# VAG Connect for Homey

Control your **Audi**, **Volkswagen** or **Škoda** directly from Homey  lock/unlock doors, start remote pre-heating, monitor battery and charging status, and more. No extra account or subscription needed  you log in with your own manufacturer account.

---

## Supported Brands

| Brand | Account needed | Official app |
|-------|---------------|--------------|
| Audi | myAudi account | myAudi |
| Volkswagen | We Connect account | We Connect |
| Škoda | Škoda Connect account | MyŠkoda |

All three brands share the same VAG Group / Cariad connected-car backend (`emea.bff.cariad.digital`), so the same features are available across all of them.

---

## Features

- **Lock / Unlock** doors remotely
- **Start / Stop pre-conditioning** (heat or cool the cabin before you get in)
- **Set cabin target temperature** (1630 C in 0.5 C steps)
- **Window heating** toggle
- **Battery level** (%) with low-battery alarm (< 15 %)
- **Estimated range** (km)
- **Charging status**  Charging / Fully Charged / Ready / Not ready / Conserving
- **Automatic polling**  status updates on a configurable interval (default: 5 min, minimum: 2 min)
- **Flow support**  trigger flows on *charging started* / *charging stopped*, or use action cards to start/stop charging and climate

---

## How to add your car to Homey

### Step 1  Enrol your car in the connected-car service

Before anything will work, your car must be active in your manufacturer's app:

- **Audi**: Download **myAudi** and connect your car. Verify you can see live data (lock status, battery, etc.) in the app.
- **VW**: Download **We Connect** and activate connected services for your car.
- **Škoda**: Download **MyŠkoda** and activate Škoda Connect.

If live data does not appear in the official app, this Homey app will not work either.

### Step 2  Add the device in Homey

1. Open the **Homey** app  **Devices**  tap **+**.
2. Search for **VAG Connect**.
3. Choose your brand: **Audi Vehicle**, **Volkswagen Vehicle**, or **Škoda Vehicle**.
4. Enter your **email and password**  the same credentials used in the myAudi / We Connect / MyŠkoda app.
5. Your cars appear  tap the one you want and tap **Add**.

### Step 3  (Optional) Configure per-vehicle settings

Tap your car  **Settings** to adjust:

| Setting | Description |
|---------|-------------|
| **S-PIN** | Some models require a 4-digit Security PIN for lock/unlock. Enter it here if your car has one set. Leave blank otherwise. |
| **Poll interval (minutes)** | How often Homey fetches live data from the car (default: 5 min, min: 2 min). |
| **Debug logging** | When enabled, detailed logs appear in [Homey Developer Tools](https://tools.developer.homey.app/). Turn on temporarily for troubleshooting, off in normal use. |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Lock/unlock fails with "S-PIN required" | Car has S-PIN enabled | Go to device Settings  enter your 4-digit S-PIN |
| Device shows "Unavailable" | Token expired or credentials changed | Re-pair the device (remove and add again) |
| Battery / range not updating | Car is asleep or out of coverage | Wait for next poll or open the manufacturer app to wake the car |
| Climate sets wrong temperature | Target temperature slider not saved | Adjust the **Target Temperature** slider in Homey before starting climate |

**To diagnose any issue:** enable **Debug logging** in device settings, then open [Homey Developer Tools](https://tools.developer.homey.app/)  Logs. Every poll, command, token refresh, and capability write will appear with a `[DEBUG]` prefix.

---

## How it works (technical)

This app communicates directly with the Cariad / VAG Group connected-car API  the same backend that powers the official manufacturer apps. No third-party service or paid API subscription is involved.

### Authentication flow

1. You enter your credentials in the Homey pair wizard.
2. The app performs an **OAuth 2.0 PKCE** login against `identity.vwgroup.io`.
3. An access token is returned and stored **encrypted** in Homey's secure device store.
4. All subsequent API calls use this token  your password is never stored.
5. Tokens are refreshed automatically when they expire.

### Key API endpoints

| Purpose | Endpoint |
|---------|---------|
| Auth | `identity.vwgroup.io/oidc/v1/authorize` |
| Token exchange | `emea.bff.cariad.digital/login/v1/{brand}/token` |
| Vehicle list (Audi) | `app-api.live-my.audi.com/vgql/v1/graphql` |
| Vehicle list (VW/Škoda) | `emea.bff.cariad.digital/vehicle/v1/vehicles` |
| Status | `emea.bff.cariad.digital/vehicle/v1/vehicles/{vin}/selectivestatus` |
| Commands | `emea.bff.cariad.digital/vehicle/v1/vehicles/{vin}/{resource}/{action}` |

---

## Limitations

- A **cellular or Wi-Fi connection on the car** is required for commands to reach it. If the car is in a basement with no signal, commands may time out.
- **Command response time** is typically 530 seconds  this is a VAG API limitation, not Homey.
- **Not all cars support all features.** Older or non-EV models may not report battery/charging data.
- The VAG API is reverse-engineered from the mobile apps. Manufacturer updates can occasionally break compatibility.

---

## Development

```bash
git clone https://github.com/Finn-Cato/Audi-connect
cd Audi-connect
npm install
homey app install   # install on your local Homey for testing
```

Requires [Homey CLI](https://apps.developer.homey.app/the-basics/getting-started) and Node.js >= 18.

---

## License

MIT
