"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function normalizePhone(value) {
  let phone = String(value || "").trim().replace(/[\\s()-]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (!/^\\+?[0-9]{8,15}$/.test(phone)) return "";
  return phone;
}

function createPhoneOtpService({ file, secret, sendCode, now = Date.now, randomInt = crypto.randomInt }) {
  if (!file || typeof file !== "string") throw new Error("Phone OTP file path is required");
  if (Buffer.byteLength(String(secret || ""), "utf8") < 32) throw new Error("Phone OTP secret must be at least 32 bytes");
  if (typeof sendCode !== "function") throw new Error("Phone OTP sender is required");

  function read() {
    if (!fs.existsSync(file)) return {};
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid phone OTP store");
    return value;
  }
  function write(value) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const temp = file + "." + process.pid + "." + crypto.randomBytes(8).toString("hex") + ".tmp";
    try {
      fs.writeFileSync(temp, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600, flag: "wx" });
      fs.renameSync(temp, file);
      try { fs.chmodSync(file, 0o600); } catch {}
    } finally { try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch {} }
  }
  const digest = (phone, code) => crypto.createHmac("sha256", secret).update(phone + ":" + code).digest("hex");

  async function request(rawPhone) {
    const phone = normalizePhone(rawPhone);
    if (!phone) return { ok: false, status: 400, message: "رقم الهاتف غير صحيح" };
    const records = read(), current = records[phone], timestamp = now();
    if (current && timestamp - current.sentAt < 60_000) return { ok: false, status: 429, message: "انتظر دقيقة قبل طلب رمز جديد." };
    const code = String(randomInt(100000, 1000000));
    await sendCode(phone, code);
    records[phone] = { codeHash: digest(phone, code), expiresAt: timestamp + 5 * 60_000, sentAt: timestamp, attempts: 0 };
    write(records);
    return { ok: true, expiresAt: new Date(timestamp + 5 * 60_000).toISOString() };
  }

  function verify(rawPhone, rawCode) {
    const phone = normalizePhone(rawPhone), code = String(rawCode || "").trim();
    if (!phone || !/^\\d{6}$/.test(code)) return { ok: false, status: 400, message: "رقم الهاتف أو رمز التحقق غير صحيح." };
    const records = read(), entry = records[phone], timestamp = now();
    if (!entry || !Number.isFinite(entry.expiresAt) || timestamp > entry.expiresAt) {
      if (entry) { delete records[phone]; write(records); }
      return { ok: false, status: 400, message: "رمز التحقق منتهي أو غير موجود." };
    }
    if (!Number.isInteger(entry.attempts) || entry.attempts >= 5) return { ok: false, status: 429, message: "تم تجاوز عدد المحاولات. اطلب رمزًا جديدًا." };
    entry.attempts += 1;
    const expected = Buffer.from(entry.codeHash || "", "hex"), actual = Buffer.from(digest(phone, code), "hex");
    const valid = expected.length === 32 && actual.length === 32 && crypto.timingSafeEqual(expected, actual);
    if (!valid) { write(records); return { ok: false, status: 400, message: "رمز التحقق غير صحيح." }; }
    delete records[phone]; write(records);
    return { ok: true, phone };
  }

  return Object.freeze({ request, verify, normalizePhone });
}

module.exports = { createPhoneOtpService, normalizePhone };
