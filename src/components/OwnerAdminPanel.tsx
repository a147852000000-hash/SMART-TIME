import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Shield, ShieldCheck, UserCheck, UserMinus, LogOut } from 'lucide-react';
import { apiUrl } from '../services/apiConfig';
import { authHeaders, logout } from '../services/authService';

type ManagedUser = {
  id: string;
  email: string;
  username?: string;
  name?: string;
  role: 'owner' | 'admin' | 'user';
  activation_status?: string;
};

type OwnerAdminPanelProps = { onLogout: () => void };

export default function OwnerAdminPanel({ onLogout }: OwnerAdminPanelProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [admins, setAdmins] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(apiUrl(path), {
      ...init,
      headers: { ...authHeaders(), ...(init.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || 'تعذر تنفيذ الطلب.');
    return data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [userData, adminData] = await Promise.all([
        request('/api/owner/admins?view=users'),
        request('/api/owner/admins?view=admins'),
      ]);
      setUsers(Array.isArray(userData.users) ? userData.users : []);
      setAdmins(Array.isArray(adminData.admins) ? adminData.admins : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل بيانات الإدارة.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  const changeAdmin = async (user: ManagedUser, action: 'assign' | 'remove') => {
    setBusyId(user.id);
    setError('');
    setNotice('');
    try {
      await request('/api/owner/admins/' + encodeURIComponent(user.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setNotice(action === 'assign' ? 'تم تعيين المستخدم أدمن.' : 'تمت إزالة صلاحية الأدمن.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحديث الصلاحية.');
    } finally {
      setBusyId('');
    }
  };

  const activate = async (user: ManagedUser) => {
    setBusyId(user.id);
    setError('');
    setNotice('');
    try {
      await request('/api/auth/owner/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: user.email }),
      });
      setNotice('تم تفعيل الحساب.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تفعيل الحساب.');
    } finally {
      setBusyId('');
    }
  };

  const signOut = async () => {
    await logout();
    onLogout();
  };

  const UserRow = ({ user, isAdmin }: { user: ManagedUser; isAdmin: boolean }) => (
    <div key={user.id} className="flex flex-col gap-3 border-b border-slate-200 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="truncate font-bold text-slate-900">{user.name || user.username || 'مستخدم بدون اسم'}</div>
        <div className="truncate text-sm text-slate-500" dir="ltr">{user.email}</div>
        <div className="mt-1 text-xs text-slate-500">
          الدور: {isAdmin ? 'أدمن' : 'مستخدم'} · الحالة: {user.activation_status || 'غير محددة'}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!isAdmin && user.activation_status !== 'active' && (
          <button disabled={busyId === user.id} onClick={() => void activate(user)} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            <UserCheck className="mr-1 inline h-4 w-4" /> تفعيل الحساب
          </button>
        )}
        <button disabled={busyId === user.id} onClick={() => void changeAdmin(user, isAdmin ? 'remove' : 'assign')} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 disabled:opacity-50">
          {isAdmin ? <><UserMinus className="mr-1 inline h-4 w-4" /> إزالة الأدمن</> : <><ShieldCheck className="mr-1 inline h-4 w-4" /> تعيين أدمن</>}
        </button>
      </div>
    </div>
  );

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col justify-between gap-4 rounded-3xl bg-white p-5 text-slate-950 shadow-xl sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-800"><Shield className="h-7 w-7" /></div>
            <div><h1 className="text-2xl font-black">لوحة المالك</h1><p className="text-sm text-slate-500">إدارة المستخدمين وصلاحيات الأدمن</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void load()} className="rounded-xl border border-slate-300 px-3 py-2 font-bold" aria-label="تحديث"><RefreshCw className="h-4 w-4" /></button>
            <button onClick={() => void signOut()} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 font-bold text-white"><LogOut className="h-4 w-4" /> تسجيل الخروج</button>
          </div>
        </header>

        {error && <div role="alert" className="rounded-2xl border border-red-800 bg-red-950 p-4 text-sm font-bold">{error}</div>}
        {notice && <div role="status" className="rounded-2xl border border-emerald-800 bg-emerald-950 p-4 text-sm font-bold">{notice}</div>}

        <section className="overflow-hidden rounded-3xl bg-white text-slate-950 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <h2 className="text-lg font-black">المستخدمون</h2><span className="text-sm text-slate-500">{users.length}</span>
          </div>
          {loading ? <p className="p-6 text-slate-500">جارٍ تحميل المستخدمين…</p> : users.length ? users.map(user => <UserRow key={user.id} user={user} isAdmin={false} />) : <p className="p-6 text-slate-500">لا يوجد مستخدمون لعرضهم.</p>}
        </section>

        <section className="overflow-hidden rounded-3xl bg-white text-slate-950 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <h2 className="text-lg font-black">الأدمن الحاليون</h2><span className="text-sm text-slate-500">{admins.length}</span>
          </div>
          {loading ? <p className="p-6 text-slate-500">جارٍ تحميل الأدمن…</p> : admins.length ? admins.map(user => <UserRow key={user.id} user={user} isAdmin />) : <p className="p-6 text-slate-500">لا يوجد أدمن معينون حاليًا.</p>}
        </section>
        <p className="px-2 text-xs text-slate-400"><CheckCircle2 className="ml-1 inline h-3 w-3" /> صلاحيات هذه الشاشة تُنفّذ من الخادم وتُرفض الطلبات غير الصادرة عن جلسة المالك.</p>
      </div>
    </main>
  );
}
