import express from "express";
import http from "node:http";
import path from "path";
import dotenv from "dotenv";
import crypto from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { Buffer } from "node:buffer";
import { db, seedDefaultChatRooms } from "./backend/database.js";
import { getCache, setCache } from "./backend/cache.js";
import { getServiceStatuses, seedServiceStatuses, setServiceStatus } from "./backend/serviceStatus.js";
import { chatRouter, setupChatWebSocket } from "./backend/chatServer.js";
import { estimateProviderPrice, type RideProvider, type RideCategory } from "./src/services/ridePriceEstimator.js";
import { askSmartAiCore } from "./backend/ai/smartAiCore.js";
import { executeToolAction } from "./backend/ai/toolExecutor.js";
import { createCalendarEvent, deleteCalendarEvent, listCalendarEvents, updateCalendarEvent } from "./backend/ai/calendar/eventExecutor.js";
import { getFinanceOverview } from "./backend/ai/finance/financeProjection.js";
import { getAiCanonicalState } from "./backend/ai/finance/aiCanonicalProjection.js";
import { createCanonicalExpense, updateCanonicalExpense, deleteCanonicalExpense, migrateLegacyExpensesToCanonical, reconcileAiTransactionsToCanonical, ensureFinanceMutationSchema } from "./backend/ai/finance/financeRepository.js";
import { acknowledgeEventReminder, listPendingEventReminders, queueDueEventReminders } from "./backend/ai/calendar/reminderScheduler.js";
import { isLocalSmartAiConfigured } from "./backend/ai/localInference.js";
import { createHttpVoiceDnaProvider, DisabledVoiceDnaProvider } from "./backend/voice/voiceDnaProvider.js";
import { POST as smartAiV2Infer } from "./app/api/ai/infer/route.js";
import { getGroqHealth, groqProvider } from "./backend/ai/providers/groqProvider.js";
import { verifyTurnstileToken } from "./backend/security/turnstile.js";
import { sendPasswordResetEmail } from "./backend/auth/passwordResetEmail.js";

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
const sttRequestWindow = new Map<string, { startedAt: number; count: number }>();
const STT_MAX_REQUESTS_PER_MINUTE = Math.max(1, Number(process.env.STT_MAX_REQUESTS_PER_MINUTE || 12));
const STT_MAX_AUDIO_BYTES = Math.max(256 * 1024, Number(process.env.STT_MAX_AUDIO_BYTES || 8 * 1024 * 1024));
function consumeSttQuota(userId: string): boolean {
  const now = Date.now();
  const current = sttRequestWindow.get(userId);
  if (!current || now - current.startedAt >= 60_000) {
    sttRequestWindow.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= STT_MAX_REQUESTS_PER_MINUTE) return false;
  current.count += 1;
  return true;
}

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
    origin === "https://smart-time-production-661f.up.railway.app" ||
    /^https?:\/\/localhost(?::\d+)?$/i.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin);

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

const groqHealthHandler = async (_req: express.Request, res: express.Response) => {
  // Preparation-only endpoint: never expose provider diagnostics from production.
  const previewEnvironment = process.env.VERCEL_ENV === "preview" || process.env.RAILWAY_ENVIRONMENT_NAME === "staging";
  if (!previewEnvironment && process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "preview-only" });
  }
  try {
    const health = await getGroqHealth();
    const status = health.configured && health.reachable ? 200 : 503;
    return res.status(status).json({
      provider: "groq",
      configured: health.configured,
      reachable: health.reachable,
      modelCount: health.models.length,
      models: health.models.map(({ id, active, ownedBy }) => ({ id, active, ownedBy })),
    });
  } catch (error) {
    return res.status(502).json({
      provider: "groq",
      configured: true,
      reachable: false,
      error: error instanceof Error ? error.message : "Groq health check failed",
    });
  }
};

app.get("/api/ai/groq-health", groqHealthHandler);
app.get("/api/ai/groq_health", groqHealthHandler);

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function createLiveKitAccessToken(input: { apiKey: string; apiSecret: string; identity: string; room: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: input.apiKey,
    sub: input.identity,
    iat: now,
    nbf: now,
    exp: now + 10 * 60,
    video: {
      roomJoin: true,
      room: input.room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.createHmac("sha256", input.apiSecret).update(signingInput).digest();
  return `${signingInput}.${base64Url(signature)}`;
}

app.post("/api/voice/livekit-token", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "Authentication is required for voice." });

  const apiKey = String(process.env.LIVEKIT_API_KEY || "").trim();
  const apiSecret = String(process.env.LIVEKIT_API_SECRET || "").trim();
  const serverUrl = String(process.env.LIVEKIT_PUBLIC_WS_URL || process.env.LIVEKIT_URL || "").trim();
  if (!apiKey || !apiSecret || !serverUrl) {
    return res.status(503).json({ error: "LiveKit voice transport is not configured." });
  }

  const roomName = `smart-time-voice-${String(user.id).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80)}`;
  const token = createLiveKitAccessToken({
    apiKey,
    apiSecret,
    identity: String(user.id),
    room: roomName,
  });

  return res.json({
    serverUrl,
    roomName,
    token,
    expiresInSeconds: 600,
  });
});


app.post("/api/ai/stt", async (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "Authentication is required for voice transcription." });
  if (!consumeSttQuota(String(user.id))) return res.status(429).json({ error: "Voice transcription rate limit exceeded. Try again shortly." });

  try {
    const rawAudio = String(req.body?.audioBase64 || "").trim();
    const language = String(req.body?.language || "ar").trim().toLowerCase();
    const locale = String(req.body?.locale || (language === "ar" ? "ar-EG" : "en-US")).trim();
    const mimeType = String(req.body?.mimeType || "audio/webm").split(";")[0].trim().toLowerCase();
    if (!rawAudio) return res.status(400).json({ error: "audioBase64 is required." });
    if (!["ar", "en"].includes(language)) return res.status(400).json({ error: "language must be ar or en." });
    if (!["ar-EG", "en-US"].includes(locale)) return res.status(400).json({ error: "Unsupported STT locale." });
    const allowedMimeTypes = new Set(["audio/webm", "audio/mp4", "audio/wav", "audio/ogg", "audio/mpeg", "audio/flac"]);
    if (!allowedMimeTypes.has(mimeType)) return res.status(415).json({ error: "Unsupported audio format." });

    const normalizedBase64 = rawAudio.replace(/^data:[^,]*;base64,/i, "").replace(/\s+/g, "");
    const maxBase64Chars = Math.ceil(STT_MAX_AUDIO_BYTES / 3) * 4 + 4;
    if (normalizedBase64.length > maxBase64Chars) {
      return res.status(413).json({ error: "Audio payload is too large." });
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedBase64) || normalizedBase64.length % 4 === 1) {
      return res.status(400).json({ error: "Invalid base64 audio payload." });
    }
    let audio: Buffer;
    try {
      audio = Buffer.from(normalizedBase64, "base64");
    } catch {
      return res.status(400).json({ error: "Invalid base64 audio payload." });
    }
    if (!audio.length) return res.status(400).json({ error: "Audio payload is empty." });
    if (audio.length > STT_MAX_AUDIO_BYTES) return res.status(413).json({ error: "Audio payload is too large." });

    const prompt = language === "ar"
      ? "الكلام باللهجة المصرية وبالعربي. اكتب النص المنطوق بالعربية فقط وبنفس الكلمات التي قالها المتحدث. حافظ على الكلمات المصرية والأسماء والأرقام والتواريخ. لا تترجم الكلام إلى الإنجليزية ولا تكتب العربية بحروف لاتينية. اكتب الكلمات الإنجليزية فقط إذا نطقها المتحدث فعلًا."
      : "اكتب الكلام المنطوق فقط كما قيل، مع الحفاظ على الأرقام والتواريخ والأسماء والكلمات الإنجليزية التي نُطقت فعلًا.";

    let transcription = await groqProvider.transcribeAudio({
      audio,
      mimeType,
      language,
      filename: mimeType === "audio/webm" ? "voice.webm" : "voice.audio",
      prompt,
    });

    // Whisper occasionally emits Latin transliteration for short Arabic mobile
    // utterances. If an Arabic request comes back mostly Latin, retry once with
    // the full Whisper model and an explicit Arabic-script prompt.
    if (language === "ar" && /[A-Za-z]/.test(transcription.text)) {
      const letters = transcription.text.replace(/[^A-Za-z\u0600-\u06FF]/g, "").length;
      const latin = transcription.text.replace(/[^A-Za-z]/g, "").length;
      if (letters > 0 && latin / letters >= 0.35) {
        transcription = await groqProvider.transcribeAudio({
          audio,
          mimeType,
          language,
          filename: mimeType === "audio/webm" ? "voice.webm" : "voice.audio",
          model: "whisper-large-v3",
          prompt: "الكلام باللهجة المصرية. أخرج النص العربي المنطوق فقط كما قيل. ممنوع الترجمة إلى الإنجليزية وممنوع كتابة العربية بحروف لاتينية. حافظ على الكلمات المصرية والأسماء والأرقام والتواريخ، واكتب الإنجليزية فقط إذا نُطقت فعلًا.",
        });

        const retryText = transcription.text.trim();
        const retryArabic = retryText.replace(/[^\u0600-\u06FF]/g, "").length;
        const retryLatin = retryText.replace(/[^A-Za-z]/g, "").length;
        if (retryText && retryLatin > 0 && retryArabic === 0) {
          return res.status(502).json({
            error: "تعذر الحصول على تفريغ عربي موثوق من الصوت.",
            code: "arabic-transcript-validation-failed",
          });
        }
      }
    }

    return res.json({
      provider: transcription.provider,
      model: transcription.model,
      transcript: transcription.text,
      requestId: transcription.requestId,
      locale,
      persisted: false,
    });
  } catch (error) {
    if (error instanceof Error && /authentication failed/i.test(error.message)) {
      return res.status(502).json({ error: "Speech provider authentication failed." });
    }
    if (error instanceof Error && /rate limit/i.test(error.message)) {
      return res.status(429).json({ error: "Speech provider rate limit reached." });
    }
    return res.status(502).json({ error: "Speech transcription provider failed." });
  }
});

app.post("/api/ai/infer", async (req, res) => {
  try {
    const request = new Request("http://localhost/api/ai/infer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(req.body || {}), userId: req.body?.userId }),
    });
    const response = await smartAiV2Infer(request);
    const text = await response.text();
    res.status(response.status).type("application/json").send(text);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "SMART AI V2 route failed", retry: true });
  }
});

// Mount Chat API
app.use("/api/chat", chatRouter);




const TRIAL_MODE = String(process.env.TRIAL_MODE || 'true').trim().toLowerCase() !== 'false';
const TRIAL_USER_ID = 'smart-time-trial-user';
const AUTH_SESSION_DAYS = 30;
const PASSWORD_RESET_MINUTES = 15;
const TURNSTILE_ENFORCE = process.env.NODE_ENV === "production" || String(process.env.TURNSTILE_ENFORCE || "").trim().toLowerCase() === "true";
const TURNSTILE_SECRET_KEY = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
const AUTH_MAX_REQUESTS_PER_MINUTE = Math.max(1, Number(process.env.AUTH_MAX_REQUESTS_PER_MINUTE || 12));
const PROGRAM_OWNER_EMAIL = String(process.env.PROGRAM_OWNER_EMAIL || 'eng.mamdouh2009@gmail.com').trim().toLowerCase();
const PROGRAM_OWNER_USER_ID = String(process.env.PROGRAM_OWNER_USER_ID || '').trim();
const PROGRAM_OWNER_ACTIVATION_KEY = String(process.env.PROGRAM_OWNER_ACTIVATION_KEY || '');
// تكلفة كل بحث/مقارنة رحلة بالجنيه المصري (يمكن تعديلها بمتغير بيئة TRIP_SEARCH_COST_EGP)
const parsedTripCost = Number(process.env.TRIP_SEARCH_COST_EGP || 5);
const TRIP_SEARCH_COST_EGP = Number.isFinite(parsedTripCost) && parsedTripCost >= 0 ? Math.round(parsedTripCost * 100) / 100 : 5;
const TRIP_WELCOME_FREE_SEARCHES = 3;
const TRIP_GIFT_HASH_SALT = String(process.env.TRIP_GIFT_HASH_SALT || 'smart-time-trip-gift-v1');
const authRequestWindow = new Map<string, { startedAt: number; count: number }>();

function consumeAuthRateLimit(req: express.Request, action: string): boolean {
  const key = `${action}:${clientIp(req)}`;
  const now = Date.now();
  const current = authRequestWindow.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    authRequestWindow.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= AUTH_MAX_REQUESTS_PER_MINUTE) return false;
  current.count += 1;
  return true;
}

async function requireTurnstile(req: express.Request, res: express.Response): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY) {
    if (!TURNSTILE_ENFORCE) return true;
    res.status(503).json({ error: "التحقق الأمني غير مُكوّن على السيرفر." });
    return false;
  }

  const token = String(req.body?.turnstileToken || "").trim();
  if (!token) {
    res.status(403).json({ error: "أكمل التحقق الأمني ثم حاول مرة أخرى.", code: "turnstile-required" });
    return false;
  }

  const validation = await verifyTurnstileToken(token, TURNSTILE_SECRET_KEY, clientIp(req));
  if (validation.success && (!validation.action || validation.action === "smart-time-auth")) return true;

  if (validation.errorCodes.includes("provider-unreachable") || validation.errorCodes.some((code) => code.startsWith("http-"))) {
    console.error("[AUTH] Turnstile provider unavailable:", validation.errorCodes.join(","));
    res.status(502).json({ error: "تعذر الاتصال بخدمة التحقق الأمني. حاول مرة أخرى." });
    return false;
  }

  console.warn("[AUTH] Turnstile rejected request:", validation.errorCodes.join(",") || "unknown-error");
  res.status(403).json({ error: "فشل التحقق الأمني. أعد التحقق وحاول مرة أخرى.", code: "turnstile-validation-failed" });
  return false;
}

function clientIp(req: express.Request): string { const ip=String(req.ip||req.socket.remoteAddress||'').trim().toLowerCase(); return ip.replace(/^::ffff:/,''); }
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
function createRoleChoiceTicket(userId:string) {
  const payload=base64Url(JSON.stringify({userId,exp:Date.now()+2*60_000}));
  const secret=String(process.env.AUTH_ROLE_TICKET_SECRET||TURNSTILE_SECRET_KEY||PROGRAM_OWNER_EMAIL);
  const sig=base64Url(crypto.createHmac('sha256',secret).update(payload).digest());
  return payload+'.'+sig;
}
function verifyRoleChoiceTicket(ticket:string) {
  const [payload,sig]=String(ticket||'').split('.');
  if(!payload||!sig) return null;
  const secret=String(process.env.AUTH_ROLE_TICKET_SECRET||TURNSTILE_SECRET_KEY||PROGRAM_OWNER_EMAIL);
  const expected=base64Url(crypto.createHmac('sha256',secret).update(payload).digest());
  try {
    if(sig.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return null;
    const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    if(!data?.userId || Number(data.exp||0)<Date.now()) return null;
    return String(data.userId);
  } catch { return null; }
}
function createSession(userId: string, sessionRole?: 'owner'|'admin'|'user'|'guest') { const token=crypto.randomBytes(32).toString('hex'); const now=new Date(); const expires=new Date(now.getTime()+AUTH_SESSION_DAYS*86400000).toISOString(); const row=db.prepare('SELECT * FROM users WHERE id=?').get(userId) as any; const role=sessionRole || effectiveRole(row); db.prepare('INSERT INTO sessions (id,user_id,expires_at,created_at,session_role) VALUES (?,?,?,?,?)').run(token,userId,expires,now.toISOString(),role); return token; }
function authUser(req: express.Request) { const h=String(req.headers.authorization||''); const token=h.startsWith('Bearer ')?h.slice(7).trim():''; if(!token)return null; return db.prepare(`SELECT u.id,u.email,u.username,u.display_name as name,u.phone,u.phone_verified as phoneVerified,u.role,s.session_role,s.id as session_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND julianday(s.expires_at) > julianday('now')`).get(token) as any || null; }
function effectiveRole(row:any): 'owner'|'admin'|'user'|'guest' {
  const email = String(row.email || '').trim().toLowerCase();
  if (email && email === PROGRAM_OWNER_EMAIL) return 'owner';
  const role = String(row.role || 'user').toLowerCase();
  return role === 'admin' ? 'admin' : role === 'owner' ? 'owner' : role === 'guest' ? 'guest' : 'user';
}
function publicUser(row:any){return {id:row.id,email:row.email,username:row.username||undefined,name:row.name||row.display_name||'',phone:row.phone||undefined,phoneVerified:!!row.phoneVerified,activationStatus:row.activation_status||row.activationStatus||'pending',role:effectiveRole(row)};}
function requestedLoginRole(value:any): 'owner'|'admin'|'user'|undefined {
  const role=String(value||'').trim().toLowerCase();
  return role === 'owner' ? 'owner' : role === 'admin' ? 'admin' : role === 'user' ? 'user' : undefined;
}
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
      ).run(TRIAL_USER_ID, email, username, hashPassword(crypto.randomBytes(24).toString('hex')), 'SMART TIME', now, null, 0, 'active', TRIP_WELCOME_FREE_SEARCHES, 10000);
      row = db.prepare('SELECT * FROM users WHERE id=?').get(TRIAL_USER_ID) as any;
    } else {
      db.prepare("UPDATE users SET activation_status='active', phone_verified=0, phone=NULL WHERE id=?").run(TRIAL_USER_ID);
    }
    const token = createSession(TRIAL_USER_ID);
    res.json({ token, user: publicUser({ ...row, name: row.display_name, phoneVerified: false, activation_status: 'active' }) });
  } catch (e:any) {
    res.status(500).json({ error: e.message || 'تعذر بدء النسخة التجريبية' });
  }
});

app.post('/check-email', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ ok: false, registered: false, accountExists: false, message: 'أدخل بريدًا إلكترونيًا صحيحًا.' });
  }
  try {
    const existing = db.prepare('SELECT id FROM users WHERE lower(email)=? LIMIT 1').get(email);
    return res.json({ ok: true, registered: Boolean(existing), accountExists: Boolean(existing), email });
  } catch (error) {
    console.error('[AUTH] Email existence lookup failed');
    return res.status(200).json({ ok: true, registered: false, accountExists: false, email });
  }
});

// The registration page uses this separate local lookup to distinguish a
// duplicate Railway account from a new address. Keep the email normalized.
app.post('/api/auth/check', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ ok: false, accountExists: false, message: 'أدخل بريدًا إلكترونيًا صحيحًا.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE lower(email)=? LIMIT 1').get(email);
  return res.json({ ok: true, accountExists: Boolean(existing) });
});

app.post('/api/auth/register', async (req,res)=>{
  if (!consumeAuthRateLimit(req, "register")) return res.status(429).json({error:'تم تجاوز عدد محاولات التسجيل من هذا العنوان. حاول لاحقًا.'});
  try{
    const name=String(req.body.name||'').trim(), username=normalizeUsername(req.body.username), email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||'');
    const deviceId=String(req.body.deviceId||'').trim().slice(0,200);
    if(name.length<2)return res.status(400).json({error:'الاسم مطلوب'});
    if(!/^[a-z0-9_.-]{3,30}$/.test(username))return res.status(400).json({error:'اسم المستخدم يجب أن يكون من 3 إلى 30 حرفًا، باستخدام حروف إنجليزية أو أرقام أو _ أو - أو .'});
    if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'البريد الإلكتروني غير صحيح'});
    if(password.length<8)return res.status(400).json({error:'كلمة المرور يجب أن تكون 8 أحرف على الأقل'});

    // Oracle is a best-effort mirror only. Never hold registration open for
    // an external service: local account creation and session issuance are authoritative.
    const syncOracle = () => {
      const oracleController = new AbortController();
      const oracleTimer = setTimeout(() => oracleController.abort(), 3000);
      void fetch('https://smart-time-ai.duckdns.org/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, username, password }),
        signal: oracleController.signal,
      }).then((oracleResponse) => {
        if (!oracleResponse.ok) console.warn('[AUTH] Oracle registration mirror returned non-2xx', { status: oracleResponse.status });
      }).catch(() => {
        console.warn('[AUTH] Oracle registration mirror unavailable; Railway registration remains active');
      }).finally(() => clearTimeout(oracleTimer));
    };

    const existing = db.prepare('SELECT id,username,display_name FROM users WHERE lower(email)=? LIMIT 1').get(email) as any;
    if (existing) {
      // Never mirror a password supplied to the registration form for an
      // existing account; that could overwrite credentials without login/reset.
      return res.status(409).json({ ok:false, registered:true, alreadyExists:true, accountExists:true, message:'هذا البريد مسجل بالفعل، يرجى تسجيل الدخول', action:'login' });
    }
    if(db.prepare('SELECT id FROM users WHERE username=?').get(username))return res.status(409).json({error:'اسم المستخدم مستخدم بالفعل.'});
    const id=`usr_${crypto.randomUUID()}`, now=new Date().toISOString();
    db.prepare("INSERT INTO users (id,email,username,password_hash,display_name,created_at,phone,phone_verified,activation_status,trip_free_searches) VALUES (?,?,?,?,?,?,?,?,?,0)").run(id,email,username,hashPassword(password),name,now,null,0,'active');
    const user={id,email,username,name,phone:undefined,phoneVerified:false,activationStatus:'active'};
    syncOracle();
    return res.json({ok:true,registered:true,accountExists:true,token:createSession(id),user});
  }catch(e:any){res.status(500).json({error:e.message||'تعذر إنشاء الحساب'});}
});

app.post('/api/auth/register/verify-phone',async(req,res)=>{
  if (!consumeAuthRateLimit(req, "register-verify")) return res.status(429).json({error:'تم تجاوز عدد محاولات التحقق. حاول لاحقًا.'});
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
  if (!consumeAuthRateLimit(req, "trips-phone-request")) return res.status(429).json({error:'تم تجاوز عدد محاولات طلب رمز التحقق. حاول لاحقًا.'});
  try{ const user=authUser(req); if(!user)return res.status(401).json({error:'يجب تسجيل الدخول أولاً'}); const phone=normalizePhone(req.body.phone); if(phone.length<8)return res.status(400).json({error:'رقم الهاتف غير صحيح'}); const taken=db.prepare('SELECT id FROM users WHERE phone=? AND id<>?').get(phone,user.id) as any; if(taken)return res.status(409).json({error:'رقم الهاتف مرتبط بحساب آخر.'}); try{ const otpResult=await requestPhoneOtp(phone); res.json({ok:true,devCode:otpResult.devCode,expiresAt:otpResult.expires}); }catch(e:any){ return res.status(503).json({error:e.message||'تعذر إرسال SMS'}); } }catch(e:any){res.status(500).json({error:e.message||'تعذر إرسال رمز التحقق'});}
});

app.post('/api/auth/trips/verify-phone',async(req,res)=>{
  if (!consumeAuthRateLimit(req, "trips-phone-verify")) return res.status(429).json({error:'تم تجاوز عدد محاولات التحقق. حاول لاحقًا.'});
  try{ const user=authUser(req); if(!user)return res.status(401).json({error:'يجب تسجيل الدخول أولاً'}); const phone=normalizePhone(req.body.phone),code=String(req.body.code||'').trim(); const row=db.prepare('SELECT * FROM users WHERE id=?').get(user.id) as any; if(!row)return res.status(404).json({error:'الحساب غير موجود'}); if(row.phone_verified)return res.json({ok:true,user:publicUser({...row,phoneVerified:true}),freeSearches:Number(row.trip_free_searches||0),alreadyVerified:true}); const check=await checkPhoneOtp(phone,code); if(!check.ok)return res.status(check.status).json({error:check.error}); const taken=db.prepare('SELECT id FROM users WHERE phone=? AND id<>?').get(phone,user.id) as any; if(taken)return res.status(409).json({error:'رقم الهاتف مرتبط بحساب آخر.'}); db.exec('BEGIN IMMEDIATE'); try{ const priorClaim=db.prepare('SELECT id FROM trip_gift_claims WHERE user_id<>? AND phone_hash=? LIMIT 1').get(user.id,giftSignalHash(phone)) as any; const giftEligible=!priorClaim; db.prepare('UPDATE users SET phone=?,phone_verified=1,trip_free_searches=?,trip_gift_claimed_at=? WHERE id=?').run(phone,giftEligible?TRIP_WELCOME_FREE_SEARCHES:0,giftEligible?new Date().toISOString():null,user.id); if(giftEligible)db.prepare('INSERT INTO trip_gift_claims (id,user_id,device_hash,ip_hash,phone_hash,created_at) VALUES (?,?,?,?,?,?)').run(`gift_${crypto.randomUUID()}`,user.id,req.body.deviceId?giftSignalHash(String(req.body.deviceId)):null,giftSignalHash(clientIp(req)),giftSignalHash(phone),new Date().toISOString()); db.prepare('DELETE FROM phone_otps WHERE phone=?').run(phone); db.exec('COMMIT'); const refreshed=db.prepare('SELECT id,email,username,display_name as name,phone,phone_verified as phoneVerified,activation_status FROM users WHERE id=?').get(user.id) as any; res.json({ok:true,user:publicUser(refreshed),giftEligible,freeSearches:giftEligible?3:0,message:giftEligible?'تم تأكيد رقم الهاتف 🎉 حصلت على 3 أبحاث مجانية هدية ترحيبية.':'تم تأكيد الهاتف، لكن الهدية سبق استخدامها بهذا الرقم.'}); }catch(e){db.exec('ROLLBACK');throw e;} }catch(e:any){res.status(500).json({error:e.message||'تعذر تأكيد رقم الهاتف'});}
});

app.post('/api/auth/login',async(req,res)=>{
  if (!consumeAuthRateLimit(req, "login")) return res.status(429).json({error:'تم تجاوز عدد محاولات تسجيل الدخول. حاول لاحقًا.'});
  try {
    const identifier=String(req.body.identifier||req.body.email||'').trim();
    const normalizedEmail=identifier.toLowerCase();
    const normalizedUsername=normalizeUsername(identifier);
    const password=String(req.body.password||'');
    const selectedRole=requestedLoginRole(req.body.role);
    let row:any=null;
    if(identifier.includes('@')) row=db.prepare('SELECT * FROM users WHERE lower(email)=? LIMIT 1').get(normalizedEmail) as any;
    else row=db.prepare('SELECT * FROM users WHERE lower(username)=? LIMIT 1').get(normalizedUsername) as any;

    let localPasswordValid=Boolean(row && verifyPassword(password,row.password_hash));
    // Legacy accounts may exist only in Oracle. Never create an account based
    // only on /check-email: authenticate against Oracle first, then persist locally.
    if ((!row || !localPasswordValid) && identifier.includes('@') && password) {
      try {
        const oracleLogin = await proxyOracleAuth('/api/auth/login', { email: normalizedEmail, identifier: normalizedEmail, password });
        const oracleUser = oracleLogin.data?.user;
        const oracleAuthenticated = oracleLogin.status >= 200 && oracleLogin.status < 300 &&
          oracleLogin.data?.ok !== false && Boolean(oracleUser) &&
          (Boolean(oracleLogin.data?.token) || oracleLogin.data?.authenticated === true || oracleLogin.data?.ok === true);
        if (oracleAuthenticated) {
          if (row) {
            // Oracle validated the current password; bring the local credential
            // back into sync without changing role, phone verification, or profile.
            db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password), row.id);
            row = db.prepare('SELECT * FROM users WHERE id=?').get(row.id) as any;
          } else {
            const email = normalizedEmail;
            const base = normalizeUsername(email.split('@')[0]).replace(/[^a-z0-9_.-]/g,'').slice(0,24);
            const stem = base.length >= 3 ? base : 'user';
            let username = stem;
            let suffix = 1;
            while (db.prepare('SELECT id FROM users WHERE lower(username)=? LIMIT 1').get(username)) {
              username = `${stem.slice(0, 24)}${suffix++}`.slice(0,30);
            }
            const name = String(oracleUser.name || oracleUser.display_name || stem).trim().slice(0,100) || stem;
            const id = `usr_${crypto.randomUUID()}`;
            const now = new Date().toISOString();
            db.prepare("INSERT INTO users (id,email,username,password_hash,display_name,created_at,phone,phone_verified,activation_status,role,trip_free_searches) VALUES (?,?,?,?,?,?,?,?,?,?,0)")
              .run(id,email,username,hashPassword(password),name,now,null,0,'active','user');
            row = db.prepare('SELECT * FROM users WHERE id=?').get(id) as any;
          }
          localPasswordValid = Boolean(row && verifyPassword(password,row.password_hash));
          console.info('[AUTH] Oracle-authenticated account persisted locally', { email: normalizedEmail, created: accountWasMissing });
        }
      } catch (error) {
        console.warn('[AUTH] Oracle login fallback unavailable', {
          reason: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'upstream-unavailable',
        });
      }
    }
    if(!row || !localPasswordValid) return res.status(401).json({error:'بيانات الدخول غير صحيحة. تأكد من البريد أو اسم المستخدم وكلمة المرور.'});
    const role=effectiveRole(row);
    if(role === 'owner' && !selectedRole) return res.json({ok:true,requiresRoleChoice:true,availableRoles:['owner','user'],roleChoiceTicket:createRoleChoiceTicket(row.id)});
    if(selectedRole === 'owner' && role !== 'owner') return res.status(403).json({error:'دخول المالك متاح لحساب المالك فقط.'});
    if(selectedRole === 'admin' && role !== 'owner' && role !== 'admin') return res.status(403).json({error:'هذا الحساب لا يملك صلاحية الدخول كإداري.'});
    const sessionRole=selectedRole === 'owner' ? 'owner' : selectedRole === 'admin' ? role : 'user';
    const user={...row,name:row.display_name,phoneVerified:row.phone_verified,role:sessionRole};
    return res.json({token:createSession(row.id,sessionRole),user:{...publicUser(user),role:sessionRole}});
  } catch(e:any) { return res.status(500).json({error:e.message||'تعذر تسجيل الدخول'}); }
});
app.post('/api/auth/select-role',(req,res)=>{
  try {
    const ticketUserId=verifyRoleChoiceTicket(String(req.body?.roleChoiceTicket||''));
    const selectedRole=requestedLoginRole(req.body?.role);
    if(!ticketUserId || !selectedRole) return res.status(403).json({error:'انتهت صلاحية اختيار نوع الدخول. سجّل الدخول مرة أخرى.'});
    const row=db.prepare('SELECT * FROM users WHERE id=?').get(ticketUserId) as any;
    if(!row || effectiveRole(row)!=='owner') return res.status(403).json({error:'هذا الحساب لا يملك صلاحية اختيار الوضع الإداري.'});
    const sessionRole=selectedRole === 'owner' ? 'owner' : 'user';
    const user={...row,name:row.display_name,phoneVerified:row.phone_verified,role:sessionRole};
    return res.json({token:createSession(row.id,sessionRole),user:{...publicUser(user),role:sessionRole}});
  } catch(e:any) { return res.status(500).json({error:e.message||'تعذر اختيار نوع الدخول'}); }
});
const ADMIN_PERMISSION_SET = [
  'users.read','users.create','users.update','users.activate','users.deactivate','users.delete','users.roles',
  'services.manage','smart_ai.manage','voice.manage','rag.manage','reports.read','data.manage',
  'audit.read','notifications.manage','system.settings','subscriptions.manage','backup.restore',
  'integrations.manage','security.manage','runtime.read'
] as const;
function requireAdmin(req: express.Request, res: express.Response) {
  const user=authUser(req);
  if(!user) { res.status(401).json({error:'يجب تسجيل الدخول.'}); return null; }
  const role=String(user.session_role||effectiveRole(user));
  if(role!=='owner' && role!=='admin') { res.status(403).json({error:'صلاحيات الإدارة مطلوبة.'}); return null; }
  return {...user, role};
}
function requireOwner(req: express.Request, res: express.Response) {
  const user=authUser(req);
  if(!user) { res.status(401).json({error:'يجب تسجيل الدخول.'}); return null; }
  if(String(user.session_role||'')!=='owner' || effectiveRole(user)!=='owner') { res.status(403).json({error:'هذا الإجراء متاح للمالك فقط.'}); return null; }
  return {...user, role:'owner' as const};
}
function protectOwnerTarget(actor:any,target:any) {
  if(!target) return 'الحساب غير موجود.';
  if(String(target.email||'').trim().toLowerCase()===PROGRAM_OWNER_EMAIL) return 'حساب مالك البرنامج محمي ولا يمكن تعطيله أو حذفه أو خفض صلاحياته.';
  if(String(actor.id)===String(target.id) && effectiveRole(actor)==='admin') return 'لا يمكن للإداري إزالة أو خفض صلاحيات حسابه الإداري.';
  return null;
}
app.get('/api/owner/admins',(req,res)=>{
  const owner=requireOwner(req,res); if(!owner) return;
  const view=String(req.query.view||'users');
  if(view==='admins'){
    const rows=db.prepare("SELECT id,email,username,display_name as name,activation_status,role,created_at FROM users WHERE role='admin' ORDER BY created_at DESC").all();
    return res.json({admins:rows.map((row:any)=>({...row,role:effectiveRole(row)}))});
  }
  const rows=db.prepare("SELECT id,email,username,display_name as name,activation_status,role,created_at FROM users WHERE id<>? AND email<>? ORDER BY created_at DESC").all(owner.id, PROGRAM_OWNER_EMAIL);
  return res.json({users:rows.map((row:any)=>({...row,role:effectiveRole(row)})).filter((row:any)=>row.role!=='admin')});
});
app.patch('/api/owner/admins/:id',(req,res)=>{
  const owner=requireOwner(req,res); if(!owner) return;
  const target=db.prepare('SELECT * FROM users WHERE id=?').get(String(req.params.id)) as any;
  if(!target) return res.status(404).json({error:'الحساب غير موجود.'});
  if(String(target.email||'').trim().toLowerCase()===PROGRAM_OWNER_EMAIL) return res.status(403).json({error:'لا يمكن تغيير دور المالك.'});
  const action=String(req.body?.action||'').trim().toLowerCase();
  if(action==='assign'){
    db.prepare("UPDATE users SET role='admin',activation_status='active',activated_by=?,activated_at=? WHERE id=?").run(owner.email,new Date().toISOString(),target.id);
    return res.json({ok:true,role:'admin'});
  }
  if(action==='remove'){
    db.prepare("UPDATE users SET role='user' WHERE id=?").run(target.id);
    return res.json({ok:true,role:'user'});
  }
  return res.status(400).json({error:'إجراء غير صالح.'});
});

app.get('/api/admin/me',(req,res)=>{
  const user=requireAdmin(req,res); if(!user) return;
  res.json({role:user.role,permissions:[...ADMIN_PERMISSION_SET],ownerProtected:user.role==='owner'});
});
app.get('/api/admin/users',(req,res)=>{
  const user=requireAdmin(req,res); if(!user) return;
  const rows=db.prepare("SELECT id,email,username,display_name as name,activation_status,role,created_at,activated_by,activated_at FROM users WHERE id<>? ORDER BY created_at DESC").all(user.id);
  res.json({users:rows.map((row:any)=>({...row,role:effectiveRole(row)}))});
});
app.patch('/api/admin/users/:id',(req,res)=>{
  const actor=requireAdmin(req,res); if(!actor) return;
  const target=db.prepare('SELECT * FROM users WHERE id=?').get(String(req.params.id)) as any;
  const protectedError=protectOwnerTarget(actor,target); if(protectedError) return res.status(403).json({error:protectedError});
  const activation=String(req.body?.activationStatus||'').trim().toLowerCase();
  const requestedRole=String(req.body?.role||'').trim().toLowerCase();
  const allowedActivation=new Set(['active','pending','suspended']);
  if(activation && !allowedActivation.has(activation)) return res.status(400).json({error:'حالة الحساب غير صالحة.'});
  if(requestedRole && !['admin','user'].includes(requestedRole)) return res.status(400).json({error:'الدور غير صالح.'});
  if (requestedRole && requestedRole !== effectiveRole(target)) {
    if (effectiveRole(actor) !== 'owner') return res.status(403).json({error:'تعيين أو تغيير صلاحية Admin متاح للمالك فقط.'});
    if (requestedRole === 'owner') return res.status(400).json({error:'لا يمكن تعيين دور Owner من هذه الواجهة.'});
  }
  const nextActivation=activation || String(target.activation_status||'pending');
  const nextRole=requestedRole || effectiveRole(target);
  db.prepare("UPDATE users SET activation_status=?,role=?,activated_by=?,activated_at=? WHERE id=?").run(nextActivation,nextRole,actor.email,new Date().toISOString(),target.id);
  const refreshed=db.prepare("SELECT id,email,username,display_name as name,activation_status,role,created_at,activated_by,activated_at FROM users WHERE id=?").get(target.id) as any;
  res.json({user:{...refreshed,role:effectiveRole(refreshed)}});
});
app.delete('/api/admin/users/:id',(req,res)=>{
  const actor=requireAdmin(req,res); if(!actor) return;
  const target=db.prepare('SELECT * FROM users WHERE id=?').get(String(req.params.id)) as any;
  const protectedError=protectOwnerTarget(actor,target); if(protectedError) return res.status(403).json({error:protectedError});
  if(effectiveRole(target)==='admin' && effectiveRole(actor)!=='owner') return res.status(403).json({error:'حذف Admin متاح للمالك فقط.'});
  if(effectiveRole(target)==='owner') return res.status(403).json({error:'لا يمكن حذف المالك.'});
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
  db.prepare('DELETE FROM users WHERE id=?').run(target.id);
  res.json({ok:true,deletedUserId:target.id});
});
app.get('/api/admin/system/status',(req,res)=>{
  const user=requireAdmin(req,res); if(!user) return;
  res.json({ok:true,role:user.role,permissions:[...ADMIN_PERMISSION_SET],services:getServiceStatuses(),timestamp:new Date().toISOString()});
});
app.get('/api/auth/me',(req,res)=>{const user=authUser(req);if(!user)return res.status(401).json({error:'جلسة الدخول منتهية'});res.json({user:{...publicUser(user),role:String(user.session_role||effectiveRole(user))}});});
const USER_APP_DATA_KEYS = new Set([
  'smart_time_user_profile','smart_time_notes','smart_time_note_folders','smart_time_note_tags',
  'smart_time_calc_history','smart_time_daily_tasks','smart_time_expenses','smart_time_budget',
  'smart_time_monthly_income','smart_time_bank_certificates','smart_time_vehicles',
  'smart_time_fuel_records','smart_time_maint_records','smart_time_accident_records',
  'smart_time_students','smart_time_lessons','smart_time_edu_expenses','smart_time_favorite_places',
  'smart_time_recent_trips','smart_time_secure_records','smart_time_chat_rooms',
  'smart_time_chat_messages','smart_time_media_folders','smart_time_media_items',
  'smart_time_notifications','smart_time_athkar_items','smart_time_ai_chat_history',
  'smart_time_notification_sound','smart_time_dashboard_layout','smart_time_dashboard_sections_v2',
  'smart_time_workout_logs','smart_time_sports_cards_order','smart_time_expenses_sections_order'
]);
const USER_APP_DATA_MAX_BYTES = 512 * 1024;
app.get('/api/user/app-data',(req,res)=>{
  const user=authUser(req);
  if(!user) return res.status(401).json({error:'جلسة الدخول منتهية'});
  try {
    const rows=db.prepare('SELECT data_key,payload_json,updated_at FROM user_app_data WHERE user_id=?').all(user.id) as any[];
    const data:Record<string,unknown>={};
    for(const row of rows) {
      if(!USER_APP_DATA_KEYS.has(String(row.data_key))) continue;
      try { data[String(row.data_key)]=JSON.parse(String(row.payload_json)); } catch {}
    }
    res.setHeader('Cache-Control','no-store');
    res.json({ok:true,data});
  } catch {
    res.status(500).json({error:'تعذر تحميل بيانات الحساب'});
  }
});
app.put('/api/user/app-data',(req,res)=>{
  const user=authUser(req);
  if(!user) return res.status(401).json({error:'جلسة الدخول منتهية'});
  const key=String(req.body?.key||'');
  if(!USER_APP_DATA_KEYS.has(key)) return res.status(400).json({error:'مفتاح البيانات غير مسموح'});
  let payload:string;
  try { payload=JSON.stringify(req.body?.value); } catch { return res.status(400).json({error:'صيغة البيانات غير صالحة'}); }
  if(payload===undefined || Buffer.byteLength(payload,'utf8')>USER_APP_DATA_MAX_BYTES) return res.status(413).json({error:'حجم البيانات أكبر من الحد المسموح'});
  try {
    db.prepare('INSERT INTO user_app_data(user_id,data_key,payload_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,data_key) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at')
      .run(user.id,key,payload,new Date().toISOString());
    res.setHeader('Cache-Control','no-store');
    res.json({ok:true,key});
  } catch {
    res.status(500).json({error:'تعذر حفظ بيانات الحساب'});
  }
});
app.delete('/api/user/app-data/:key',(req,res)=>{
  const user=authUser(req);
  if(!user) return res.status(401).json({error:'جلسة الدخول منتهية'});
  const key=String(req.params.key||'');
  if(!USER_APP_DATA_KEYS.has(key)) return res.status(400).json({error:'مفتاح البيانات غير مسموح'});
  try {
    db.prepare('DELETE FROM user_app_data WHERE user_id=? AND data_key=?').run(user.id,key);
    res.json({ok:true});
  } catch {
    res.status(500).json({error:'تعذر حذف بيانات الحساب'});
  }
});
app.post('/api/auth/owner/activate',(req,res)=>{try{const ownerEmail=String(req.body.ownerEmail||'').trim().toLowerCase(),key=String(req.body.activationKey||'').trim(),userEmail=String(req.body.userEmail||'').trim().toLowerCase();if(ownerEmail!==PROGRAM_OWNER_EMAIL)return res.status(403).json({error:'هذا الإجراء مخصص لصاحب البرنامج.'});if(!PROGRAM_OWNER_ACTIVATION_KEY||key!==PROGRAM_OWNER_ACTIVATION_KEY)return res.status(403).json({error:'مفتاح تفعيل المالك غير صحيح أو غير مُكوّن.'});const user=db.prepare('SELECT id FROM users WHERE email=?').get(userEmail) as any;if(!user)return res.status(404).json({error:'الحساب غير موجود.'});db.prepare("UPDATE users SET activation_status='active',activated_by=?,activated_at=? WHERE id=?").run(ownerEmail,new Date().toISOString(),user.id);res.json({ok:true,message:'تم اعتماد الحساب بنجاح.'});}catch(e:any){res.status(500).json({error:e.message||'تعذر اعتماد الحساب'});}});
app.post('/api/auth/phone-login/request-otp',async(req,res)=>{
  if (!consumeAuthRateLimit(req, "phone-login-request")) return res.status(429).json({error:'تم تجاوز عدد محاولات طلب رمز الدخول. حاول لاحقًا.'});
  try{const phone=normalizePhone(req.body.phone);if(phone.length<8)return res.status(400).json({error:'رقم الهاتف غير صحيح'});const row=db.prepare('SELECT id FROM users WHERE phone=? AND phone_verified=1').get(phone) as any;if(!row)return res.status(404).json({error:'هذا الرقم غير مرتبط بحساب موثق.'});try{const otpResult=await requestPhoneOtp(phone);res.json({ok:true,expiresAt:otpResult.expires,devCode:otpResult.devCode,smsProvider:otpResult.provider});}catch(err:any){return res.status(503).json({error:err.message||'تعذر إرسال SMS'});}}catch(e:any){res.status(500).json({error:e.message||'تعذر إرسال رمز SMS'});}});
app.post('/api/auth/phone-login',async(req,res)=>{
  if (!consumeAuthRateLimit(req, "phone-login")) return res.status(429).json({error:'تم تجاوز عدد محاولات تسجيل الدخول بالهاتف. حاول لاحقًا.'});
  try{const phone=normalizePhone(req.body.phone),code=String(req.body.code||'').trim();const check=await checkPhoneOtp(phone,code);if(!check.ok)return res.status(check.status).json({error:check.error});const row=db.prepare('SELECT * FROM users WHERE phone=? AND phone_verified=1').get(phone) as any;if(!row)return res.status(404).json({error:'هذا الرقم غير مرتبط بحساب موثق.'});db.prepare('DELETE FROM phone_otps WHERE phone=?').run(phone);res.json({token:createSession(row.id),user:publicUser({...row,name:row.display_name,phoneVerified:row.phone_verified})});}catch(e:any){res.status(500).json({error:e.message||'تعذر تسجيل الدخول بالهاتف'});}});
const ORACLE_AUTH_BASE_URL = "https://smart-time-ai.duckdns.org";
async function proxyOracleAuth(pathname: string, payload: Record<string, unknown>, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${ORACLE_AUTH_BASE_URL}${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data: any;
    try { data = JSON.parse(raw); }
    catch { throw new Error("Oracle auth service returned an invalid response"); }
    return { status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

app.post('/api/auth/forgot-password', async (req, res) => {
  if (!consumeAuthRateLimit(req, 'forgot-password')) {
    return res.status(429).json({ ok: false, emailSent: false, message: 'تم تجاوز عدد محاولات الاستعادة. حاول لاحقًا.' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ ok: false, emailSent: false, message: 'أدخل بريدًا إلكترونيًا صحيحًا.' });
  }

  // Oracle is the primary password-reset sender. Railway must not attempt to
  // initialize a local Gmail transport just to proxy this request.
  try {
    const result = await proxyOracleAuth('/api/auth/forgot-password', { email }, 10_000);
    const responseText = JSON.stringify(result.data ?? {});
    const missingSmtpCredentials = /missing credentials for\s+["']?plain|credentials.*plain/i.test(responseText);

    // Oracle may be reachable while its mail transport is misconfigured.
    // Never expose Nodemailer internals or pass this through as an HTTP 500.
    if (missingSmtpCredentials) {
      console.error('[AUTH_PROXY] Oracle forgot-password mail transport is not configured');
      return res.status(503).json({
        ok: false,
        emailSent: false,
        code: 'PASSWORD_RESET_MAIL_UNAVAILABLE',
        message: 'خدمة استعادة كلمة المرور غير متاحة حاليًا. إعدادات البريد الإلكتروني غير مكتملة على خادم الإرسال.',
      });
    }

    return res.status(result.status).json(result.data);
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    const hasRailwayMailCredentials = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASS);

    console.error('[AUTH_PROXY] Forgot-password Oracle request failed', {
      reason: timedOut ? 'timeout' : 'upstream-unavailable',
      railwayMailConfigured: hasRailwayMailCredentials,
    });

    // There is no separate Railway mailer in this route. If Oracle is down,
    // fail closed with a clear 503 instead of crashing on missing PLAIN creds.
    return res.status(503).json({
      ok: false,
      emailSent: false,
      code: 'AUTH_UPSTREAM_UNAVAILABLE',
      message: hasRailwayMailCredentials
        ? 'تعذر الاتصال بخدمة استعادة كلمة المرور. حاول مرة أخرى لاحقًا.'
        : 'خدمة استعادة كلمة المرور غير متاحة حاليًا؛ خادم الإرسال غير متصل وإعدادات البريد الاحتياطية غير مكتملة.',
    });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  if (!consumeAuthRateLimit(req, 'reset-password')) {
    return res.status(429).json({ ok: false, message: 'تم تجاوز عدد محاولات تغيير كلمة المرور. حاول لاحقًا.' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const newPassword = String(req.body?.newPassword || req.body?.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ ok: false, message: 'أدخل بريدًا إلكترونيًا صحيحًا.' });
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ ok: false, message: 'أدخل رمز الاستعادة المكوّن من 6 أرقام.' });
  }
  if (newPassword.length < 8 || newPassword.length > 256) {
    return res.status(400).json({ ok: false, message: 'كلمة المرور يجب أن تكون بين 8 و256 حرفًا.' });
  }
  try {
    // Oracle validates and consumes the reset code. After it confirms the reset,
    // update the local database used by /api/auth/login before reporting success.
    const result = await proxyOracleAuth('/api/auth/reset-password', { email, code, newPassword, password: newPassword });
    if (!(result.status >= 200 && result.status < 300 && result.data?.ok !== false)) {
      return res.status(result.status).json(result.data);
    }

    const hashedPassword = hashPassword(newPassword);
    try {
      const existing = db.prepare('SELECT id FROM users WHERE lower(email)=? LIMIT 1').get(email) as any;
      if (existing) {
        const localUpdate = db.prepare('UPDATE users SET password_hash=? WHERE id=?')
          .run(hashedPassword, existing.id);
        if (localUpdate.changes < 1) throw new Error('local password update affected no rows');
      } else {
        // A successful one-time Oracle reset code proves mailbox control.
        // Create a local account only after that verification, never from
        // an unauthenticated /check-email response.
        const localPart = normalizeUsername(email.split('@')[0]).replace(/[^a-z0-9_.-]/g,'').slice(0,24);
        const stem = localPart.length >= 3 ? localPart : 'user';
        let username = stem;
        let suffix = 1;
        while (db.prepare('SELECT id FROM users WHERE lower(username)=? LIMIT 1').get(username)) {
          username = `${stem.slice(0,24)}${suffix++}`.slice(0,30);
        }
        const id = `usr_${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        db.prepare("INSERT INTO users (id,email,username,password_hash,display_name,created_at,phone,phone_verified,activation_status,role,trip_free_searches) VALUES (?,?,?,?,?,?,?,?,?,?,0)")
          .run(id,email,username,hashedPassword,stem,now,null,0,'active','user');
      }
    } catch (error) {
      console.error('[AUTH_PROXY] Local password sync failed after Oracle reset', {
        reason: 'local-database-update-failed',
        detail: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({
        ok: false,
        code: 'LOCAL_PASSWORD_SYNC_FAILED',
        message: 'تم التحقق من رمز الاستعادة، لكن تعذر حفظ كلمة المرور في قاعدة تسجيل الدخول. لم يتم تأكيد نجاح العملية؛ حاول مرة أخرى أو تواصل مع الدعم.',
      });
    }

    console.info('ANY USER Railway password updated', email);
    return res.json({ ok: true, message: 'تم تغيير كلمة المرور بنجاح - يمكنك تسجيل الدخول الآن' });
  } catch (error) {
    console.error('[AUTH_PROXY] Reset-password request failed', {
      reason: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'upstream-unavailable',
    });
    return res.status(502).json({ ok: false, code: 'AUTH_UPSTREAM_UNAVAILABLE', message: 'خدمة تغيير كلمة المرور غير متاحة حاليًا. حاول مرة أخرى لاحقًا.' });
  }
});
app.post('/api/auth/logout',(req,res)=>{const h=String(req.headers.authorization||''),token=h.startsWith('Bearer ')?h.slice(7).trim():'';if(token)db.prepare('DELETE FROM sessions WHERE id=?').run(token);res.json({ok:true});});
app.post('/api/auth/chat/request-otp',async(req,res)=>{try{const user=authUser(req);if(!user)return res.status(401).json({error:'يجب تسجيل الدخول بالبريد أولاً'});const phone=normalizePhone(req.body.phone);if(phone.length<8)return res.status(400).json({error:'رقم الهاتف غير صحيح'});const taken=db.prepare('SELECT id FROM users WHERE phone=? AND id<>?').get(phone,user.id) as any;if(taken)return res.status(409).json({error:'رقم الهاتف مرتبط بحساب آخر'});try{const otpResult=await requestPhoneOtp(phone);res.json({ok:true,expiresAt:otpResult.expires,devCode:otpResult.devCode,smsProvider:otpResult.provider});}catch(err:any){return res.status(503).json({error:err.message||'تعذر إرسال SMS'});}}catch(e:any){res.status(500).json({error:e.message||'تعذر إرسال رمز التحقق'});}});
app.post('/api/auth/chat/verify-otp',async(req,res)=>{try{const user=authUser(req);if(!user)return res.status(401).json({error:'جلسة الدخول غير صالحة'});const phone=normalizePhone(req.body.phone),code=String(req.body.code||'').trim();const check=await checkPhoneOtp(phone,code);if(!check.ok)return res.status(check.status).json({error:check.error});db.prepare('UPDATE users SET phone=?,phone_verified=1 WHERE id=?').run(phone,user.id);db.prepare('DELETE FROM phone_otps WHERE phone=?').run(phone);const refreshed=db.prepare('SELECT id,email,username,display_name as name,phone,phone_verified as phoneVerified,activation_status FROM users WHERE id=?').get(user.id) as any;res.json({token:createSession(user.id),user:publicUser(refreshed)});}catch(e:any){res.status(500).json({error:e.message||'تعذر تأكيد الرقم'});}});


// ----------------------------------------------------
// 1. Health check
// ----------------------------------------------------
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
    const confirmed = req.body?.confirmed === true;
    const timezone = String(req.body?.timezone || (appContext?.profile && typeof appContext.profile === "object" ? appContext.profile.timezone || "Africa/Cairo" : "Africa/Cairo"));

    if (!message) return res.status(400).json({ error: "Message is required" });
    if (!appContext || typeof appContext !== "object") {
      return res.status(400).json({ error: "بيانات سياق SMART TIME مطلوبة." });
    }

    const response = await askSmartAiCore({
      message,
      language,
      conversationHistory,
      appContext: appContext as Record<string, unknown>,
      userId: String(user.id),
      timezone,
      conversationId: typeof req.body?.conversationId === "string" ? req.body.conversationId : undefined,
      activeTaskId: typeof req.body?.activeTaskId === "string" ? req.body.activeTaskId : undefined,
      activeFileIds: Array.isArray(req.body?.activeFileIds) ? req.body.activeFileIds.map(String) : undefined,
      confirmed,
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

app.get("/api/ai/state", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });

  try {
    const canonicalFinance = getAiCanonicalState(String(user.id));
    const transactions = canonicalFinance.transactions;
    const budget = canonicalFinance.budget;

    const calendarEvents = listCalendarEvents(String(user.id));
    const rawTasks = db.prepare(`
      SELECT id, title, completed, priority, category,
             due_date as dueDate, due_time as dueTime,
             note, created_at as createdAt,
             completed_at as completedAt
      FROM ai_tasks
      WHERE user_id = ?
      ORDER BY COALESCE(due_date, '9999-12-31'), COALESCE(due_time, '23:59'), created_at DESC
    `).all(user.id) as any[];

    const tasks = rawTasks.map((task) => ({
      ...task,
      completed: Boolean(task.completed),
      reminderEnabled: true,
    }));

    return res.json({
      source: "smart-ai-sqlite",
      userId: user.id,
      transactions,
      budget,
      tasks,
      calendarEvents,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "تعذر قراءة حالة SMART AI." });
  }
});


app.post("/api/finance/expenses", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    const record = createCanonicalExpense(String(user.id), req.body || {});
    return res.status(201).json({ source: "smart-time-finance-sqlite", record });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "تعذر إضافة المصروف." });
  }
});

app.patch("/api/finance/expenses/:id", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    const record = updateCanonicalExpense(String(user.id), String(req.params.id), req.body || {});
    return res.json({ source: "smart-time-finance-sqlite", record });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "تعذر تحديث المصروف." });
  }
});

app.delete("/api/finance/expenses/:id", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    deleteCanonicalExpense(String(user.id), String(req.params.id));
    return res.json({ source: "smart-time-finance-sqlite", deleted: true, id: String(req.params.id) });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "تعذر حذف المصروف." });
  }
});

app.post("/api/finance/migrate", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    ensureFinanceMutationSchema();
    const legacyItems = Array.isArray(req.body?.expenses) ? req.body.expenses : [];
    const legacy = migrateLegacyExpensesToCanonical(String(user.id), legacyItems);
    const ai = req.body?.reconcileAiTransactions === false
      ? null
      : reconcileAiTransactionsToCanonical(String(user.id));
    return res.json({
      source: "smart-time-finance-sqlite",
      legacy,
      ai,
      verificationPassed: Boolean(legacy.verificationPassed && (ai === null || ai.verificationPassed)),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "تعذر تنفيذ ترحيل البيانات المالية." });
  }
});

app.get("/api/finance/overview", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    return res.json(getFinanceOverview(String(user.id)));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "تعذر قراءة بيانات التمويل." });
  }
});

app.get("/api/ai/events", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    const events = listCalendarEvents(String(user.id), {
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
    });
    return res.json({ source: "smart-ai-sqlite", events, fetchedAt: new Date().toISOString() });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "تعذر قراءة أحداث التقويم." });
  }
});

app.get("/api/ai/reminders", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    queueDueEventReminders();
    const limit = Number(req.query.limit || 50);
    return res.json({
      source: "smart-ai-sqlite",
      reminders: listPendingEventReminders(String(user.id), Number.isFinite(limit) ? limit : 50),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "تعذر قراءة تذكيرات الأحداث." });
  }
});

app.post("/api/ai/reminders/:id/ack", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    const acknowledged = acknowledgeEventReminder(String(user.id), req.params.id);
    if (!acknowledged) return res.status(404).json({ error: "التذكير غير موجود أو تم تأكيده بالفعل." });
    return res.json({ acknowledged: true, id: req.params.id });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "تعذر تأكيد التذكير." });
  }
});

app.post("/api/ai/events", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    const event = createCalendarEvent(String(user.id), req.body || {});
    return res.status(201).json(event);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "تعذر إنشاء الحدث." });
  }
});

app.patch("/api/ai/events/:id", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    const event = updateCalendarEvent(String(user.id), req.params.id, req.body || {});
    return res.json(event);
  } catch (error: any) {
    const message = error?.message || "تعذر تحديث الحدث.";
    return res.status(message.includes("not found") ? 404 : 400).json({ error: message });
  }
});

app.delete("/api/ai/events/:id", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    deleteCalendarEvent(String(user.id), req.params.id);
    return res.status(204).send();
  } catch (error: any) {
    const message = error?.message || "تعذر حذف الحدث.";
    return res.status(message.includes("not found") ? 404 : 400).json({ error: message });
  }
});

app.post("/api/ai/tasks", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    const result = executeToolAction(String(user.id), {
      type: "add_daily_task",
      payload: req.body || {},
    } as any);
    if (!result.ok) return res.status(500).json({ error: result.error || "تعذر إنشاء المهمة." });
    return res.status(201).json(result.record);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "تعذر إنشاء المهمة." });
  }
});

app.patch("/api/ai/tasks/:id", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    const result = executeToolAction(String(user.id), {
      type: "update_daily_task",
      payload: { ...(req.body || {}), id: req.params.id },
    } as any);
    if (!result.ok) return res.status(500).json({ error: result.error || "تعذر تحديث المهمة." });
    return res.json(result.record);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "تعذر تحديث المهمة." });
  }
});

app.delete("/api/ai/tasks/:id", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  try {
    const row = db.prepare("SELECT id FROM ai_tasks WHERE id = ? AND user_id = ?").get(req.params.id, user.id) as any;
    if (!row) return res.status(404).json({ error: "المهمة غير موجودة." });
    db.prepare("DELETE FROM ai_tasks WHERE id = ? AND user_id = ?").run(req.params.id, user.id);
    const verify = db.prepare("SELECT id FROM ai_tasks WHERE id = ? AND user_id = ?").get(req.params.id, user.id);
    if (verify) return res.status(500).json({ error: "فشل التحقق من حذف المهمة." });
    return res.status(204).send();
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "تعذر حذف المهمة." });
  }
});

app.post("/api/ai/tasks/import", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  try {
    const insert = db.prepare(`INSERT OR IGNORE INTO ai_tasks
      (id,user_id,title,completed,priority,category,due_date,due_time,note,created_at,completed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    let imported = 0;
    for (const task of tasks) {
      const id = String(task?.id || "").trim();
      const title = String(task?.title || "").trim();
      if (!id || !title) continue;
      insert.run(
        id, String(user.id), title, task?.completed ? 1 : 0,
        String(task?.priority || "medium"), String(task?.category || "general"),
        String(task?.dueDate || "") || null, String(task?.dueTime || "") || null,
        String(task?.note || "") || null, String(task?.createdAt || new Date().toISOString()),
        task?.completedAt ? String(task.completedAt) : null
      );
      imported += 1;
    }
    return res.json({ imported });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "تعذر استيراد المهام." });
  }
});

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

app.post("/api/ai/egyptian-tts", async (req, res) => {
  try {
    if (!smartVoiceDnaProvider.isAvailable()) {
      return res.status(503).json({ error: "محرك الصوت المصري غير موصل حاليًا." });
    }

    const ipKey = "public-tts:" + clientIp(req);
    if (!consumeVoiceDnaQuota(ipKey)) {
      return res.status(429).json({ error: "طلبات الصوت كثيرة حاليًا. حاول بعد قليل." });
    }

    const text = String(req.body?.text || "").trim();
    const speaker = String(req.body?.speaker || "Mohamed").trim();
    if (!text) return res.status(400).json({ error: "النص الصوتي مطلوب." });
    if (text.length > 800) return res.status(413).json({ error: "النص الصوتي طويل جدًا." });

    const allowedSpeakers = new Set([
      "Abdelrahman", "Abdullah", "Kamal", "Hossam", "Mohamed",
      "Omar", "Sayed", "Zaki", "Aly", "Essam", "Ahmed",
      "Asmaa", "Esraa", "Hanan", "Sarah", "Yasmin", "Omnia",
    ]);
    if (!allowedSpeakers.has(speaker)) {
      return res.status(400).json({ error: "الصوت المصري المطلوب غير متاح." });
    }

    const result = await smartVoiceDnaProvider.synthesize({
      text,
      language: "ar",
      locale: "ar-EG",
      profileId: "smart-ai-egyptian-default",
      speaker,
      speakingStyle: "natural",
    });

    res.setHeader("Content-Type", result.contentType || "audio/wav");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-SMART-VOICE-PROVIDER", result.provider);
    return res.send(Buffer.from(result.audio));
  } catch (error: any) {
    console.error("Egyptian TTS error:", error?.message || error);
    return res.status(502).json({ error: "تعذر توليد الصوت المصري حاليًا." });
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
    // Open-Meteo's English-language geocoder can miss Arabic city names.
    // Normalize common Arabic city names while preserving arbitrary user input.
    const normalizedCity = ({
      "القاهرة": "Cairo",
      "القاهره": "Cairo",
      "مصر الجديدة": "Heliopolis",
      "الجيزة": "Giza",
      "الجيزه": "Giza",
      "الإسكندرية": "Alexandria",
      "الاسكندرية": "Alexandria",
      "اسكندرية": "Alexandria",
      "شرم الشيخ": "Sharm el-Sheikh",
      "الغردقة": "Hurghada",
      "الغردقه": "Hurghada",
      "الأقصر": "Luxor",
      "الاقصر": "Luxor",
      "أسوان": "Aswan",
      "اسوان": "Aswan",
    } as Record<string, string>)[requestedCity] || requestedCity;
    const geo = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalizedCity)}&count=1&language=en&format=json`);
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
  const liveKitOrigin = String(process.env.LIVEKIT_ORIGIN_WS_URL || "").trim();
  if (liveKitOrigin) {
    httpServer.on("upgrade", (req, socket, head) => {
      const requestUrl = String(req.url || "");
      if (!requestUrl.startsWith("/livekit/")) return;

      try {
        const targetUrl = new URL(requestUrl.replace(/^\/livekit/, ""), liveKitOrigin);
        const upstream = new WebSocket(targetUrl.toString());
        const client = new WebSocketServer({ noServer: true });

        const reject = () => {
          try { socket.destroy(); } catch {}
          try { upstream.close(); } catch {}
        };

        upstream.once("open", () => {
          client.handleUpgrade(req, socket, head, (downstream) => {
            downstream.on("message", (data) => {
              if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
            });
            downstream.on("close", () => {
              try { upstream.close(); } catch {}
            });
            downstream.on("error", reject);

            upstream.on("message", (data) => {
              if (downstream.readyState === WebSocket.OPEN) downstream.send(data);
            });
            upstream.on("close", (code, reason) => {
              try { downstream.close(code, reason); } catch {}
            });
            upstream.on("error", reject);
          });
        });
        upstream.once("error", reject);
      } catch {
        try { socket.destroy(); } catch {}
      }
    });
  }


  queueDueEventReminders();
  const reminderScheduler = setInterval(() => {
    try {
      queueDueEventReminders();
    } catch (error) {
      console.error("[SMART AI] reminder scheduler error:", error);
    }
  }, 15_000);
  reminderScheduler.unref?.();

  httpServer.listen(PORT, "0.0.0.0", () => {
    setServiceStatus("backend", "LIVE", "express", `Listening on port ${PORT}`);
    setServiceStatus("chat_realtime", "LIVE", "websocket", "Realtime chat WebSocket ready on /ws/chat");
    console.log(`[SMART TIME V8] Server & Chat WebSocket running on http://0.0.0.0:${PORT}`);
  });
}


startServer();
