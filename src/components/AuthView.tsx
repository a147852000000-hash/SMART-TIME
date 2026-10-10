import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { forgotPassword, loginWithIdentifier, registerWithEmail, resetPassword, selectLoginRole } from '../services/authService';
import { apiUrl } from '../services/apiConfig';

interface Props {
  onAuthenticated: () => void;
  onGuest: () => void;
  loginNotice?: string;
  requireTripPhoneVerification?: boolean;
}

type Mode = 'login'|'register'|'forgot';

export const AuthView: React.FC<Props> = ({ onAuthenticated, onGuest, loginNotice, requireTripPhoneVerification = false }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [roleChoiceTicket, setRoleChoiceTicket] = useState('');
  const [showRoleChoice, setShowRoleChoice] = useState(false);
  const [emailExistsInRailway, setEmailExistsInRailway] = useState(false);

  useEffect(() => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailExistsInRailway(false);
      if (mode === 'register') setError('');
      return;
    }
    if (mode !== 'register') {
      setError('');
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        await fetch('https://smart-time-ai.duckdns.org/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail }),
        }).catch(() => null);
        const response = await fetch(apiUrl('/api/auth/check'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail }),
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        const exists = response.ok && data.accountExists === true;
        setEmailExistsInRailway(exists);
        setError(exists ? 'هذا البريد مسجل بالفعل، يرجى تسجيل الدخول' : '');
      } catch {
        if (!cancelled) {
          setEmailExistsInRailway(false);
          setError('');
        }
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [email, mode]);

  const clearError = () => setError('');
  const switchMode = (next: Mode) => { setMode(next); clearError(); setCode(''); setResetSent(false); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const challenge = '';
      if (mode === 'register') {
        if (emailExistsInRailway) throw new Error('هذا البريد مسجل بالفعل، يرجى تسجيل الدخول');
        if (name.trim().length < 2) throw new Error('اكتب اسمًا صحيحًا.');
        if (!username.trim()) throw new Error('اسم المستخدم مطلوب.');
        const registration = await registerWithEmail(name.trim(), username.trim(), email.trim().toLowerCase(), password, challenge);
        if (registration?.alreadyExists || registration?.registered && !registration?.token) {
          throw new Error('هذا البريد مسجل بالفعل، يرجى تسجيل الدخول');
        }
        onAuthenticated(); return;
      }
      if (mode === 'forgot') {
        if (!resetSent) {
          const d:any = await forgotPassword(email.trim());
          if (!d.ok && !d.emailSent) {
            throw new Error(d.message || 'تعذر إرسال رمز الاستعادة حاليًا. حاول لاحقًا.');
          }
          setResetSent(true); setCode('');
          setError(d.emailSent
            ? 'تم إرسال كود استعادة كلمة المرور إلى بريدك الإلكتروني'
            : (d.message || 'لو البريد الإلكتروني مرتبط بحساب، هيوصلك كود استعادة كلمة المرور.'));
          return;
        }
        await resetPassword(email.trim(), code.trim(), password, challenge);
        setMode('login'); setCode(''); setPassword(''); setResetSent(false);
        setError('تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.'); return;
      }
      if (!email.trim()) throw new Error('أدخل بريدك الإلكتروني.');
      const result = await loginWithIdentifier(email.trim(), password, challenge);
      if ('requiresRoleChoice' in result && result.requiresRoleChoice) {
        setRoleChoiceTicket(result.roleChoiceTicket || '');
        setShowRoleChoice(true);
        setError('');
        return;
      }
      onAuthenticated();
    } catch (err:any) {
      const message = err?.message || 'تعذر تنفيذ العملية.';
      if (mode === 'forgot' && message.includes('غير مسجل')) {
        setError('لو البريد الإلكتروني مرتبط بحساب، هيوصلك كود استعادة كلمة المرور.');
      } else {
        if (mode === 'register' && /مسجل بالفعل|already exists/i.test(message)) {
          setEmailExistsInRailway(true);
          setError('هذا البريد مسجل بالفعل، يرجى تسجيل الدخول');
        } else {
          setError(message);
        }
      }
    }
    finally { setBusy(false); }
  };

  const chooseRole = async (role: 'owner' | 'user') => {
    setError(''); setBusy(true);
    try {
      if (!roleChoiceTicket) throw new Error('انتهت صلاحية اختيار نوع الدخول. سجّل الدخول مرة أخرى.');
      await selectLoginRole(roleChoiceTicket, role);
      onAuthenticated();
    } catch (err:any) { setError(err.message || 'تعذر اختيار نوع الدخول.'); }
    finally { setBusy(false); }
  };

  return (
    <main style={{ backgroundColor: '#FFFFFF' }} className="min-h-screen w-full bg-white text-black flex items-center justify-center px-4 py-6 sm:px-6 sm:py-10 font-sans" dir="ltr">
      {/* Transparent card - pure white background */}
      <section style={{ backgroundColor: 'transparent' }} className="w-full max-w-[600px] bg-transparent px-1 py-2 sm:px-4 sm:py-4 border-0 shadow-none">
        <header className="mb-7 sm:mb-8 flex flex-col items-center text-center">
          <img
            src="/logo-smarttime-original.png"
            alt="SmartTime TIME GOLD"
            className="mb-1 h-auto w-[460px] max-w-full object-contain drop-shadow-[0_8px_14px_rgba(197,160,89,0.08)]"
          />
          {/* Eng.mamdouh saad in GOLD */}
          <p className="mt-1 font-serif text-[25px] sm:text-[32px] font-medium tracking-wide text-[#B88A32]">Eng.mamdouh saad</p>
          <h1 className="mt-4 sm:mt-5 font-serif text-[34px] sm:text-[42px] font-medium leading-tight text-black">
            {mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create account' : 'Forgot password?'}
          </h1>
        </header>

        {showRoleChoice ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              <div className="text-lg font-semibold text-black">Choose sign-in type</div>
              <p className="mt-1 text-sm text-gray-600">Choose how to enter for this session.</p>
            </div>
            <button type="button" disabled={busy} onClick={() => chooseRole('owner')} className="w-full rounded-xl bg-black p-3.5 font-medium text-[#C5A059] transition hover:bg-gray-900 disabled:opacity-50">Continue as Owner</button>
            <button type="button" disabled={busy} onClick={() => chooseRole('user')} className="w-full rounded-xl border border-gray-300 bg-white p-3.5 font-medium text-black transition hover:bg-gray-50 disabled:opacity-50">Continue as User</button>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {loginNotice && mode === 'login' && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loginNotice}</div>}

            {mode === 'register' && <>
              <label className="block">
                <span className="mb-2 block text-[15px] sm:text-[17px] font-medium text-gray-900">Full name</span>
                <div className="relative">
                  <UserRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                  <input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name" className="h-[60px] sm:h-[68px] w-full rounded-[14px] border border-[#C5A059]/75 bg-white pl-12 pr-4 text-[16px] sm:text-[18px] outline-none transition focus:border-[#B88A32] focus:ring-2 focus:ring-[#C5A059]/20" placeholder="Your name" />
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-[15px] sm:text-[17px] font-medium text-gray-900">Username</span>
                <input required dir="ltr" value={username} onChange={e=>setUsername(e.target.value.replace(/\s/g,'').slice(0,30))} autoComplete="username" className="h-[60px] sm:h-[68px] w-full rounded-[14px] border border-[#C5A059]/75 bg-white px-4 text-[16px] sm:text-[18px] outline-none transition focus:border-[#B88A32] focus:ring-2 focus:ring-[#C5A059]/20" placeholder="username" />
              </label>
            </>}

            <label className="block">
              <span className="mb-2 block text-[15px] sm:text-[17px] font-medium text-gray-900">Email</span>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <input required type="email" autoComplete="email" dir="ltr" value={email} onChange={e=>{setEmail(e.target.value); setError('');}} className="h-12 w-full rounded-xl border border-[#D4AF37]/50 bg-white pl-12 pr-4 outline-none transition placeholder:text-gray-500 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20" placeholder="email@example.com" />
              </div>
            </label>

            {mode === 'forgot' && resetSent && (
              <label className="block">
                <span className="mb-2 block text-[15px] sm:text-[17px] font-medium text-gray-900">Reset code</span>
                <input required dir="ltr" value={code} onChange={e=>setCode(e.target.value)} className="h-[60px] sm:h-[68px] w-full rounded-[14px] border border-[#C5A059]/75 bg-white px-4 text-center tracking-[.3em] outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20" placeholder="Enter the code from your email" />
              </label>
            )}

            {mode !== 'forgot' || resetSent ? (
              <label className="block">
                <span className="mb-2 block text-[15px] sm:text-[17px] font-medium text-gray-900">{mode === 'forgot' ? 'New password' : 'Password'}</span>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                  <input required minLength={8} type={show?'text':'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e=>setPassword(e.target.value)} className="h-[60px] sm:h-[68px] w-full rounded-[14px] border border-[#C5A059]/75 bg-white pl-12 pr-12 text-[16px] sm:text-[18px] outline-none transition placeholder:text-gray-400 focus:border-[#B88A32] focus:ring-2 focus:ring-[#C5A059]/20" placeholder="••••••••" />
                  <button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40">{show?<EyeOff className="h-5 w-5"/>:<Eye className="h-5 w-5"/>}</button>
                </div>
              </label>
            ) : null}

            {error && <div role="alert" className={`rounded-xl p-3 text-sm font-medium ${error.includes('تم ') ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-red-200 bg-red-50 text-red-700'}`}>{error}</div>}

            <button disabled={busy || (mode === 'register' && emailExistsInRailway)} className="flex h-[60px] sm:h-[72px] w-full items-center justify-center rounded-full bg-[#090909] px-4 font-semibold text-[20px] sm:text-[24px] text-[#D6AD52] shadow-[0_8px_20px_rgba(0,0,0,0.08)] transition hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C5A059] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              {busy?'Please wait…':mode==='register'?'Create account':mode==='forgot'?(resetSent?'Reset password':'Send reset code'):'Sign In'}
            </button>

            {mode === 'login' && (
              <>
                {/* Forgot + Sign up */}
                <div className="flex flex-col items-center gap-3 pt-2 text-sm">
                  <button type="button" onClick={()=>switchMode('forgot')} className="text-[#C5A059] transition hover:underline">Forgot password?</button>
                  <p className="text-center text-gray-700">Don't have an account?{' '}
                    <button type="button" onClick={()=>switchMode('register')} className="font-semibold text-[#C5A059] transition hover:text-[#A68136] hover:underline">Sign up</button>
                  </p>
                </div>

                {/* Divider + Google BETWEEN Sign up and Guest */}
                <div className="pt-2">
                  <div className="mb-4 flex items-center gap-3 text-sm text-gray-500">
                    <span className="h-px flex-1 bg-[#D4AF37]/40"/>
                    <span>or continue with</span>
                    <span className="h-px flex-1 bg-[#D4AF37]/40"/>
                  </div>
                  <button type="button" onClick={()=>setError('Google sign-in is not configured on this deployment yet.')} className="flex min-h-[60px] sm:min-h-[68px] w-full items-center justify-center gap-3 rounded-[14px] border border-[#A88B52] bg-white px-4 py-3 text-[17px] sm:text-[20px] shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40">
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18c-.72 1.44-1.13 3.07-1.13 4.93s.41 3.49 1.13 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="font-medium text-gray-800">Continue with Google</span>
                  </button>
                </div>

                {/* Guest directly after Google - no second divider */}
                <div className="pt-3">
                  <button type="button" onClick={onGuest} className="flex min-h-[60px] sm:min-h-[68px] w-full items-center justify-center gap-3 rounded-[14px] border border-[#A88B52] bg-white px-3 text-[15px] sm:text-[18px] text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40">
                    <UserRound className="h-5 w-5 shrink-0 text-[#C5A059]"/>
                    <span>الدخول كزائر — Continue as Guest</span>
                  </button>
                </div>
              </>
            )}

            {mode === 'register' && emailExistsInRailway && <button type="button" onClick={()=>switchMode('login')} className="w-full rounded-xl border border-amber-200 bg-amber-50 py-3 text-sm font-semibold text-amber-900">Email already registered — Sign In</button>}
            {mode !== 'login' && <button type="button" onClick={()=>switchMode('login')} className="w-full py-2 text-sm text-gray-600 transition hover:text-black hover:underline">Back to Sign In</button>}

            {/* Guest for register/forgot modes */}
            {mode !== 'login' && (
              <div className="pt-3">
                <button type="button" onClick={onGuest} className="flex min-h-[60px] sm:min-h-[68px] w-full items-center justify-center gap-3 rounded-[14px] border border-[#A88B52] bg-white px-3 text-[15px] sm:text-[18px] text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/40">
                  <UserRound className="h-5 w-5 shrink-0 text-[#C5A059]"/>
                  <span>الدخول كزائر — Continue as Guest</span>
                </button>
              </div>
            )}
          </form>
        )}
      </section>
    </main>
  );
};