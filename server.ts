import express from "express";
import http from "node:http";
import path from "path";
import dotenv from "dotenv";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { db, seedDefaultChatRooms } from "./backend/database.js";
import { getCache, setCache } from "./backend/cache.js";
import { getServiceStatuses, seedServiceStatuses, setServiceStatus } from "./backend/serviceStatus.js";
import { chatRouter, setupChatWebSocket } from "./backend/chatServer.js";
import { estimateProviderPrice, type RideProvider, type RideCategory } from "./src/services/ridePriceEstimator.js";
import { askSmartAiCore } from "./backend/ai/smartAiCore.js";
import { isLocalSmartAiConfigured } from "./backend/ai/localInference.js";
import { createHttpVoiceDnaProvider, DisabledVoiceDnaProvider } from "./backend/voice/voiceDnaProvider.js";
import { sendPasswordResetEmail as sendPasswordResetEmailWithProvider } from "./backend/auth/passwordResetEmail.js";
import { verifyTurnstileToken } from "./backend/security/turnstile.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT || 3000);
const SMART_VOICE_DNA_PROVIDER_URL = String(process.env.SMART_VOICE_DNA_PROVIDER_URL || "").trim();
const SMART_VOICE_DNA_PROVIDER_TOKEN = String(process.env.SMART_VOICE_DNA_PROVIDER_TOKEN || "").trim();
const smartVoiceDnaProvider = SMART_VOICE_DNA_PROVIDER_URL
  ? createHttpVoiceDnaProvider({ id: "voicetut-local", url: SMART_VOICE_DNA_PROVIDER_URL, token: SMART_VOICE_DNA_PROVIDER_TOKEN || undefined, timeoutMs: Number(process.env.SMART_VOICE_DNA_PROVIDER_TIMEOUT_MS || 120000) })
  : new DisabledVoiceDnaProvider();
const SMART_VOICE_DNA_MAX_REQUESTS_PER_MINUTE = Math.max(1, Number(process.env.SMART_VOICE_DNA_MAX_REQUESTS_PER_MINUTE || 8));
const voiceDnaRequestWindow = new Map<string, { startedAt: number; count: number }>();
let voiceDnaProviderHealth = { checkedAt: 0, healthy: false };

async function checkVoiceDnaProviderHealth(): Promise<boolean> {
  if (!smartVoiceDnaProvider.isAvailable()) return false;
  const now = Date.now();
  if (now - voiceDnaProviderHealth.checkedAt < 15_000) return voiceDnaProviderHealth.healthy;

  try {
    const configuredUrl = new URL(SMART_VOICE_DNA_PROVIDER_URL);
    configuredUrl.pathname = configuredUrl.pathname.replace(/\/synthesize\/?$/, "/health") || "/health";
    if (!configuredUrl.pathname) configuredUrl.pathname = "/health";
    configuredUrl.search = "";
    configuredUrl.hash = "";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4_000);
    try {
      const response = await fetch(configuredUrl, { headers: { Accept: "application/json" }, signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      voiceDnaProviderHealth = {
        checkedAt: now,
        healthy: response.ok && payload?.ok === true,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    voiceDnaProviderHealth = { checkedAt: now, healthy: false };
  }
  return voiceDnaProviderHealth.healthy;
}
function consumeVoiceDnaQuota(userId: string): boolean {
  const now = Date.now();
  const current = voiceDnaRequestWindow.get(userId);
  if (!current || now - current.startedAt >= 60_000) {
    voiceDnaRequestWindow.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= SMART_VOICE_DNA_MAX_REQUESTS_PER_MINUTE) return false;
  current.count += 1;
  return true;
}

// CORS for the Vercel-hosted frontend talking to the Railway API.
// Keep credentials disabled; SMART TIME auth uses bearer tokens explicitly.
app.use((req, res, next) => {
  const origin = String(req.headers.origin || "");
  const allowed =
    !origin ||
    /^https:\/\/([a-z0-9-]+\.)*vercel\.app$/i.test(origin) ||
    /^https?:\/\/localhost(?::\\d+)?$/i.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(?::\\d+)?$/i.test(origin);

  if (allowed && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
seedServiceStatuses();
seedDefaultChatRooms();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Mount Chat API
app.use("/api/chat", chatRouter);




const TRIAL_MODE = String(process.env.TRIAL_MODE || 'false').trim().toLowerCase() === 'true';
const TRIAL_USER_ID = 'smart-time-trial-user';
const AUTH_SESSION_DAYS = 30;
const PASSWORD_RESET_MINUTES = 60;
const PROGRAM_OWNER_EMAIL = String(process.env.PROGRAM_OWNER_EMAIL || '').trim().toLowerCase();
const PROGRAM_OWNER_USER_ID = String(process.env.PROGRAM_OWNER_USER_ID || '').trim();
const PROGRAM_OWNER_ACTIVATION_KEY = String(process.env.PROGRAM_OWNER_ACTIVATION_KEY || '');
// تكلفة كل بحث/مقارنة رحلة بالجنيه المصري (يمكن تعديلها بمتغير بيئة TRIP_SEARCH_COST_EGP)
const parsedTripCost = Number(process.env.TRIP_SEARCH_COST_EGP || 5);
const TRIP_SEARCH_COST_EGP = Number.isFinite(parsedTripCost) && parsedTripCost >= 0 ? Math.round(parsedTripCost * 100) / 100 : 5;
const TRIP_WELCOME_FREE_SEARCHES = 3;
const TRIP_GIFT_HASH_SALT = String(process.env.TRIP_GIFT_HASH_SALT || 'smart-time-trip-gift-v1');
function clientIp(req: express.Request): string { const ip=String(req.ip||req.socket.remoteAddress||'').trim().toLowerCase(); return ip.replace(/^::ffff:/,''); }
const TURNSTILE_ENFORCE = String(process.env.TURNSTILE_ENFORCE || "false").trim().toLowerCase() === "true";
async function requireAuthTurnstile(req: express.Request, res: express.Response): Promise<boolean> {
  if (!TURNSTILE_ENFORCE) return true;
  const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) {
    res.status(503).json({ error: "خدمة التحقق الأمني غير مهيأة. حاول لاحقًا." });
    return false;
  }
  const token = String(req.body?.turnstileToken || "").trim();
  const result = await verifyTurnstileToken(token, secret, clientIp(req));
  if (!result.success || (result.action && result.action !== "smart-time-auth")) {
    res.status(403).json({ error: "أكمل خطوة التحقق الأمني ثم حاول مرة أخرى." });
    return false;
  }
  return true;
}
function giftSignalHash(value:string): string { return crypto.createHash('sha256').update(`${TRIP_GIFT_HASH_SALT}:${value}`).digest('hex'); }
const OWNER_WALLET_NUMBER = String(process.env.OWNER_WALLET_NUMBER || '01126621962').trim();
const OWNER_INSTAPAY_ADDRESS = String(process.env.OWNER_INSTAPAY_ADDRESS || '01126621962').trim();
const parsedTopupMin = Number(process.env.WALLET_TOPUP_MIN_EGP || 5);
const parsedTopupMax = Number(process.env.WALLET_TOPUP_MAX_EGP || 10000);
const WALLET_TOPUP_MIN_EGP = Number.isFinite(parsedTopupMin) && parsedTopupMin > 0 ? parsedTopupMin : 5;
const WALLET_TOPUP_MAX_EGP = Number.isFinite(parsedTopupMax) && parsedTopupMax >= WALLET_TOPUP_MIN_EGP ? parsedTopupMax : 10000;
const ALLOWED_TOPUP_METHODS = new Set(['vodafone_cash', 'instapay', 'etisalat_cash', 'other']);
const MAX_REVIEW_NOTE_LENGTH = 300;
function hashPassword(password: string) { const salt = crypto.randomBytes(16).toString('hex'); return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`; }
function verifyPassword(password: string, stored: string) { const [salt, expected] = String(stored||'').split(':'); if (!salt||!expected) return false; const actual=crypto.scryptSync(password,salt,64).toString('hex'); return crypto.timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex')); }
function createSession(userId: string) { const token=crypto.randomBytes(32).toString('hex'); const now=new Date(); const expires=new Date(now.getTime()+AUTH_SESSION_DAYS*86400000).toISOString(); db.prepare('INSERT INTO sessions (id,user_id,expires_at,created_at) VALUES (?,?,?,?)').run(token,userId,expires,now.toISOString()); return token; }
function jwtSecret(): string {
  const secret = String(process.env.JWT_SECRET || process.env.AUTH_TOKEN_SECRET || '').trim();
  if (secret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  return secret;
}
function base64url(value: string | Buffer): string { return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function signJwt(payload: Record<string, unknown>): string {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.createHmac('sha256', jwtSecret()).update(unsigned).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${unsigned}.${signature}`;
}
function verifyJwt(token: string): any | null {
  try {
    const parts = token.split('.'); if (parts.length !== 3) return null;
    const unsigned = `${parts[0]}.${parts[1]}`;
    const expected = crypto.createHmac('sha256', jwtSecret()).update(unsigned).digest();
    const actual = Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - parts[2].length % 4) % 4), 'base64');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const decode = (part: string) => Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - part.length % 4) % 4), 'base64').toString('utf8');
    if (JSON.parse(decode(parts[0])).alg !== 'HS256') return null;
    const payload = JSON.parse(decode(parts[1]));
    return payload.exp && Number(payload.exp) > Math.floor(Date.now() / 1000) ? payload : null;
  } catch { return null; }
}
const OWNER_EMAILS = new Set(String(process.env.OWNER_EMAILS || 'eng.mamdouh2009@gmail.com,mamdouh.oracle.2026@gmail.com').split(',').map(v => v.trim().toLowerCase()).filter(Boolean));
const VALID_APP_ROLES = new Set(['owner', 'admin', 'user']);
function rolesForDbRole(role: string): string[] { if (role === 'owner') return ['owner', 'admin', 'user']; if (role === 'admin') return ['admin', 'user']; return ['user']; }
function issueRoleSelectionTicket(row: any): string {
  const now = Math.floor(Date.now() / 1000);
  const availableRoles = rolesForDbRole(String(row.role)).filter(role => role === 'user' || OWNER_EMAILS.has(String(row.email).toLowerCase()));
  return signJwt({ purpose: 'role_selection', sub: row.id, email: row.email, actualRoleInDB: row.role, availableRoles, iat: now, exp: now + 300 });
}
function authUser(req: express.Request) {
  const h = String(req.headers.authorization || ''), token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) return null;
  if (token.split('.').length === 3) {
    const claims = verifyJwt(token);
    if (!claims || claims.purpose !== 'app_session' || !claims.sub || !VALID_APP_ROLES.has(String(claims.selectedRole))) return null;
    const row = db.prepare("SELECT u.id,u.email,u.username,u.display_name as name,u.phone,u.phone_verified as phoneVerified,u.activation_status,u.role,s.id as session_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.user_id=? AND julianday(s.expires_at)>julianday('now')").get(String(claims.sid||''),String(claims.sub)) as any;
    if (!row || row.role !== claims.role || !rolesForDbRole(String(row.role)).includes(String(claims.selectedRole))) return null;
    return { ...row, actualRoleInDB: row.role, selectedRole: claims.selectedRole, role: claims.selectedRole };
  }
  return db.prepare(`SELECT u.id,u.email,u.username,u.display_name as name,u.phone,u.phone_verified as phoneVerified,u.activation_status,u.role,s.session_role as selectedRole,s.id as session_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND julianday(s.expires_at) > julianday('now')`).get(token) as any || null;
}
function publicUser(row:any){const selectedRole=row.selectedRole||'user';return {id:row.id,email:row.email,username:row.username||undefined,name:row.name||row.display_name||'',phone:row.phone||undefined,phoneVerified:!!row.phoneVerified,role:selectedRole,selectedRole,activationStatus:row.activation_status||row.activationStatus||'pending'};}
function normalizePhone(phone:string){return String(phone||'').replace(/[\s()-]/g,'');}
function normalizeUsername(username:string){return String(username||'').trim().toLowerCase();}
function otpHash(code:string){return crypto.createHash('sha256').update(code).digest('hex');}
async function sendSms(phone:string, code:string){
  const provider=String(process.env.SMS_PROVIDER||'').trim().toLowerCase();
  const body=`رمز التحقق من SMART TIME هو: ${code}. صالح لمدة 5 دقائق.`;
  if(provider==='twilio'){
    const sid=String(process.env.TWILIO_ACCOUNT_SID||'').trim();
    const token=String(process.env.TWILIO_AUTH_TOKEN||'').trim();
    const from=String(process.env.TWILIO_FROM||'').trim();
    if(!sid||!token||!from) throw new Error('إعدادات Twilio غير مكتملة.');
    const params=new URLSearchParams({To:phone,From:from,Body:body});
    const auth=Buffer.from(`${sid}:${token}`).toString('base64');
    const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body:params});
    if(!r.ok) throw new Error(`فشل إرسال SMS (${r.status}).`);
    return {provider:'twilio'};
  }
  if(provider==='webhook'){
    const url=String(process.env.SMS_WEBHOOK_URL||'').trim();
    const secret=String(process.env.SMS_WEBHOOK_SECRET||'').trim();
    if(!url) throw new Error('رابط SMS Webhook غير مُكوّن.');
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(secret?{'X-SMS-Secret':secret}:{})},body:JSON.stringify({to:phone,message:body,code})});
    if(!r.ok) throw new Error(`فشل مزود SMS (${r.status}).`);
    return {provider:'webhook'};
  }
  throw new Error('مزود SMS غير مُكوّن. استخدم SMS_PROVIDER=twilio أو webhook أو messagecentral.');
}

// ----------------------------------------------------
// Message Central (VerifyNow) — no-credit-card SMS OTP alternative to Twilio.
// Unlike Twilio/webhook above, Message Central generates AND validates the OTP itself;
// we only keep a reference (verificationId) to check against later.
// Docs: https://www.messagecentral.com/product/verify-now/api
// ----------------------------------------------------
let messageCentralTokenCache: { token: string; fetchedAt: number } | null = null;
async function getMessageCentralToken(): Promise<string> {
  const customerId = String(process.env.MESSAGECENTRAL_CUSTOMER_ID || '').trim();
  const key = String(process.env.MESSAGECENTRAL_KEY || '').trim();
  if (!customerId || !key) throw new Error('إعدادات Message Central غير مكتملة: MESSAGECENTRAL_CUSTOMER_ID و MESSAGECENTRAL_KEY مطلوبان.');
  if (messageCentralTokenCache && (Date.now() - messageCentralTokenCache.fetchedAt) < 20 * 60 * 60 * 1000) {
    return messageCentralTokenCache.token;
  }
  const url = `https://cpaas.messagecentral.com/auth/v1/authentication/token?customerId=${encodeURIComponent(customerId)}&key=${encodeURIComponent(key)}&scope=NEW`;
  const r = await fetch(url, { headers: { accept: '*/*' } });
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok || !data?.token) throw new Error('فشل الحصول على توكن Message Central. تأكد من MESSAGECENTRAL_CUSTOMER_ID و MESSAGECENTRAL_KEY.');
  messageCentralTokenCache = { token: data.token, fetchedAt: Date.now() };
  return data.token;
}
function splitPhoneForMessageCentral(phone: string): { countryCode: string; localNumber: string } {
  let p = String(phone || '').trim();
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('20')) return { countryCode: '20', localNumber: p.slice(2).replace(/^0+/, '') };
  if (p.startsWith('0')) return { countryCode: '20', localNumber: p.slice(1) };
  return { countryCode: '20', localNumber: p };
}
async function sendOtpViaMessageCentral(phone: string, flowType: 'WHATSAPP' | 'SMS'): Promise<{ verificationId: string }> {
  const token = await getMessageCentralToken();
  const { countryCode, localNumber } = splitPhoneForMessageCentral(phone);
  const url = `https://cpaas.messagecentral.com/verification/v3/send?countryCode=${encodeURIComponent(countryCode)}&flowType=${flowType}&mobileNumber=${encodeURIComponent(localNumber)}`;
  const r = await fetch(url, { method: 'POST', headers: { authToken: token } });
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok || data?.responseCode !== 200 || !data?.data?.verificationId) throw new Error(data?.message || data?.data?.errorMessage || `فشل إرسال رمز التحقق عبر Message Central (${flowType}).`);
  return { verificationId: String(data.data.verificationId) };
}
// يحاول واتساب أولاً، ولو فشل الإرسال (رقم مش على واتساب، أو الميزة غير مفعّلة بالحساب) يرجع تلقائيًا لـ SMS عادي.
async function sendSmsViaMessageCentral(phone: string): Promise<{ verificationId: string; channel: 'whatsapp' | 'sms' }> {
  try {
    const { verificationId } = await sendOtpViaMessageCentral(phone, 'WHATSAPP');
    return { verificationId, channel: 'whatsapp' };
  } catch (whatsappErr) {
    const { verificationId } = await sendOtpViaMessageCentral(phone, 'SMS');
    return { verificationId, channel: 'sms' };
  }
}
async function validateMessageCentralOtp(verificationId: string, code: string): Promise<boolean> {
  const token = await getMessageCentralToken();
  const url = `https://cpaas.messagecentral.com/verification/v3/validateOtp?verificationId=${encodeURIComponent(verificationId)}&code=${encodeURIComponent(code)}`;
  const r = await fetch(url, { method: 'GET', headers: { authToken: token } });
  const data: any = await r.json().catch(() => ({}));
  return !!(r.ok && data?.responseCode === 200 && data?.data?.verificationStatus === 'VERIFICATION_COMPLETED');
}

// ----------------------------------------------------
// Shared phone-OTP issue/verify helpers used by all phone-verification endpoints below.
// These branch between the "we generate the code" providers (twilio/webhook/dev-fallback)
// and the "provider generates the code" flow (messagecentral).
// ----------------------------------------------------
async function requestPhoneOtp(phone: string): Promise<{ expires: string; provider: string; devCode?: string }> {
  const provider = String(process.env.SMS_PROVIDER || '').trim().toLowerCase();
  const expires = new Date(Date.now() + 300000).toISOString();
  const createdAt = new Date().toISOString();
  if (provider === 'messagecentral') {
    const { verificationId, channel } = await sendSmsViaMessageCentral(phone);
    db.prepare(`INSERT INTO phone_otps(phone,code_hash,expires_at,attempts,created_at,remote_provider,remote_verification_id) VALUES(?,?,?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,created_at=excluded.created_at,remote_provider=excluded.remote_provider,remote_verification_id=excluded.remote_verification_id`)
      .run(phone, '', expires, 0, createdAt, 'messagecentral', verificationId);
    return { expires, provider: `messagecentral_${channel}` };
  }
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare(`INSERT INTO phone_otps(phone,code_hash,expires_at,attempts,created_at,remote_provider,remote_verification_id) VALUES(?,?,?,?,?,NULL,NULL) ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,created_at=excluded.created_at,remote_provider=NULL,remote_verification_id=NULL`)
    .run(phone, otpHash(code), expires, 0, createdAt);
  try {
    const info = await sendSms(phone, code);
    return { expires, provider: info.provider };
  } catch (e: any) {
    if (process.env.NODE_ENV !== 'production') return { expires, provider: 'development', devCode: code };
    throw e;
  }
}
type OtpCheckResult = { ok: true; error?: undefined; status?: undefined } | { ok: false; error: string; status: number };
async function checkPhoneOtp(phone: string, code: string): Promise<OtpCheckResult> {
  const otp = db.prepare('SELECT * FROM phone_otps WHERE phone=?').get(phone) as any;
  if (!otp || new Date(otp.expires_at).getTime() < Date.now()) return { ok: false, error: 'رمز التحقق منتهي أو غير موجود', status: 400 };
  if (otp.attempts >= 5) return { ok: false, error: 'تم تجاوز عدد المحاولات. اطلب رمزًا جديدًا.', status: 429 };
  db.prepare('UPDATE phone_otps SET attempts=attempts+1 WHERE phone=?').run(phone);
  let valid = false;
  if (otp.remote_provider === 'messagecentral' && otp.remote_verification_id) {
    try { valid = await validateMessageCentralOtp(otp.remote_verification_id, code); } catch { valid = false; }
  } else {
    valid = otpHash(code) === otp.code_hash;
  }
  if (!valid) return { ok: false, error: 'رمز التحقق غير صحيح', status: 400 };
  return { ok: true };
}

async function sendPasswordResetEmail(email:string, code:string){
  return sendPasswordResetEmailWithProvider(email, code, PASSWORD_RESET_MINUTES);
}


app.get('/api/trial/session', (req,res) => {
  if (!TRIAL_MODE) return res.status(404).json({ error: 'Trial mode is disabled' });
  try {
    const now = new Date().toISOString();
    let row = db.prepare('SELECT * FROM users WHERE id=?').get(TRIAL_USER_ID) as any;
    if (!row) {
      const email = 'trial@smart-time.local';
      const username = 'smart_time_trial';
      db.prepare(
        "INSERT INTO users (id,email,username,password_hash,display_name,created_at,phone,phone_verified,activation_status,trip_free_searches,wallet_balance) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
      ).run(TRIAL_USER_ID, email, username, hashPassword(crypto.randomBytes(24).toString('hex')), 'SMART TIME', now, null, 0, 'active', TRIP_WELCOME_FREE_SEARCHES, 0);
      row = db.prepare('SELECT * FROM users WHERE id=?').get(TRIAL_USER_ID) as any;
    }
    const token = createSession(TRIAL_USER_ID);
    res.json({ token, user: publicUser({ ...row, name: row.display_name, phoneVerified: false, activation_status: 'active' }) });
  } catch (e:any) {
    res.status(500).json({ error: e.message || 'تعذر بدء النسخة التجريبية' });
  }
});

app.post('/api/auth/register', async (req,res)=>{
  try{
    if (!(await requireAuthTurnstile(req, res))) return;
    const name=String(req.body.name||'').trim(), username=normalizeUsername(req.body.username), email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||'');
    // TEMPORARY (testing phase): phone is now optional at signup. Leaving it blank skips phone
    // verification entirely — the account is created and usable immediately across every section.
    // The Trips section's phone-gift screen still asks for it later, whenever the user chooses to.
    // To make phone required again, restore the `if(phone.length<8) return res.status(400)...` check below.
    const rawPhone=normalizePhone(req.body.phone), phone = rawPhone.length>=8 ? rawPhone : '';
    const deviceId=String(req.body.deviceId||'').trim().slice(0,200);
    if(name.length<2)return res.status(400).json({error:'الاسم مطلوب'});
    if(!/^[a-z0-9_.-]{3,30}$/.test(username))return res.status(400).json({error:'اسم المستخدم يجب أن يكون من 3 إلى 30 حرفًا، باستخدام حروف إنجليزية أو أرقام أو _ أو - أو .'});
    if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'البريد الإلكتروني غير صحيح'});
    if(password.length<8)return res.status(400).json({error:'كلمة المرور يجب أن تكون 8 أحرف على الأقل'});
    if(db.prepare('SELECT id FROM users WHERE email=?').get(email))return res.status(409).json({error:'البريد الإلكتروني مستخدم بالفعل'});
    if(db.prepare('SELECT id FROM users WHERE username=?').get(username))return res.status(409).json({error:'اسم المستخدم مستخدم بالفعل.'});
    if(phone && db.prepare('SELECT id FROM users WHERE phone=?').get(phone))return res.status(409).json({error:'رقم الهاتف مرتبط بحساب آخر.'});
    const id=`usr_${crypto.randomUUID()}`, now=new Date().toISOString();
    db.prepare("INSERT INTO users (id,email,username,password_hash,display_name,created_at,phone,phone_verified,activation_status,trip_free_searches) VALUES (?,?,?,?,?,?,?,?,?,0)").run(id,email,username,hashPassword(password),name,now,phone||null,0,'active');
    // IMPORTANT: the account (with its email) is already committed to the users table above.
    // A failure to send the phone-verification SMS must never delete that row again — losing the
    // SMS provider must not mean losing the registration. We keep the account and let the user
    // retry verification later (via the Trips phone-gift screen, which re-sends a fresh OTP).
    let expires = new Date(Date.now()+300000).toISOString();
    let smsSent = false;
    let devCode: string | undefined;
    if (phone) {
      try { const otpResult = await requestPhoneOtp(phone); expires = otpResult.expires; devCode = otpResult.devCode; smsSent = otpResult.provider !== 'development'; }
      catch(e:any) { /* smsSent stays false; user can retry from the Trips phone-gift screen */ }
    }
    const user={id,email,username,name,phone:phone||undefined,phoneVerified:false,activationStatus:'active'};
    res.json({
      token:createSession(id),
      user,
      requiresPhoneVerification: !!phone,
      expiresAt:expires,
      devCode,
      smsSent,
      smsWarning: (!smsSent && process.env.NODE_ENV==='production') ? 'تم إنشاء حسابك وتسجيل بريدك الإلكتروني بنجاح، لكن تعذر إرسال رمز SMS الآن. يمكنك إعادة طلب رمز التحقق لاحقًا من شاشة تفعيل هدية الرحلات.' : undefined,
    });
  }catch(e:any){res.status(500).json({error:e.message||'تعذر إنشاء الحساب'});}
});

app.post('/api/auth/register/verify-phone',async(req,res)=>{
  try{
    const user=authUser(req); if(!user)return res.status(401).json({error:'يجب تسجيل الدخول أولاً'});
    const phone=normalizePhone(req.body.phone), code=String(req.body.code||'').trim();
    const row=db.prepare('SELECT * FROM users WHERE id=? AND phone=?').get(user.id,phone) as any;
    if(!row)return res.status(400).json({error:'رقم الهاتف غير مرتبط بهذا الحساب.'});
    const check=await checkPhoneOtp(phone,code);
    if(!check.ok)return res.status(check.status).json({error:check.error});
    db.exec('BEGIN IMMEDIATE');
    try {
      const priorClaim=db.prepare('SELECT id FROM trip_gift_claims WHERE user_id<>? AND phone_hash=? LIMIT 1').get(user.id,giftSignalHash(phone)) as any;
      const giftEligible=!priorClaim;
      db.prepare('UPDATE users SET phone_verified=1,trip_free_searches=?,trip_gift_claimed_at=? WHERE id=?').run(giftEligible?TRIP_WELCOME_FREE_SEARCHES:0,giftEligible?new Date().toISOString():null,user.id);
      if(giftEligible) db.prepare('INSERT INTO trip_gift_claims (id,user_id,device_hash,ip_hash,phone_hash,created_at) VALUES (?,?,?,?,?,?)').run(`gift_${crypto.randomUUID()}`,user.id,req.body.deviceId?giftSignalHash(String(req.body.deviceId)):null,giftSignalHash(clientIp(req)),giftSignalHash(phone),new Date().toISOString());
      db.prepare('DELETE FROM phone_otps WHERE phone=?').run(phone); db.exec('COMMIT');
      const refreshed=db.prepare('SELECT id,email,username,display_name as name,phone,phone_verified as phoneVerified,activation_status FROM users WHERE id=?').get(user.id) as any;
      res.json({ok:true,user:publicUser(refreshed),giftEligible,freeSearches:giftEligible?TRIP_WELCOME_FREE_SEARCHES:0,message:giftEligible?'تم تأكيد رقم الهاتف 🎉 وحصلت على 3 أبحاث مجانية هدية ترحيبية.':'تم تأكيد رقم الهاتف، لكن الهدية سبق استخدامها بهذا الرقم.'});
    } catch(e){db.exec('ROLLBACK'); throw e;}
  }catch(e:any){res.status(500).json({error:e.message||'تعذر تأكيد رقم الهاتف'});}
});

app.post('/api/auth/trips/request-phone-otp',async(req,res)=>{
  try{ const user=authUser(req); if(!user)return res.status(401).json({error:'يجب تسجيل الدخول أولاً'}); const phone=normalizePhone(req.body.phone); if(phone.length<8)return res.status(400).json({error:'رقم الهاتف غير صحيح'}); const taken=db.prepare('SELECT id FROM users WHERE phone=? AND id<>?').get(phone,user.id) as any; if(taken)return res.status(409).json({error:'رقم الهاتف مرتبط بحساب آخر.'}); try{ const otpResult=await requestPhoneOtp(phone); res.json({ok:true,devCode:otpResult.devCode,expiresAt:otpResult.expires}); }catch(e:any){ return res.status(503).json({error:e.message||'تعذر إرسال SMS'}); } }catch(e:any){res.status(500).json({error:e.message||'تعذر إرسال رمز التحقق'});}
});

app.post('/api/auth/trips/verify-phone',async(req,res)=>{
  try{ const user=authUser(req); if(!user)return res.status(401).json({error:'يجب تسجيل الدخول أولاً'}); const phone=normalizePhone(req.body.phone),code=String(req.body.code||'').trim(); const row=db.prepare('SELECT * FROM users WHERE id=?').get(user.id) as any; if(!row)return res.status(404).json({error:'الحساب غير موجود'}); if(row.phone_verified)return res.json({ok:true,user:publicUser({...row,phoneVerified:true}),freeSearches:Number(row.trip_free_searches||0),alreadyVerified:true}); const check=await checkPhoneOtp(phone,code); if(!check.ok)return res.status(check.status).json({error:check.error}); const taken=db.prepare('SELECT id FROM users WHERE phone=? AND id<>?').get(phone,user.id) as any; if(taken)return res.status(409).json({error:'رقم الهاتف مرتبط بحساب آخر.'}); db.exec('BEGIN IMMEDIATE'); try{ const priorClaim=db.prepare('SELECT id FROM trip_gift_claims WHERE user_id<>? AND phone_hash=? LIMIT 1').get(user.id,giftSignalHash(phone)) as any; const giftEligible=!priorClaim; db.prepare('UPDATE users SET phone=?,phone_verified=1,trip_free_searches=?,trip_gift_claimed_at=? WHERE id=?').run(phone,giftEligible?TRIP_WELCOME_FREE_SEARCHES:0,giftEligible?new Date().toISOString():null,user.id); if(giftEligible)db.prepare('INSERT INTO trip_gift_claims (id,user_id,device_hash,ip_hash,phone_hash,created_at) VALUES (?,?,?,?,?,?)').run(`gift_${crypto.randomUUID()}`,user.id,req.body.deviceId?giftSignalHash(String(req.body.deviceId)):null,giftSignalHash(clientIp(req)),giftSignalHash(phone),new Date().toISOString()); db.prepare('DELETE FROM phone_otps WHERE phone=?').run(phone); db.exec('COMMIT'); const refreshed=db.prepare('SELECT id,email,username,display_name as name,phone,phone_verified as phoneVerified,activation_status FROM users WHERE id=?').get(user.id) as any; res.json({ok:true,user:publicUser(refreshed),giftEligible,freeSearches:giftEligible?3:0,message:giftEligible?'تم تأكيد رقم الهاتف 🎉 حصلت على 3 أبحاث مجانية هدية ترحيبية.':'تم تأكيد الهاتف، لكن الهدية سبق استخدامها بهذا الرقم.'}); }catch(e){db.exec('ROLLBACK');throw e;} }catch(e:any){res.status(500).json({error:e.message||'تعذر تأكيد رقم الهاتف'});}
});

app.post('/api/auth/login',async(req,res)=>{try{if(!(await requireAuthTurnstile(req,res)))return;const identifier=String(req.body.identifier||req.body.email||'').trim(),normalizedEmail=identifier.toLowerCase(),normalizedUsername=normalizeUsername(identifier),password=String(req.body.password||'');let row:any=null;if(identifier.includes('@')) row=db.prepare('SELECT * FROM users WHERE email=?').get(normalizedEmail) as any;else row=db.prepare('SELECT * FROM users WHERE username=?').get(normalizedUsername) as any;if(!row||!verifyPassword(password,row.password_hash))return res.status(401).json({error:'بيانات الدخول غير صحيحة. تأكد من البريد أو اسم المستخدم وكلمة المرور.'});const dbRole=String(row.role||'user').toLowerCase();if(!VALID_APP_ROLES.has(dbRole))return res.status(403).json({error:'دور الحساب غير صالح.'});if(OWNER_EMAILS.has(String(row.email).toLowerCase())&&['owner','admin'].includes(dbRole)){const roleChoiceTicket=issueRoleSelectionTicket({...row,role:dbRole});const claims=verifyJwt(roleChoiceTicket);return res.json({requiresRoleChoice:true,roleChoiceTicket,actualRoleInDB:dbRole,availableRoles:claims?.availableRoles||['user']});}const user={...row,name:row.display_name,phoneVerified:row.phone_verified,selectedRole:'user'};res.json({token:createSession(row.id),user:publicUser(user)});}catch(e:any){res.status(500).json({error:'تعذر تسجيل الدخول'});}});
app.post('/api/auth/select-role',(req,res)=>{try{const claims=verifyJwt(String(req.body.roleChoiceTicket||'')),requestedRole=String(req.body.role||'').trim().toLowerCase();if(!claims||claims.purpose!=='role_selection'||!claims.sub)return res.status(401).json({error:'انتهت صلاحية اختيار نوع الدخول. سجّل الدخول مرة أخرى.'});if(!VALID_APP_ROLES.has(requestedRole))return res.status(400).json({error:'نوع الدخول غير صالح.'});const row=db.prepare('SELECT * FROM users WHERE id=?').get(String(claims.sub)) as any;if(!row)return res.status(401).json({error:'الحساب غير موجود.'});const dbRole=String(row.role||'user').toLowerCase();if(dbRole!==String(claims.actualRoleInDB)||String(row.email).toLowerCase()!==String(claims.email).toLowerCase())return res.status(403).json({error:'تم تغيير صلاحيات الحساب. سجّل الدخول مرة أخرى.'});if(requestedRole==='owner'&&dbRole!=='owner')return res.status(403).json({error:'لا تملك صلاحية الدخول كمالك.'});if(requestedRole==='admin'&&dbRole!=='admin'&&dbRole!=='owner')return res.status(403).json({error:'لا تملك صلاحية الدخول كمسؤول.'});if(!rolesForDbRole(dbRole).includes(requestedRole))return res.status(403).json({error:'نوع الدخول غير مسموح لهذا الحساب.'});if(requestedRole!=='user'&&!OWNER_EMAILS.has(String(row.email).toLowerCase()))return res.status(403).json({error:'هذا الحساب غير مخوّل لاختيار هذا النوع من الدخول.'});const now=Math.floor(Date.now()/1000),sid=createSession(row.id),token=signJwt({purpose:'app_session',sub:row.id,sid,email:row.email,role:dbRole,selectedRole:requestedRole,iat:now,exp:now+AUTH_SESSION_DAYS*86400});db.prepare('UPDATE sessions SET session_role=? WHERE id=?').run(requestedRole,sid);res.json({token,user:publicUser({...row,name:row.display_name,phoneVerified:row.phone_verified,selectedRole:requestedRole})});}catch(e:any){res.status(500).json({error:'تعذر اختيار نوع الدخول.'});}});
app.get('/api/auth/me',(req,res)=>{const user=authUser(req);if(!user)return res.status(401).json({error:'جلسة الدخول منتهية'});res.json({user:publicUser(user)});});
app.post('/api/auth/owner/activate',(req,res)=>{try{const ownerEmail=String(req.body.ownerEmail||'').trim().toLowerCase(),key=String(req.body.activationKey||'').trim(),userEmail=String(req.body.userEmail||'').trim().toLowerCase();if(ownerEmail!==PROGRAM_OWNER_EMAIL)return res.status(403).json({error:'هذا الإجراء مخصص لصاحب البرنامج.'});if(!PROGRAM_OWNER_ACTIVATION_KEY||key!==PROGRAM_OWNER_ACTIVATION_KEY)return res.status(403).json({error:'مفتاح تفعيل المالك غير صحيح أو غير مُكوّن.'});const user=db.prepare('SELECT id FROM users WHERE email=?').get(userEmail) as any;if(!user)return res.status(404).json({error:'الحساب غير موجود.'});db.prepare("UPDATE users SET activation_status='active',activated_by=?,activated_at=? WHERE id=?").run(ownerEmail,new Date().toISOString(),user.id);res.json({ok:true,message:'تم اعتماد الحساب بنجاح.'});}catch(e:any){res.status(500).json({error:e.message||'تعذر اعتماد الحساب'});}});
app.post('/api/auth/phone-login/request-otp',async(req,res)=>{try{const phone=normalizePhone(req.body.phone);if(phone.length<8)return res.status(400).json({error:'رقم الهاتف غير صحيح'});const row=db.prepare('SELECT id FROM users WHERE phone=? AND phone_verified=1').get(phone) as any;if(!row)return res.status(404).json({error:'هذا الرقم غير مرتبط بحساب موثق.'});try{const otpResult=await requestPhoneOtp(phone);res.json({ok:true,expiresAt:otpResult.expires,devCode:otpResult.devCode,smsProvider:otpResult.provider});}catch(err:any){return res.status(503).json({error:err.message||'تعذر إرسال SMS'});}}catch(e:any){res.status(500).json({error:e.message||'تعذر إرسال رمز SMS'});}});
app.post('/api/auth/phone-login',async(req,res)=>{try{const phone=normalizePhone(req.body.phone),code=String(req.body.code||'').trim();const check=await checkPhoneOtp(phone,code);if(!check.ok)return res.status(check.status).json({error:check.error});const row=db.prepare('SELECT * FROM users WHERE phone=? AND phone_verified=1').get(phone) as any;if(!row)return res.status(404).json({error:'هذا الرقم غير مرتبط بحساب موثق.'});db.prepare('DELETE FROM phone_otps WHERE phone=?').run(phone);res.json({token:createSession(row.id),user:publicUser({...row,name:row.display_name,phoneVerified:row.phone_verified})});}catch(e:any){res.status(500).json({error:e.message||'تعذر تسجيل الدخول بالهاتف'});}});
app.post('/api/auth/forgot-password',async(req,res)=>{const generic={ok:true,message:'إذا كان البريد الإلكتروني مسجلاً فستصلك تعليمات استعادة كلمة المرور خلال دقائق.'};try{if(!(await requireAuthTurnstile(req,res)))return;const email=String(req.body.email||'').trim().toLowerCase();if(!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.json(generic);const row=db.prepare('SELECT id FROM users WHERE email=?').get(email) as any;if(!row)return res.json(generic);const code=crypto.randomBytes(32).toString('hex'),expires=new Date(Date.now()+PASSWORD_RESET_MINUTES*60000).toISOString();db.prepare(`INSERT INTO password_resets(email,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,created_at=excluded.created_at`).run(email,otpHash(code),expires,0,new Date().toISOString());try{console.log('SMTP_ATTEMPT',{recipient:email.replace(/^(.).+(@.*)$/,'$1***$2')});await sendPasswordResetEmail(email,code,PASSWORD_RESET_MINUTES);res.json(generic);}catch(mailErr:any){db.prepare('DELETE FROM password_resets WHERE email=?').run(email);console.error('SMTP_FAILED',{recipient:email.replace(/^(.).+(@.*)$/,'$1***$2'),code:String(mailErr?.code||'MAIL_SEND_FAILED')});res.json(generic);}}catch(e:any){console.error('PASSWORD_RESET_REQUEST_FAILED',{code:String(e?.code||'INTERNAL_ERROR')});res.json(generic);}});
app.post('/api/auth/reset-password',async(req,res)=>{try{if(!(await requireAuthTurnstile(req,res)))return;const email=String(req.body.email||'').trim().toLowerCase(),code=String(req.body.code||req.body.token||'').trim(),newPassword=String(req.body.newPassword||'');if(newPassword.length<8)return res.status(400).json({error:'كلمة المرور يجب أن تكون 8 أحرف على الأقل'});if(!/^[a-f0-9]{64}$/i.test(code))return res.status(400).json({error:'رمز الاستعادة غير صحيح أو منتهي.'});const reset=db.prepare('SELECT * FROM password_resets WHERE email=?').get(email) as any;if(!reset||new Date(reset.expires_at).getTime()<Date.now())return res.status(400).json({error:'رمز الاستعادة غير صحيح أو منتهي.'});if(reset.attempts>=5)return res.status(429).json({error:'تم تجاوز عدد المحاولات.'});db.prepare('UPDATE password_resets SET attempts=attempts+1 WHERE email=?').run(email);if(otpHash(code)!==reset.code_hash)return res.status(400).json({error:'رمز الاستعادة غير صحيح أو منتهي.'});db.exec('BEGIN IMMEDIATE');try{const changed=db.prepare('UPDATE users SET password_hash=? WHERE email=?').run(hashPassword(newPassword),email);if(!Number(changed.changes)){db.exec('ROLLBACK');return res.status(400).json({error:'رمز الاستعادة غير صحيح أو منتهي.'});}db.prepare('DELETE FROM password_resets WHERE email=?').run(email);db.exec('COMMIT');res.json({ok:true});}catch(e){db.exec('ROLLBACK');throw e;}}catch(e:any){res.status(500).json({error:'تعذر تغيير كلمة المرور.'});}});
app.post('/api/auth/logout',(req,res)=>{const h=String(req.headers.authorization||''),token=h.startsWith('Bearer ')?h.slice(7).trim():'';if(token){const claims=token.split('.').length===3?verifyJwt(token):null;db.prepare('DELETE FROM sessions WHERE id=?').run(claims?.purpose==='app_session'?String(claims.sid||''):token);}res.json({ok:true});});
app.post('/api/auth/chat/request-otp',async(req,res)=>{try{const user=authUser(req);if(!user)return res.status(401).json({error:'يجب تسجيل الدخول بالبريد أولاً'});const phone=normalizePhone(req.body.phone);if(phone.length<8)return res.status(400).json({error:'رقم الهاتف غير صحيح'});const taken=db.prepare('SELECT id FROM users WHERE phone=? AND id<>?').get(phone,user.id) as any;if(taken)return res.status(409).json({error:'رقم الهاتف مرتبط بحساب آخر'});try{const otpResult=await requestPhoneOtp(phone);res.json({ok:true,expiresAt:otpResult.expires,devCode:otpResult.devCode,smsProvider:otpResult.provider});}catch(err:any){return res.status(503).json({error:err.message||'تعذر إرسال SMS'});}}catch(e:any){res.status(500).json({error:e.message||'تعذر إرسال رمز التحقق'});}});
app.post('/api/auth/chat/verify-otp',async(req,res)=>{try{const user=authUser(req);if(!user)return res.status(401).json({error:'جلسة الدخول غير صالحة'});const phone=normalizePhone(req.body.phone),code=String(req.body.code||'').trim();const check=await checkPhoneOtp(phone,code);if(!check.ok)return res.status(check.status).json({error:check.error});db.prepare('UPDATE users SET phone=?,phone_verified=1 WHERE id=?').run(phone,user.id);db.prepare('DELETE FROM phone_otps WHERE phone=?').run(phone);const refreshed=db.prepare('SELECT id,email,username,display_name as name,phone,phone_verified as phoneVerified,activation_status FROM users WHERE id=?').get(user.id) as any;res.json({token:createSession(user.id),user:publicUser(refreshed)});}catch(e:any){res.status(500).json({error:e.message||'تعذر تأكيد الرقم'});}});


// ----------------------------------------------------
// 1. Health check
// ----------------------------------------------------
app.get('/api/user/settings',(req,res)=>{try{const user=authUser(req);if(!user)return res.status(401).json({error:'يجب تسجيل الدخول أولاً.'});const row=db.prepare("SELECT payload_json,updated_at FROM user_app_data WHERE user_id=? AND data_key='settings'").get(user.id) as any;let settings:any={};if(row){try{settings=JSON.parse(row.payload_json);}catch{return res.status(500).json({error:'تعذر قراءة إعدادات الحساب.'});}}res.json({ok:true,settings,updatedAt:row?.updated_at||null});}catch{return res.status(500).json({error:'تعذر قراءة إعدادات الحساب.'});}});
app.post('/api/user/settings',(req,res)=>{try{const user=authUser(req);if(!user)return res.status(401).json({error:'يجب تسجيل الدخول أولاً.'});const settings=req.body?.settings;if(!settings||typeof settings!=='object'||Array.isArray(settings))return res.status(400).json({error:'صيغة الإعدادات غير صحيحة.'});const payload=JSON.stringify(settings);if(Buffer.byteLength(payload,'utf8')>1024*1024)return res.status(413).json({error:'حجم الإعدادات أكبر من المسموح.'});const updatedAt=new Date().toISOString();db.prepare("INSERT INTO user_app_data(user_id,data_key,payload_json,updated_at) VALUES(?,'settings',?,?) ON CONFLICT(user_id,data_key) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at").run(user.id,payload,updatedAt);res.json({ok:true,updatedAt});}catch{return res.status(500).json({error:'تعذر حفظ إعدادات الحساب.'});}});
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "SMART TIME — وقتك من ذهب",
    version: "25.7",
    database: "sqlite",
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------
// 1B. V8 Real Services Foundation
// ----------------------------------------------------
app.get("/api/services/status", (_req, res) => {
  res.json({ version: "25.7", services: getServiceStatuses(), timestamp: new Date().toISOString() });
});

app.get("/api/database/health", (_req, res) => {
  try {
    const row = db.prepare("SELECT datetime('now') as now").get();
    setServiceStatus("database", "LIVE", "sqlite", "Database is writable and reachable");
    res.json({ status: "LIVE", engine: "sqlite", row });
  } catch (error:any) {
    setServiceStatus("database", "OFFLINE", "sqlite", error.message);
    res.status(500).json({ status: "OFFLINE", error: error.message });
  }
});

// ----------------------------------------------------
// 2. AI Center - SMART AI (Keyless App Intelligence)
// ----------------------------------------------------
// SMART AI is app-owned. The V1 core answers app-data questions from
// sanitized SMART TIME context and does not require an AI API key.
const handleAiChat = async (req: express.Request, res: express.Response) => {
  const language = String(req.body?.language || "ar") === "en" ? "en" : "ar";
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول لاستخدام SMART AI." });

    const message = String(req.body?.message || req.body?.prompt || "").trim();
    const conversationHistory = Array.isArray(req.body?.conversationHistory)
      ? req.body.conversationHistory.slice(-8)
      : [];
    const appContext = req.body?.appContext;

    if (!message) return res.status(400).json({ error: "Message is required" });
    if (!appContext || typeof appContext !== "object") {
      return res.status(400).json({ error: "بيانات سياق SMART TIME مطلوبة." });
    }

    const response = await askSmartAiCore({
      message,
      language,
      conversationHistory,
      appContext: appContext as Record<string, unknown>,
    });

    return res.json(response);
  } catch (error: any) {
    console.error("SMART AI Core error:", error?.message || error);
    return res.status(500).json({
      error: language === "en"
        ? "SMART AI could not process this request."
        : "تعذر تشغيل SMART AI لهذه الرسالة.",
    });
  }
};

app.post("/api/ai/chat", handleAiChat);
app.post("/api/gemini/chat", handleAiChat);

app.get("/api/ai/status", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  res.json({
    provider: "smart-ai",
    core: "smart-time-core",
    deterministic: true,
    localInferenceConfigured: isLocalSmartAiConfigured(),
    localModel: isLocalSmartAiConfigured() ? String(process.env.SMART_AI_LOCAL_MODEL || "smart-time-local").trim() : null,
    apiKeyRequired: false,
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------
// SMART VOICE DNA - private family sharing metadata
// ----------------------------------------------------
// This API stores only profile metadata and share permissions.
// Reference audio remains on the owner's device in V1.
app.post("/api/voice-dna/profiles", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });

    const id = String(req.body?.id || "").trim();
    const displayName = String(req.body?.displayName || "").trim().slice(0, 120);
    const relationship = String(req.body?.relationship || "family").trim().slice(0, 40);
    const language = String(req.body?.language || "ar") === "en" ? "en" : "ar";
    const locale = language === "en" ? "en-US" : "ar-EG";
    const dialect = String(req.body?.dialect || locale).trim().slice(0, 20);
    const speakingStyle = String(req.body?.speakingStyle || "natural").trim().slice(0, 30);
    const engineStatus = String(req.body?.engineStatus || "pending_local_engine").trim().slice(0, 40);
    const ownerConfirmed = req.body?.ownerConfirmed === true;
    const guardianConfirmed = req.body?.guardianConfirmed === true;
    const consentRecordedAt = String(req.body?.consentRecordedAt || "").trim().slice(0, 60);
    const validRelationships = new Set(["self", "father", "mother", "spouse", "son", "daughter", "family"]);
    const validDialects = new Set(["ar-EG", "en-US"]);
    const validSpeakingStyles = new Set(["natural", "calm", "warm", "formal", "alert"]);
    const validEngineStatuses = new Set(["pending_local_engine", "ready"]);
    const requiresGuardian = relationship === "son" || relationship === "daughter";

    if (!id || !displayName) return res.status(400).json({ error: "Voice profile id and name are required." });
    if (!validRelationships.has(relationship)) return res.status(400).json({ error: "صلة القرابة غير صالحة." });
    if (!validDialects.has(dialect) || dialect !== locale) return res.status(400).json({ error: "لهجة Voice DNA غير متوافقة مع اللغة." });
    if (!validSpeakingStyles.has(speakingStyle)) return res.status(400).json({ error: "أسلوب الكلام غير صالح." });
    if (!validEngineStatuses.has(engineStatus)) return res.status(400).json({ error: "حالة محرك Voice DNA غير صالحة." });
    if (!ownerConfirmed) return res.status(400).json({ error: "صاحب الصوت لازم يوافق بنفسه." });
    if (requiresGuardian && !guardianConfirmed) return res.status(400).json({ error: "موافقة ولي الأمر مطلوبة لصوت الطفل." });

    const existingProfile = db.prepare("SELECT owner_user_id as ownerUserId, revoked_at as revokedAt FROM voice_dna_profiles WHERE id=?").get(id) as any;
    if (existingProfile && String(existingProfile.ownerUserId) !== String(user.id)) {
      return res.status(403).json({ error: "ملف Voice DNA مرتبط بحساب آخر." });
    }

    db.prepare(`INSERT INTO voice_dna_profiles
      (id, owner_user_id, display_name, relationship, language, locale, dialect, speaking_style, engine_status, owner_confirmed, guardian_confirmed, consent_recorded_at, created_at, revoked_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?, ?, ?,NULL)
      ON CONFLICT(id) DO UPDATE SET
        display_name=excluded.display_name,
        relationship=excluded.relationship,
        language=excluded.language,
        locale=excluded.locale,
        dialect=excluded.dialect,
        speaking_style=excluded.speaking_style,
        engine_status=excluded.engine_status,
        owner_confirmed=excluded.owner_confirmed,
        guardian_confirmed=excluded.guardian_confirmed,
        consent_recorded_at=excluded.consent_recorded_at,
        revoked_at=NULL`)
      .run(id, user.id, displayName, relationship, language, locale, dialect, speakingStyle, engineStatus, ownerConfirmed ? 1 : 0, guardianConfirmed ? 1 : 0, consentRecordedAt || new Date().toISOString(), new Date().toISOString());

    return res.json({ ok: true, id });
  } catch (error: any) {
    console.error("Voice DNA profile registration error:", error?.message || error);
    return res.status(500).json({ error: "تعذر تسجيل ملف Voice DNA." });
  }
});

app.post("/api/voice-dna/profiles/:id/revoke", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    const profileId = String(req.params.id || "").trim();
    const profile = db.prepare("SELECT id FROM voice_dna_profiles WHERE id=? AND owner_user_id=? AND revoked_at IS NULL").get(profileId, user.id) as any;
    if (!profile) return res.status(404).json({ error: "ملف Voice DNA غير موجود." });

    const now = new Date().toISOString();
    db.prepare("UPDATE voice_dna_profiles SET revoked_at=? WHERE id=? AND owner_user_id=?").run(now, profileId, user.id);
    db.prepare("UPDATE voice_dna_shares SET status='revoked', revoked_at=? WHERE profile_id=?").run(now, profileId);
    db.prepare("UPDATE voice_dna_sync_packages SET revoked_at=? WHERE profile_id=? AND revoked_at IS NULL").run(now, profileId);
    db.prepare("DELETE FROM voice_dna_recovery_samples WHERE user_id=? AND profile_id=?").run(user.id, profileId);
    return res.json({ ok: true, status: "revoked" });
  } catch (error: any) {
    console.error("Voice DNA profile revoke error:", error?.message || error);
    return res.status(500).json({ error: "تعذر إلغاء ملف Voice DNA." });
  }
});

app.get("/api/voice-dna/profiles", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    const rows = db.prepare(`SELECT id, owner_user_id as ownerUserId, display_name as displayName,
      relationship, language, locale, dialect, speaking_style as speakingStyle,
      engine_status as engineStatus, owner_confirmed as ownerConfirmed,
      guardian_confirmed as guardianConfirmed, consent_recorded_at as consentRecordedAt,
      created_at as createdAt, revoked_at as revokedAt
      FROM voice_dna_profiles
      WHERE owner_user_id=? AND revoked_at IS NULL
      ORDER BY created_at ASC`).all(user.id);
    return res.json({ profiles: rows });
  } catch (error: any) {
    return res.status(500).json({ error: "تعذر قراءة ملفات Voice DNA." });
  }
});

app.post("/api/voice-dna/shares", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });

    const profileId = String(req.body?.profileId || "").trim();
    const recipientIdentifier = String(req.body?.recipientIdentifier || "").trim().toLowerCase();

    const profile = db.prepare("SELECT id FROM voice_dna_profiles WHERE id=? AND owner_user_id=? AND revoked_at IS NULL").get(profileId, user.id) as any;
    if (!profile) return res.status(404).json({ error: "Voice DNA profile not found." });
    if (!recipientIdentifier) return res.status(400).json({ error: "Recipient username or email is required." });

    const recipient = db.prepare("SELECT id FROM users WHERE lower(username)=? OR lower(email)=?").get(recipientIdentifier, recipientIdentifier) as any;
    if (!recipient) return res.status(404).json({ error: "المستخدم المستلم غير موجود." });
    if (recipient.id === user.id) return res.status(400).json({ error: "لا يمكن مشاركة الصوت مع نفس الحساب." });

    const shareId = "vshare_" + crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO voice_dna_shares
      (id, profile_id, owner_user_id, recipient_user_id, status, created_at, accepted_at, revoked_at)
      VALUES (?,?,?,?, 'pending', ?, NULL, NULL)
      ON CONFLICT(profile_id, recipient_user_id) DO UPDATE SET status='pending', created_at=excluded.created_at, accepted_at=NULL, revoked_at=NULL`)
      .run(shareId, profileId, user.id, recipient.id, now);

    return res.json({ ok: true, status: "pending" });
  } catch (error: any) {
    console.error("Voice DNA share error:", error?.message || error);
    return res.status(500).json({ error: "تعذر إنشاء مشاركة Voice DNA." });
  }
});

app.get("/api/voice-dna/shares", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });

    const outgoing = db.prepare(`SELECT s.id, s.profile_id as profileId, p.display_name as displayName,
      s.recipient_user_id as recipientUserId, u.username as recipientUsername, s.status, s.created_at as createdAt,
      s.accepted_at as acceptedAt, s.revoked_at as revokedAt
      FROM voice_dna_shares s
      JOIN voice_dna_profiles p ON p.id=s.profile_id
      JOIN users u ON u.id=s.recipient_user_id
      WHERE s.owner_user_id=?
      ORDER BY s.created_at DESC`).all(user.id);

    const incoming = db.prepare(`SELECT s.id, s.profile_id as profileId, p.display_name as displayName,
      s.owner_user_id as ownerUserId, u.username as ownerUsername, s.status, s.created_at as createdAt,
      s.accepted_at as acceptedAt, s.revoked_at as revokedAt
      FROM voice_dna_shares s
      JOIN voice_dna_profiles p ON p.id=s.profile_id
      JOIN users u ON u.id=s.owner_user_id
      WHERE s.recipient_user_id=?
      ORDER BY s.created_at DESC`).all(user.id);

    return res.json({ outgoing, incoming });
  } catch (error: any) {
    return res.status(500).json({ error: "تعذر قراءة مشاركات Voice DNA." });
  }
});

app.post("/api/voice-dna/shares/:id/accept", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    const shareId = String(req.params.id || "").trim();
    const row = db.prepare("SELECT id FROM voice_dna_shares WHERE id=? AND recipient_user_id=? AND status='pending'").get(shareId, user.id) as any;
    if (!row) return res.status(404).json({ error: "دعوة مشاركة الصوت غير موجودة." });

    db.prepare("UPDATE voice_dna_shares SET status='active', accepted_at=?, revoked_at=NULL WHERE id=?")
      .run(new Date().toISOString(), shareId);
    return res.json({ ok: true, status: "active" });
  } catch (error: any) {
    return res.status(500).json({ error: "تعذر قبول مشاركة Voice DNA." });
  }
});

app.post("/api/voice-dna/shares/:id/revoke", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    const shareId = String(req.params.id || "").trim();
    const row = db.prepare("SELECT id FROM voice_dna_shares WHERE id=? AND (owner_user_id=? OR recipient_user_id=?)")
      .get(shareId, user.id, user.id) as any;
    if (!row) return res.status(404).json({ error: "مشاركة الصوت غير موجودة." });

    db.prepare("UPDATE voice_dna_shares SET status='revoked', revoked_at=? WHERE id=?")
      .run(new Date().toISOString(), shareId);
    return res.json({ ok: true, status: "revoked" });
  } catch (error: any) {
    return res.status(500).json({ error: "تعذر إلغاء مشاركة Voice DNA." });
  }
});

// ----------------------------------------------------
// SMART VOICE DNA - encrypted sync
app.get("/api/voice-dna/status", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    const configured = smartVoiceDnaProvider.isAvailable();
    const healthy = configured ? await checkVoiceDnaProviderHealth() : false;
    return res.json({
      provider: smartVoiceDnaProvider.id,
      configured,
      healthy,
      localOnly: smartVoiceDnaProvider.id === "voicetut-local",
    });
  } catch {
    return res.status(500).json({ error: "تعذر قراءة حالة Voice DNA." });
  }
});

app.post("/api/voice-dna/synthesize", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    if (!smartVoiceDnaProvider.isAvailable()) return res.status(503).json({ error: "محرك Voice DNA المحلي غير موصل حاليًا." });
    if (!consumeVoiceDnaQuota(String(user.id))) {
      return res.status(429).json({ error: "تم الوصول للحد المؤقت لتوليد Voice DNA. حاول بعد قليل." });
    }
    if (req.body?.consentConfirmed !== true) return res.status(400).json({ error: "لازم تأكيد موافقة استخدام الصوت قبل التوليد." });

    const profileId = String(req.body?.profileId || "").trim();
    const text = String(req.body?.text || "").trim();
    const referenceAudioBase64 = String(req.body?.referenceAudioBase64 || "").trim();
    const referenceMimeType = String(req.body?.referenceMimeType || "audio/webm").trim().slice(0, 100);
    const referenceText = String(req.body?.referenceText || "").trim().slice(0, 1000);
    const speakingStyle = String(req.body?.speakingStyle || "natural").trim();

    if (!profileId || !text || !referenceAudioBase64) return res.status(400).json({ error: "بيانات توليد الصوت غير مكتملة." });
    if (text.length > 4000) return res.status(413).json({ error: "النص طويل جدًا." });

    const profile = db.prepare(`SELECT id, owner_user_id as ownerUserId, language, locale, dialect, speaking_style as speakingStyle,
      relationship, owner_confirmed as ownerConfirmed, guardian_confirmed as guardianConfirmed
      FROM voice_dna_profiles WHERE id=? AND revoked_at IS NULL`).get(profileId) as any;
    if (!profile) return res.status(404).json({ error: "ملف Voice DNA غير موجود." });

    const owns = String(profile.ownerUserId) === String(user.id);
    const shared = Boolean(db.prepare("SELECT 1 FROM voice_dna_shares WHERE profile_id=? AND recipient_user_id=? AND status='active'").get(profileId, user.id));
    if (!owns && !shared) return res.status(403).json({ error: "لا توجد صلاحية لاستخدام هذا الصوت." });
    if (!profile.ownerConfirmed) return res.status(403).json({ error: "ملف الصوت لا يحمل موافقة صاحبه." });
    if ((profile.relationship === "son" || profile.relationship === "daughter") && !profile.guardianConfirmed) return res.status(403).json({ error: "موافقة ولي الأمر غير مكتملة." });

    const referenceAudio = Uint8Array.from(Buffer.from(referenceAudioBase64, "base64"));
    const maxBytes = Math.max(256 * 1024, Number(process.env.SMART_VOICE_DNA_MAX_REFERENCE_BYTES || 8 * 1024 * 1024));
    if (referenceAudio.length === 0 || referenceAudio.length > maxBytes) return res.status(413).json({ error: "حجم عينة الصوت غير مسموح." });

    const result = await smartVoiceDnaProvider.synthesize({
      text,
      language: profile.language === "en" ? "en" : "ar",
      locale: profile.locale === "en-US" ? "en-US" : "ar-EG",
      profileId,
      referenceAudio,
      referenceMimeType,
      referenceText,
      speakingStyle: ["natural", "calm", "warm", "formal", "alert"].includes(speakingStyle) ? speakingStyle as any : "natural",
    });

    res.setHeader("Content-Type", result.contentType || "audio/wav");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-SMART-VOICE-PROVIDER", result.provider);
    return res.send(Buffer.from(result.audio));
  } catch (error: any) {
    console.error("Voice DNA synthesis error:", error?.message || error);
    return res.status(502).json({ error: "تعذر توليد الصوت من المحرك المحلي." });
  }
});


// ----------------------------------------------------
app.post("/api/voice-dna/keys/public", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    const algorithm = String(req.body?.algorithm || "").trim().slice(0, 120);
    const publicJwk = req.body?.publicJwk;
    if (!algorithm || !publicJwk || typeof publicJwk !== "object") return res.status(400).json({ error: "Public Voice DNA key is required." });
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO voice_dna_public_keys (user_id, algorithm, public_jwk_json, created_at, rotated_at)
      VALUES (?,?,?,?,NULL)
      ON CONFLICT(user_id) DO UPDATE SET algorithm=excluded.algorithm, public_jwk_json=excluded.public_jwk_json, rotated_at=excluded.created_at`)
      .run(user.id, algorithm, JSON.stringify(publicJwk), now);
    return res.json({ ok: true });
  } catch (error: any) {
    console.error("Voice DNA public key registration error:", error?.message || error);
    return res.status(500).json({ error: "تعذر تسجيل مفتاح Voice DNA العام." });
  }
});

app.get("/api/voice-dna/keys/public/:userId", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    const userId = String(req.params.userId || "").trim();
    const row = db.prepare("SELECT algorithm, public_jwk_json as publicJwkJson FROM voice_dna_public_keys WHERE user_id=?").get(userId) as any;
    if (!row) return res.status(404).json({ error: "المستخدم لم يسجل مفتاح Voice DNA بعد." });
    return res.json({ algorithm: row.algorithm, publicJwk: JSON.parse(String(row.publicJwkJson)) });
  } catch {
    return res.status(500).json({ error: "تعذر قراءة مفتاح Voice DNA العام." });
  }
});
 
app.post("/api/voice-dna/recovery/envelope", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });

    const algorithm = String(req.body?.algorithm || "").trim().slice(0, 80);
    const kdf = String(req.body?.kdf || "").trim().slice(0, 80);
    const iterations = Number(req.body?.iterations || 0);
    const salt = String(req.body?.salt || "").trim();
    const iv = String(req.body?.iv || "").trim();
    const ciphertext = String(req.body?.ciphertext || "").trim();
    const publicJwk = req.body?.publicJwk;

    if (algorithm !== "RSA-OAEP-256" || kdf !== "PBKDF2-SHA-256") {
      return res.status(400).json({ error: "صيغة مفتاح الاسترداد غير مدعومة." });
    }
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 2000000) {
      return res.status(400).json({ error: "عدد دورات الاسترداد غير صالح." });
    }
    if (!salt || !iv || !ciphertext || !publicJwk || typeof publicJwk !== "object") {
      return res.status(400).json({ error: "بيانات استرداد Voice DNA غير مكتملة." });
    }
    if (salt.length > 128 || iv.length > 64 || ciphertext.length > 20000) {
      return res.status(413).json({ error: "حزمة استرداد Voice DNA كبيرة جدًا." });
    }

    const now = new Date().toISOString();

    // Rotating the recovery envelope rotates the encryption key for sample backups too.
    // Remove samples encrypted with the previous recovery key before replacing the envelope.
    db.prepare("DELETE FROM voice_dna_recovery_samples WHERE user_id=?").run(user.id);

    db.prepare(`INSERT INTO voice_dna_recovery_envelopes
      (user_id, algorithm, kdf, iterations, salt, iv, ciphertext, public_jwk_json, created_at, rotated_at)
      VALUES (?,?,?,?,?,?,?,?,?,NULL)
      ON CONFLICT(user_id) DO UPDATE SET
        algorithm=excluded.algorithm,
        kdf=excluded.kdf,
        iterations=excluded.iterations,
        salt=excluded.salt,
        iv=excluded.iv,
        ciphertext=excluded.ciphertext,
        public_jwk_json=excluded.public_jwk_json,
        rotated_at=excluded.created_at`)
      .run(user.id, algorithm, kdf, iterations, salt, iv, ciphertext, JSON.stringify(publicJwk), now);

    return res.json({ ok: true, rotatedAt: now });
  } catch (error: any) {
    console.error("Voice DNA recovery envelope error:", error?.message || error);
    return res.status(500).json({ error: "تعذر حفظ نسخة استرداد Voice DNA." });
  }
});

app.get("/api/voice-dna/recovery/envelope", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });

    const row = db.prepare(`SELECT algorithm, kdf, iterations, salt, iv, ciphertext, public_jwk_json as publicJwkJson,
      created_at as createdAt, rotated_at as rotatedAt
      FROM voice_dna_recovery_envelopes WHERE user_id=?`).get(user.id) as any;
    if (!row) return res.status(404).json({ error: "لا توجد نسخة استرداد Voice DNA لهذا الحساب." });

    return res.json({
      algorithm: row.algorithm,
      kdf: row.kdf,
      iterations: Number(row.iterations),
      salt: row.salt,
      iv: row.iv,
      ciphertext: row.ciphertext,
      publicJwk: JSON.parse(String(row.publicJwkJson)),
      createdAt: row.createdAt,
      rotatedAt: row.rotatedAt,
    });
  } catch {
    return res.status(500).json({ error: "تعذر قراءة نسخة استرداد Voice DNA." });
  }
});

app.delete("/api/voice-dna/recovery/envelope", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    db.prepare("DELETE FROM voice_dna_recovery_samples WHERE user_id=?").run(user.id);
    db.prepare("DELETE FROM voice_dna_recovery_envelopes WHERE user_id=?").run(user.id);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "تعذر حذف نسخة استرداد Voice DNA." });
  }
});
 
app.post("/api/voice-dna/recovery/samples", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });

    const profileId = String(req.body?.profileId || "").trim();
    const salt = String(req.body?.salt || "").trim();
    const iv = String(req.body?.iv || "").trim();
    const ciphertext = String(req.body?.ciphertext || "").trim();
    const mimeType = String(req.body?.mimeType || "audio/webm").trim().slice(0, 100);
    const durationMs = Number(req.body?.durationMs || 0);

    if (!profileId || !salt || !iv || !ciphertext) {
      return res.status(400).json({ error: "بيانات النسخة الاحتياطية للصوت غير مكتملة." });
    }
    if (iv.length > 64 || salt.length > 128 || ciphertext.length > 12000000) {
      return res.status(413).json({ error: "نسخة Voice DNA كبيرة جدًا." });
    }
    if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 120000) {
      return res.status(400).json({ error: "مدة عينة Voice DNA غير صالحة." });
    }

    const owner = db.prepare("SELECT id FROM voice_dna_profiles WHERE id=? AND owner_user_id=? AND revoked_at IS NULL").get(profileId, user.id) as any;
    if (!owner) return res.status(404).json({ error: "ملف Voice DNA غير موجود." });

    const recovery = db.prepare("SELECT salt FROM voice_dna_recovery_envelopes WHERE user_id=?").get(user.id) as any;
    if (!recovery || String(recovery.salt) !== salt) {
      return res.status(409).json({ error: "نسخة الاسترداد غير متزامنة. أعد إعداد/تحديث الاسترداد." });
    }

    const now = new Date().toISOString();
    db.prepare(`INSERT INTO voice_dna_recovery_samples
      (id, user_id, profile_id, salt, iv, ciphertext, mime_type, duration_ms, created_at, rotated_at)
      VALUES (?,?,?,?,?,?,?,?,?,NULL)
      ON CONFLICT(user_id, profile_id) DO UPDATE SET
        salt=excluded.salt,
        iv=excluded.iv,
        ciphertext=excluded.ciphertext,
        mime_type=excluded.mime_type,
        duration_ms=excluded.duration_ms,
        created_at=excluded.created_at,
        rotated_at=excluded.created_at`)
      .run("vrec_" + crypto.randomUUID(), user.id, profileId, salt, iv, ciphertext, mimeType, Math.round(durationMs), now);

    return res.json({ ok: true, profileId, updatedAt: now });
  } catch (error: any) {
    console.error("Voice DNA recovery sample upload error:", error?.message || error);
    return res.status(500).json({ error: "تعذر تحديث النسخة الاحتياطية للصوت." });
  }
});

app.get("/api/voice-dna/recovery/samples", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    const rows = db.prepare(`SELECT profile_id as profileId, salt, iv, ciphertext, mime_type as mimeType,
      duration_ms as durationMs, created_at as createdAt, rotated_at as rotatedAt
      FROM voice_dna_recovery_samples WHERE user_id=? ORDER BY created_at DESC`).all(user.id);
    return res.json({ samples: rows });
  } catch {
    return res.status(500).json({ error: "تعذر قراءة النسخ الاحتياطية للصوت." });
  }
});

app.delete("/api/voice-dna/recovery/samples", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    db.prepare("DELETE FROM voice_dna_recovery_samples WHERE user_id=?").run(user.id);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "تعذر حذف النسخ الاحتياطية للصوت." });
  }
});

app.delete("/api/voice-dna/recovery/samples/:profileId", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    const profileId = String(req.params.profileId || "").trim();
    if (!profileId) return res.status(400).json({ error: "Profile id is required." });
    db.prepare("DELETE FROM voice_dna_recovery_samples WHERE user_id=? AND profile_id=?").run(user.id, profileId);
    return res.json({ ok: true, profileId });
  } catch {
    return res.status(500).json({ error: "تعذر حذف نسخة الصوت الاحتياطية." });
  }
});



app.post("/api/voice-dna/sync/upload", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    const profileId = String(req.body?.profileId || "").trim();
    const shareId = String(req.body?.shareId || "").trim();
    const recipientUserId = String(req.body?.recipientUserId || "").trim();
    const wrappedKey = String(req.body?.wrappedKey || "").trim();
    const iv = String(req.body?.iv || "").trim();
    const ciphertext = String(req.body?.ciphertext || "").trim();
    const mimeType = String(req.body?.mimeType || "audio/webm").trim().slice(0, 100);
    if (!profileId || !shareId || !recipientUserId || !wrappedKey || !iv || !ciphertext) return res.status(400).json({ error: "Encrypted Voice DNA package is incomplete." });
    const share = db.prepare("SELECT id FROM voice_dna_shares WHERE id=? AND profile_id=? AND owner_user_id=? AND recipient_user_id=? AND status='active'").get(shareId, profileId, user.id, recipientUserId) as any;
    if (!share) return res.status(403).json({ error: "Voice DNA share is not active." });
    const maxChars = Math.max(1024 * 1024, Number(process.env.SMART_VOICE_DNA_MAX_PACKAGE_CHARS || 12 * 1024 * 1024));
    if (wrappedKey.length > 16000 || iv.length > 256 || ciphertext.length > maxChars) return res.status(413).json({ error: "Encrypted Voice DNA package is too large." });
    const packageId = "vpkg_" + crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO voice_dna_sync_packages
      (id, profile_id, owner_user_id, recipient_user_id, share_id, wrapped_key, iv, ciphertext, mime_type, created_at, revoked_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,NULL)`).run(packageId, profileId, user.id, recipientUserId, shareId, wrappedKey, iv, ciphertext, mimeType, now);
    return res.json({ ok: true, packageId });
  } catch (error: any) {
    console.error("Voice DNA encrypted upload error:", error?.message || error);
    return res.status(500).json({ error: "تعذر مزامنة Voice DNA المشفّر." });
  }
});

app.post("/api/voice-dna/sync/ack", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    const packageId = String(req.body?.packageId || "").trim();
    if (!packageId) return res.status(400).json({ error: "Package id is required." });

    const pkg = db.prepare("SELECT id FROM voice_dna_sync_packages WHERE id=? AND recipient_user_id=? AND revoked_at IS NULL").get(packageId, user.id) as any;
    if (!pkg) return res.status(404).json({ error: "حزمة Voice DNA غير موجودة أو تم سحبها." });

    db.prepare("DELETE FROM voice_dna_sync_packages WHERE id=? AND recipient_user_id=?").run(packageId, user.id);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "تعذر تأكيد استلام حزمة Voice DNA." });
  }
});

app.get("/api/voice-dna/sync/incoming", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    const rows = db.prepare(`SELECT p.id, p.profile_id as profileId, p.share_id as shareId,
      p.wrapped_key as wrappedKey, p.iv, p.ciphertext, p.mime_type as mimeType, p.created_at as createdAt,
      v.owner_user_id as ownerUserId, v.display_name as displayName, v.relationship,
      v.language, v.locale, v.dialect, v.speaking_style as speakingStyle
      FROM voice_dna_sync_packages p
      JOIN voice_dna_profiles v ON v.id=p.profile_id
      JOIN voice_dna_shares s ON s.id=p.share_id
      WHERE p.recipient_user_id=? AND p.revoked_at IS NULL AND s.status='active' AND v.revoked_at IS NULL
      ORDER BY p.created_at DESC`).all(user.id);
    return res.json({ packages: rows });
  } catch {
    return res.status(500).json({ error: "تعذر قراءة حزم Voice DNA." });
  }
});

app.post("/api/voice-dna/sync/revoke", async (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    const shareId = String(req.body?.shareId || "").trim();
    const row = db.prepare("SELECT id FROM voice_dna_shares WHERE id=? AND (owner_user_id=? OR recipient_user_id=?)").get(shareId, user.id, user.id) as any;
    if (!row) return res.status(404).json({ error: "مشاركة الصوت غير موجودة." });
    db.prepare("UPDATE voice_dna_sync_packages SET revoked_at=? WHERE share_id=?").run(new Date().toISOString(), shareId);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "تعذر إلغاء حزمة Voice DNA." });
  }
});
// ----------------------------------------------------
// 3. Smart Search Intent Parser
// ----------------------------------------------------
app.post("/api/ai/search-intent", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    let parsed = {
      originalQuery: query,
      detectedCategory: "all",
      timeFilter: "all",
      keywords: query.split(" ").filter((w: string) => w.length > 1),
    };

    // Keyword heuristics
    const qLower = query.toLowerCase();
    if (qLower.includes("صرف") || qLower.includes("مصاريف") || qLower.includes("فاتورة") || qLower.includes("فلوس") || qLower.includes("expense")) {
      parsed.detectedCategory = "expenses";
    } else if (qLower.includes("عربية") || qLower.includes("سيارة") || qLower.includes("بنزين") || qLower.includes("زيت") || qLower.includes("car") || qLower.includes("fuel")) {
      parsed.detectedCategory = "vehicles";
    } else if (qLower.includes("ملاحظ") || qLower.includes("نوت") || qLower.includes("note") || qLower.includes("كتبت")) {
      parsed.detectedCategory = "notes";    } else if (qLower.includes("رحلة") || qLower.includes("مشوار") || qLower.includes("اوبر") || qLower.includes("كريم") || qLower.includes("trip") || qLower.includes("uber")) {
      parsed.detectedCategory = "trips";
    } else if (qLower.includes("مدرسة") || qLower.includes("تعليم") || qLower.includes("درس") || qLower.includes("طالب") || qLower.includes("school") || qLower.includes("lesson")) {
      parsed.detectedCategory = "education";
    } else if (qLower.includes("قرآن") || qLower.includes("ذكر") || qLower.includes("صلاة") || qLower.includes("دعاء") || qLower.includes("bible") || qLower.includes("prayer")) {
      parsed.detectedCategory = "religious";
    }

    if (qLower.includes("الشهر اللي فات") || qLower.includes("الشهر الماضي") || qLower.includes("last month")) {
      parsed.timeFilter = "last_month";
    } else if (qLower.includes("النهاردة") || qLower.includes("اليوم") || qLower.includes("today")) {
      parsed.timeFilter = "today";
    } else if (qLower.includes("الأسبوع ده") || qLower.includes("this week")) {
      parsed.timeFilter = "this_week";
    }

    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// 4. Trips Transport Provider Comparison Engine & Maps Proxy
// ----------------------------------------------------
function computeCoordinatesDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2 || (Math.abs(lat1 - lat2) < 0.0001 && Math.abs(lon1 - lon2) < 0.0001)) return 5.0;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const directDist = R * c;
  const roadDist = directDist * 1.35; // typical city road factor
  return Math.max(1.0, Math.round(roadDist * 10) / 10);
}

async function resolveTripMetrics(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const fallbackDistance = computeCoordinatesDistanceKm(fromLat, fromLng, toLat, toLng);
  const fallbackDuration = Math.max(5, Math.round(fallbackDistance * 2.2 + 4));
  const tomtomKey = process.env.TOMTOM_API_KEY;

  if (tomtomKey) {
    try {
      const points = `${fromLat},${fromLng}:${toLat},${toLng}`;
      const url = `https://api.tomtom.com/routing/1/calculateRoute/${encodeURIComponent(points)}/json?key=${encodeURIComponent(tomtomKey)}&routeType=fastest&traffic=true&travelMode=car&language=ar`;
      const rr = await fetch(url);
      const data = await rr.json();
      const summary = data?.routes?.[0]?.summary;
      const distanceKm = Number(summary?.lengthInMeters || 0) / 1000;
      const durationMinutes = Number(summary?.travelTimeInSeconds || 0) / 60;
      if (rr.ok && distanceKm > 0 && durationMinutes > 0) {
        return { distanceKm, durationMinutes, source: 'tomtom' };
      }
    } catch (error) {
      console.warn('TomTom fare metrics unavailable:', error);
    }
  }

  try {
    const osrm = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false&steps=false`;
    const or = await fetch(osrm, { headers: { 'User-Agent': 'SMART-TIME/25.7' } });
    const od = await or.json();
    const route = od?.routes?.[0];
    const distanceKm = Number(route?.distance || 0) / 1000;
    const durationMinutes = Number(route?.duration || 0) / 60;
    if (or.ok && distanceKm > 0 && durationMinutes > 0) {
      return { distanceKm, durationMinutes, source: 'osrm' };
    }
  } catch (error) {
    console.warn('OSRM fare metrics unavailable:', error);
  }

  return { distanceKm: fallbackDistance, durationMinutes: fallbackDuration, source: 'estimated-route' };
}

const handleTripCompare = async (req: express.Request, res: express.Response) => {
  try {
    // التحقق من تسجيل الدخول والرصيد قبل تنفيذ أي بحث (كل بحث يكلف TRIP_SEARCH_COST_EGP)
    const user = authUser(req);
    if (!user) {
      return res.status(401).json({ error: 'يجب تسجيل الدخول لاستخدام خدمة مقارنة الرحلات' });
    }
    const userRow = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(user.id) as any;
    const currentBalance = userRow?.wallet_balance || 0;
    if (currentBalance < TRIP_SEARCH_COST_EGP) {
      return res.status(402).json({
        error: `رصيدك الحالي (${currentBalance.toFixed(2)} ج.م) غير كافٍ. تكلفة البحث ${TRIP_SEARCH_COST_EGP} ج.م، من فضلك اشحن رصيدك أولاً.`,
        code: 'INSUFFICIENT_BALANCE',
        balance: currentBalance,
        required: TRIP_SEARCH_COST_EGP,
      });
    }

    const { from, to, pickup, destination, rideTypeFilter, rideType } = req.body;
    const filter = rideTypeFilter || (rideType ? String(rideType).toLowerCase() : 'all');

    const fromLat = from?.lat || pickup?.lat || pickup?.latitude || 30.0561;
    const fromLng = from?.lng || pickup?.lng || pickup?.longitude || 31.3301;
    const toLat = to?.lat || destination?.lat || destination?.latitude || 30.0131;
    const toLng = to?.lng || destination?.lng || destination?.longitude || 31.4289;

    // المسافة والزمن من TomTom إن كان المفتاح متاحًا، ثم OSRM، ثم تقدير محلي كحل أخير.
    const metrics = await resolveTripMetrics(fromLat, fromLng, toLat, toLng);
    const distanceKm = Number(Number(metrics?.distanceKm || 0).toFixed(2));
    const baseDurationMins = Math.max(1, Math.round(Number(metrics?.durationMinutes || 0)));
    const category: RideCategory = filter === 'comfort' ? 'comfort' : filter === 'scooter' ? 'scooter' : 'economy';

    const carProviders = [
      { providerId: 'uber', providerName: 'Uber', logoUrl: '/provider-logos/uber.svg', vehicleType: 'سيارة عادية', etaMinutes: 4, rating: 4.8, deepLink: `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${fromLat}&pickup[longitude]=${fromLng}&dropoff[latitude]=${toLat}&dropoff[longitude]=${toLng}` },
      { providerId: 'careem', providerName: 'Careem', logoUrl: '/provider-logos/careem.svg', vehicleType: 'سيارة عادية', etaMinutes: 5, rating: 4.7, deepLink: 'https://www.careem.com/' },
      { providerId: 'indrive', providerName: 'inDrive', logoUrl: '/provider-logos/indrive.svg', vehicleType: 'سيارة عادية', etaMinutes: 6, rating: 4.6, deepLink: `indrive://route?start_lat=${fromLat}&start_lng=${fromLng}&end_lat=${toLat}&end_lng=${toLng}` },
      { providerId: 'didi', providerName: 'DiDi', logoUrl: '/provider-logos/didi.svg', vehicleType: 'سيارة عادية', etaMinutes: 5, rating: 4.7, deepLink: `didiglobal://trip?pick_lat=${fromLat}&pick_lng=${fromLng}&drop_lat=${toLat}&drop_lng=${toLng}` },
      { providerId: 'bolt', providerName: 'Bolt', logoUrl: '/provider-logos/bolt.svg', vehicleType: 'سيارة عادية', etaMinutes: 6, rating: 4.6, deepLink: '#' },
      { providerId: 'yalla-bina', providerName: 'Yalla Bina', logoUrl: '/provider-logos/yalla-bina.svg', vehicleType: 'سيارة عادية', etaMinutes: 7, rating: 4.5, deepLink: '#' },
      { providerId: 'captain-egypt', providerName: 'كابتن مصر', logoUrl: '/provider-logos/captain-egypt.svg', vehicleType: 'سيارة عادية', etaMinutes: 7, rating: 4.5, deepLink: '#' },
      { providerId: 'smart-line', providerName: 'Smart Line', logoUrl: '/provider-logos/smart-line.svg', vehicleType: 'سيارة عادية', etaMinutes: 8, rating: 4.5, deepLink: '#' },
    ] as const;

    const makeEstimate = (providerId: RideProvider, providerName: string, logoUrl: string, vehicleType: string, etaMinutes: number, rating: number, deepLink: string) => {
      const estimate = estimateProviderPrice(providerId, {
        distanceKm,
        durationMinutes: baseDurationMins,
        startTime: new Date(),
        category,
      });
      return {
        providerId,
        providerName,
        logoUrl,
        vehicleType,
        rideType: `${providerName} ${category === 'comfort' ? 'Comfort' : category === 'scooter' ? 'Motorcycle' : 'Economy'}`,
        typeCategory: category === 'scooter' ? 'scooter' : category === 'comfort' ? 'comfort' : 'normal',
        fare: estimate.estimatedFare,
        estimatedFareMin: estimate.minFare,
        estimatedFareMax: estimate.maxFare,
        currency: 'EGP',
        etaMinutes,
        durationMinutes: baseDurationMins,
        isLive: false,
        quoteStatus: 'ESTIMATED',
        quoteSource: 'smart-time-estimator',
        pricingNote: 'سعر تقديري من SMART TIME وقد يختلف عن السعر الفعلي',
        effectivePerKm: estimate.effectivePerKm,
        trafficFactor: estimate.trafficFactor,
        timeFactor: estimate.timeFactor,
        driverRating: rating,
        rating,
        badge: null,
        deepLink,
      };
    };

    const providers = filter === 'scooter'
      ? [makeEstimate(
          'indrive', 'inDrive', '/provider-logos/indrive.svg', 'موتوسيكل', 3, 4.6,
          `indrive://route?start_lat=${fromLat}&start_lng=${fromLng}&end_lat=${toLat}&end_lng=${toLng}`,
        )]
      : carProviders.map((p) => makeEstimate(p.providerId as RideProvider, p.providerName, p.logoUrl, filter === 'comfort' ? 'Comfort' : p.vehicleType, p.etaMinutes, p.rating, p.deepLink));

    const sortedByFare = [...providers].sort((a, b) => a.fare - b.fare);
    const fastest = [...providers].sort((a, b) => a.etaMinutes - b.etaMinutes)[0];
    if (sortedByFare[0]) (sortedByFare[0] as any).badge = 'cheapest';

    for (const provider of ['uber', 'careem', 'indrive', 'didi']) {
      setServiceStatus(provider, 'NOT_CONFIGURED', 'transport', 'Showing SMART TIME estimate only; not an official live fare');
    }
    const requestId = crypto.randomUUID();

    const result = {
      distanceKm,
      estimatedDurationMins: baseDurationMins,
      routeSource: metrics.source,
      pricingMode: 'SMART_TIME_ESTIMATE',
      pricingDisclaimer: 'جميع الأسعار تقديرية واجتهادية من SMART TIME وليست أسعارًا رسمية من شركات النقل.',
      bestValueId: sortedByFare[0]?.providerId || null,
      cheapestId: sortedByFare[0]?.providerId || null,
      fastestId: fastest?.providerId || null,
      options: providers,
    };

    // الخصم والحفظ يتمان في معاملة واحدة حتى لا يحدث خصم مزدوج أو رصيد سالب
    let newBalance = currentBalance;
    try {
      db.exec('BEGIN IMMEDIATE');
      const debit = db.prepare(
        'UPDATE users SET wallet_balance = ROUND(wallet_balance - ?, 2) WHERE id = ? AND wallet_balance >= ?'
      ).run(TRIP_SEARCH_COST_EGP, user.id, TRIP_SEARCH_COST_EGP) as any;
      if (!debit.changes) {
        const latest = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(user.id) as any;
        db.exec('ROLLBACK');
        return res.status(402).json({
          error: `رصيدك الحالي (${Number(latest?.wallet_balance || 0).toFixed(2)} ج.م) غير كافٍ. تكلفة البحث ${TRIP_SEARCH_COST_EGP} ج.م، من فضلك اشحن رصيدك أولاً.`,
          code: 'INSUFFICIENT_BALANCE',
          balance: Number(latest?.wallet_balance || 0),
          required: TRIP_SEARCH_COST_EGP,
        });
      }
      const balanceRow = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(user.id) as any;
      newBalance = Number(balanceRow?.wallet_balance || 0);

      db.prepare("INSERT INTO ride_requests(id,pickup_json,destination_json,created_at) VALUES(?,?,?,?)")
        .run(requestId, JSON.stringify(pickup || from || {}), JSON.stringify(destination || to || {}), new Date().toISOString());
      for (const option of providers) {
        db.prepare("INSERT INTO ride_quotes(id,request_id,provider,amount,currency,eta_minutes,duration_minutes,status,raw_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
          .run(crypto.randomUUID(), requestId, option.providerId, option.fare, option.currency, option.etaMinutes, option.durationMinutes, 'ESTIMATED', JSON.stringify(option), new Date().toISOString());
      }
      db.prepare(
        `INSERT INTO wallet_transactions (id, user_id, amount, type, reference, balance_after, created_at) VALUES (?, ?, ?, 'trip_search', ?, ?, ?)`
      ).run(`wtx_${crypto.randomUUID()}`, user.id, -TRIP_SEARCH_COST_EGP, requestId, newBalance, new Date().toISOString());
      db.exec('COMMIT');
    } catch (txError) {
      try { db.exec('ROLLBACK'); } catch {}
      throw txError;
    }

    return res.json({
      success: true,
      result,
      distanceKm,
      baseDurationMins,
      options: providers,
      recommendations: {
        best: sortedByFare[0] || null,
        cheapest: sortedByFare[0] || null,
        fastest: fastest || null,
      },
      requestId,
      livePricing: false,
      quoteStatus: 'ESTIMATED',
      warning: 'جميع الأسعار تقديرية واجتهادية من SMART TIME وليست أسعارًا رسمية من شركات النقل.',
      timestamp: new Date().toISOString(),
      walletBalance: newBalance,
      tripCost: TRIP_SEARCH_COST_EGP,
    });
  } catch (e: any) {
    console.error('Trip compare failed:', e);
    return res.status(500).json({ error: e?.message || 'تعذر حساب أسعار الرحلة' });
  }
};

app.post("/api/trips/compare", handleTripCompare);
app.post("/api/transport/compare", handleTripCompare);

// ----------------------------------------------------
// 4B. Google Maps & Geolocation Proxy Endpoints
// ----------------------------------------------------
app.get("/api/maps/route", async (req, res) => {
  try {
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    const valid = (v: string) => /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(v);
    if (!valid(from) || !valid(to)) return res.status(400).json({ error: "Valid from/to coordinates are required" });

    const tomtomKey = process.env.TOMTOM_API_KEY;
    if (tomtomKey) {
      try {
        const url = `https://api.tomtom.com/routing/1/calculateRoute/${encodeURIComponent(from)}:${encodeURIComponent(to)}/json?key=${encodeURIComponent(tomtomKey)}&routeType=fastest&traffic=true&travelMode=car&language=ar`;
        const rr = await fetch(url);
        const data = await rr.json();
        const summary = data?.routes?.[0]?.summary;
        const points = data?.routes?.[0]?.legs?.[0]?.points || [];
        if (rr.ok && points.length) {
          return res.json({
            coordinates: points.map((p: any) => [p.latitude, p.longitude]),
            distanceKm: Number(summary?.lengthInMeters || 0) / 1000,
            durationMins: Number(summary?.travelTimeInSeconds || 0) / 60,
            provider: "tomtom",
          });
        }
      } catch {}
    }

    // Development fallback: public OSRM routing. No API key required.
    const [fromLat, fromLng] = from.split(',').map(Number);
    const [toLat, toLng] = to.split(',').map(Number);
    const osrm = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=false`;
    const or = await fetch(osrm, { headers: { "User-Agent": "SMART-TIME/25.7" } });
    const od = await or.json();
    const route = od?.routes?.[0];
    if (!or.ok || !route?.geometry?.coordinates?.length) return res.status(502).json({ error: "Route service unavailable" });
    res.json({
      coordinates: route.geometry.coordinates.map((p: [number, number]) => [p[1], p[0]]),
      distanceKm: Number(route.distance || 0) / 1000,
      durationMins: Number(route.duration || 0) / 60,
      provider: "osrm",
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Route failed" });
  }
});

app.get("/api/maps/geocode", async (req, res) => {
  try {
    const address = String(req.query.address || "").trim();
    if (!address) return res.status(400).json({ error: "Address is required" });

    // 1) Mapbox (مجاني بدون بطاقة دفع - أولوية أولى لو الـ Token موجود)
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (mapboxToken) {
      try {
        const mbUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=eg&language=ar&limit=1&access_token=${mapboxToken}`;
        const mr = await fetch(mbUrl);
        const mdata = await mr.json();
        if (mdata.features?.length) {
          const item = mdata.features[0];
          return res.json({
            address: item.place_name,
            latitude: item.center[1],
            longitude: item.center[0],
            placeId: item.id,
          });
        }
      } catch (mbErr) {
        // لو Mapbox فشل، كمل للخيارات التانية تحت
      }
    }

    // 2) Google Maps (لو مفتاحه موجود)
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (mapsKey) {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&language=ar&region=eg&key=${mapsKey}`;
      const r = await fetch(gUrl);
      const data = await r.json();
      if (data.status === "OK" && data.results?.length) {
        const item = data.results[0];
        return res.json({
          address: item.formatted_address,
          latitude: item.geometry.location.lat,
          longitude: item.geometry.location.lng,
          placeId: item.place_id,
        });
      }
    }
    // Fallback Geocoding
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + " Egypt")}&format=json&accept-language=ar&limit=1`;
    const nr = await fetch(nomUrl, { headers: { "User-Agent": "SmartTimeGold/8.3" } });
    const ndata = await nr.json();
    if (Array.isArray(ndata) && ndata.length > 0) {
      return res.json({
        address: ndata[0].display_name,
        latitude: parseFloat(ndata[0].lat),
        longitude: parseFloat(ndata[0].lon),
        placeId: ndata[0].place_id?.toString(),
      });
    }
    return res.status(404).json({ error: "Location not found" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/maps/reverse-geocode", async (req, res) => {
  try {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: "Valid lat and lng required" });

    // 1) Mapbox
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (mapboxToken) {
      try {
        const mbUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?language=ar&limit=1&access_token=${mapboxToken}`;
        const mr = await fetch(mbUrl);
        const mdata = await mr.json();
        if (mdata.features?.length) {
          const item = mdata.features[0];
          return res.json({
            address: item.place_name,
            latitude: lat,
            longitude: lng,
            placeId: item.id,
          });
        }
      } catch (mbErr) {
        // كمل للخيارات التانية
      }
    }

    // 2) Google Maps
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (mapsKey) {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=ar&key=${mapsKey}`;
      const r = await fetch(gUrl);
      const data = await r.json();
      if (data.status === "OK" && data.results?.length) {
        const item = data.results[0];
        return res.json({
          address: item.formatted_address,
          latitude: lat,
          longitude: lng,
          placeId: item.place_id,
        });
      }
    }
    // Fallback Reverse Geocoding
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`;
    const nr = await fetch(nomUrl, { headers: { "User-Agent": "SmartTimeGold/8.3" } });
    const ndata = await nr.json();
    if (ndata && ndata.display_name) {
      return res.json({
        address: ndata.display_name,
        latitude: lat,
        longitude: lng,
        placeId: ndata.place_id?.toString(),
      });
    }
    return res.json({
      address: `الموقع المحدد (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      latitude: lat,
      longitude: lng,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/maps/places-search", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    if (!query) return res.json({ results: [] });

    // 1) Mapbox
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (mapboxToken) {
      try {
        const mbUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=eg&language=ar&limit=8&access_token=${mapboxToken}`;
        const mr = await fetch(mbUrl);
        const mdata = await mr.json();
        if (mdata.features?.length) {
          const results = mdata.features.map((p: any) => ({
            address: p.place_name,
            name: p.text || p.place_name,
            latitude: p.center[1],
            longitude: p.center[0],
            placeId: p.id,
          }));
          return res.json({ results });
        }
      } catch (mbErr) {
        // كمل للخيارات التانية
      }
    }

    // 2) Google Maps
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (mapsKey) {
      const gUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + " مصر")}&language=ar&key=${mapsKey}`;
      const r = await fetch(gUrl);
      const data = await r.json();
      if (data.status === "OK" && data.results?.length) {
        const results = data.results.slice(0, 8).map((p: any) => ({
          address: p.formatted_address || p.name,
          name: p.name,
          latitude: p.geometry.location.lat,
          longitude: p.geometry.location.lng,
          placeId: p.place_id,
        }));
        return res.json({ results });
      }
    }
    // Fallback Nominatim Search
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + " Egypt")}&format=json&accept-language=ar&limit=6`;
    const nr = await fetch(nomUrl, { headers: { "User-Agent": "SmartTimeGold/8.3" } });
    const ndata = await nr.json();
    if (Array.isArray(ndata)) {
      const results = ndata.map((item: any) => ({
        address: item.display_name,
        name: item.display_name.split(",")[0],
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        placeId: item.place_id?.toString(),
      }));
      return res.json({ results });
    }
    return res.json({ results: [] });
  } catch (err: any) {
    res.status(500).json({ results: [], error: err.message });
  }
});

app.post("/api/maps/parse-voice-trip", async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text) return res.status(400).json({ error: "Text is required" });

    // Keyless SMART TIME route parser. Voice recognition happens on the client;
    // this endpoint only extracts pickup/dropoff from the recognized Arabic text.
    let pickup = "";
    let dropoff = "";
    const match = text.match(/(?:من|من عند|من مكان)\s+(.+?)\s+(?:إلى|الى|لحد|رايح|ل|لـ|على)\s+(.+)/i);
    if (match) {
      pickup = match[1].trim();
      dropoff = match[2].trim();
    } else {
      const separators = text.split(/\s+(?:الى|إلى|رايح|لـ|ل)\s+/i);
      if (separators.length >= 2) {
        pickup = separators[0].replace(/^من\s+/i, "").trim();
        dropoff = separators.slice(1).join(" إلى ").trim();
      } else {
        pickup = text;
      }
    }

    return res.json({ success: true, pickup, dropoff, provider: "smart-ai", engine: "rules" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 5. Data Backup / Restore Sync API
// ----------------------------------------------------
app.post("/api/backup/export", (req, res) => {
  const payload = req.body;
  res.setHeader("Content-Disposition", 'attachment; filename="smart_time_backup.json"');
  res.setHeader("Content-Type", "application/json");
  res.json({
    exportDate: new Date().toISOString(),
    version: "25.7",
    data: payload,
  });
});

// ----------------------------------------------------
// 6. Live Internet Data Layer
// ----------------------------------------------------
// Real-time data is fetched server-side so API keys never reach the browser.
// Providers can be changed later without changing the UI/data layer.
const fetchJson = async (url: string, init: RequestInit = {}) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
};

let cryptoBlockedUntil = 0;
let cryptoInFlight: Promise<any> | null = null;

app.get("/api/live/market", async (_req, res) => {
  const marketCacheKey = "market:composite:v2";
  const cached = getCache<any>(marketCacheKey);
  if (cached) {
    return res.json({ ...cached.value, cache: "HIT" });
  }

  const result: any = {
    source: "live",
    fetchedAt: new Date().toISOString(),
    gold: null,
    silver: null,
    currencies: {},
    crypto: {},
    statuses: {},
  };

  const metalsCache = getCache<any>("market:metals:v2", true);
  try {
    const [gold, silver] = await Promise.all([
      fetchJson("https://api.gold-api.com/price/XAU"),
      fetchJson("https://api.gold-api.com/price/XAG"),
    ]);
    result.gold = gold; result.silver = silver; result.statuses.metals = "LIVE";
    setCache("market:metals:v2", { gold, silver }, 60_000);
  } catch (error) {
    result.gold = metalsCache?.value?.gold ?? null; result.silver = metalsCache?.value?.silver ?? null;
    result.statuses.metals = metalsCache ? "FALLBACK" : "OFFLINE";
    console.warn("Live metals provider unavailable:", (error as Error)?.message);
  }

  const fxCache = getCache<any>("market:fx:v2", true);
  try {
    const fx = await fetchJson("https://api.frankfurter.dev/v2/rates?base=USD&quotes=EGP,EUR,GBP,SAR,AED");
    for (const row of Array.isArray(fx) ? fx : []) result.currencies[row.quote] = row.rate;
    result.statuses.fx = "LIVE";
    setCache("market:fx:v2", result.currencies, 120_000);
  } catch (error) {
    result.currencies = fxCache?.value ?? {}; result.statuses.fx = fxCache ? "FALLBACK" : "OFFLINE";
    console.warn("Live FX provider unavailable:", (error as Error)?.message);
  }

  const cryptoCache = getCache<any>("market:crypto:v2", true);
  const now = Date.now();
  try {
    if (now < cryptoBlockedUntil && cryptoCache) throw new Error("CoinGecko rate limited; using cached data");
    if (!cryptoInFlight) {
      const ids = "bitcoin,ethereum,solana,binancecoin,ripple";
      cryptoInFlight = fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`)
        .finally(() => { cryptoInFlight = null; });
    }
    result.crypto = await cryptoInFlight;
    result.statuses.crypto = "LIVE";
    cryptoBlockedUntil = 0;
    setCache("market:crypto:v2", result.crypto, 120_000);
  } catch (error) {
    const message = (error as Error)?.message || "Crypto provider unavailable";
    if (message.includes("HTTP 429") || message.includes("rate limited")) cryptoBlockedUntil = Date.now() + 5 * 60_000;
    result.crypto = cryptoCache?.value ?? {}; result.statuses.crypto = cryptoCache ? "FALLBACK" : "OFFLINE";
    console.warn("Live crypto provider unavailable:", message);
  }

  const hasData = result.gold || result.silver || Object.keys(result.currencies).length || Object.keys(result.crypto).length;
  if (hasData) setCache(marketCacheKey, result, 45_000);
  res.json({ ...result, cache: "MISS" });
});

const stripXml = (value: string) => value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

async function fetchGoogleNewsRss(lang: string) {
  const hl = lang === "ar" ? "ar" : "en-US";
  const gl = "EG";
  const ceid = lang === "ar" ? "EG:ar" : "US:en";
  const xml = await fetch(`https://news.google.com/rss?hl=${hl}&gl=${gl}&ceid=${ceid}`, { signal: AbortSignal.timeout(12000) }).then(async r => {
    if (!r.ok) throw new Error(`HTTP ${r.status} from Google News`);
    return r.text();
  });
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return items.slice(0, 15).map((m) => {
    const block = m[1];
    const get = (tag: string) => stripXml(block.match(new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`))?.[1] || "");
    const source = get("source");
    const url = get("link");
    const title = get("title");
    const publishedAt = get("pubDate");
    return { title, description: "", url, publishedAt, source: { name: source } };
  }).filter((a) => a.title && a.url);
}

app.get("/api/live/news", async (req, res) => {
  try {
    const key = process.env.GNEWS_API_KEY;
    const lang = String(req.query.lang || "ar");
    const country = String(req.query.country || "eg");
    const category = String(req.query.category || "general");
    const max = String(req.query.max || "10");

    if (key) {
      try {
        const data = await fetchJson(`https://gnews.io/api/v4/top-headlines?category=${encodeURIComponent(category)}&lang=${encodeURIComponent(lang)}&country=${encodeURIComponent(country)}&max=${max}&apikey=${encodeURIComponent(key)}`);
        const payload = { source: "gnews", configured: true, fetchedAt: new Date().toISOString(), articles: data.articles || [], status: "LIVE" }; setCache(`news:${lang}:${country}:${category}`, payload, 5*60*1000); setServiceStatus("news","LIVE","gnews","Fresh provider data"); return res.json(payload);
      } catch (gnewsError) {
        console.warn("GNews unavailable, falling back to Google News RSS:", (gnewsError as Error)?.message);
      }
    }

    const articles = await fetchGoogleNewsRss(lang);
    const payload = { source: "google-news-rss", configured: Boolean(key), fetchedAt: new Date().toISOString(), articles, status: key ? "FALLBACK" : "LIVE" }; setCache(`news:${lang}:${country}:${category}`, payload, 5*60*1000); setServiceStatus("news", key ? "FALLBACK" : "LIVE", "google-news-rss", key ? "GNews unavailable; RSS fallback active" : "RSS live source active"); return res.json(payload);
  } catch (error) {
    const lang = String(req.query.lang || "ar"), country = String(req.query.country || "eg"), category = String(req.query.category || "general");
    const stale = getCache<any>(`news:${lang}:${country}:${category}`, true);
    if (stale) { setServiceStatus("news","FALLBACK","cache",(error as Error)?.message); return res.json({ ...stale.value, status:"FALLBACK", stale:true }); }
    setServiceStatus("news","OFFLINE","news",(error as Error)?.message);
    res.status(502).json({ source: "news", configured: Boolean(process.env.GNEWS_API_KEY), articles: [], status:"OFFLINE", error: (error as Error)?.message });
  }
});

app.get("/api/live/weather", async (req, res) => {
  try {
    const requestedCity = String(req.query.city || "Cairo").trim() || "Cairo";
    const geo = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(requestedCity)}&count=1&language=en&format=json`);
    const place = geo?.results?.[0];
    if (!place?.latitude || !place?.longitude) {
      return res.status(404).json({ source: "open-meteo", error: "City not found" });
    }
    const weather = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`);
    const current = weather?.current || {};
    return res.json({
      source: "open-meteo",
      fetchedAt: new Date().toISOString(),
      city: place.name || requestedCity,
      temperatureC: Number(current.temperature_2m),
      humidity: Number(current.relative_humidity_2m),
      windKmh: Number(current.wind_speed_10m),
      weatherCode: Number(current.weather_code),
    });
  } catch (error) {
    return res.status(502).json({ source: "open-meteo", error: (error as Error)?.message });
  }
});


app.get('/api/sports/exercises', async (req, res) => {
  try {
    const key = process.env.RAPIDAPI_KEY;
    if (!key) return res.status(503).json({ error: 'RAPIDAPI_KEY غير مضبوط في متغيرات البيئة' });
    const bodyPart = typeof req.query.bodyPart === 'string' ? req.query.bodyPart : '';
    const endpoint = bodyPart
      ? `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${encodeURIComponent(bodyPart)}?limit=12&offset=0`
      : 'https://exercisedb.p.rapidapi.com/exercises?limit=12&offset=0';
    const upstream = await fetch(endpoint, {
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'exercisedb.p.rapidapi.com' },
    });
    const text = await upstream.text();
    res.status(upstream.status).type('application/json').send(text);
  } catch (error) {
    console.error('ExerciseDB proxy error:', error);
    res.status(502).json({ error: 'تعذر الاتصال بخدمة ExerciseDB' });
  }
});

app.get("/api/live/sports", async (req, res) => {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    return res.json({ source: "unconfigured", matches: [], configured: false, fetchedAt: new Date().toISOString() });
  }
  try {
    const live = String(req.query.live || "all");
    const url = `https://v3.football.api-sports.io/fixtures?live=${encodeURIComponent(live)}`;
    const data = await fetchJson(url, { headers: { "x-apisports-key": key, Accept: "application/json" } });
    res.json({ source: "api-football", configured: true, fetchedAt: new Date().toISOString(), matches: data.response || [] });
  } catch (error) {
    res.status(502).json({ source: "api-football", configured: true, matches: [], error: (error as Error)?.message });
  }
});

// ----------------------------------------------------
// 6. Vite Integration
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const httpServer = http.createServer(app);
  setupChatWebSocket(httpServer);

  httpServer.listen(PORT, "0.0.0.0", () => {
    setServiceStatus("backend", "LIVE", "express", `Listening on port ${PORT}`);
    setServiceStatus("chat_realtime", "LIVE", "websocket", "Realtime chat WebSocket ready on /ws/chat");
    console.log(`[SMART TIME V8] Server & Chat WebSocket running on http://0.0.0.0:${PORT}`);
  });
}


startServer();
