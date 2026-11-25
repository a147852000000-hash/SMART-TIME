import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { CardSettingsProvider } from './context/CardSettingsContext.tsx';
import { ensureServerConfig } from './mobileServerSetup';
import './index.css';

// [FIX back-2026-11] زر الرجوع في أندرويد: بدونه يخرج التطبيق فوراً من أول ضغطة.
// الأولوية: معالج التطبيق الداخلي (إغلاق النوافذ / رجوع خطوة) → سجل المتصفح →
// الخروج من التطبيق فقط عند الشاشة الرئيسية بلا نوافذ.
async function registerAndroidBackButton() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform?.()) return;
    const { App: CapApp } = await import('@capacitor/app');
    await CapApp.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
      const w = window as unknown as { __smartTimeHardwareBack?: () => boolean };
      if (w.__smartTimeHardwareBack?.()) return;
      if (canGoBack) { window.history.back(); return; }
      void CapApp.exitApp();
    });
  } catch {
    /* على الويب العادي لا يوجد زر رجوع نظامي — نتجاهل بأمان */
  }
}

// داخل تطبيق الموبايل: ننتظر اختيار عنوان السيرفر أولاً (أول تشغيل فقط).
// على الويب العادي ensureServerConfig يرجع فوراً ولا يتغير أي شيء.
function boot() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <CardSettingsProvider>
          <App />
        </CardSettingsProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

void registerAndroidBackButton();
ensureServerConfig().then(boot).catch(() => boot());
