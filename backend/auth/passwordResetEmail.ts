export type PasswordResetEmailResult = { provider: "resend" | "oracle-relay"; messageId?: string };

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

export async function sendPasswordResetEmail(email: string, code: string, ttlMinutes: number): Promise<PasswordResetEmailResult> {
  const provider = String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase();

  if (provider === "oracle-relay") {
    const relayUrl = required("ORACLE_EMAIL_RELAY_URL");
    const secret = required("ORACLE_EMAIL_RELAY_SECRET");
    let parsedUrl: URL;
    try { parsedUrl = new URL(relayUrl); } catch { throw new Error("ORACLE_EMAIL_RELAY_URL must be a valid HTTPS URL."); }
    if (parsedUrl.protocol !== "https:") throw new Error("Oracle email relay must use HTTPS.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(relayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": secret },
        body: JSON.stringify({ email, code, ttlMinutes }),
        signal: controller.signal,
      });
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
        const error: any = new Error("Oracle email relay rejected the request.");
        error.code = `ORACLE_RELAY_HTTP_${response.status}`;
        throw error;
      }
      const messageId = typeof payload?.messageId === "string" ? payload.messageId : undefined;
      console.log("PASSWORD_RESET_EMAIL_ACCEPTED", { provider: "oracle-relay", recipient: maskEmail(email) });
      return { provider: "oracle-relay", messageId };
    } catch (error: any) {
      if (error?.name === "AbortError") {
        const timeoutError: any = new Error("Oracle email relay request timed out.");
        timeoutError.code = "ORACLE_RELAY_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (provider !== "resend") {
    throw new Error("خدمة البريد غير مكوّنة. استخدم EMAIL_PROVIDER=oracle-relay أو resend.");
  }

  const key = required("RESEND_API_KEY");
  const from = required("EMAIL_FROM");
  const frontendUrl = String(process.env.FRONTEND_URL || "https://smart-time-orcin-six.vercel.app").trim();
  const subject = "SMART-TIME password reset";
  const safeCode = escapeHtml(code);
  const safeTtl = escapeHtml(String(ttlMinutes));
  const safeFrontendUrl = escapeHtml(frontendUrl);

  console.log("RESEND_ATTEMPT", { to: maskEmail(email), provider: "resend" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        text: `رمز استعادة كلمة مرور SMART-TIME هو: ${code}. صالح لمدة ${ttlMinutes} دقيقة. إذا لم تطلب الاستعادة فتجاهل الرسالة.`,
        html: `<!doctype html><html lang="ar"><body dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#172033"><h2>استعادة كلمة مرور SMART-TIME</h2><p>استخدم الرمز التالي داخل التطبيق لإكمال استعادة كلمة المرور:</p><p style="font-size:30px;font-weight:700;letter-spacing:6px">${safeCode}</p><p>صلاحية الرمز ${safeTtl} دقيقة.</p><p><a href="${safeFrontendUrl}">فتح SMART-TIME</a></p><p>إذا لم تطلب الاستعادة، تجاهل هذه الرسالة.</p></body></html>`,
      }),
      signal: controller.signal,
    });

    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload?.message === "string" ? payload.message : typeof payload?.error === "string" ? payload.error : "Resend API request failed";
      const error: any = new Error(message);
      error.code = typeof payload?.name === "string" ? payload.name : `HTTP_${response.status}`;
      console.error("RESEND_FAILED", { status: response.status, error: message, code: error.code });
      throw error;
    }

    const messageId = typeof payload?.id === "string" ? payload.id : undefined;
    console.log("RESEND_SENT", { id: messageId });
    return { provider: "resend", messageId };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      console.error("RESEND_FAILED", { status: undefined, error: "Request timed out after 10 seconds", code: "RESEND_TIMEOUT" });
      const timeoutError: any = new Error("Resend request timed out after 10 seconds.");
      timeoutError.code = "RESEND_TIMEOUT";
      throw timeoutError;
    }
    if (!error?.code || error.code === "ECONNRESET" || error.code === "ENOTFOUND" || error.code === "EAI_AGAIN") {
      console.error("RESEND_FAILED", {
        status: undefined,
        error: error instanceof Error ? error.message : "Unknown Resend transport error",
        code: typeof error?.code === "string" ? error.code : "RESEND_NETWORK_ERROR",
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
