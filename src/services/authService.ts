import { UserRepository } from './repositories/userRepository';
import { UserProfile } from '../types';
import { apiUrl } from './apiConfig';
import { StorageAdapter } from './storageAdapter';

export interface AuthUser {
  id: string;
  email: string;
  username?: string;
  name: string;
  phone?: string;
  phoneVerified?: boolean;
  role?: 'owner' | 'admin' | 'user' | 'guest';
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

const SESSION_KEY = 'smart_time_auth_session';
const DEVICE_ID_KEY = 'smart_time_device_id';
export function getDeviceId(): string {
  try { const existing=localStorage.getItem(DEVICE_ID_KEY); if(existing && existing.length>=16) return existing; const id=typeof crypto!=='undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; StorageAdapter.setItem(DEVICE_ID_KEY,id); return id; } catch { return `ephemeral-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; } }
const api = (path: string, options: RequestInit = {}) => fetch(apiUrl(path), {
  ...options,
  headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers || {}) },
});

function saveSession(session: AuthSession) {
  StorageAdapter.setItem(SESSION_KEY, JSON.stringify(session));
}
export function getStoredSession(): AuthSession | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
export function clearSession() { localStorage.removeItem(SESSION_KEY); }
export function authHeaders() {
  const session = getStoredSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

async function request(path: string, body: Record<string, unknown>) {
  const res = await api(path, { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'حدث خطأ في الاتصال بالخادم');
  return data;
}

function applyUserToProfile(user: AuthUser): UserProfile {
  const current = UserRepository.getProfile();
  const updated = UserRepository.updateProfile({
    id: user.id,
    name: user.name || current.name,
    email: user.email || current.email,
    phone: user.phone || current.phone,
    // Phone verification is not required for chat; phone remains optional account data.
    isOnboarded: true,
  });
  return updated;
}

export async function startTrialSession(): Promise<AuthSession> {
  const res = await fetch(apiUrl('/api/trial/session'));
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) throw new Error(data.error || 'تعذر بدء النسخة التجريبية');
  const session: AuthSession = { token: data.token, user: data.user };
  saveSession(session);
  applyUserToProfile(session.user);
  return session;
}

export async function loginWithIdentifier(identifier: string, password: string, turnstileToken?: string, role?: 'admin' | 'user'): Promise<AuthSession | { requiresRoleChoice: true; availableRoles: string[]; roleChoiceTicket: string }> {
  const data = await request('/api/auth/login', { identifier, password, role: role || '', turnstileToken: turnstileToken || '' });
  if (data.requiresRoleChoice) return data;
  const session: AuthSession = { token: data.token, user: data.user };
  saveSession(session); applyUserToProfile(session.user); return session;
}


export async function selectLoginRole(roleChoiceTicket: string, role: 'owner' | 'user'): Promise<AuthSession> {
  const data = await request('/api/auth/select-role', { roleChoiceTicket, role });
  const session: AuthSession = { token: data.token, user: data.user };
  saveSession(session); applyUserToProfile(session.user); return session;
}

export async function requestPhoneLoginOtp(phone: string, turnstileToken?: string) { return request('/api/auth/phone-login/request-otp', { phone, turnstileToken: turnstileToken || '' }); }

export async function loginWithPhone(phone: string, code: string, turnstileToken?: string): Promise<AuthSession> {
  const data = await request('/api/auth/phone-login', { phone, code, turnstileToken: turnstileToken || '' });
  const session: AuthSession = { token: data.token, user: data.user };
  saveSession(session); applyUserToProfile(session.user); return session;
}

const API_BASE = 'https://smart-time-ai.duckdns.org';

export async function forgotPassword(email: string) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) throw new Error('أدخل بريدك الإلكتروني.');

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/auth/forgot-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
      signal: controller.signal,
    });
  } catch {
    throw new Error('تعذر الاتصال بخدمة استعادة كلمة المرور. تحقق من الإنترنت وحاول مرة أخرى.');
  } finally {
    window.clearTimeout(timeoutId);
  }

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || 'تعذر إرسال كود استعادة كلمة المرور. حاول مرة أخرى.');
  }

  // Oracle is the authority for the reset-code store and email delivery.
  // Do not infer "not registered" merely because its response omits accountExists.
  if (data.emailSent === true) return { ...data, ok: data.ok !== false };
  if (data.ok === true) {
    return {
      ...data,
      emailSent: false,
      message: data.message || 'لو البريد الإلكتروني مرتبط بحساب، هيوصلك كود استعادة كلمة المرور.',
    };
  }
  throw new Error(data.message || data.error || 'تعذر إرسال كود استعادة كلمة المرور. حاول مرة أخرى.');
}

// Compatibility alias for existing callers; the reset request now uses the Oracle API.
export async function requestPasswordReset(email: string, _turnstileToken?: string) {
  return forgotPassword(email);
}

export async function resetPassword(email: string, code: string, newPassword: string, turnstileToken?: string) {
  return request('/api/auth/reset-password', { email, code, newPassword, turnstileToken: turnstileToken || '' });
}

export async function registerWithEmail(name: string, username: string, email: string, password: string, turnstileToken?: string): Promise<any> {
  const data = await request('/api/auth/register', { name, username, email, password, deviceId: getDeviceId(), turnstileToken: turnstileToken || '' });
  if (!data.token) return data;
  const session: AuthSession = { token: data.token, user: data.user };
  saveSession(session); applyUserToProfile(session.user);
  // Return every field the server sent (devCode, smsSent, smsWarning, requiresPhoneVerification, ...),
  // not just {token, user} — the caller needs those to tell the person what actually happened.
  return { ...data, token: session.token, user: session.user };
}

export async function verifyRegistrationPhone(phone: string, code: string, turnstileToken?: string): Promise<any> { const data=await request('/api/auth/register/verify-phone',{phone,code,deviceId:getDeviceId(),turnstileToken: turnstileToken || ''}); if(data?.user){ const current=getStoredSession(); if(current?.token){ saveSession({token:current.token,user:data.user}); applyUserToProfile(data.user); } } return data; }
export async function requestTripsPhoneOtp(phone: string, turnstileToken?: string): Promise<any> { return request('/api/auth/trips/request-phone-otp',{phone,turnstileToken:turnstileToken || ''}); }
export async function verifyTripsPhone(phone: string, code: string, turnstileToken?: string): Promise<any> { const data=await request('/api/auth/trips/verify-phone',{phone,code,deviceId:getDeviceId(),turnstileToken:turnstileToken || ''}); if(data?.user){ const current=getStoredSession(); if(current?.token){ saveSession({token:current.token,user:data.user}); applyUserToProfile(data.user); } } return data; }

export async function restoreSession(): Promise<AuthSession | null> {
  const stored = getStoredSession();
  if (!stored?.token) return null;
  try {
    const res = await api('/api/auth/me', { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error();
    const session = { token: stored.token, user: data.user } as AuthSession;
    saveSession(session); applyUserToProfile(session.user); return session;
  } catch { clearSession(); return null; }
}

export async function requestChatOtp(phone: string) {
  return request('/api/auth/chat/request-otp', { phone });
}

export async function verifyChatOtp(phone: string, code: string): Promise<AuthSession> {
  const data = await request('/api/auth/chat/verify-otp', { phone, code, token: getStoredSession()?.token });
  const session: AuthSession = { token: data.token, user: data.user };
  saveSession(session); applyUserToProfile(session.user); return session;
}

export async function logout() {
  try { await api('/api/auth/logout', { method: 'POST', headers: authHeaders() }); } catch {}
  clearSession();
}


/**
 * Best-effort mirror registration to the Oracle API so forgot-password can find
 * accounts created through the primary app registration flow.
 */
export async function register(email: string, name: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const usernameBase = (normalizedEmail.split("@")[0] || "user")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "_")
    .slice(0, 30);
  const username = usernameBase.length >= 3 ? usernameBase : `usr_${usernameBase}`;

  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizedEmail, name: name.trim(), password, username }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Oracle registration failed (${response.status})`);
  }
  return data;
}
