'use strict';

const Homey = require('homey');
const AudiApi = require('../../lib/AudiApi');

const MS_PER_MINUTE = 60 * 1000;
const MIN_POLL_MS = 2 * MS_PER_MINUTE;

class AudiDevice extends Homey.Device {

  async onInit() {
    this.log('AudiDevice init:', this.getData().vin);
    this._vin = this.getData().vin;
    this._api = new AudiApi();
    this._prevChargingState = null;

    // Restore tokens from encrypted store
    const tokens = await this.getStoreValue('tokens');
    if (tokens) this._api.setTokens(tokens);

    // Capability listeners
    this.registerCapabilityListener('locked', this._onLockToggle.bind(this));

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
    if (batt?.currentSoCInPercent !== undefined) {
      await this._set('measure_battery', batt.currentSoCInPercent);
      await this._set('alarm_battery', batt.currentSoCInPercent < 15);
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
      await this._set('charging_status', chargingState);
      this._fireChargingTriggers(chargingState);
    }

    // ── Lock state ──
    const doorLock = data?.access?.accessStatus?.value?.doorLockStatus;
    if (doorLock !== undefined) {
      await this._set('locked', doorLock === 'locked');
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
