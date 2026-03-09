'use strict';

const Homey = require('homey');

class AudiApp extends Homey.App {

  async onInit() {
    this.log('Audi Connect app has been initialized');
    this._registerFlowCards();
  }

  _registerFlowCards() {
    // ---- Actions ----
    this.homey.flow.getActionCard('start_climate')
      .registerRunListener(async ({ device }) => device.startClimate());

    this.homey.flow.getActionCard('stop_climate')
      .registerRunListener(async ({ device }) => device.stopClimate());

    this.homey.flow.getActionCard('start_charging')
      .registerRunListener(async ({ device }) => device.startCharging());

    this.homey.flow.getActionCard('stop_charging')
      .registerRunListener(async ({ device }) => device.stopCharging());

    // ---- Conditions ----
    this.homey.flow.getConditionCard('is_charging')
      .registerRunListener(async ({ device }) => {
        const status = device.getCapabilityValue('charging_status');
        return status === 'charging';
      });
  }

}

module.exports = AudiApp;
