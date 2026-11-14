/**
 * Google Sign-In — free Google Identity Services, no server quota.
 *
 * When the deployment ships VITE_GOOGLE_CLIENT_ID (a free Google Cloud OAuth
 * client), this module loads accounts.google.com/gsi/client once, renders the
 * official button and hands the received ID token (JWT) to authService.login
 * WithGoogle for server-side verification (backend/auth/google.ts).
 * Without the client id the sign-in button simply keeps its current
 * "not configured" behaviour — zero cost, zero requests.
 */

const GOOGLE_GSI_SRC = 'https://accounts.google.com/gsi/client';

export function googleClientId(): string {
  return String((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '').trim();
}

export function googleSignInConfigured(): boolean {
  return googleClientId().length > 0;
}

let scriptPromise: Promise<void> | null = null;

export function loadGoogleScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.reject(new Error('no document'));
  if ((window as any).google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('تعذر تحميل خدمة جوجل.')));
      return;
    }
    const script = document.createElement('script');
    script.src = GOOGLE_GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => { scriptPromise = null; reject(new Error('تعذر تحميل خدمة جوجل.')); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface GsiCredentialResponse { credential: string; }

/** Renders the official Google button into `container`; returns a cleanup fn. */
export async function renderGoogleSignInButton(
  container: HTMLElement,
  onCredential: (idToken: string) => void,
): Promise<() => void> {
  await loadGoogleScript();
  const google = (window as any).google;
  if (!google?.accounts?.id) throw new Error('تعذر تحميل خدمة جوجل.');
  google.accounts.id.initialize({
    client_id: googleClientId(),
    callback: (response: GsiCredentialResponse) => {
      if (response?.credential) onCredential(response.credential);
    },
    auto_select: false,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: true,
  });
  container.innerHTML = '';
  const width = Math.min(400, Math.max(220, container.clientWidth || 320));
  google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    width,
    locale: 'en',
    logo_alignment: 'left',
  });
  return () => { container.innerHTML = ''; };
}

/** Test hook (mainly for storybook/e2e): clear the cached script promise. */
export function resetGoogleScriptCache(): void { scriptPromise = null; }
