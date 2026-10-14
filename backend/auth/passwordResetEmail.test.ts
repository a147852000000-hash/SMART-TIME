import nodemailer from "nodemailer";
import assert from "node:assert/strict";
import { sendPasswordResetEmail } from "./passwordResetEmail.js";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

try {
  process.env.EMAIL_PROVIDER = "resend";
  process.env.EMAIL_FROM = "SMART TIME <onboarding@resend.dev>";
  process.env.RESEND_API_KEY = "test-key";

  let requestBody: any = null;
  globalThis.fetch = (async (_input: any, init?: any) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ id: "email-test-1" }), { status: 200, headers: { "content-type": "application/json" } });
  }) as any;

  const result = await sendPasswordResetEmail("user@example.com", "123456", 15);
  assert.equal(result.provider, "resend");
  assert.equal(result.messageId, "email-test-1");
  assert.equal(requestBody.to[0], "user@example.com");
  assert.match(requestBody.text, /123456/);
  assert.match(requestBody.text, /15/);

  delete process.env.EMAIL_FROM;
  await assert.rejects(
    () => sendPasswordResetEmail("user@example.com", "123456", 15),
    /خدمة البريد غير مكوّنة/
  );


  process.env.EMAIL_PROVIDER = "oracle-relay";
  process.env.ORACLE_EMAIL_RELAY_URL = "https://smart-time-ai.duckdns.org/api/internal/send-reset";
  process.env.ORACLE_EMAIL_RELAY_SECRET = "unit-test-secret";
  let relayRequest: any = null;
  globalThis.fetch = (async (input: any, init?: any) => {
    relayRequest = { url: String(input), headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ ok: true, messageId: "relay-test-1" }), { status: 200, headers: { "content-type": "application/json" } });
  }) as any;
  const relayResult = await sendPasswordResetEmail("user@example.com", "654321", 15);
  assert.equal(relayResult.provider, "oracle-relay");
  assert.equal(relayResult.messageId, "relay-test-1");
  assert.equal(relayRequest.url, process.env.ORACLE_EMAIL_RELAY_URL);
  assert.equal(relayRequest.headers["x-internal-secret"], "unit-test-secret");
  assert.deepEqual(relayRequest.body, { email: "user@example.com", code: "654321", ttlMinutes: 15 });

  process.env.ORACLE_EMAIL_RELAY_URL = "http://insecure.example/api/internal/send-reset";
  await assert.rejects(() => sendPasswordResetEmail("user@example.com", "654321", 15), /تعذر إرسال رسالة استعادة كلمة المرور/);

  // SMTP provider can send a reset email using the configured transport.
  process.env.EMAIL_PROVIDER = "smtp";
  process.env.EMAIL_FALLBACK_PROVIDERS = "oracle-relay,resend";
  process.env.SMTP_HOST = "smtp.example.test";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_USER = "mailer@example.test";
  process.env.SMTP_PASS = "test-password";
  process.env.SMTP_FROM = "Smart Time <mailer@example.test>";
  delete process.env.EMAIL_FROM;
  let smtpConfig: any = null;
  let smtpMessage: any = null;
  const originalCreateTransport = nodemailer.createTransport;
  (nodemailer as any).createTransport = (config: any) => {
    smtpConfig = config;
    return { sendMail: async (message: any) => { smtpMessage = message; return { messageId: "smtp-test-1" }; }, close: () => {} };
  };
  const smtpResult = await sendPasswordResetEmail("recipient@example.test", "789012", 15);
  assert.equal(smtpResult.provider, "smtp");
  assert.equal(smtpResult.messageId, "smtp-test-1");
  assert.equal(smtpConfig.requireTLS, true);
  assert.equal(smtpMessage.to, "recipient@example.test");
  assert.match(smtpMessage.text, /789012/);

  // If Oracle relay fails, SMTP is tried next; only a successful provider is reported.
  process.env.EMAIL_PROVIDER = "oracle-relay";
  process.env.EMAIL_FALLBACK_PROVIDERS = "smtp,resend";
  process.env.ORACLE_EMAIL_RELAY_URL = "https://oracle.example.test/api/internal/send-reset";
  process.env.ORACLE_EMAIL_RELAY_SECRET = "unit-test-secret";
  globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false }), { status: 503 })) as any;
  const fallbackResult = await sendPasswordResetEmail("recipient@example.test", "456789", 15);
  assert.equal(fallbackResult.provider, "smtp");
  assert.equal(fallbackResult.messageId, "smtp-test-1");
  (nodemailer as any).createTransport = originalCreateTransport;

  console.log("password reset email provider tests: PASS");
} finally {
  process.env = originalEnv;
  globalThis.fetch = originalFetch;
}
