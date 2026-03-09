'use strict';

const axios = require('axios');
const qs = require('qs');
const crypto = require('crypto');

// ── VAG Group shared constants ────────────────────────────────────────────────
const SCOPE = 'address badge birthdate birthplace email gallery mbb name nationalIdentifier nationality nickname phone picture profession profile vin openid';
const IDK_TOKEN_URL = 'https://emea.bff.cariad.digital/login/v1/idk/token';
const VW_TOKEN_URL = 'https://mbboauth-1d.prd.ece.vwg-connect.com/mbbcoauth/mobile/oauth2/v1/token';
const VEHICLES_URL = 'https://app-api.live-my.audi.com/vgql/v1/graphql';
const STATUS_BASE = 'https://emea.bff.cariad.digital/vehicle/v1/vehicles';

// ── Per-brand configuration ────────────────────────────────────────────────────
const BRAND_CONFIGS = {
  audi: {
    clientId:       'f4d0934f-32bf-4ce4-b3c4-699a7049ad26@apps_vw-dilab_com',
    redirectUri:    'myaudi:///',
    xclientId:      '59edf286-a9ca-4d34-9421-68da00f72dc8',
    appTokenUrl:    'https://emea.bff.cariad.digital/login/v1/audi/token',
    appTokenConfig: 'myaudi',
    userAgent:      'myAudi-Android/4.14.1',
    appVersion:     '4.14.1',
    appName:        'myAudi',
  },
  vw: {
    clientId:       'a24fba63-34a3-4d8a-a54a-7baa85f13eb0@apps_vw-dilab_com',
    redirectUri:    'weconnect://authenticated',
    xclientId:      'd8e4e60fc564b4a2aed6cb54e8b67bbb',
    appTokenUrl:    'https://emea.bff.cariad.digital/login/v1/vw/token',
    appTokenConfig: 'myvw',
    userAgent:      'WeConnect-android/5.1.2',
    appVersion:     '5.1.2',
    appName:        'WeConnect',
  },
  skoda: {
    clientId:       '7f045eee-7003-4379-9968-9355ed2adb06@apps_vw-dilab_com',
    redirectUri:    'skodaconnect://authenticated',
    xclientId:      'de2f9d0b-c6e2-4f36-89b5-8e7e1f7e8b4d',
    appTokenUrl:    'https://emea.bff.cariad.digital/login/v1/skoda/token',
    appTokenConfig: 'myskoda',
    userAgent:      'MySkoda-android/3.2.0',
    appVersion:     '3.2.0',
    appName:        'MySkoda',
  },
};

// ── Simple cookie jar ─────────────────────────────────────────────────────────
class CookieJar {
  constructor() { this._jar = new Map(); }

  ingest(headers) {
    const raw = headers['set-cookie'];
    if (!raw) return;
    for (const c of Array.isArray(raw) ? raw : [raw]) {
      const kv = c.split(';')[0];
      const eq = kv.indexOf('=');
      if (eq > 0) this._jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
    }
  }

  header() {
    return [...this._jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

// ── AudiApi ───────────────────────────────────────────────────────────────────
class AudiApi {
  constructor(brand = 'audi') {
    this._brand = brand;
    this._cfg = BRAND_CONFIGS[brand] || BRAND_CONFIGS.audi;
    this._accessToken = null;
    this._refreshToken = null;
    this._audiToken = null;
    this._vwToken = null;
    this._vwRefreshToken = null;
  }

  // ── PKCE ──────────────────────────────────────────────────────────────────

  _generatePKCE() {
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  // ── QM-Auth header (HMAC-SHA256) ──────────────────────────────────────────

  _qmAuth() {
    const ts = Math.floor(Date.now() / 100000).toString();
    const secret = Buffer.from([
      26, 182, 153, 37, 172, 23, 154, 170,
      78, 131, 171, 230, 113, 169, 71, 109,
      23, 100, 24, 184, 91, 215, 6, 241,
      67, 108, 161, 91, 230, 71, 152, 156,
    ]);
    const hash = crypto.createHmac('sha256', secret).update(ts).digest('hex');
    return `v1:01da27b0:${hash}`;
  }

  // ── Form parsing helpers ──────────────────────────────────────────────────

  _parseHiddenFields(html) {
    const out = {};
    const re = /<input[^>]+type=["']hidden["'][^>]*/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const name = /name=["']([^"']+)["']/.exec(m[0]);
      const value = /value=["']([^"']*)["']/.exec(m[0]);
      if (name) out[name[1]] = value ? value[1] : '';
    }
    return out;
  }

  _between(str, start, end) {
    const i = str.indexOf(start);
    if (i === -1) return '';
    const j = str.indexOf(end, i + start.length);
    return j === -1 ? '' : str.slice(i + start.length, j);
  }

  // ── Low-level HTTP (manual redirect control + cookie jar) ─────────────────

  async _fetch(method, url, opts = {}, jar) {
    const headers = {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'de-de',
      ...opts.headers,
    };
    const cookie = jar.header();
    if (cookie) headers['Cookie'] = cookie;

    try {
      const resp = await axios({
        method,
        url,
        headers,
        data: opts.body,
        maxRedirects: opts.maxRedirects ?? 10,
        validateStatus: opts.validateStatus ?? ((s) => s < 400),
        responseType: 'text',
        decompress: true,
      });
      jar.ingest(resp.headers || {});
      return resp;
    } catch (err) {
      if (err.response) jar.ingest(err.response.headers || {});
      throw err;
    }
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(username, password) {
    const jar = new CookieJar();
    const { verifier, challenge } = this._generatePKCE();
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = crypto.randomBytes(16).toString('hex');

    const authUrl = 'https://identity.vwgroup.io/oidc/v1/authorize'
      + `?client_id=${encodeURIComponent(this._cfg.clientId)}`
      + `&scope=${encodeURIComponent(SCOPE)}`
      + `&response_type=code`
      + `&redirect_uri=${encodeURIComponent(this._cfg.redirectUri)}`
      + `&nonce=${nonce}`
      + `&state=${state}`
      + `&code_challenge=${challenge}`
      + `&code_challenge_method=S256`;

    // Step 1 – load the login page
    const loginPage = await this._fetch('GET', authUrl, {
      headers: { 'Accept': 'text/html,*/*' },
      maxRedirects: 10,
    }, jar);

    const body = loginPage.data;

    let code;
    if (typeof body === 'string' && body.includes('emailPasswordForm')) {
      code = await this._legacyLogin(jar, body, username, password, verifier);
    } else {
      // New Auth0-style universal login – find state token
      const stateMatch = body.match(/state=([A-Za-z0-9_-]{20,})/);
      if (stateMatch) {
        code = await this._newLogin(jar, stateMatch[1], username, password, verifier);
      } else {
        throw new Error('Unrecognised login page format. The myAudi authentication flow may have changed.');
      }
    }

    return this._exchangeCode(code, verifier);
  }

  // Legacy form-based flow (email → password form)
  async _legacyLogin(jar, pageBody, username, password, verifier) {
    const form = this._parseHiddenFields(pageBody);
    form.email = username;

    const emailResp = await this._fetch('POST',
      `https://identity.vwgroup.io/signin-service/v1/${this._cfg.clientId}/login/identifier`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: qs.stringify(form),
        maxRedirects: 5,
      }, jar);

    const body2 = emailResp.data;
    const pwForm = {
      _csrf: this._between(body2, "csrf_token: '", "'"),
      email: username,
      password,
      hmac: this._between(body2, '"hmac":"', '"'),
      relayState: this._between(body2, '"relayState":"', '"'),
    };

    const authResp = await this._fetch('POST',
      `https://identity.vwgroup.io/signin-service/v1/${this._cfg.clientId}/login/authenticate`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: qs.stringify(pwForm),
        maxRedirects: 0,
        validateStatus: (s) => s < 500,
      }, jar);

    return this._followToCode(jar, authResp, 0);
  }

  // New Auth0 universal-login flow
  async _newLogin(jar, stateToken, username, password, verifier) {
    const resp = await this._fetch('POST',
      `https://identity.vwgroup.io/u/login?state=${stateToken}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: qs.stringify({ username, password, state: stateToken }),
        maxRedirects: 0,
        validateStatus: (s) => s < 500,
      }, jar);

    return this._followToCode(jar, resp, 0);
  }

  // Follow HTTP 302s until brand redirect URI and extract ?code=
  async _followToCode(jar, resp, depth) {
    if (depth > 15) throw new Error('Auth redirect loop exceeded');
    const location = resp.headers?.location || '';
    const scheme = this._cfg.redirectUri.split(':')[0] + ':';

    if (location.startsWith(scheme)) {
      const m = location.match(/[?#&]code=([^&]+)/);
      if (m) return decodeURIComponent(m[1]);
      throw new Error('No code in redirect: ' + location);
    }

    if (location) {
      const next = location.startsWith('http') ? location : 'https://identity.vwgroup.io' + location;
      const nextResp = await this._fetch('GET', next, {
        headers: { 'Accept': 'text/html,*/*' },
        maxRedirects: 0,
        validateStatus: (s) => s < 500,
      }, jar);
      return this._followToCode(jar, nextResp, depth + 1);
    }

    throw new Error('Auth flow ended without a myaudi:/// redirect (status ' + resp.status + ')');
  }

  // ── Token exchange ────────────────────────────────────────────────────────

  async _exchangeCode(code, verifier) {
    // Step 1 – IDK token
    const idkResp = await axios.post(IDK_TOKEN_URL,
      qs.stringify({
        client_id: this._cfg.clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this._cfg.redirectUri,
        response_type: 'token id_token',
        code_verifier: verifier,
      }),
      {
        headers: {
          'accept': 'application/json',
          'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
          'x-qmauth': this._qmAuth(),
          'user-agent': this._cfg.userAgent,
        },
      });

    this._accessToken = idkResp.data.access_token;
    this._refreshToken = idkResp.data.refresh_token;
    const idToken = idkResp.data.id_token;

    // Step 2 – brand app token (optional; used for myAudi GraphQL vehicle list)
    try {
      const audiResp = await axios.post(this._cfg.appTokenUrl,
        JSON.stringify({ token: this._accessToken, grant_type: 'id_token', stage: 'live', config: this._cfg.appTokenConfig }),
        {
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json; charset=utf-8',
            'x-app-version': this._cfg.appVersion,
            'x-app-name': this._cfg.appName,
            'user-agent': this._cfg.userAgent,
          },
        });
      this._audiToken = audiResp.data;
    } catch (_) {
      // App token is optional; IDK token is sufficient for status/command APIs
    }

    // Step 3 – VW MBB token (optional; used for legacy vehicle APIs)
    try {
      const vwResp = await axios.post(VW_TOKEN_URL,
        qs.stringify({ grant_type: 'id_token', token: idToken, scope: 'sc2:fal' }),
        {
          headers: {
            'User-Agent': this._cfg.userAgent,
            'X-App-Version': this._cfg.appVersion,
            'X-App-Name': this._cfg.appName,
            'X-Client-Id': this._cfg.xclientId,
          },
        });
      this._vwToken = vwResp.data.access_token;
      this._vwRefreshToken = vwResp.data.refresh_token;
    } catch (_) {
      // VW MBB token is optional; BFF APIs work without it
    }

    return this._tokenStore();
  }

  // ── Token refresh ─────────────────────────────────────────────────────────

  async refreshTokens() {
    const resp = await axios.post(IDK_TOKEN_URL,
      qs.stringify({
        grant_type: 'refresh_token',
        refresh_token: this._refreshToken,
        client_id: this._cfg.clientId,
      }),
      {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-qmauth': this._qmAuth(),
          'user-agent': USER_AGENT,
        },
      });
    this._accessToken = resp.data.access_token;
    if (resp.data.refresh_token) this._refreshToken = resp.data.refresh_token;
  }

  // ── Token store (plain object – safe to persist in Homey store) ───────────

  _tokenStore() {
    return {
      accessToken: this._accessToken,
      refreshToken: this._refreshToken,
      audiToken: this._audiToken,
      vwToken: this._vwToken,
      vwRefreshToken: this._vwRefreshToken,
    };
  }

  getTokenStore() { return this._tokenStore(); }

  setTokens(store) {
    if (!store) return;
    this._accessToken = store.accessToken;
    this._refreshToken = store.refreshToken;
    this._audiToken = store.audiToken;
    this._vwToken = store.vwToken;
    this._vwRefreshToken = store.vwRefreshToken;
  }

  // ── Vehicle data ──────────────────────────────────────────────────────────

  async getVehicles() {
    if (this._brand !== 'audi') {
      // VW/Skoda: use REST vehicle list endpoint (IDK token is sufficient)
      try {
        const resp = await axios.get(STATUS_BASE, {
          headers: {
            'user-agent': this._cfg.userAgent,
            'authorization': `Bearer ${this._accessToken}`,
            'accept': 'application/json',
          },
        });
        const list = Array.isArray(resp.data?.data) ? resp.data.data
                   : Array.isArray(resp.data) ? resp.data
                   : [];
        if (list.length > 0) {
          return list.map(v => ({
            vin: v.vin,
            nickname: v.nickname || v.vehicleNickname || v.vin,
            devicePlatform: v.devicePlatform,
          }));
        }
      } catch (_) {}
    }

    // Audi (and fallback): GraphQL vehicle list
    const resp = await axios.post(VEHICLES_URL,
      {
        query: `query vehicleList {
  userVehicles {
    vin
    type
    devicePlatform
    mbbConnect
    userRole { role }
    vehicle { classification { driveTrain } }
    nickname
  }
}`,
      },
      {
        headers: {
          'user-agent': this._cfg.userAgent,
          'authorization': `Bearer ${this._audiToken?.access_token || this._accessToken}`,
          'accept': 'application/json;charset=UTF-8',
          'content-type': 'application/json',
        },
      });
    return resp.data?.data?.userVehicles || [];
  }

  async getVehicleStatus(vin) {
    const jobs = 'access,charging,climatisation,fuelStatus,measurements';
    const resp = await axios.get(`${STATUS_BASE}/${vin}/selectivestatus?jobs=${jobs}`,
      {
        headers: {
          'accept': '*/*',
          'authorization': `Bearer ${this._accessToken}`,
          'user-agent': USER_AGENT,
          'content-version': '1',
        },
      });
    return resp.data;
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  async _command(vin, resource, action, body = {}) {
    await axios.post(`${STATUS_BASE}/${vin}/${resource}/${action}`, body, {
      headers: {
        'content-type': 'application/json',
        'accept': '*/*',
        'user-agent': USER_AGENT,
        'content-version': '1',
        'x-newrelic-id': 'VgAEWV9QDRAEXFlRAAYPUA==',
        'authorization': `Bearer ${this._accessToken}`,
      },
    });
  }

  async lock(vin, spin = null)     { return this._command(vin, 'access', 'lock',          spin ? { spin } : {}); }
  async unlock(vin, spin = null)   { return this._command(vin, 'access', 'unlock',        spin ? { spin } : {}); }
  async startClimate(vin, targetTemp_C = 22, windowHeating = false, currentSettings = null) {
    // Build full settings object (preserve zone settings from last poll)
    const settings = Object.assign({}, currentSettings || {}, {
      targetTemperature_C: targetTemp_C,
      targetTemperature_F: Math.round(targetTemp_C * 9 / 5 + 32),
      windowHeatingEnabled: windowHeating,
      climatisationWithoutExternalPower: true,
    });
    // Remove read-only timestamp field if present
    delete settings.carCapturedTimestamp;

    // Try to apply settings first (PUT, then POST as fallback)
    const settingsUrl = `${STATUS_BASE}/${vin}/climatisation/settings`;
    const settingsHeaders = {
      'content-type': 'application/json',
      'accept': '*/*',
      'user-agent': USER_AGENT,
      'content-version': '1',
      'authorization': `Bearer ${this._accessToken}`,
    };
    try {
      await axios.put(settingsUrl, settings, { headers: settingsHeaders });
    } catch (e1) {
      try {
        await axios.post(settingsUrl, settings, { headers: settingsHeaders });
      } catch (e2) {
        // Settings endpoint unavailable — proceed anyway, car uses stored settings
      }
    }

    // Now start climatisation
    return this._command(vin, 'climatisation', 'start', {});
  }
  async stopClimate(vin)           { return this._command(vin, 'climatisation', 'stop',   {}); }
  async startCharging(vin)         { return this._command(vin, 'charging', 'start',       {}); }
  async stopCharging(vin)          { return this._command(vin, 'charging', 'stop',        {}); }
}

module.exports = AudiApi;
