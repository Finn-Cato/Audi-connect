# Audi Control for Homey
A Homey app that integrates with Audi vehicles using the official Audi-compatible API from either **Smartcar** or **High Mobility**.  
The app enables door lock/unlock, remote climate control, battery status monitoring, charging information, and more — all through the user's own Audi login.

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
