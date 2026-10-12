import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startSmtpTestServer } from "./smtpTestServer.js";
import { sendPasswordResetEmail } from "./passwordResetEmail.js";

const originalEnv = { ...process.env };
const resetCode = "482619";
const ttlMinutes = 60;

const smtp = await startSmtpTestServer();
try {
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String(smtp.port);
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_USER = "sender@example.test";
  process.env.SMTP_PASS = "test-only-app-password";
  process.env.EMAIL_FROM = "SMART-TIME Test <sender@example.test>";
  delete process.env.RESEND_API_KEY;
  delete process.env.ORACLE_EMAIL_RELAY_URL;
  delete process.env.ORACLE_EMAIL_RELAY_SECRET;

  const result = await sendPasswordResetEmail("user@example.com", resetCode, ttlMinutes);
  assert.equal(result.provider, "smtp");
  assert.equal(typeof result.messageId, "string");
  assert.ok(result.messageId);
  assert.equal(smtp.messages.length, 1, "direct SMTP should deliver exactly one test message");
  const message = smtp.messages[0];
  assert.match(message, /To:.*user@example\.com/i);
  assert.match(message, /Subject: SMART-TIME password reset/i);
  assert.ok(message.includes(resetCode), "the real reset code should be included in the email content");
  assert.ok(message.includes(String(ttlMinutes)), "the email should include its expiry interval");
  assert.equal(resetCode.length, 6);
  assert.match(resetCode, /^[0-9]{6}$/);

  delete process.env.SMTP_PASS;
  await assert.rejects(
    () => sendPasswordResetEmail("user@example.com", resetCode, ttlMinutes),
    /SMTP_PASS مطلوب/
  );

  process.env.SMTP_PASS = "test-only-app-password";
  process.env.SMTP_PORT = "0";
  await assert.rejects(
    () => sendPasswordResetEmail("user@example.com", resetCode, ttlMinutes),
    /SMTP_PORT must be a valid TCP port/
  );

  const source = fs.readFileSync(path.join(process.cwd(), "backend/auth/passwordResetEmail.ts"), "utf8");
  assert.equal(source.includes("api.resend.com"), false, "Resend transport must not remain supported");
  assert.equal(source.includes("oracle-relay"), false, "Oracle relay transport must not remain supported");
  assert.equal(source.includes("error: message"), false, "provider errors must not be logged with raw message text");

  console.log("password reset email SMTP-only tests: PASS");
} finally {
  await smtp.close();
  process.env = originalEnv;
}
