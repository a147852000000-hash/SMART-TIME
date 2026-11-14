import type { CapacitorConfig } from '@capacitor/cli';

/**
 * إعداد غلاف أندرويد لتطبيق Smart Time — مجاني بالكامل وبلا أي خدمة خارجية.
 *
 * - androidScheme https: أصل التطبيق يصبح https://localhost (CORS الموجود في
 *   server.ts يسمح به أصلاً، و WebAuthn يحتاج سياق آمن).
 * - cleartext + allowMixedContent: يسمح بـ http:// للسيرفرات المحلية/اللان.
 * - الواجهة تعمل من dist/client وتتصل بأي سيرفر يختاره المستخدم أول تشغيل.
 */
const config: CapacitorConfig = {
  appId: 'app.smarttime.free',
  appName: 'Smart Time',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowMixedContent: true,
  },
};

export default config;
