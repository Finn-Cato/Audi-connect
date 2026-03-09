'use strict';

const Homey = require('homey');
const AudiApi = require('../../lib/AudiApi');

class AudiDriver extends Homey.Driver {

  async onInit() {
    this.log('AudiDriver has been initialized');
  }

  async onPair(session) {
    let api = null;
    let tokens = null;

    // Called when the user submits the login_credentials form
    session.setHandler('login', async ({ username, password }) => {
      api = new AudiApi();
      try {
        tokens = await api.login(username, password);
        this.log('Login successful');
        return true;
      } catch (err) {
        this.error('Login error:', err.message);
        throw new Error(this.homey.__('pair.login_failed') + ' — ' + err.message);
      }
    });

    // Called to populate the list_devices view
    session.setHandler('list_devices', async () => {
      if (!api || !tokens) throw new Error('Not logged in');
      const vehicles = await api.getVehicles();

      return vehicles.map(v => ({
        name: v.nickname || `Audi (${v.vin})`,
        data: { vin: v.vin },
        store: { tokens },
        settings: {
          vin: v.vin,
          spin: '',
          poll_interval: 5,
        },
      }));
    });
  }

}

module.exports = AudiDriver;
