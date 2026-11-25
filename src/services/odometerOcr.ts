/**
 * قراءة رقم العداد (Odometer) من الصورة — OCR يعمل على الجهاز نفسه 100% مجاناً
 * (Tesseract.js + نموذج tessdata_fast المضغوط محلياً في public/ocr).
 *
 * المبادئ:
 *  - لا مفاتيح مدفوعة ولا خدمات سحابية: صفر تكلفة، ويعمل بدون إنترنت بعد أول تحميل.
 *  - القراءة "اقتراح يُراجَع": النتيجة تُعبّأ في حقل الإدخال ويُظهر التطبيق
 *    بدائل مقترحة، والمستخدم يراجع ويصحح قبل الاعتماد — لا نبتكر رقماً وهمياً.
 *  - أي فشل (شبكة/WebView قديم/صورة سيئة) يعني رجوعاً سلساً للإدخال اليدوي.
 */

export interface OdometerOcrResult {
  /** أفضل رقم مقترح للتعبئة التلقائية (أو '' إذا لم نصل لثقة كافية). */
  best: string;
  /** بدائل مرتبة (الأفضل أولاً) — تُعرض كأزرار اختيار سريع. */
  candidates: string[];
  /** ثقة القراءة 0-100 لأفضل مرشح. */
  confidence: number;
  /** true إذا كانت الثقة كافية للتعبئة التلقائية. */
  confident: boolean;
}

type TesseractWorker = {
  recognize: (image: string | HTMLCanvasElement) => Promise<{
    data: {
      text: string;
      words?: Array<{ text?: string; confidence?: number }>;
    };
  }>;
  terminate: () => Promise<unknown>;
};

let workerPromise: Promise<TesseractWorker> | null = null;

const WORKER_PATH = '/ocr/worker.min.js';
const CORE_PATH = '/ocr';
const LANG_PATH = '/ocr/lang';

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      // OEM 1 = LSTM فقط — أخف وأدق مع نموذج tessdata_fast
      // ملاحظة [v1.4]: gzip=false — أداة AAPT2 أثناء بناء الـ APK تفك ضغط
      // ملفات ‎.gz داخل assets وتزيل الامتداد، لذا نشحن النموذج غير مضغوط
      // (eng.traineddata) ليعمل نفس المسار على الويب وداخل التطبيق معاً.
      const worker = await createWorker('eng', 1, {
        workerPath: WORKER_PATH,
        corePath: CORE_PATH,
        langPath: LANG_PATH,
        gzip: false,
        // لا نسجل أي شيء في الكونسول — الأداء والخصوصية
        logger: () => undefined,
        errorHandler: () => undefined,
      } as Parameters<typeof createWorker>[2]);
      return worker as unknown as TesseractWorker;
    })();
  }
  return workerPromise;
}

/**
 * معالجة مسبقة بسيطة عبر canvas: تصغير للأبعاد المعقولة + تدرّج رمادي +
 * توسيع التباين — يحسّن قراءة شاشات العداد الرقمية بوضوح.
 * مع علم العكس (أرقام فاتحة على خلفية داكنة).
 */
function preprocess(dataUrl: string, invert: boolean): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxSide = 1400;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no-canvas')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const data = ctx.getImageData(0, 0, w, h);
        const px = data.data;
        // مرور أول: تدرّج رمادي + إيجاد min/max لتوسيع التباين
        let min = 255;
        let max = 0;
        for (let i = 0; i < px.length; i += 4) {
          const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
          px[i] = g; px[i + 1] = g; px[i + 2] = g;
          if (g < min) min = g;
          if (g > max) max = g;
        }
        const range = Math.max(1, max - min);
        for (let i = 0; i < px.length; i += 4) {
          let v = ((px[i] - min) * 255) / range;
          if (invert) v = 255 - v;
          px[i] = v; px[i + 1] = v; px[i + 2] = v;
        }
        ctx.putImageData(data, 0, 0);
      } catch {
        // getImageData قد يفشل مع صور CORS — نكمل بالصورة الأصلية
      }
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('image-load-failed'));
    img.src = dataUrl;
  });
}

/** يستخرج أرقاماً منطقية من نص OCR مع ثقة كل كلمة. */
function extractCandidates(
  text: string,
  words: Array<{ text?: string; confidence?: number }>,
): Array<{ value: string; score: number }> {
  const seen = new Map<string, number>();
  const push = (raw: string, confidence: number) => {
    const value = (raw.match(/\d{3,8}/g) || []).join('');
    if (!value || value.length < 3) return;
    // أوزان: أرقام العداد عادة 4-7 خانات
    let score = confidence;
    if (value.length >= 4 && value.length <= 7) score += 20;
    if (value.length === 8) score += 5;
    if (value.length === 3) score -= 10;
    // أصفار بادئة كثيرة غالباً علامة عداد (مثل 070000) — مكافأة خفيفة
    if (/^0{1,3}\d+$/.test(value)) score += 5;
    const prev = seen.get(value) ?? -1;
    if (score > prev) seen.set(value, score);
  };

  for (const w of words || []) {
    const t = String(w?.text || '');
    const c = typeof w?.confidence === 'number' ? w.confidence : 50;
    if (/\d{3,}/.test(t.replace(/\D/g, ''))) push(t, c);
  }
  // مرور على النص الكامل أيضاً (كلمات ملتصقة قد تتكسر في words)
  push(text, 55);

  return Array.from(seen.entries())
    .map(([value, score]) => ({ value, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

/** يقرأ العداد من صورة (dataURL) — best-effort. أي فشل يعيد null بأمان. */
export async function readOdometerFromImage(dataUrl: string): Promise<OdometerOcrResult | null> {
  try {
    const worker = await getWorker();
    await worker.recognize; // worker جاهز

    // محاولة أولى: صورة كما هي (نص داكن على خلفية فاتحة)
    let candidates = await runPass(worker, await preprocess(dataUrl, false));
    // محاولة ثانية فقط عند الفشل: عكس الألوان (شاشات العداد فاتحة على داكن)
    if (!candidates.length) {
      candidates = await runPass(worker, await preprocess(dataUrl, true));
    }

    if (!candidates.length) {
      return { best: '', candidates: [], confidence: 0, confident: false };
    }

    const top = candidates[0];
    const rest = candidates.slice(1).map((c) => c.value);
    // حد الثقة للتعبئة التلقائية: مجموع جيد وليس رقماً سخيفاً (≥3 خانات مضمون بالاستخراج)
    const confident = top.score >= 60;
    return {
      best: confident ? top.value : '',
      candidates: [top.value, ...rest],
      confidence: Math.min(99, Math.round(Math.max(0, top.score))),
      confident,
    };
  } catch {
    // أي مشكلة (WebView بلا WASM، تعطل الـ worker، صورة تالفة…) → إدخال يدوي
    return null;
  }
}

async function runPass(
  worker: TesseractWorker,
  image: HTMLCanvasElement,
): Promise<Array<{ value: string; score: number }>> {
  // PSM 11 = Sparse text — مناسب للوحة عداد فيها أرقام متفرقة
  try {
    (worker as unknown as { setParameters?: (p: Record<string, string>) => Promise<unknown> })
      .setParameters?.({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '0123456789' });
  } catch { /* قد لا تتوفر — نكمل بالإعدادات الافتراضية */ }
  const { data } = await worker.recognize(image);
  return extractCandidates(String(data?.text || ''), data?.words || []);
}

/** تحرير موارد الـ worker عند إغلاق التطبيق/الصفحة (اختياري). */
export async function disposeOdometerOcr(): Promise<void> {
  if (!workerPromise) return;
  try {
    const w = await workerPromise;
    await w.terminate?.();
  } catch { /* تجاهل */ }
  workerPromise = null;
}
