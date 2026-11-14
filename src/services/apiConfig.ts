// إعدادات مركزية لعنوان الباك اند.
// لو المتغير VITE_API_URL متظبط (مثلاً في تطبيق الأندرويد أو أي استضافة منفصلة للفرونت اند)
// هيستخدمه في كل الطلبات. لو مش متظبط (زي حالة تشغيل الفرونت اند والباك اند على نفس الدومين
// في Vercel أو أي استضافة عادية)، هيرجع فاضي وبالتالي الروابط النسبية (/api/...) هتفضل شغالة عادي.

const RUNTIME_OVERRIDE_KEY = 'smart_time_api_url';

/**
 * تجاوز وقت التشغيل لتطبيق الأندرويد (Capacitor): أول تشغيل للـ APK يسأل عن
 * عنوان السيرفر ويخزنه هنا، فيتخطى VITE_API_URL المبني داخل الحزمة.
 */
function readRuntimeOverride(): string {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) return '';
    return (window.localStorage.getItem(RUNTIME_OVERRIDE_KEY) || '').trim();
  } catch {
    return '';
  }
}

const RAW_BASE = readRuntimeOverride() || (import.meta.env.VITE_API_URL || '').trim();

// نتأكد إن الرابط متسجل من غير / في الآخر عشان مايحصلش // مزدوجة
export const API_BASE_URL = RAW_BASE.replace(/\/+$/, '');
export const RUNTIME_API_KEY = RUNTIME_OVERRIDE_KEY;

/** حفظ/تحديث عنوان السيرفر وقت التشغيل (يُستخدم في شاشة إعداد تطبيق الموبايل). */
export function setRuntimeApiUrl(value: string): void {
  try {
    const clean = value.trim().replace(/\/+$/, '');
    if (clean) window.localStorage.setItem(RUNTIME_OVERRIDE_KEY, clean);
    else window.localStorage.removeItem(RUNTIME_OVERRIDE_KEY);
  } catch {
    /* التخزين غير متاح — تجاهل بأمان */
  }
}

/**
 * يبني رابط API كامل. لو فيه API_BASE_URL متظبط بيستخدمه، غير كده بيرجع نفس المسار النسبي.
 * استخدمها بدل ما تكتب fetch('/api/...') مباشرة.
 */
export function apiUrl(path: string): string {
  if (!path.startsWith('/')) path = `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

/**
 * يبني رابط WebSocket كامل حسب نفس المنطق.
 * لو API_BASE_URL متظبط (http/https)، بيحوله تلقائيًا لـ ws/wss.
 * غير كده بيستخدم نفس دومين الصفحة الحالية (السلوك الأصلي).
 */
export function wsUrl(path: string): string {
  if (!path.startsWith('/')) path = `/${path}`;

  if (API_BASE_URL) {
    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    return `${wsBase}${path}`;
  }

  if (typeof window === 'undefined') return path;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}
