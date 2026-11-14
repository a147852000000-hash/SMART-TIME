import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { CardSettingsProvider } from './context/CardSettingsContext.tsx';
import { ensureServerConfig } from './mobileServerSetup';
import './index.css';

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

ensureServerConfig().then(boot).catch(() => boot());


