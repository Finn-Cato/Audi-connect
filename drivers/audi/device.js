'use strict';

const Homey = require('homey');
const AudiApi = require('../../lib/AudiApi');

const MS_PER_MINUTE = 60 * 1000;
const MIN_POLL_MS = 2 * MS_PER_MINUTE;

class AudiDevice extends Homey.Device {

  async onInit() {
    this.log('AudiDevice init:', this.getData().vin);
    this._vin = this.getData().vin;
    const brand = await this.getStoreValue('brand') || 'audi';
    this._api = new AudiApi(brand);
    this._prevChargingState = null;
    this._lastClimateSettings = null; // cached from last poll

    // Restore tokens from encrypted store
    const tokens = await this.getStoreValue('tokens');
    if (tokens) this._api.setTokens(tokens);

    // Capability listeners
    this.registerCapabilityListener('locked', this._onLockToggle.bind(this));
    this.registerCapabilityListener('climate_on', this._onClimateToggle.bind(this));
    this.registerCapabilityListener('climate_temperature', this._onTemperatureSet.bind(this));
    this.registerCapabilityListener('climate_window_heat', this._onWindowHeatToggle.bind(this));

    // Start polling
    this._startPolling();

    // Initial poll (non-fatal)
    await this._poll().catch(err => this.error('Initial poll error:', err.message));
  }

  // ── Polling ───────────────────────────────────────────────────────────────

  _startPolling() {
    this._stopPolling();
    const intervalMin = Math.max(Number(this.getSetting('poll_interval')) || 5, 2);
    this._pollTimer = this.homey.setInterval(this._poll.bind(this), intervalMin * MS_PER_MINUTE);
  }

  _stopPolling() {
    if (this._pollTimer) {
      this.homey.clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  async _poll() {
    try {
      const status = await this._api.getVehicleStatus(this._vin);
      await this._applyStatus(status);
      await this.setAvailable();
    } catch (err) {
      if (err.response?.status === 401) {
        // Attempt token refresh once
        try {
          await this._api.refreshTokens();
          await this.setStoreValue('tokens', this._api.getTokenStore());
          const status = await this._api.getVehicleStatus(this._vin);
          await this._applyStatus(status);
          await this.setAvailable();
        } catch (innerErr) {
          this.error('Token refresh failed:', innerErr.message);
          await this.setUnavailable(this.homey.__('device.reauth_required'));
        }
      } else {
        this.error('Poll error:', err.message);
      }
    }
  }

  // ── Capability mapping ────────────────────────────────────────────────────

  async _applyStatus(data) {
    // ── EV battery ──
    const batt = data?.charging?.batteryStatus?.value;
    if (batt !== undefined) {
      // API returns currentSOC_pct (EV battery)
      const soc = batt.currentSOC_pct ?? batt.currentSoCInPercent;
      if (soc !== undefined) {
        await this._set('measure_battery', soc);
        await this._set('alarm_battery', soc < 15);
      }
      const rangeKm = batt.cruisingRangeElectric_km ?? batt.cruisingRangeElectricInKilometers ?? 0;
      await this._set('measure_range', rangeKm);
    }

    // ── Fuel (ICE / PHEV primary engine) – only when no EV battery reported ──
    const fuel = data?.fuelStatus?.rangeStatus?.value;
    if (fuel && batt === undefined) {
      const pct = fuel.primaryEngine?.currentFuelLevel_pct ?? fuel.primaryEngine?.currentSOC_pct ?? 0;
      const km  = fuel.primaryEngine?.remainingRangeInKm ?? 0;
      await this._set('measure_battery', pct);
      await this._set('alarm_battery', pct < 10);
      await this._set('measure_range', km);
    }

    // ── Charging state ──
    const chargingState = data?.charging?.chargingStatus?.value?.chargingState;
    if (chargingState !== undefined) {
      await this._set('charging_status', this._normalizeChargingState(chargingState));
      this._fireChargingTriggers(chargingState);
    }

    // ── Lock state ──
    const doorLock = data?.access?.accessStatus?.value?.doorLockStatus;
    if (doorLock !== undefined) {
      await this._set('locked', doorLock === 'locked');
    }

    // ── Climate state ──
    const climateState = data?.climatisation?.climatisationStatus?.value?.climatisationState;
    if (climateState !== undefined) {
      await this._set('climate_on', climateState !== 'off');
    }

    // ── Climate settings ──
    const climateSettings = data?.climatisation?.climatisationSettings?.value;
    if (climateSettings) {
      this._lastClimateSettings = climateSettings; // cache full object for next start
      if (climateSettings.targetTemperature_C !== undefined)
        await this._set('climate_temperature', climateSettings.targetTemperature_C);
      if (climateSettings.windowHeatingEnabled !== undefined)
        await this._set('climate_window_heat', climateSettings.windowHeatingEnabled);
    }
  }

  async _set(capability, value) {
    try {
      await this.setCapabilityValue(capability, value);
    } catch (err) {
      this.error(`setCapabilityValue(${capability}) failed:`, err.message);
    }
  }

  _fireChargingTriggers(newState) {
    if (this._prevChargingState === newState) return;
    const prev = this._prevChargingState;
    this._prevChargingState = newState;

    if (prev === null) return; // skip on very first poll

    if (newState === 'charging') {
      this.homey.flow.getDeviceTriggerCard('charging_started')
        .trigger(this, {}, {})
        .catch(this.error);
    }
    if (prev === 'charging' && newState !== 'charging') {
      this.homey.flow.getDeviceTriggerCard('charging_stopped')
        .trigger(this, {}, {})
        .catch(this.error);
    }
  }

  // ── Climate capability listener ─────────────────────────────────────────────

  async _onClimateToggle(value) {
    if (value) {
      // Send current slider/toggle values to the car when turning ON
      const temp    = this.getCapabilityValue('climate_temperature') ?? 22;
      const winHeat = this.getCapabilityValue('climate_window_heat') ?? false;
      await this._api.startClimate(this._vin, temp, winHeat, this._lastClimateSettings);
    } else {
      await this._api.stopClimate(this._vin);
    }
  }

  async _onTemperatureSet(/* value */) {
    // Just save locally — applied next time climate is turned ON
  }

  async _onWindowHeatToggle(/* value */) {
    // Just save locally — applied next time climate is turned ON
  }

  // ── Charging state normalizer ─────────────────────────────────────────────
  // The Cariad API returns verbose strings that must map to our enum IDs.
  _normalizeChargingState(raw) {
    if (!raw) return 'invalid';
    const s = raw.toLowerCase();
    if (s === 'charging') return 'charging';
    if (s.includes('conservation') || s.includes('conserving')) return 'conserving';
    if (s.includes('chargepurposereached') || s.includes('charged') || s.includes('fullycharge')) return 'charged';
    if (s === 'readyforcharging') return 'readyForCharging';
    if (s === 'notreadyforcharging') return 'notReadyForCharging';
    if (s === 'error' || s === 'invalid' || s === 'fault') return 'invalid';
    // Unknown value — log it and fall back so the enum never breaks
    this.log('Unknown chargingState from API:', raw);
    return 'invalid';
  }

  // ── Lock capability listener ───────────────────────────────────────────────

  async _onLockToggle(shouldLock) {
    const spin = this.getSetting('spin') || null;
    if (shouldLock) {
      await this._api.lock(this._vin, spin);
    } else {
      await this._api.unlock(this._vin, spin);
    }
  }

  // ── Remote actions (called by flow-card listeners in app.js) ─────────────

  async startClimate()  { return this._api.startClimate(this._vin); }
  async stopClimate()   { return this._api.stopClimate(this._vin); }
  async startCharging() { return this._api.startCharging(this._vin); }
  async stopCharging()  { return this._api.stopCharging(this._vin); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async onAdded() {
    this.log('AudiDevice added:', this._vin);
    // Persist the VIN in settings for display in the UI
    await this.setSettings({ vin: this._vin }).catch(() => {});
  }

  async onDeleted() {
    this._stopPolling();
    this.log('AudiDevice deleted:', this._vin);
  }

  async onSettings({ changedKeys }) {
    if (changedKeys.includes('poll_interval')) {
      this._startPolling(); // restart with new interval
    }
  }

}

module.exports = AudiDevice;
