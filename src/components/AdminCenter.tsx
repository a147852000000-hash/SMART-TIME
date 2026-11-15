import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Users, CheckCircle2, Ban, Trash2, RefreshCw, LogOut, Crown, ArrowLeftCircle, UserCog, AlertTriangle } from 'lucide-react';
import { apiUrl } from '../services/apiConfig';
import { authHeaders, logout, getStoredSession } from '../services/authService';

// [owner-perms] لوحة تحكم الإدارة تعمل فعليًا الآن: كانت تستدعي /api/admin/users
// وهو مسار غير موجود على الخادم، فكانت تظهر خطأ دائمًا، وكانت محجوبة عن المالك.
// الآن المالك يرى كل الحسابات ويديرها (تفعيل/تعطيل/تعيين Admin/حذف) ويستطيع
// الدخول إلى التطبيق بنفس الجلسة، والإداري يدير الحسابات العادية فقط.

type AdminUser = {
  id: string; email: string; username?: string; name: string;
  role: string; activation_status: string; created_at?: string;
  resolvedRole?: 'owner' | 'admin' | 'user'; accountIsOwner?: boolean;
};

type PanelProps = { onLogout: () => void; onEnterApp: () => void };

const roleLabel = (u: AdminUser): string => {
  if (u.accountIsOwner || u.resolvedRole === 'owner') return 'المالك';
  if (u.resolvedRole === 'admin' || u.role === 'admin') return 'إداري (Admin)';
  return 'مستخدم';
};

const statusLabel = (s: string): { text: string; cls: string } => {
  if (s === 'active') return { text: 'نشط', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' };
  if (s === 'suspended') return { text: 'معطّل', cls: 'bg-red-100 text-red-700 border-red-300' };
  return { text: 'قيد التفعيل', cls: 'bg-amber-100 text-amber-800 border-amber-300' };
};

export default function AdminCenter({ onLogout, onEnterApp }: PanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; suspended: number; admins: number } | null>(null);
  const [viewer, setViewer] = useState<{ id: string; role: 'owner' | 'admin' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const sessionRole = getStoredSession()?.user?.role;
  const isOwnerSession = sessionRole === 'owner';

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(apiUrl('/api/admin/users'), { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'تعذر تحميل المستخدمين');
      setUsers(d.users || []);
      setStats(d.stats || null);
      setViewer(d.viewer || null);
    } catch (e: any) { setError(e.message || 'تعذر تحميل لوحة الإدارة'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const patchUser = async (id: string, patch: Record<string, string>, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusyId(id); setError('');
    try {
      const r = await fetch(apiUrl('/api/admin/users/' + encodeURIComponent(id)), {
        method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'تعذر تحديث الحساب');
      await load();
    } catch (e: any) { setError(e.message || 'تعذر تحديث الحساب'); }
    finally { setBusyId(''); }
  };

  const removeUser = async (u: AdminUser) => {
    const label = u.name || u.username || u.email;
    if (!window.confirm(`حذف حساب «${label}» نهائيًا مع بياناته؟\nلا يمكن التراجع عن هذه العملية.`)) return;
    setBusyId(u.id); setError('');
    try {
      const r = await fetch(apiUrl('/api/admin/users/' + encodeURIComponent(u.id)), { method: 'DELETE', headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'تعذر حذف الحساب');
      await load();
    } catch (e: any) { setError(e.message || 'تعذر حذف الحساب'); }
    finally { setBusyId(''); }
  };

  const canActOn = (u: AdminUser): boolean => {
    if (!viewer || u.id === viewer.id) return false;           // حسابك نفسه: بدون إجراءات
    if (u.accountIsOwner || u.resolvedRole === 'owner') return false; // حساب المالك محمي
    if (viewer.role === 'admin' && (u.resolvedRole === 'admin' || u.role === 'admin')) return false;
    return true;
  };

  const statCards: Array<[string, number | '—', React.ElementType, string]> = [
    ['إجمالي الحسابات', stats?.total ?? '—', Users, 'text-sky-400'],
    ['حسابات نشطة', stats?.active ?? '—', CheckCircle2, 'text-emerald-400'],
    ['حسابات معطّلة', stats?.suspended ?? '—', Ban, 'text-red-400'],
    ['إداريون (Admins)', stats?.admins ?? '—', ShieldCheck, 'text-amber-400'],
  ];

  return <main dir="rtl" className="min-h-screen bg-slate-950 text-white p-4 sm:p-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-3xl bg-white text-slate-950 p-5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="SMART TIME" className="w-16 h-16 rounded-2xl object-contain border border-slate-100" />
          <div>
            <h1 className="text-2xl font-black">لوحة تحكم الإدارة</h1>
            <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
              Eng.mamdouh saad · {isOwnerSession ? <span className="inline-flex items-center gap-1 text-amber-600"><Crown className="w-4 h-4" /> المالك / Super Admin</span> : 'إداري (Admin)'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void load()} title="تحديث" className="rounded-xl border border-slate-300 px-3 py-2 font-black hover:bg-slate-100"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={onEnterApp} className="rounded-xl bg-slate-950 text-[#C5A059] px-4 py-2 font-black flex items-center gap-2 hover:bg-slate-800">
            <ArrowLeftCircle className="w-4 h-4" /> الدخول إلى التطبيق
          </button>
          <button onClick={() => { void logout(); onLogout(); }} className="rounded-xl bg-red-600 text-white px-4 py-2 font-black flex items-center gap-2"><LogOut className="w-4 h-4" /> تسجيل الخروج</button>
        </div>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map(([label, value, Icon, color]) => (
          <div key={label} className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <Icon className={`w-5 h-5 mb-2 ${color}`} />
            <div className="font-black text-2xl">{value}</div>
            <div className="text-[11px] text-slate-400 mt-1 font-bold">{label}</div>
          </div>
        ))}
      </section>

      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 text-[12px] font-bold text-slate-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <span>
          صلاحيات المالك: تفعيل/تعطيل أي حساب، تعيين أو إزالة إداري (Admin)، وحذف الحسابات — محمية على الخادم ولا تُنفَّذ إلا من جلسة المالك. التعطيل وتغيير الدور يُنهيان جلسات الحساب فورًا.
          {isOwnerSession ? ' أنت الآن بجلسة المالك — كل الصلاحيات مفتوحة.' : ' أنت بجلسة إداري — التفعيل والتعطيل للحسابات العادية فقط.'}
        </span>
      </div>

      {error && <div className="rounded-2xl bg-red-950 border border-red-800 p-4 font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5" />{error}</div>}

      <section className="rounded-3xl bg-white text-slate-950 overflow-hidden">
        <div className="p-5 border-b font-black text-lg flex items-center gap-2"><UserCog className="w-5 h-5" /> إدارة الحسابات</div>
        {loading ? <div className="p-6 font-bold">جارٍ التحميل…</div>
          : users.length === 0 ? <div className="p-6 text-slate-500 font-bold">لا توجد حسابات مسجلة بعد.</div>
            : <div className="divide-y">{users.map(u => {
              const st = statusLabel(u.activation_status);
              const isSelf = viewer?.id === u.id;
              const isOwnerAccount = Boolean(u.accountIsOwner || u.resolvedRole === 'owner');
              const isAdminTarget = u.resolvedRole === 'admin' || u.role === 'admin';
              const actionable = canActOn(u) && busyId !== u.id;
              return (
                <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black flex items-center gap-2 flex-wrap">
                      {isOwnerAccount && <Crown className="w-4 h-4 text-amber-500" />}
                      <span className="truncate">{u.name || u.username || 'بدون اسم'}</span>
                      {isSelf && <span className="text-[10px] rounded-full bg-slate-900 text-white px-2 py-0.5 font-black">حسابك</span>}
                    </div>
                    <div className="text-sm text-slate-500 truncate" dir="ltr">{u.email}</div>
                    <div className="text-xs mt-1 font-bold flex items-center gap-2 flex-wrap">
                      <span className="rounded-full border border-slate-300 px-2 py-0.5">{isOwnerAccount ? '👑 ' : ''}{roleLabel(u)}</span>
                      <span className={`rounded-full border px-2 py-0.5 ${st.cls}`}>{st.text}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {actionable && (
                      <button
                        onClick={() => void patchUser(u.id, { activationStatus: u.activation_status === 'active' ? 'suspended' : 'active' })}
                        className="rounded-xl border px-3 py-2 text-xs font-black flex items-center gap-1 hover:bg-slate-100">
                        {u.activation_status === 'active' ? <><Ban className="w-4 h-4" /> تعطيل</> : <><CheckCircle2 className="w-4 h-4" /> تفعيل</>}
                      </button>
                    )}
                    {actionable && isOwnerSession && (
                      <button
                        onClick={() => void patchUser(
                          u.id,
                          { role: isAdminTarget ? 'user' : 'admin' },
                          isAdminTarget
                            ? `إزالة صلاحية Admin من «${u.name || u.email}» وإعادته مستخدمًا عاديًا؟ سيتم إنهاء جلساته الحالية.`
                            : `تعيين «${u.name || u.email}» إداريًا (Admin)؟ سيتم إنهاء جلساته الحالية لتفعيل الدور الجديد.`
                        )}
                        className="rounded-xl border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 flex items-center gap-1 hover:bg-amber-100">
                        <ShieldCheck className="w-4 h-4" /> {isAdminTarget ? 'إزالة Admin' : 'تعيين Admin'}
                      </button>
                    )}
                    {actionable && isOwnerSession && (
                      <button
                        onClick={() => void removeUser(u)}
                        className="rounded-xl bg-red-600 text-white px-3 py-2 text-xs font-black flex items-center gap-1 hover:bg-red-700">
                        <Trash2 className="w-4 h-4" /> حذف
                      </button>
                    )}
                  </div>
                </div>
              );
            })}</div>}
      </section>
    </div>
  </main>;
}
