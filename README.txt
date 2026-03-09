VAG Connect lets you control your Audi, Volkswagen or Skoda directly from Homey using the official Cariad connected-car API. No extra subscriptions  just log in with your existing manufacturer account.

SUPPORTED BRANDS
- Audi (myAudi account)
- Volkswagen (We Connect account)
- Skoda (Skoda Connect account)

FEATURES
- Lock and unlock doors remotely
- Start/stop cabin pre-conditioning with adjustable target temperature (16-30 C) and window heating
- Start/stop charging (EV models)
- Live battery level (%) with low-battery alarm below 15%
- Live estimated driving range (km)
- Charging status: Charging, Fully Charged, Ready, Not Ready, Conserving
- Configurable background polling (2-60 min interval)

FLOW CARDS
- Triggers: Charging started, Charging stopped
- Actions: Start pre-conditioning, Stop pre-conditioning, Start charging, Stop charging
- Condition: Car is/is not charging

HOW TO USE
1. Make sure your car is enrolled in the connected-car service (myAudi / We Connect / Skoda Connect app).
2. In Homey, go to Devices > + > VAG Connect and choose your brand.
3. Log in with your manufacturer account email and password.
4. Your vehicles will be listed  add the one you want.

DEVICE SETTINGS
- S-PIN: Enter your 4-digit Security PIN if your car requires it for lock/unlock.
- Poll interval: How often Homey fetches data from the car (default: 5 min).
- Debug logging: Enable for verbose logs in Homey Developer Tools when troubleshooting.

PRIVACY
Your credentials are used only to obtain an OAuth access token, which is stored encrypted in Homey. Your password is never stored. All communication is directly with the official Cariad API (emea.bff.cariad.digital).
