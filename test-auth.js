'use strict';
const AudiApi = require('./lib/AudiApi');

// ── Credentials: set via env vars or edit below ────────────────────────────────
// Usage:  $env:AUDI_USER="you@email.com"; $env:AUDI_PASS="yourpass"; node test-auth.js
const USERNAME = process.env.AUDI_USER || 'your@email.com';
const PASSWORD = process.env.AUDI_PASS || 'yourpassword';
// ──────────────────────────────────────────────────────────────────────────────

if (USERNAME === 'your@email.com') {
  console.error('Provide credentials via env vars:');
  console.error('  $env:AUDI_USER="you@email.com"; $env:AUDI_PASS="yourpass"; node test-auth.js');
  process.exit(1);
}

const api = new AudiApi();
console.log('Logging in...');
api.login(USERNAME, PASSWORD)
  .then(tokens => {
    console.log('✅ Login OK — access token (first 40):', tokens.accessToken?.slice(0, 40));
    return api.getVehicles();
  })
  .then(async vehicles => {
    console.log('\n✅ Vehicles:', vehicles.length);
    for (const v of vehicles) {
      console.log(' -', v.vin, v.nickname || '');
    }
    if (!vehicles.length) return;

    const vin = vehicles[0].vin;
    console.log('\nFetching status for', vin, '...');
    const status = await api.getVehicleStatus(vin);

    // Print raw status so we can see the exact field names
    console.log('\n--- RAW STATUS ---');
    console.log(JSON.stringify(status, null, 2).slice(0, 4000));

    // Show what our parser would extract
    console.log('\n--- PARSED VALUES (mirrors device.js _applyStatus) ---');
    const batt = status?.charging?.batteryStatus?.value;
    const charging = status?.charging?.chargingStatus?.value;
    const fuel = status?.fuelStatus?.rangeStatus?.value;
    const lock = status?.access?.accessStatus?.value;

    // EV battery (same priority as device.js)
    const soc = batt?.currentSOC_pct ?? batt?.currentSoCInPercent;
    const rangeKm = batt?.cruisingRangeElectric_km ?? batt?.cruisingRangeElectricInKilometers ?? 0;
    console.log('Battery SoC (EV):  ', soc, '%');
    console.log('  ↳ raw batt obj:  ', JSON.stringify(batt));
    console.log('EV range km:       ', rangeKm);

    // Fuel / PHEV (only used by device.js when no EV battery reported)
    const fuelPct = fuel?.primaryEngine?.currentFuelLevel_pct ?? fuel?.primaryEngine?.currentSOC_pct;
    const fuelKm  = fuel?.primaryEngine?.remainingRangeInKm;
    console.log('Fuel SoC:          ', fuelPct, '%');
    console.log('Fuel range km:     ', fuelKm);
    console.log('  ↳ raw fuel obj:  ', JSON.stringify(fuel));

    console.log('Charging state:    ', charging?.chargingState);
    console.log('Door lock:         ', lock?.doorLockStatus);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    if (err.response) console.error('  Status:', err.response.status, '\n  Data:', JSON.stringify(err.response.data).slice(0, 500));
  });


