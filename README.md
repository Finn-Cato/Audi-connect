# VAG Connect for Homey

Control your **Audi**, **Volkswagen** or **Škoda** directly from Homey — lock/unlock doors, start remote pre-heating, monitor battery and charging status, and more. No extra account or subscription needed — you log in with your own manufacturer account.

---

## 🚗 Supported Brands

| Brand | Account needed | App used to log in |
|-------|---------------|--------------------|
| Audi | myAudi account | myAudi app |
| Volkswagen | We Connect account | We Connect app |
| Škoda | Škoda Connect account | MyŠkoda app |

All three brands share the same VAG Group / Cariad connected-car backend (`emea.bff.cariad.digital`), so the same features are available across all of them.

---

## ✅ Features

- 🔒 **Lock / Unlock** doors remotely
- 🌡️ **Start / Stop pre-conditioning** (heat or cool the cabin before you get in)
- 🌡️ **Set cabin target temperature** (16–30 °C)
- 🪟 **Window heating** toggle
- 🔋 **Battery level** (%) with low-battery alarm
- 📏 **Estimated range** (km)
- ⚡ **Charging status** (Charging / Fully Charged / Ready / Not ready / Conserving)
- 🔄 **Automatic polling** — status updates every 5 minutes (configurable)
- 📲 **Flow support** — trigger flows on charging started/stopped or use actions to start/stop charging and climate

---

## 📲 How to add your car to Homey

### Step 1 — Make sure your car is enrolled in the connected-car service

Before anything will work, your car must be activated in your manufacturer's app:

- **Audi**: Download **myAudi** and connect your car using your myAudi account. Verify you can see live data (lock status, battery etc.) inside the myAudi app.
- **VW**: Download **We Connect** and activate connected services for your car.
- **Škoda**: Download **MyŠkoda** and activate Škoda Connect.

If you can't see live data in the official app, this Homey app won't work either.

### Step 2 — Add the device in Homey

1. Open the **Homey** app on your phone.
2. Tap **Devices** → the **+** button → search for **VAG Connect** (or Audi Connect).
3. Choose your brand: **Audi Vehicle**, **Volkswagen Vehicle**, or **Škoda Vehicle**.
4. Enter your **email and password** — the same credentials you use in the myAudi / We Connect / MyŠkoda app.
5. Your cars will appear in a list — tap the one you want and tap **Add**.

That's it. Your car is now a device in Homey.

### Step 3 — (Optional) Configure per-vehicle settings

Tap your car in Homey → **Settings** → you can:

| Setting | What it does |
|---------|-------------|
| **S-PIN** | Some models require a 4-digit Security PIN to lock/unlock. Leave blank if not needed. |
| **Poll interval** | How often Homey fetches live data from the car (default: every 5 min, min: 2 min). |

---

## 🏗️ How it works (technical)

This app communicates directly with the Cariad / VAG Group connected-car API — the same backend that powers the manufacturer apps. No third-party service or paid API subscription is involved.

**Authentication flow:**
1. You enter your credentials in the Homey pair wizard.
2. The app performs an OAuth 2.0 PKCE login against `identity.vwgroup.io`.
3. An access token is returned and stored **encrypted** in Homey's secure device store.
4. All subsequent API calls use this token — your password is never stored.
5. Tokens are refreshed automatically when they expire.

**Key API endpoints used:**
- Auth: `identity.vwgroup.io`
- Token exchange: `emea.bff.cariad.digital/login/v1/{brand}/token`
- Vehicle list: `app-api.live-my.audi.com/vgql/v1/graphql`
- Status: `emea.bff.cariad.digital/vehicle/v1/vehicles/{vin}/selectivestatus`
- Commands: `emea.bff.cariad.digital/vehicle/v1/vehicles/{vin}/{resource}/{action}`

---

## ⚠️ Limitations

- A **cellular or Wi-Fi connection** on the car side is required for commands to reach the vehicle. If your car is parked in a basement with no signal, commands may time out.
- **Response time** for remote commands (lock, climate start) typically takes 5–30 seconds for the car to actually respond — this is a limitation of the VAG API, not Homey.
- **Not all cars support all features.** Older models or non-EV models may not report battery/charging data.
- The VAG API is **unofficially reverse-engineered**. Manufacturer app updates can occasionally break compatibility.

---

## 🛠️ Development

```bash
git clone https://github.com/Finn-Cato/Audi-connect
cd Audi-connect
npm install
homey app install   # install on your local Homey for testing
```

Requires [Homey CLI](https://apps.developer.homey.app/the-basics/getting-started) and Node.js ≥ 18.

---

## 📄 License

MIT

---

## 🚗 Features

### 🔐 Remote Actions
- Lock & unlock doors
- Start pre-heating / remote climate
- Start or stop charging (EV only)

### ⚡ EV Data
- State of Charge (SoC)
- Estimated range
- Charging status (plugged, charging, completed)
- Charge limit (read & set)

### 📊 Additional Vehicle Data
- Odometer
- Location (if user grants permission)
- Fuel level for hybrid models
- VIN, model info, year

All data is fetched securely from Audi's connected services via official API partners.

---

## 🧩 Supported API Platforms

### 1. Smartcar (recommended)
Smartcar provides an Audi-compatible API that allows users to log in with their **Audi Connect account**, granting the app access to their vehicle after explicit consent.  
Supports:
- Lock/unlock  
- Battery %  
- Charging control  
- Pre-condition (heat)  
- Vehicle attributes  
- Wide Audi model support  
[2](https://smartcar.com/brand/audi)

### 2. High Mobility – Audi Data API
High Mobility is an official connected-car data platform with Audi integration.  
Good for accessing:
- Battery level  
- EV energy data  
- Diagnostics  
- Location  
- Charging data  
[1](https://www.high-mobility.com/car-api/audi-data-api)

➡️ Both platforms offer **free sandbox tiers** for development.  
➡️ Users authenticate using their **own Audi account**, so no extra account is needed.

---

## 🔐 Authentication Flow

The user connects their car by:
1. Opening the Homey app settings.
2. Clicking "Connect Audi".
3. Being redirected to Smartcar or High Mobility login.
4. Logging in using their **myAudi credentials**.
5. Granting permissions for vehicle control and data access.

The API returns an OAuth token used for secure calls.

No credentials are stored in the Homey app.

---

## 🏗️ Technical Architecture
