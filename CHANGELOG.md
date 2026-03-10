## v0.1.3  2026-03-10

- Fixed Škoda login (400 error) — updated to current MySkoda app OAuth redirect URI
- Improved auth error messages: server response body now shown in logs for easier debugging

## v0.1.2  2026-03-10

- Added unique driver icons for Audi (red car) and Škoda (green car)
- Replaced driver images with clean white-background brand images (Audi four rings / Škoda badge)
- Fixes App Store certification review issues

## v0.1.1  2026-03-09

- Removed Volkswagen support (a dedicated VW app already exists on the App Store)
- Renamed app to **Audi Connect**
- New Audi and Škoda branding images
- Fixed app install bundle size (97 MB → 11 MB — much faster installation)

## v0.1.0  2026-03-09

### Initial release

**Supported brands**
- Audi (myAudi account)
- Volkswagen (We Connect account)
- Škoda (Škoda Connect account)

**Features**
- Lock and unlock doors remotely
- Start / stop cabin pre-conditioning with adjustable target temperature (1630 C) and window heating toggle
- Start / stop charging (EV)
- Live battery level (%) with low-battery alarm below 15 %
- Live estimated range (km)
- Charging status sensor: Charging, Fully Charged, Ready, Not Ready, Conserving
- Automatic background polling  configurable interval (260 min, default 5 min)

**Flow cards**
- Triggers: Charging started, Charging stopped
- Actions: Start pre-conditioning, Stop pre-conditioning, Start charging, Stop charging
- Condition: Car is charging

**Settings per vehicle**
- S-PIN field for models that require a Security PIN for lock/unlock
- Configurable poll interval
- Debug logging checkbox  enables verbose [DEBUG] logs in Homey Developer Tools

**Technical**
- Direct OAuth 2.0 PKCE authentication against identity.vwgroup.io  no third-party service
- Tokens stored encrypted in Homey secure device store, refreshed automatically
- Device goes unavailable after 5 consecutive poll failures and recovers automatically
- Climate command sends temperature and window-heat settings to the car before starting
