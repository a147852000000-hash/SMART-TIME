#!/usr/bin/env node
"use strict";

/*
 * SMART TIME Oracle single-process candidate.
 * Preserves the active JSON-backed Oracle authentication authority and serves
 * the Vite React build from the same Express process and origin.
 * Deploy only after review and explicit owner approval.
 */
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const PORT = Number(process.env.PORT) || 3000;
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(PROJECT_ROOT, "dist");
const USERS_FILE = process.env.USERS_FILE || path.join(PROJECT_ROOT, "users.json");
const CODES_FILE = process.env.CODES_FILE || path.join(PROJECT_ROOT, "reset-codes.json");
const SESSIONS_FILE = process.env.SESSIONS_FILE || path.join(PROJECT_ROOT, "sessions.json");
const OWNER_EMAIL = String(process.env.PROGRAM_OWNER_EMAIL || "").trim().toLowerCase();
const CODE_SECRET = String(process.env.RESET_CODE_SECRET || "");
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 10 * 60 * 1000;
const RESET_COOLDOWN_MS = 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!EMAIL_RE.test(OWNER_EMAIL) || OWNER_EMAIL.length > 254) throw new Error("PROGRAM_OWNER_EMAIL is required and must be a valid email");
if (Buffer.byteLength(CODE_SECRET, "utf8") < 32) throw new Error("RESET_CODE_SECRET must be set to at least 32 bytes");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
const origins = String(process.env.ALLOWED_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : "*" }));
app.use(express.json({ limit: "10kb" }));

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { throw new Error("Invalid JSON data file: " + path.basename(file)); }
}
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = file + "." + process.pid + "." + crypto.randomBytes(8).toString("hex") + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600, flag: "wx" });
    fs.renameSync(tmp, file);
    try { fs.chmodSync(file, 0o600); } catch {}
  } finally { try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {} }
}
const normEmail = value => String(value || "").trim().toLowerCase();
const validEmail = email => email.length <= 254 && EMAIL_RE.test(email);
const saveUsers = users => writeJsonAtomic(USERS_FILE, users);
const saveCodes = codes => writeJsonAtomic(CODES_FILE, codes);
const saveSessions = sessions => writeJsonAtomic(SESSIONS_FILE, sessions);

function loadUsersRaw() {
  const users = readJson(USERS_FILE, []);
  if (!Array.isArray(users)) throw new Error("users.json must contain an array");
  return users;
}
function loadUsers() {
  const users = loadUsersRaw();
  let changed = false, ownerCount = 0;
  const seen = new Set();
  for (const user of users) {
    if (!user || typeof user !== "object" || Array.isArray(user)) throw new Error("Invalid user record in users.json");
    const email = normEmail(user.email);
    if (email && user.email !== email) { user.email = email; changed = true; }
    if (email) { if (seen.has(email)) throw new Error("Duplicate email detected in users.json"); seen.add(email); }
    if (!user.id) { user.id = crypto.randomUUID(); changed = true; }
    if (!user.activation_status) { user.activation_status = "active"; changed = true; }
    if (!["active", "suspended"].includes(user.activation_status)) { user.activation_status = "suspended"; changed = true; }
    const expectedRole = email === OWNER_EMAIL ? "owner" : (user.role === "admin" ? "admin" : "user");
    if (user.role !== expectedRole) { user.role = expectedRole; changed = true; }
    if (!Number.isSafeInteger(user.authVersion) || user.authVersion < 0) { user.authVersion = 0; changed = true; }
    if (!user.created_at) { user.created_at = user.createdAt || new Date().toISOString(); changed = true; }
    if (email === OWNER_EMAIL) ownerCount++;
  }
  if (ownerCount !== 1) throw new Error("Expected exactly one configured owner account; found " + ownerCount);
  if (changed) saveUsers(users);
  return users;
}
function loadCodes() {
  const value = readJson(CODES_FILE, {});
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid reset-codes.json");
  return value;
}
function loadSessions() {
  const value = readJson(SESSIONS_FILE, {});
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid sessions.json");
  return value;
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16), N = 16384, r = 8, p = 1;
  const derived = crypto.scryptSync(password, salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return "scrypt$" + N + "$" + r + "$" + p + "$" + salt.toString("hex") + "$" + derived.toString("hex");
}
function timingSafeStringEqual(a, b) {
  const aa = Buffer.from(String(a), "utf8"), bb = Buffer.from(String(b), "utf8");
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored) return { ok: false, needsUpgrade: false };
  if (!stored.startsWith("scrypt$")) return { ok: timingSafeStringEqual(password, stored), needsUpgrade: true };
  const parts = stored.split("$");
  if (parts.length !== 6) return { ok: false, needsUpgrade: false };
  const N = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3]);
  if (![N,r,p].every(Number.isSafeInteger) || N < 1024 || N > 262144 || r < 1 || r > 16 || p < 1 || p > 4) return { ok: false, needsUpgrade: false };
  if (!/^[a-f0-9]{32}$/i.test(parts[4]) || !/^[a-f0-9]{128}$/i.test(parts[5])) return { ok: false, needsUpgrade: false };
  try {
    const actual = crypto.scryptSync(password, Buffer.from(parts[4], "hex"), 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
    return { ok: crypto.timingSafeEqual(actual, Buffer.from(parts[5], "hex")), needsUpgrade: false };
  } catch { return { ok: false, needsUpgrade: false }; }
}
const hashCode = (email, code) => crypto.createHmac("sha256", CODE_SECRET).update(email + ":" + code).digest("hex");
function safeEqualHex(a, b) {
  if (!/^[a-f0-9]{64}$/i.test(String(a)) || !/^[a-f0-9]{64}$/i.test(String(b))) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
const rateHits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + ":" + req.path, now = Date.now();
    let item = rateHits.get(key);
    if (!item || now >= item.resetAt) item = { count: 0, resetAt: now + windowMs };
    item.count++; rateHits.set(key, item);
    if (item.count > max) return res.status(429).json({ ok: false, message: "محاولات كتير - حاول بعد شوية" });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [key, value] of rateHits) if (now >= value.resetAt) rateHits.delete(key); }, 10 * 60 * 1000).unref();

const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS } });
function publicUser(user, effectiveRole) {
  return { id: user.id, email: user.email, username: user.username || "", name: user.name || "", role: effectiveRole || user.role || "user", activation_status: user.activation_status || "active", created_at: user.created_at || user.createdAt || "" };
}
function issueSession(user, viewAs) {
  const owner = normEmail(user.email) === OWNER_EMAIL;
  const safeViewAs = owner && viewAs === "user" ? "user" : owner ? "owner" : "normal";
  const token = crypto.randomBytes(32).toString("base64url"), sessions = loadSessions(), now = Date.now();
  for (const [key,item] of Object.entries(sessions)) if (!item || !Number.isFinite(item.expiresAt) || item.expiresAt <= now) delete sessions[key];
  sessions[crypto.createHash("sha256").update(token).digest("hex")] = { userId: user.id, viewAs: safeViewAs, authVersion: user.authVersion || 0, createdAt: now, expiresAt: now + SESSION_TTL_MS };
  saveSessions(sessions);
  return { token, user: publicUser(user, owner ? (safeViewAs === "user" ? "user" : "owner") : (user.role || "user")) };
}
function bearerToken(req) { const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i); return match ? match[1].trim() : ""; }
function authRequired(req, res, next) {
  const token = bearerToken(req);
  if (!token || token.length < 32) return res.status(401).json({ ok: false, message: "يلزم تسجيل الدخول" });
  const sessions = loadSessions(), key = crypto.createHash("sha256").update(token).digest("hex"), session = sessions[key];
  if (!session || session.expiresAt <= Date.now()) {
    if (session) { delete sessions[key]; saveSessions(sessions); }
    return res.status(401).json({ ok: false, message: "انتهت الجلسة، سجّل الدخول مرة أخرى" });
  }
  const user = loadUsers().find(item => item.id === session.userId);
  if (!user || user.activation_status !== "active" || session.authVersion !== (user.authVersion || 0)) {
    delete sessions[key]; saveSessions(sessions);
    return res.status(403).json({ ok: false, message: "الحساب غير مفعل أو انتهت الجلسة" });
  }
  const isOwner = normEmail(user.email) === OWNER_EMAIL, viewAsUser = isOwner && session.viewAs === "user";
  const role = isOwner ? (viewAsUser ? "user" : "owner") : (user.role === "admin" ? "admin" : "user");
  req.auth = { user: { ...user, role }, role, isOwner, viewAsUser, sessionKey: key };
  next();
}
function ownerOnly(req, res, next) {
  if (!req.auth || !req.auth.isOwner || req.auth.viewAsUser || req.auth.role !== "owner") return res.status(403).json({ ok: false, error: "غير مصرح: هذه العملية للمالك فقط" });
  next();
}
function findAccount(identifier) {
  const value = String(identifier || "").trim().toLowerCase(), users = loadUsers();
  return { users, user: users.find(item => normEmail(item.email) === value || String(item.username || "").trim().toLowerCase() === value) };
}
const roleTickets = new Map();
setInterval(() => { const now = Date.now(); for (const [ticket,item] of roleTickets) if (item.expiresAt <= now) roleTickets.delete(ticket); }, 60 * 1000).unref();

app.get("/health", (req,res) => res.json({ ok: true }));
app.post("/check-email", (req,res) => {
  const email = normEmail((req.body || {}).email);
  if (!validEmail(email)) return res.status(400).json({ ok: false, registered: null, accountExists: null });
  return res.json({ ok: true, registered: null, accountExists: null });
});
app.post("/api/auth/register", rateLimit(10,15*60*1000), (req,res) => {
  const body=req.body||{}, email=normEmail(body.email), password=String(body.password||"");
  if (!validEmail(email)) return res.status(400).json({ok:false,message:"بريد غير صالح"});
  if (email===OWNER_EMAIL) return res.status(409).json({ok:false,alreadyExists:true,message:"هذا البريد محجوز للمالك - استخدم تسجيل الدخول"});
  if (password.length<8||password.length>128) return res.status(400).json({ok:false,message:"كلمة المرور لازم تكون 8 حروف على الأقل"});
  const users=loadUsers();
  if (users.some(item=>normEmail(item.email)===email)) return res.status(409).json({ok:false,alreadyExists:true,message:"هذا البريد مسجل بالفعل، يرجى تسجيل الدخول"});
  const name=String(body.name||body.username||email.split("@")[0]||"مستخدم").trim().slice(0,100)||"مستخدم";
  let username=String(body.username||email.split("@")[0]||"").trim().toLowerCase().replace(/[^a-z0-9_.-]/g,"_").replace(/_+/g,"_").slice(0,30);
  while(username.length<3) username+="_";
  if(users.some(item=>String(item.username||"").toLowerCase()===username)) username=username.slice(0,25)+"_"+crypto.randomBytes(3).toString("hex");
  const user={id:crypto.randomUUID(),email,name,username,password:hashPassword(password),role:"user",activation_status:"active",authVersion:0,created_at:new Date().toISOString()};
  users.push(user); saveUsers(users);
  return res.status(201).json({ok:true,registered:true,...issueSession(user)});
});
app.post("/api/auth/login", rateLimit(10,15*60*1000), (req,res) => {
  const body=req.body||{}, identifier=body.identifier||body.email, password=String(body.password||"");
  if(!identifier||!password||String(identifier).length>254||password.length>128) return res.status(400).json({ok:false,message:"أدخل البريد وكلمة المرور"});
  const {users,user}=findAccount(identifier);
  if(!user||user.activation_status!=="active") return res.status(401).json({ok:false,message:"بيانات الدخول غير صحيحة أو الحساب موقوف"});
  const verified=verifyPassword(password,user.password);
  if(!verified.ok) return res.status(401).json({ok:false,message:"بيانات الدخول غير صحيحة"});
  if(verified.needsUpgrade){user.password=hashPassword(password);saveUsers(users);}
  if(normEmail(user.email)===OWNER_EMAIL){
    const ticket=crypto.randomBytes(32).toString("base64url");
    roleTickets.set(ticket,{userId:user.id,expiresAt:Date.now()+5*60*1000});
    return res.json({ok:true,requiresRoleChoice:true,availableRoles:["owner","user"],roleChoiceTicket:ticket});
  }
  if(!["admin","user"].includes(user.role)){user.role="user";saveUsers(users);}
  return res.json({ok:true,...issueSession(user)});
});
app.post("/api/auth/select-role", rateLimit(10,15*60*1000), (req,res) => {
  const body=req.body||{}, ticket=String(body.roleChoiceTicket||""), role=String(body.role||""), entry=roleTickets.get(ticket);
  if(!entry||entry.expiresAt<=Date.now()){roleTickets.delete(ticket);return res.status(401).json({ok:false,message:"انتهت صلاحية اختيار نوع الدخول. سجّل الدخول مرة أخرى."});}
  if(!["owner","user"].includes(role)) return res.status(400).json({ok:false,message:"اختيار غير صالح"});
  const user=loadUsers().find(item=>item.id===entry.userId);
  if(!user||normEmail(user.email)!==OWNER_EMAIL||user.activation_status!=="active"){roleTickets.delete(ticket);return res.status(403).json({ok:false,message:"غير مصرح"});}
  roleTickets.delete(ticket); return res.json({ok:true,...issueSession(user,role)});
});
app.get("/api/auth/me",authRequired,(req,res)=>res.json({ok:true,user:publicUser(req.auth.user,req.auth.role)}));
app.post("/api/auth/logout",authRequired,(req,res)=>{const sessions=loadSessions();delete sessions[req.auth.sessionKey];saveSessions(sessions);return res.json({ok:true});});
const GENERIC_FORGOT={ok:true,emailSent:true,message:"لو البريد مسجّل هيوصله كود استعادة كلمة المرور. افحص بريدك أو ارجع للتسجيل إذا لم يكن لديك حساب."};
app.post("/api/auth/forgot-password",rateLimit(5,15*60*1000),async(req,res)=>{
  const email=normEmail((req.body||{}).email);
  if(!validEmail(email)) return res.status(400).json({ok:false,emailSent:false,message:"بريد غير صالح"});
  const user=loadUsers().find(item=>normEmail(item.email)===email);
  if(!user||!process.env.GMAIL_USER||!process.env.GMAIL_APP_PASS) return res.json(GENERIC_FORGOT);
  const codes=loadCodes(),now=Date.now();
  for(const key of Object.keys(codes)) if(!codes[key]||!Number.isFinite(codes[key].expiresAt)||now>codes[key].expiresAt) delete codes[key];
  const existing=codes[email]; if(existing&&existing.sentAt&&now-existing.sentAt<RESET_COOLDOWN_MS) return res.json(GENERIC_FORGOT);
  const code=String(crypto.randomInt(100000,1000000));
  codes[email]={codeHash:hashCode(email,code),expiresAt:now+RESET_TTL_MS,sentAt:now,attempts:0};saveCodes(codes);
  try{await transporter.sendMail({from:process.env.GMAIL_USER,to:email,subject:"Smart Time - كود الاستعادة",text:"كودك: "+code+" صالح 10 دقائق",html:'<div style="font-family:Arial;direction:rtl;text-align:center;padding:20px"><h1>SMART TIME</h1><p>كود استعادة كلمة المرور:</p><h2 style="letter-spacing:8px;background:#f0f0f0;padding:15px">'+code+'</h2><p>صالح 10 دقائق - لا تشاركه</p></div>'});}
  catch{const latest=loadCodes();delete latest[email];saveCodes(latest);console.error("forgot-password: email send failed");}
  return res.json(GENERIC_FORGOT);
});
app.post("/api/auth/reset-password",rateLimit(10,15*60*1000),(req,res)=>{
  const body=req.body||{},email=normEmail(body.email),code=String(body.code||body.token||"").trim(),newPassword=String(body.newPassword||body.password||"");
  const bad={ok:false,message:"الكود غير صحيح أو منتهي - اطلب كود جديد"};
  if(!validEmail(email)||!/^\d{6}$/.test(code)) return res.status(400).json(bad);
  if(newPassword.length<8||newPassword.length>128) return res.status(400).json({ok:false,message:"كلمة المرور لازم تكون 8 حروف على الأقل"});
  const codes=loadCodes(),entry=codes[email]; if(!entry||!entry.codeHash) return res.status(400).json(bad);
  if(!Number.isFinite(entry.expiresAt)||Date.now()>entry.expiresAt||(entry.attempts||0)>=MAX_RESET_ATTEMPTS){delete codes[email];saveCodes(codes);return res.status(400).json(bad);}
  if(!safeEqualHex(entry.codeHash,hashCode(email,code))){entry.attempts=(entry.attempts||0)+1;saveCodes(codes);return res.status(400).json(bad);}
  const users=loadUsers(),user=users.find(item=>normEmail(item.email)===email);
  if(!user){delete codes[email];saveCodes(codes);return res.status(400).json(bad);}
  user.password=hashPassword(newPassword);user.authVersion=(user.authVersion||0)+1;saveUsers(users);
  delete codes[email];saveCodes(codes);
  const sessions=loadSessions();for(const [key,session] of Object.entries(sessions))if(session.userId===user.id)delete sessions[key];saveSessions(sessions);
  return res.json({ok:true,message:"تم تغيير كلمة المرور بنجاح"});
});
app.get("/api/admin/users",authRequired,ownerOnly,(req,res)=>res.json({ok:true,users:loadUsers().map(user=>publicUser(user))}));
app.patch("/api/admin/users/:id",authRequired,ownerOnly,(req,res)=>{
  const id=String(req.params.id||""),body=req.body||{},users=loadUsers(),user=users.find(item=>item.id===id);
  if(!user)return res.status(404).json({ok:false,error:"الحساب غير موجود"});
  if(normEmail(user.email)===OWNER_EMAIL||user.role==="owner")return res.status(403).json({ok:false,error:"لا يمكن تغيير صلاحيات أو حالة المالك من هذه اللوحة"});
  const hasRole=Object.prototype.hasOwnProperty.call(body,"role"),hasStatus=Object.prototype.hasOwnProperty.call(body,"activationStatus");
  if(!hasRole&&!hasStatus)return res.status(400).json({ok:false,error:"لا توجد تغييرات صالحة"});
  if(hasRole&&!["admin","user"].includes(body.role))return res.status(400).json({ok:false,error:"الدور غير صالح"});
  if(hasStatus&&!["active","suspended"].includes(body.activationStatus))return res.status(400).json({ok:false,error:"حالة الحساب غير صالحة"});
  let invalidate=false;
  if(hasRole&&user.role!==body.role){user.role=body.role;invalidate=true;}
  if(hasStatus&&user.activation_status!==body.activationStatus){user.activation_status=body.activationStatus;invalidate=true;}
  if(invalidate)user.authVersion=(user.authVersion||0)+1;
  saveUsers(users);
  if(invalidate){const sessions=loadSessions();for(const [key,session] of Object.entries(sessions))if(session.userId===user.id)delete sessions[key];saveSessions(sessions);}
  return res.json({ok:true,user:publicUser(user)});
});
app.delete("/api/admin/users/:id",authRequired,ownerOnly,(req,res)=>{
  const id=String(req.params.id||""),users=loadUsers(),user=users.find(item=>item.id===id);
  if(!user)return res.status(404).json({ok:false,error:"الحساب غير موجود"});
  if(normEmail(user.email)===OWNER_EMAIL||user.role==="owner")return res.status(403).json({ok:false,error:"لا يمكن حذف حساب المالك"});
  saveUsers(users.filter(item=>item.id!==id));
  const sessions=loadSessions();for(const [key,session] of Object.entries(sessions))if(session.userId===id)delete sessions[key];saveSessions(sessions);
  const codes=loadCodes();delete codes[normEmail(user.email)];saveCodes(codes);
  return res.json({ok:true});
});


// Per-user preferences are kept separate from account credentials and keyed by the
// authenticated Oracle user id. Never accept a user id from the request body.
const USER_SETTINGS_FILE = process.env.USER_SETTINGS_FILE || path.join(PROJECT_ROOT, "user-settings.json");
function loadUserSettings() {
  const value = readJson(USER_SETTINGS_FILE, {});
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid user-settings.json");
  return value;
}
app.get("/api/user/settings", authRequired, (req, res) => {
  try {
    const all = loadUserSettings();
    return res.json({ ok: true, settings: all[req.auth.user.id] || {} });
  } catch {
    return res.status(500).json({ ok: false, error: "تعذر تحميل إعدادات المستخدم." });
  }
});
app.post("/api/user/settings", authRequired, (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : null;
    if (!body || Buffer.byteLength(JSON.stringify(body), "utf8") > 64 * 1024) {
      return res.status(400).json({ ok: false, error: "إعدادات غير صالحة أو أكبر من الحد المسموح." });
    }
    const all = loadUserSettings();
    const previous = all[req.auth.user.id] && typeof all[req.auth.user.id] === "object" ? all[req.auth.user.id] : {};
    all[req.auth.user.id] = { ...previous, ...body, updatedAt: new Date().toISOString() };
    writeJsonAtomic(USER_SETTINGS_FILE, all);
    return res.json({ ok: true, settings: all[req.auth.user.id] });
  } catch {
    return res.status(500).json({ ok: false, error: "تعذر حفظ إعدادات المستخدم." });
  }
});

// Compatibility aliases for the existing owner administration screen.
// Owner remains the only principal allowed to promote/demote admins.
app.get("/api/owner/admins", authRequired, ownerOnly, (req, res) => {
  const view = String(req.query.view || "users");
  const users = loadUsers().filter(user => normEmail(user.email) !== OWNER_EMAIL).map(user => publicUser(user));
  if (view === "admins") return res.json({ ok: true, admins: users.filter(user => user.role === "admin") });
  return res.json({ ok: true, users: users.filter(user => user.role !== "admin") });
});
app.patch("/api/owner/admins/:id", authRequired, ownerOnly, (req, res) => {
  const id = String(req.params.id || ""), action = String((req.body || {}).action || "");
  if (!["assign", "remove"].includes(action)) return res.status(400).json({ ok: false, error: "إجراء غير صالح." });
  const users = loadUsers(), user = users.find(item => item.id === id);
  if (!user) return res.status(404).json({ ok: false, error: "الحساب غير موجود." });
  if (normEmail(user.email) === OWNER_EMAIL || user.role === "owner") return res.status(403).json({ ok: false, error: "لا يمكن تغيير صلاحيات المالك." });
  user.role = action === "assign" ? "admin" : "user";
  user.authVersion = (user.authVersion || 0) + 1;
  saveUsers(users);
  const sessions = loadSessions();
  for (const [key, session] of Object.entries(sessions)) if (session.userId === user.id) delete sessions[key];
  saveSessions(sessions);
  return res.json({ ok: true, user: publicUser(user) });
});

/*
 * React static hosting: same origin as /api, no second server.
 * API paths never fall through to index.html, so missing APIs remain explicit 404s.
 */
app.use(express.static(DIST_DIR,{index:false,etag:true,maxAge:"1h"}));
app.get("*",(req,res,next)=>{
  if(req.path.startsWith("/api/")||req.path==="/health"||req.path==="/check-email") {
    return res.status(404).json({ok:false,error:"API route not found",path:req.path});
  }
  const indexFile=path.join(DIST_DIR,"index.html");
  if(!fs.existsSync(indexFile)) return res.status(503).type("text").send("SMART TIME frontend is not built yet. Run npm run build:oracle-web.");
  return res.sendFile(indexFile);
});

loadUsers();
app.listen(PORT,"127.0.0.1",()=>console.log("SMART TIME Oracle single-process server listening on 127.0.0.1:"+PORT));
