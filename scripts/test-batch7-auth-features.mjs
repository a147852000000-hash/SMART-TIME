#!/usr/bin/env node
/**
 * Batch 7 runtime gate — Google Sign-In + Passkey (fingerprint) login.
 *
 * Spawns the real server (temp DB, GROQ_API_KEY empty, NODE_ENV=test) and
 * exercises the full ceremonies with locally-generated cryptographic material:
 *   1. Google endpoint gating (503 without GOOGLE_CLIENT_ID, then full
 *      create/link flows against a LOCAL JWKS server with a locally-generated
 *      RSA key — no requests to google.com, no quota).
 *   2. WebAuthn registration + assertion end-to-end (ES256/RS256/Ed25519
 *      keypairs generated in-process), negative cases (bad challenge, UV flag
 *      missing, tampered signature, replay), guest blocking, management API.
 * No external service quota is consumed anywhere.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let failures = 0;

const watchdog = setTimeout(() => {
  console.log('FAIL watchdog timeout (300s) — a request or boot hung');
  process.exit(1);
}, 300_000);

function fetchT(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
}

function check(condition, label) {
  if (condition) console.log(`PASS ${label}`);
  else { failures += 1; console.log(`FAIL ${label}`); }
}

let nextPort = 46421;

async function startServer(extraEnv = {}) {
  nextPort += 1;
  const port = String(nextPort);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'batch7-'));
  const dbPath = path.join(dir, 'db.sqlite');
  // Pre-create an EMPTY db file so database.ts's legacy-copy branch (repo
  // data/smart-time.db) never seeds users from previous local runs.
  fs.writeFileSync(dbPath, '');
  const child = spawn('npx', ['tsx', 'server.ts'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TRIAL_MODE: 'true',
      PORT: port,
      SMART_TIME_DB_PATH: dbPath,
      GROQ_API_KEY: '',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  const collect = (data) => logs.push(String(data));
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  const base = `http://localhost:${port}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetchT(`${base}/api/health`);
      if (res.ok) return { child, base, logs, port: Number(port), dbPath };
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log('FAIL server boot\n' + logs.slice(-40).join(''));
  child.kill('SIGKILL');
  process.exit(1);
}

// ---------- WebAuthn fixture builders ----------

function b64uEncode(buffer) {
  return Buffer.from(buffer).toString('base64url');
}
function b64uDecode(value) {
  return Buffer.from(String(value || ''), 'base64url');
}

function cborEncode(value) {
  const chunks = [];
  const push = (b) => chunks.push(b);
  const head = (major, n) => {
    const m = major << 5;
    if (n < 24) return Buffer.from([m | n]);
    if (n <= 0xff) return Buffer.from([m | 24, n]);
    if (n <= 0xffff) { const b = Buffer.alloc(3); b[0] = m | 25; b.writeUInt16BE(n, 1); return b; }
    const b = Buffer.alloc(5); b[0] = m | 26; b.writeUInt32BE(n, 1); return b;
  };
  const walk = (v) => {
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) { push(head(2, v.length)); push(Buffer.from(v)); return; }
    if (typeof v === 'number') {
      if (Number.isInteger(v) && v >= 0) { push(head(0, v)); return; }
      if (Number.isInteger(v) && v < 0) { push(head(1, -1 - v)); return; }
      const b = Buffer.alloc(9); b[0] = 0xfb; b.writeDoubleBE(v, 1); push(b); return;
    }
    if (typeof v === 'string') { const raw = Buffer.from(v, 'utf8'); push(head(3, raw.length)); push(raw); return; }
    if (typeof v === 'boolean') { push(Buffer.from([v ? 0xf5 : 0xf4])); return; }
    if (v === null || v === undefined) { push(Buffer.from([0xf6])); return; }
    if (Array.isArray(v)) { push(head(4, v.length)); v.forEach(walk); return; }
    if (v instanceof Map) {
      push(head(5, v.size));
      const keys = [...v.keys()].sort((a, b) => Buffer.compare(Buffer.from(cborEncode(a)), Buffer.from(cborEncode(b))));
      keys.forEach((k) => { walk(k); walk(v.get(k)); });
      return;
    }
    throw new Error('unsupported fixture type');
  };
  walk(value);
  return Buffer.concat(chunks);
}

/** Builds a COSE key map (fixture) from a node public key. */
function coseKeyFromPublicKey(publicKey) {
  const jwk = publicKey.export({ format: 'jwk' });
  if (jwk.kty === 'EC') {
    return new Map([[1, 2], [3, -7], [-1, 1], [-2, b64uDecode(jwk.x)], [-3, b64uDecode(jwk.y)]]);
  }
  if (jwk.kty === 'RSA') {
    return new Map([[1, 3], [3, -257], [-1, b64uDecode(jwk.n)], [-2, b64uDecode(jwk.e)]]);
  }
  if (jwk.kty === 'OKP') {
    return new Map([[1, 1], [3, -8], [-1, 6], [-2, b64uDecode(jwk.x)]]);
  }
  throw new Error('unsupported kty for fixtures');
}

function buildAuthData({ rpId, flags, signCount = 0, aaguid = null, credentialId = null, coseKey = null }) {
  const parts = [crypto.createHash('sha256').update(rpId).digest(), Buffer.from([flags]), Buffer.alloc(4)];
  parts[2].writeUInt32BE(signCount, 0);
  if ((flags & 0x40) === 0x40) {
    parts.push(aaguid || Buffer.alloc(16, 0x07));
    parts.push(Buffer.from([0, credentialId.length]));
    parts.push(credentialId);
    parts.push(cborEncode(coseKey));
  }
  return Buffer.concat(parts);
}

function buildAttestationObject(authData) {
  return cborEncode(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
}

function clientDataJsonBuffer(type, challenge, origin) {
  return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }), 'utf8');
}

function makeKeypair(kind) {
  if (kind === 'ec') return crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  if (kind === 'rsa') return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  if (kind === 'ed25519') return crypto.generateKeyPairSync('ed25519');
  throw new Error('bad kind');
}

function signAssertion(privateKey, alg, authData, clientDataJSON) {
  const signed = Buffer.concat([authData, crypto.createHash('sha256').update(clientDataJSON).digest()]);
  if (alg === 'EdDSA') return crypto.sign(null, signed, privateKey);
  return crypto.sign('sha256', signed, privateKey);
}

// ---------- Google fixture builders ----------

function mintGoogleToken({ privateKey, kid, clientId, sub, email, expiresInSeconds = 300, iss = 'accounts.google.com', aud = null }) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss,
    aud: aud || clientId,
    sub,
    email,
    email_verified: true,
    name: 'Test Google User',
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    iat: Math.floor(Date.now() / 1000),
  })).toString('base64url');
  const signature = crypto.createSign('SHA256').update(`${header}.${payload}`).sign(privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

async function startLocalJwksServer(rsaPublicKey, kid) {
  const jwk = rsaPublicKey.export({ format: 'jwk' });
  const body = JSON.stringify({ keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] });
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}/jwks` };
}

// ---------- HTTP helpers ----------

async function postJson(base, p, body, token = '') {
  const res = await fetchT(`${base}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function getJson(base, p, token = '') {
  const res = await fetchT(`${base}${p}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function registerUser(base, email) {
  const r = await postJson(base, '/api/auth/register', {
    name: 'Test User', username: email.split('@')[0], email, password: 'Password#12345',
  });
  if (r.status !== 200) throw new Error(`register failed: ${JSON.stringify(r)}`);
  return r.data;
}

// =====================================================================
async function main() {
  console.log('--- Scenario A: Google gating without client id ---');
  const A = await startServer();
  {
    const r = await postJson(A.base, '/api/auth/google', { credential: 'x.y.z' });
    check(r.status === 503 && r.data.code === 'GOOGLE_NOT_CONFIGURED', 'A1 /api/auth/google returns 503 GOOGLE_NOT_CONFIGURED without client id');
    const ro = await postJson(A.base, '/api/auth/passkey/register/options', {}, '');
    check(ro.status === 401, 'A2 passkey register/options requires session (401)');
    const lo = await postJson(A.base, '/api/auth/passkey/login/options', {});
    check(lo.status === 200 && lo.data.challenge && lo.data.challengeId && lo.data.rpId === 'localhost', 'A3 passkey login/options public works (rpId=localhost)');
    const guest = await fetchT(`${A.base}/api/trial/session`);
    const guestData = await guest.json().catch(() => ({}));
    const gr = await postJson(A.base, '/api/auth/passkey/register/options', {}, guestData.token);
    check(gr.status === 403, 'A4 guest/trial session cannot enroll passkey (403)');
  }
  A.child.kill('SIGKILL');

  console.log('--- Scenario B: WebAuthn full ceremony (ES256) + negatives ---');
  const B = await startServer();
  {
    const reg = await registerUser(B.base, 'passkey-user@test.local');
    check(!!reg.token, 'B0 register user');
    const me = await getJson(B.base, '/api/auth/me', reg.token);
    check(me.status === 200, 'B0.1 session works');

    const kp = makeKeypair('ec');
    const opts = await postJson(B.base, '/api/auth/passkey/register/options', {}, reg.token);
    check(opts.status === 200 && opts.data.challenge && opts.data.rp?.id === 'localhost', 'B1 passkey register options');
    check(opts.data.authenticatorSelection?.userVerification === 'required' && opts.data.attestation === 'none', 'B1.1 options request UV + attestation none');
    const credId = crypto.randomBytes(32);
    const credIdB64u = b64uEncode(credId);
    const clientData = clientDataJsonBuffer('webauthn.create', opts.data.challenge, `http://localhost:${B.port}`);
    const authData = buildAuthData({
      rpId: 'localhost', flags: 0x45, signCount: 1,
      credentialId: credId, coseKey: coseKeyFromPublicKey(kp.publicKey),
    });
    const regResp = await postJson(B.base, '/api/auth/passkey/register/verify', {
      deviceName: 'Android Test',
      credential: {
        id: credIdB64u, rawId: credIdB64u, type: 'public-key', transports: ['internal'],
        response: { clientDataJSON: b64uEncode(clientData), attestationObject: b64uEncode(buildAttestationObject(authData)) },
      },
    }, reg.token);
    check(regResp.status === 200 && regResp.data.ok === true, 'B2 passkey registration verified');
    const list = await getJson(B.base, '/api/auth/passkeys', reg.token);
    check(list.status === 200 && list.data.passkeys?.length === 1 && list.data.passkeys[0].deviceName === 'Android Test', 'B3 passkey listed for account');

    // Negative: registration challenge is single-use.
    const replayReg = await postJson(B.base, '/api/auth/passkey/register/verify', {
      credential: {
        id: credIdB64u, rawId: credIdB64u, type: 'public-key',
        response: { clientDataJSON: b64uEncode(clientData), attestationObject: b64uEncode(buildAttestationObject(authData)) },
      },
    }, reg.token);
    check(replayReg.status === 400, 'B4 registration challenge single-use (replay rejected)');

    // Login ceremony.
    const loginOpts = await postJson(B.base, '/api/auth/passkey/login/options', {});
    check(loginOpts.status === 200 && loginOpts.data.challengeId, 'B5 login options');
    const loginClientData = clientDataJsonBuffer('webauthn.get', loginOpts.data.challenge, `http://localhost:${B.port}`);
    const assertionAuthData = buildAuthData({ rpId: 'localhost', flags: 0x05, signCount: 2 });
    const signature = signAssertion(kp.privateKey, 'ES256', assertionAuthData, loginClientData);
    const loginResp = await postJson(B.base, '/api/auth/passkey/login/verify', {
      challengeId: loginOpts.data.challengeId,
      credential: {
        id: credIdB64u, rawId: credIdB64u, type: 'public-key',
        response: {
          clientDataJSON: b64uEncode(loginClientData),
          authenticatorData: b64uEncode(assertionAuthData),
          signature: b64uEncode(signature),
        },
      },
    });
    check(loginResp.status === 200 && !!loginResp.data.token, 'B6 passkey login issues session');
    const me2 = await getJson(B.base, '/api/auth/me', loginResp.data.token);
    check(me2.status === 200 && me2.data.user?.email === 'passkey-user@test.local', 'B7 passkey session belongs to registered user');

    // Negative: tampered signature.
    const lo2 = await postJson(B.base, '/api/auth/passkey/login/options', {});
    const cd2 = clientDataJsonBuffer('webauthn.get', lo2.data.challenge, `http://localhost:${B.port}`);
    const ad2 = buildAuthData({ rpId: 'localhost', flags: 0x05, signCount: 3 });
    const sig2 = signAssertion(kp.privateKey, 'ES256', ad2, cd2);
    sig2[10] ^= 0xff;
    const tampered = await postJson(B.base, '/api/auth/passkey/login/verify', {
      challengeId: lo2.data.challengeId,
      credential: { id: credIdB64u, rawId: credIdB64u, type: 'public-key', response: { clientDataJSON: b64uEncode(cd2), authenticatorData: b64uEncode(ad2), signature: b64uEncode(sig2) } },
    });
    check(tampered.status === 401, 'B8 tampered signature rejected');

    // Negative: missing UV flag (password-less presence only).
    const lo3 = await postJson(B.base, '/api/auth/passkey/login/options', {});
    const cd3 = clientDataJsonBuffer('webauthn.get', lo3.data.challenge, `http://localhost:${B.port}`);
    const ad3 = buildAuthData({ rpId: 'localhost', flags: 0x01, signCount: 4 });
    const noUv = await postJson(B.base, '/api/auth/passkey/login/verify', {
      challengeId: lo3.data.challengeId,
      credential: { id: credIdB64u, rawId: credIdB64u, type: 'public-key', response: { clientDataJSON: b64uEncode(cd3), authenticatorData: b64uEncode(ad3), signature: b64uEncode(signAssertion(kp.privateKey, 'ES256', ad3, cd3)) } },
    });
    check(noUv.status === 401, 'B9 assertion without UV (no fingerprint) rejected');

    // Negative: challenge replay on login.
    const cd3b = clientDataJsonBuffer('webauthn.get', lo3.data.challenge, `http://localhost:${B.port}`);
    const ad3b = buildAuthData({ rpId: 'localhost', flags: 0x05, signCount: 4 });
    const replay = await postJson(B.base, '/api/auth/passkey/login/verify', {
      challengeId: lo3.data.challengeId,
      credential: { id: credIdB64u, rawId: credIdB64u, type: 'public-key', response: { clientDataJSON: b64uEncode(cd3b), authenticatorData: b64uEncode(ad3b), signature: b64uEncode(signAssertion(kp.privateKey, 'ES256', ad3b, cd3b)) } },
    });
    check(replay.status === 401, 'B10 login challenge single-use (replay rejected)');

    // Management: remove the passkey, login must stop working.
    const del = await fetchT(`${B.base}/api/auth/passkeys/${encodeURIComponent(credIdB64u)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${reg.token}` } });
    check(del.status === 200, 'B11 passkey deleted');
    const list2 = await getJson(B.base, '/api/auth/passkeys', reg.token);
    check(list2.data.passkeys?.length === 0, 'B11.1 list empty after delete');
    const lo4 = await postJson(B.base, '/api/auth/passkey/login/options', {});
    const cd4 = clientDataJsonBuffer('webauthn.get', lo4.data.challenge, `http://localhost:${B.port}`);
    const ad4 = buildAuthData({ rpId: 'localhost', flags: 0x05, signCount: 5 });
    const afterDelete = await postJson(B.base, '/api/auth/passkey/login/verify', {
      challengeId: lo4.data.challengeId,
      credential: { id: credIdB64u, rawId: credIdB64u, type: 'public-key', response: { clientDataJSON: b64uEncode(cd4), authenticatorData: b64uEncode(ad4), signature: b64uEncode(signAssertion(kp.privateKey, 'ES256', ad4, cd4)) } },
    });
    check(afterDelete.status === 401, 'B12 login after credential deletion rejected');
  }
  B.child.kill('SIGKILL');

  console.log('--- Scenario C: RS256 + Ed25519 assertion algorithms ---');
  const C = await startServer();
  {
    for (const [kind, alg] of [['rsa', 'RS256'], ['ed25519', 'EdDSA']]) {
      const reg = await registerUser(C.base, `${kind}-user@test.local`);
      const kp = makeKeypair(kind);
      const opts = await postJson(C.base, '/api/auth/passkey/register/options', {}, reg.token);
      const credIdB64u = b64uEncode(crypto.randomBytes(32));
      const clientData = clientDataJsonBuffer('webauthn.create', opts.data.challenge, `http://localhost:${C.port}`);
      const authData = buildAuthData({ rpId: 'localhost', flags: 0x45, signCount: 1, credentialId: b64uDecode(credIdB64u), coseKey: coseKeyFromPublicKey(kp.publicKey) });
      const regResp = await postJson(C.base, '/api/auth/passkey/register/verify', {
        credential: { id: credIdB64u, rawId: credIdB64u, type: 'public-key', response: { clientDataJSON: b64uEncode(clientData), attestationObject: b64uEncode(buildAttestationObject(authData)) } },
      }, reg.token);
      check(regResp.status === 200 && regResp.data.ok, `C1 ${alg} registration verified`);
      const loginOpts = await postJson(C.base, '/api/auth/passkey/login/options', {});
      const cd = clientDataJsonBuffer('webauthn.get', loginOpts.data.challenge, `http://localhost:${C.port}`);
      const ad = buildAuthData({ rpId: 'localhost', flags: 0x05, signCount: 2 });
      const loginResp = await postJson(C.base, '/api/auth/passkey/login/verify', {
        challengeId: loginOpts.data.challengeId,
        credential: { id: credIdB64u, rawId: credIdB64u, type: 'public-key', response: { clientDataJSON: b64uEncode(cd), authenticatorData: b64uEncode(ad), signature: b64uEncode(signAssertion(kp.privateKey, alg, ad, cd)) } },
      });
      check(loginResp.status === 200 && !!loginResp.data.token, `C2 ${alg} assertion accepted`);
    }
  }
  C.child.kill('SIGKILL');

  console.log('--- Scenario D: Google sign-in (local JWKS, create + link + negatives) ---');
  const googleRsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwks = await startLocalJwksServer(googleRsa.publicKey, 'test-kid-1');
  const D = await startServer({ GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com', GOOGLE_JWKS_URL: jwks.url });
  {
    const goodToken = mintGoogleToken({ privateKey: googleRsa.privateKey, kid: 'test-kid-1', clientId: 'test-client-id.apps.googleusercontent.com', sub: 'google-sub-123', email: 'new-google-user@test.local' });
    const r1 = await postJson(D.base, '/api/auth/google', { credential: goodToken });
    check(r1.status === 200 && !!r1.data.token, 'D1 valid Google token creates account + session');
    const me1 = await getJson(D.base, '/api/auth/me', r1.data.token);
    check(me1.status === 200 && me1.data.user?.email === 'new-google-user@test.local', 'D1.1 session user is the Google email');
    const userId1 = r1.data.user?.id;

    const again = await postJson(D.base, '/api/auth/google', { credential: mintGoogleToken({ privateKey: googleRsa.privateKey, kid: 'test-kid-1', clientId: 'test-client-id.apps.googleusercontent.com', sub: 'google-sub-123', email: 'new-google-user@test.local' }) });
    check(again.status === 200 && again.data.user?.id === userId1, 'D2 same Google sub returns same account (find by google_id)');

    // Link flow: existing password account with same email keeps its password.
    const existing = await registerUser(D.base, 'existing@test.local');
    const linkToken = mintGoogleToken({ privateKey: googleRsa.privateKey, kid: 'test-kid-1', clientId: 'test-client-id.apps.googleusercontent.com', sub: 'google-sub-456', email: 'existing@test.local' });
    const link = await postJson(D.base, '/api/auth/google', { credential: linkToken });
    check(link.status === 200 && link.data.user?.id === existing.user?.id, 'D3 Google token linked to existing email account');
    const pwdLogin = await postJson(D.base, '/api/auth/login', { identifier: 'existing@test.local', password: 'Password#12345' });
    check(pwdLogin.status === 200, 'D3.1 password login still works after linking');

    // Negatives.
    const badAud = mintGoogleToken({ privateKey: googleRsa.privateKey, kid: 'test-kid-1', clientId: 'test-client-id.apps.googleusercontent.com', sub: 'x1', email: 'x1@test.local', aud: 'other-client' });
    check((await postJson(D.base, '/api/auth/google', { credential: badAud })).status === 401, 'D4 wrong aud rejected');
    const expired = mintGoogleToken({ privateKey: googleRsa.privateKey, kid: 'test-kid-1', clientId: 'test-client-id.apps.googleusercontent.com', sub: 'x2', email: 'x2@test.local', expiresInSeconds: -500 });
    check((await postJson(D.base, '/api/auth/google', { credential: expired })).status === 401, 'D5 expired token rejected');
    const wrongKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    const badSig = mintGoogleToken({ privateKey: wrongKey, kid: 'test-kid-1', clientId: 'test-client-id.apps.googleusercontent.com', sub: 'x3', email: 'x3@test.local' });
    check((await postJson(D.base, '/api/auth/google', { credential: badSig })).status === 401, 'D6 forged signature rejected');
    const unknownKid = mintGoogleToken({ privateKey: googleRsa.privateKey, kid: 'no-such-kid', clientId: 'test-client-id.apps.googleusercontent.com', sub: 'x4', email: 'x4@test.local' });
    check((await postJson(D.base, '/api/auth/google', { credential: unknownKid })).status === 401, 'D7 unknown kid rejected');
    const unverified = mintGoogleToken({ privateKey: googleRsa.privateKey, kid: 'test-kid-1', clientId: 'test-client-id.apps.googleusercontent.com', sub: 'x5', email: 'x5@test.local' });
    // tamper payload: flip email_verified to false without resigning -> signature must fail
    const [h, p, s] = unverified.split('.');
    const payloadJson = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    payloadJson.email_verified = false;
    const p2 = Buffer.from(JSON.stringify(payloadJson)).toString('base64url');
    check((await postJson(D.base, '/api/auth/google', { credential: `${h}.${p2}.${s}` })).status === 401, 'D8 payload tampering rejected (signature mismatch)');

    // Owner flow preserved: Google token for the owner email -> requiresRoleChoice.
    const ownerToken = mintGoogleToken({ privateKey: googleRsa.privateKey, kid: 'test-kid-1', clientId: 'test-client-id.apps.googleusercontent.com', sub: 'owner-sub', email: 'eng.mamdouh2009@gmail.com' });
    const ownerResp = await postJson(D.base, '/api/auth/google', { credential: ownerToken });
    check(ownerResp.status === 200 && ownerResp.data.requiresRoleChoice === true && !!ownerResp.data.roleChoiceTicket, 'D9 owner email via Google keeps role-choice flow');
  }
  D.child.kill('SIGKILL');
  jwks.server.close();

  console.log(`\nDONE failures=${failures}`);
  clearTimeout(watchdog);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.log('FAIL main:', e?.stack || e); clearTimeout(watchdog); process.exit(1); });
