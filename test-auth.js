'use strict';
const AudiApi = require('./lib/AudiApi');

// ── Set your myAudi credentials here ──────────────────────────────────────────
const USERNAME = 'your@email.com';
const PASSWORD = 'yourpassword';
// ──────────────────────────────────────────────────────────────────────────────

if (USERNAME === 'your@email.com') {
  console.error('Edit test-auth.js and set your USERNAME and PASSWORD first.');
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
    console.log('\n--- PARSED VALUES ---');
    const batt = status?.charging?.batteryStatus?.value;
    const charging = status?.charging?.chargingStatus?.value;
    const fuel = status?.fuelStatus?.rangeStatus?.value;
    const lock = status?.access?.accessStatus?.value;
    console.log('Battery SoC:', batt?.currentSoCInPercent, '% (field: charging.batteryStatus.value.currentSoCInPercent)');
    console.log('Range km:   ', batt?.cruisingRangeElectric_km ?? batt?.cruisingRangeElectricInKilometers, '(charging path)');
    console.log('Fuel SoC:   ', fuel?.primaryEngine?.currentFuelLevel_pct ?? fuel?.primaryEngine?.currentSOC_pct, '% (fuel path)');
    console.log('Fuel range: ', fuel?.primaryEngine?.remainingRangeInKm, 'km');
    console.log('Charging:   ', charging?.chargingState);
    console.log('Door lock:  ', lock?.doorLockStatus);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    if (err.response) console.error('  Status:', err.response.status, '\n  Data:', JSON.stringify(err.response.data).slice(0, 500));
  });


