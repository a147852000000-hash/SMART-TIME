export type PasswordResetEmailResult = { provider: "smtp"; messageId?: string };

function required(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`إعداد البريد غير مكتمل: ${name} مطلوب.`);
  return value;
}

function maskEmail(email: string): string {
  const [local, domain] = String(email || "").split("@");
  if (!local || !domain) return "[invalid-email]";
  return `${local.slice(0, 1)}***@${domain}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Password-reset email delivery is direct SMTP only.
 * For Gmail, set SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=true,
 * SMTP_USER=<mailbox>, SMTP_PASS=<Gmail App Password>, and optionally EMAIL_FROM.
 * Credentials are read only from process environment and are never logged.
 */
export async function sendPasswordResetEmail(email: string, code: string, ttlMinutes: number): Promise<PasswordResetEmailResult> {
  const host = required("SMTP_HOST");
  const port = Number(required("SMTP_PORT"));
  const user = required("SMTP_USER");
  const pass = required("SMTP_PASS");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }
  const secureSetting = String(process.env.SMTP_SECURE || "").trim().toLowerCase();
  const secure = secureSetting ? secureSetting === "true" : port === 465;
  const from = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || user).trim();
  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
  try {
    const result = await transporter.sendMail({
      from,
      to: email,
      subject: "SMART-TIME password reset",
      text: `رمز استعادة كلمة مرور SMART-TIME هو: ${code}. صالح لمدة ${ttlMinutes} دقيقة. إذا لم تطلب الاستعادة فتجاهل الرسالة.`,
      html: `<!doctype html><html lang="ar"><body dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#172033"><h2>استعادة كلمة مرور SMART-TIME</h2><p>رمز الاستعادة:</p><p style="font-size:30px;font-weight:700;letter-spacing:6px">${escapeHtml(code)}</p><p>صلاحية الرمز ${escapeHtml(String(ttlMinutes))} دقيقة.</p><p>إذا لم تطلب الاستعادة، تجاهل الرسالة.</p></body></html>`,
    });
    console.log("SMTP_SENT", { recipient: maskEmail(email) });
    return { provider: "smtp", messageId: typeof result?.messageId === "string" ? result.messageId : undefined };
  } finally {
    transporter.close();
  }
}
