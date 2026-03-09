'use strict';

const Homey = require('homey');
const AudiApi = require('../../lib/AudiApi');

class SkodaDriver extends Homey.Driver {

  async onInit() {
    this.log('SkodaDriver has been initialized');
  }

  async onPair(session) {
    let api = null;
    let tokens = null;

    session.setHandler('login', async ({ username, password }) => {
      api = new AudiApi('skoda');
      try {
        tokens = await api.login(username, password);
        this.log('Skoda login successful');
        return true;
      } catch (err) {
        this.error('Skoda login error:', err.message);
        throw new Error(this.homey.__('pair.login_failed') + ' — ' + err.message);
      }
    });

    session.setHandler('list_devices', async () => {
      if (!api || !tokens) throw new Error('Not logged in');
      const vehicles = await api.getVehicles();

      return vehicles.map(v => ({
        name: v.nickname || `Škoda (${v.vin})`,
        data: { vin: v.vin },
        store: { tokens, brand: 'skoda' },
        settings: {
          vin: v.vin,
          spin: '',
          poll_interval: 5,
        },
      }));
    });
  }

}

module.exports = SkodaDriver;
