/**
 * إعداد السيرفر داخل تطبيق الموبايل (Capacitor) — بدون أي خدمة مدفوعة.
 *
 * الشاشة تظهر فقط داخل الغلاف الأصلي (window.Capacitor.isNativePlatform):
 *  - أول تشغيل: تطلب عنوان السيرفر (مثال: https://smart-time.duckdns.org)
 *    وتخزنه في localStorage عبر setRuntimeApiUrl فيتخطى VITE_API_URL المبني.
 *  - زر عائم صغير (⚙) لإعادة فتح نفس الشاشة وتغيير السيرفر لاحقاً.
 *  - الفتح بـ #server-setup في الرابط يفرض ظهور الشاشة (باب طوارئ للصيانة).
 *
 * على الويب العادي الوحدة no-op تماماً: الصفحة same-origin ولا شيء يتغير.
 */
import { setRuntimeApiUrl, RUNTIME_API_KEY } from './services/apiConfig';

const NATIVE_FLAG = 'smart_time_server_setup_overlay';

function isNativeShell(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform() === true;
  } catch {
    return false;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !!parsed.hostname;
  } catch {
    return false;
  }
}

function readSavedServer(): string {
  try { return window.localStorage.getItem(RUNTIME_API_KEY) || ''; } catch { return ''; }
}

/** يبني بطاقة الحوار ويعيد العناصر المهمة. */
function buildDialog(initial: string, allowSkip: boolean): {
  root: HTMLDivElement; input: HTMLInputElement; msg: HTMLDivElement;
  save: HTMLButtonElement; test: HTMLButtonElement; skip: HTMLButtonElement | null;
} {
  const root = document.createElement('div');
  root.id = NATIVE_FLAG;
  root.setAttribute('dir', 'rtl');
  root.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647', 'display:flex',
    'align-items:center', 'justify-content:center', 'padding:18px',
    'background:linear-gradient(160deg,#0f172a 0%,#1e293b 55%,#0f766e 130%)',
    'font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif',
  ].join(';');

  root.innerHTML = `
    <div style="width:100%;max-width:420px;background:#ffffff;border-radius:20px;
                box-shadow:0 24px 60px rgba(2,6,23,.45);padding:26px 22px;text-align:right">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <div style="width:44px;height:44px;border-radius:12px;background:#0f766e;color:#fff;
                    display:flex;align-items:center;justify-content:center;font-size:22px">⏱</div>
        <div>
          <div style="font-size:18px;font-weight:800;color:#0f172a">إعداد سيرفر Smart Time</div>
          <div style="font-size:12px;color:#475569">أدخل عنوان الخادم مرة واحدة فقط</div>
        </div>
      </div>
      <div style="font-size:13px;color:#334155;line-height:1.8;margin:10px 0 14px">
        اكتب رابط موقع Smart Time كما تفتحه في المتصفح، مثال:
        <span style="direction:ltr;display:inline-block;font-weight:700">https://example.duckdns.org</span>
      </div>
      <input id="st-server-input" type="url" autocomplete="off" spellcheck="false"
             placeholder="https://..." value="${initial.replace(/"/g, '&quot;')}"
             style="width:100%;box-sizing:border-box;direction:ltr;text-align:left;
                    padding:12px 14px;border:1.5px solid #cbd5e1;border-radius:12px;
                    font-size:14px;outline:none" />
      <div id="st-server-msg" style="min-height:20px;font-size:12.5px;margin-top:8px;color:#64748b"></div>
      <button id="st-server-save" style="width:100%;padding:13px;border:0;border-radius:12px;
              background:#0f766e;color:#fff;font-size:15px;font-weight:800;cursor:pointer;margin-top:4px">
        حفظ وتشغيل
      </button>
      <button id="st-server-test" style="width:100%;padding:11px;border:1.5px solid #cbd5e1;
              border-radius:12px;background:#f8fafc;color:#0f172a;font-size:14px;font-weight:700;
              cursor:pointer;margin-top:10px">
        اختبار الاتصال قبل الحفظ
      </button>
      <button id="st-server-skip" style="display:none;width:100%;padding:10px;border:0;
              background:transparent;color:#64748b;font-size:13px;font-weight:700;
              cursor:pointer;margin-top:8px">
        تخطي الآن (بدون سيرفر)
      </button>
    </div>`;

  document.body.appendChild(root);
  const input = root.querySelector('#st-server-input') as HTMLInputElement;
  const msg = root.querySelector('#st-server-msg') as HTMLDivElement;
  const save = root.querySelector('#st-server-save') as HTMLButtonElement;
  const test = root.querySelector('#st-server-test') as HTMLButtonElement;
  const skip = root.querySelector('#st-server-skip') as HTMLButtonElement | null;
  if (skip && allowSkip) skip.style.display = 'block';
  input.focus();
  return { root, input, msg, save, test, skip };
}

function setMessage(msg: HTMLDivElement, text: string, kind: 'info' | 'ok' | 'err'): void {
  msg.textContent = text;
  msg.style.color = kind === 'ok' ? '#047857' : kind === 'err' ? '#b91c1c' : '#64748b';
}

async function testServer(value: string, msg: HTMLDivElement): Promise<boolean> {
  setMessage(msg, 'جارٍ اختبار الاتصال…', 'info');
  try {
    const base = value.trim().replace(/\/+$/, '');
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) { setMessage(msg, 'الاتصال ناجح — الخادم يستجيب.', 'ok'); return true; }
    setMessage(msg, `الخادم رد برمز ${res.status} — تحقق من الرابط.`, 'err');
    return false;
  } catch {
    setMessage(msg, 'تعذر الوصول للخادم — تأكد من الرابط والاتصال بالإنترنت.', 'err');
    return false;
  }
}

function showSetupDialog(allowSkip: boolean, onDone: () => void): void {
  if (document.getElementById(NATIVE_FLAG)) return;
  const { root, input, msg, save, test, skip } = buildDialog(readSavedServer(), allowSkip);

  save.addEventListener('click', () => {
    const value = input.value.trim();
    if (!isHttpUrl(value)) { setMessage(msg, 'أدخل رابطاً صحيحاً يبدأ بـ https:// أو http://', 'err'); return; }
    setRuntimeApiUrl(value);
    root.remove();
    onDone();
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); });

  test.addEventListener('click', () => {
    const value = input.value.trim();
    if (!isHttpUrl(value)) { setMessage(msg, 'أدخل رابطاً صحيحاً أولاً.', 'err'); return; }
    void testServer(value, msg);
  });

  skip?.addEventListener('click', () => { root.remove(); onDone(); });
}

/** زر عائم صغير لإعادة فتح شاشة إعداد السيرفر من داخل التطبيق. */
function mountResetButton(): void {
  if (document.getElementById('st-server-gear')) return;
  const gear = document.createElement('button');
  gear.id = 'st-server-gear';
  gear.title = 'إعدادات السيرفر';
  gear.textContent = '⚙';
  gear.setAttribute('aria-label', 'إعدادات السيرفر');
  gear.style.cssText = [
    'position:fixed', 'bottom:14px', 'left:14px', 'z-index:2147483646',
    'width:34px', 'height:34px', 'border-radius:50%', 'border:0',
    'background:rgba(15,23,42,.55)', 'color:#fff', 'font-size:16px',
    'cursor:pointer', 'opacity:.45',
  ].join(';');
  gear.addEventListener('click', () => {
    showSetupDialog(false, () => window.location.reload());
  });
  document.body.appendChild(gear);
}

/** تُنتظر قبل تشغيل تطبيق React (انظر main.tsx). */
export function ensureServerConfig(): Promise<void> {
  try {
    if (typeof window === 'undefined' || !isNativeShell()) return Promise.resolve();
    mountResetButton();
    const saved = readSavedServer();
    const forced = window.location.hash === '#server-setup';
    if (saved && isHttpUrl(saved) && !forced) return Promise.resolve();
    return new Promise<void>((resolve) => {
      showSetupDialog(!saved, () => resolve());
    });
  } catch {
    return Promise.resolve();
  }
}
