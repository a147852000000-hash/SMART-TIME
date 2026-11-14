/**
 * طباعة وتصدير مدركة للغلاف الأصلي (Capacitor) — مجانية بالكامل، بلا حزم خارجية.
 *
 * الخلفية: window.print() و window.open() لا يعملان داخل WebView أندرويد
 * (لا مانagers طباعة ولا نوافذ منبثقة)، فكانت الأزرار تنهار بصمت. الآن:
 *  - على الويب: نفس سلوك الطباعة المعتاد.
 *  - داخل التطبيق: رسالة واضحة تشرح البديل بدل الفشل الصامت.
 */

export function isNativeShell(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform() === true;
  } catch {
    return false;
  }
}

let toastTimer: number | undefined;

/** رسالة قصيرة أسفل الشاشة — بديل الفشل الصامت داخل التطبيق. */
export function showExportToast(message: string): void {
  try {
    let box = document.getElementById('st-export-toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'st-export-toast';
      box.setAttribute('dir', 'rtl');
      box.style.cssText = [
        'position:fixed', 'bottom:76px', 'left:50%', 'transform:translateX(-50%)',
        'z-index:2147483646', 'max-width:min(92vw,420px)', 'padding:12px 16px',
        'border-radius:14px', 'background:rgba(15,23,42,.94)', 'color:#fff',
        'font-size:13px', 'font-weight:700', 'line-height:1.7', 'text-align:center',
        'box-shadow:0 10px 30px rgba(2,6,23,.35)', 'transition:opacity .25s',
        'opacity:0', 'pointer-events:none',
      ].join(';');
      document.body.appendChild(box);
    }
    box.textContent = message;
    box.style.opacity = '1';
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { if (box) box.style.opacity = '0'; }, 4200);
  } catch { /* تجاهل بأمان */ }
}

const NATIVE_PRINT_HINT =
  'الطباعة غير مدعومة داخل تطبيق الموبايل حالياً — استخدم تصدير Excel/Word أو افتح البرنامج من متصفح الموبايل.';

/**
 * [FIX batch8] نسخة مستقلة قابلة للطباعة من الصفحة الحالية (بنفس التنسيقات).
 * تُستخدم داخل إطارات المعاينة (iframe) حيث يحجب المتصفح نافذة الطباعة،
 * ولنوافذ الطباعة المنبثقة المحجوبة — نفس التنسيق لأنه ينسخ أنماط الصفحة.
 */
function printableDocumentHtml(): string {
  try {
    return '<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>SMART TIME</title>'
      + document.head.innerHTML
      + '</head><body>'
      + document.body.innerHTML
      + '<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>'
      + '</body></html>';
  } catch {
    return '';
  }
}

/** طباعة الصفحة الحالية: تعمل على الويب، وترسل رسالة واضحة داخل التطبيق. */
export function printCurrentPage(): void {
  if (isNativeShell()) {
    showExportToast(NATIVE_PRINT_HINT);
    return;
  }
  // [FIX batch8] داخل iframe (لوحة المعاينة) يحجب المتصفح window.print بصمت —
  // نفتح نسخة طباعة مستقلة بنفس المحتوى والتنسيق بدل الفشل الصامت.
  const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  if (inIframe) {
    const html = printableDocumentHtml();
    if (html && openPrintWindow(html)) return;
    showExportToast('المتصفح منع فتح نافذة الطباعة هنا — افتح البرنامج في تبويب مستقل ثم اضغط طباعة.');
    return;
  }
  try {
    window.print();
  } catch {
    showExportToast('تعذر بدء الطباعة في هذا المتصفح.');
  }
}

/**
 * يفتح نافذة طباعة مستقلة بمحتوى HTML جاهز (نمط exportPdf القديم).
 * يعيد false داخل التطبيق أو عند حجب النوافذ المنبثقة — المستدعي يخرج بأمان.
 */
export function openPrintWindow(html: string): boolean {
  if (isNativeShell()) {
    showExportToast(NATIVE_PRINT_HINT);
    return false;
  }
  try {
    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) return false;
    win.document.write(html);
    win.document.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * تنزيل ملف عبر Blob: يعمل على الويب؛ داخل التطبيق رسالة واضحة بدل الصمت
 * (دعم التنزيل الأصلي داخل WebView يأتي في تحديث قادم عبر إضافات Capacitor الرسمية المجانية).
 */
export function downloadBlobAware(
  content: BlobPart,
  type: string,
  filename: string,
  nativeHint: string,
): boolean {
  if (isNativeShell()) {
    showExportToast(nativeHint || 'التنزيل داخل التطبيق غير مدعوم بعد — افتح البرنامج من المتصفح للتصدير.');
    return false;
  }
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    showExportToast('تعذر تنزيل الملف في هذا المتصفح.');
    return false;
  }
}
