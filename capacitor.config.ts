import type { CapacitorConfig } from '@capacitor/cli';

/**
 * إعداد غلاف أندرويد لتطبيق Smart Time — مجاني بالكامل وبلا أي خدمة خارجية.
 *
 * - androidScheme https: أصل التطبيق يصبح https://localhost (CORS الموجود في
 *   server.ts يسمح به أصلاً، و WebAuthn يحتاج سياق آمن).
 * - cleartext + allowMixedContent: يسمح بـ http:// للسيرفرات المحلية/اللان.
 * - نسخة v1.1: العنوان يُثبت وقت البناء عبر VITE_API_URL فالتطبيق يعمل من
 *   أول فتح بدون أي إعداد — وشاشة الإعداد تبقى متاحة عبر زر ⚙ للصيانة فقط.
 */
const config: CapacitorConfig = {
  appId: 'app.smarttime.free',
  appName: 'Smart Time',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
