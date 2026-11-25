// اختبار OCR: يولّد صورة رقم عداد ويقرأها بنفس بيانات التدريب المضمّنة
import { createWorker } from 'tesseract.js';
import { createCanvas } from 'canvas';

const KM = '45230';

function makeOdometerImage(km) {
  const canvas = createCanvas(640, 240);
  const ctx = canvas.getContext('2d');
  // خلفية سوداء معبئة (نمط عداد رقمي)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 640, 240);
  ctx.fillStyle = '#7CFC00';
  ctx.font = 'bold 120px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(km, 320, 120);
  return canvas.toBuffer('image/png');
}

function parseOdometerDigits(raw) {
  const fixed = String(raw || '')
    .toUpperCase()
    .replace(/[OQ]/g, '0')
    .replace(/[IL|]/g, '1')
    .replace(/[Z]/g, '2')
    .replace(/[S]/g, '5')
    .replace(/[B]/g, '8')
    .replace(/[G]/g, '6')
    .replace(/[^0-9]/g, ' ');
  const groups = fixed.split(/\s+/).filter((g) => g.length >= 3 && g.length <= 7);
  if (!groups.length) return '';
  let best = groups[0];
  for (const g of groups) if (g.length > best.length) best = g;
  const km = parseInt(best, 10);
  if (!Number.isFinite(km) || km <= 0 || km > 3000000) return '';
  return String(km);
}

const worker = await createWorker('eng', 1, {
  langPath: '/home/z/my-project/SMART-TIME/public/ocr/lang',
  gzip: false,
  cachePath: '/tmp/tess-cache',
});
await worker.setParameters({
  tessedit_char_whitelist: '0123456789',
  tessedit_pageseg_mode: '7', // سطر واحد — صورة الاختبار سطر واحد
});

const buf = makeOdometerImage(KM);
const { data } = await worker.recognize(buf);
const parsed = parseOdometerDigits(data.text);
console.log('OCR raw text:', JSON.stringify(data.text));
console.log('Parsed:', parsed, '| Expected:', KM, '|', parsed === KM ? 'PASS' : 'FAIL');
await worker.terminate();
process.exit(parsed === KM ? 0 : 1);
