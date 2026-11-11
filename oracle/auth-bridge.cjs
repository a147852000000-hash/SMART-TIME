"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

/**
 * Read-only adapter to the existing Oracle JSON auth authority.
 * It never creates users/sessions and never writes either auth file.
 */
function createAuthBridge(options = {}) {
  const usersFile = path.resolve(options.usersFile || process.env.USERS_FILE || path.join(process.cwd(), "users.json"));
  const sessionsFile = path.resolve(options.sessionsFile || process.env.SESSIONS_FILE || path.join(process.cwd(), "sessions.json"));
  const ownerEmail = String(options.ownerEmail || process.env.PROGRAM_OWNER_EMAIL || "").trim().toLowerCase();
  const now = typeof options.now === "function" ? options.now : Date.now;

  function readObject(file, label) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      const wrapped = new Error("Auth bridge cannot read " + label);
      wrapped.cause = error;
      throw wrapped;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Auth bridge found invalid " + label);
    }
    return parsed;
  }

  function readUsers() {
    let users;
    try {
      users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
    } catch (error) {
      const wrapped = new Error("Auth bridge cannot read users.json");
      wrapped.cause = error;
      throw wrapped;
    }
    if (!Array.isArray(users)) throw new Error("Auth bridge found invalid users.json");
    const owners = users.filter(user =>
      user && String(user.email || "").trim().toLowerCase() === ownerEmail
    );
    if (!ownerEmail || owners.length !== 1) {
      throw new Error("Auth bridge requires exactly one configured owner account");
    }
    return users;
  }

  function authenticateToken(token) {
    const rawToken = String(token || "").trim();
    if (rawToken.length < 32 || rawToken.length > 512) return null;

    const sessions = readObject(sessionsFile, "sessions.json");
    const sessionKey = crypto.createHash("sha256").update(rawToken).digest("hex");
    const session = sessions[sessionKey];
    if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= now()) return null;

    const user = readUsers().find(item => item && item.id === session.userId);
    if (!user || user.activation_status !== "active") return null;
    const currentVersion = Number.isSafeInteger(user.authVersion) && user.authVersion >= 0 ? user.authVersion : 0;
    if (session.authVersion !== currentVersion) return null;

    const isOwner = String(user.email || "").trim().toLowerCase() === ownerEmail;
    const viewAsUser = isOwner && session.viewAs === "user";
    const role = isOwner ? (viewAsUser ? "user" : "owner") : (user.role === "admin" ? "admin" : "user");

    return {
      user: {
        id: String(user.id),
        email: String(user.email || ""),
        username: String(user.username || ""),
        name: String(user.name || ""),
        role,
        activation_status: user.activation_status,
        created_at: String(user.created_at || user.createdAt || ""),
      },
      role,
      isOwner,
      viewAsUser,
      sessionKey,
    };
  }

  function middleware(req, res, next) {
    const header = String(req.headers.authorization || "");
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "يلزم تسجيل الدخول" });
    let auth;
    try {
      auth = authenticateToken(match[1]);
    } catch (error) {
      return res.status(503).json({ error: "تعذر التحقق من جلسة الدخول" });
    }
    if (!auth) return res.status(401).json({ error: "الجلسة غير صالحة أو منتهية" });
    req.auth = auth;
    return next();
  }

  return Object.freeze({ authenticateToken, middleware });
}

module.exports = { createAuthBridge };
