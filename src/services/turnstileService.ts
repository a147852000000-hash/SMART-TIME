type TurnstileWidgetId = string | number;

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "auto" | "light" | "dark";
      size?: "normal" | "flexible" | "compact";
      action?: string;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      "timeout-callback"?: () => void;
    },
  ) => TurnstileWidgetId;
  reset: (widgetId?: TurnstileWidgetId) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SITE_KEY = String(
  import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAAFRjix4A7Wlbz4cu",
).trim();

const SCRIPT_ID = "smart-time-cloudflare-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      const wait = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(wait);
          resolve();
        }
      }, 50);
      window.setTimeout(() => {
        window.clearInterval(wait);
        reject(new Error("Turnstile script timed out."));
      }, 10_000);
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("تعذر تحميل خدمة التحقق الأمني."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function renderTurnstile(
  container: HTMLElement,
  onToken: (token: string) => void,
  onFailure: () => void,
): Promise<TurnstileWidgetId> {
  if (!TURNSTILE_SITE_KEY) throw new Error("Turnstile site key is not configured.");
  await loadScript();
  if (!window.turnstile) throw new Error("Turnstile is unavailable.");

  return window.turnstile.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    theme: "light",
    size: "flexible",
    action: "smart-time-auth",
    callback: onToken,
    "error-callback": onFailure,
    "expired-callback": onFailure,
    "timeout-callback": onFailure,
  });
}

export function resetTurnstile(widgetId: TurnstileWidgetId | null) {
  if (widgetId !== null && window.turnstile) {
    window.turnstile.reset(widgetId);
  }
}
