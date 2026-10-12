import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, LogOut, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { apiUrl } from '../services/apiConfig';
import { authHeaders, logout } from '../services/authService';

type OwnerAccount = {
  id: string;
  displayName: string | null;
  email: string;
  role: 'owner' | 'admin' | 'user' | string;
};

type AccountPage = {
  users: OwnerAccount[];
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

const PAGE_SIZE = 25;

export default function OwnerAdminPanel({ onLogout }: { onLogout: () => void }) {
  const [accounts, setAccounts] = useState<OwnerAccount[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
        if (search) params.set('search', search);
        const response = await fetch(apiUrl('/api/auth/owner/accounts?' + params.toString()), { headers: authHeaders() });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'تعذر تحميل الحسابات');
        const page = data as AccountPage;
        if (!cancelled) {
          setAccounts(Array.isArray(page.users) ? page.users : []);
          setTotal(Number(page.total || 0));
          setHasMore(Boolean(page.hasMore));
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'تعذر تحميل الحسابات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [offset, search, reloadVersion]);

  const applySearch = (event: React.FormEvent) => {
    event.preventDefault();
    setOffset(0);
    setSearch(query.trim());
  };

  const updateRole = async (account: OwnerAccount) => {
    if (account.role === 'owner') return;
    const action = account.role === 'admin' ? 'revoke' : 'appoint';
    const prompt = action === 'appoint'
      ? 'تعيين هذا الحساب كمسؤول Admin؟'
      : 'سحب صلاحية Admin من هذا الحساب؟';
    if (!window.confirm(prompt)) return;
    setBusyId(account.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(apiUrl('/api/auth/owner/admin-role'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'تعذر تغيير الصلاحية');
      setNotice(action === 'appoint' ? 'تم تعيين المسؤول بنجاح.' : 'تم سحب صلاحية المسؤول.');
      setReloadVersion(value => value + 1);
    } catch (e: any) {
      setError(e.message || 'تعذر تغيير الصلاحية');
    } finally {
      setBusyId('');
    }
  };

  const deleteAccount = async (account: OwnerAccount) => {
    if (account.role === 'owner') return;
    if (!window.confirm('سيتم حذف الحساب وبياناته المرتبطة من قاعدة الاختبار. لا يمكن التراجع عن العملية. متابعة؟')) return;
    setBusyId(account.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(apiUrl('/api/auth/owner/accounts/' + encodeURIComponent(account.id)), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'تعذر حذف الحساب');
      setNotice('تم حذف الحساب.');
      if (accounts.length === 1 && offset > 0) setOffset(Math.max(0, offset - PAGE_SIZE));
      setReloadVersion(value => value + 1);
    } catch (e: any) {
      setError(e.message || 'تعذر حذف الحساب');
    } finally {
      setBusyId('');
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5 text-slate-950 shadow-2xl">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-9 w-9 text-amber-700" />
            <div>
              <h1 className="text-2xl font-black">إدارة حسابات SMART-TIME</h1>
              <p className="text-sm text-slate-500">لوحة المالك المعتمد فقط</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setReloadVersion(value => value + 1)} disabled={loading} className="rounded-xl border px-3 py-2 font-bold disabled:opacity-50" aria-label="تحديث الحسابات"><RefreshCw className="h-4 w-4" /></button>
            <button onClick={() => { void logout(); onLogout(); }} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 font-bold text-white"><LogOut className="h-4 w-4" /> تسجيل الخروج</button>
          </div>
        </header>

        <section className="rounded-3xl bg-white p-5 text-slate-950">
          <form onSubmit={applySearch} className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-300 px-3 py-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث بالبريد الإلكتروني أو الاسم" className="w-full bg-transparent outline-none" maxLength={200} />
            </label>
            <button type="submit" className="rounded-xl bg-slate-950 px-5 py-2 font-bold text-white">بحث</button>
            <button type="button" onClick={() => { setQuery(''); setSearch(''); setOffset(0); }} className="rounded-xl border px-5 py-2 font-bold">مسح البحث</button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>إجمالي النتائج: <strong className="text-slate-950">{total}</strong></span>
            <span>عرض {total === 0 ? 0 : offset + 1}–{Math.min(offset + accounts.length, total)} من {total}</span>
          </div>
        </section>

        {error && <div role="alert" className="rounded-2xl border border-red-800 bg-red-950 p-4 font-bold">{error}</div>}
        {notice && <div role="status" className="rounded-2xl border border-emerald-800 bg-emerald-950 p-4 font-bold">{notice}</div>}

        <section className="overflow-hidden rounded-3xl bg-white text-slate-950">
          <div className="border-b p-5 text-lg font-black">الحسابات المسجلة</div>
          {loading ? <div className="p-6 font-bold">جارٍ تحميل الحسابات…</div>
            : accounts.length === 0 ? <div className="p-6 text-slate-500">لا توجد حسابات مطابقة.</div>
              : <div className="divide-y divide-slate-200">
                {accounts.map(account => (
                  <article key={account.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <div className="break-words font-black">{account.displayName || 'بدون اسم'}</div>
                      <div className="break-all text-sm text-slate-500">{account.email}</div>
                      <div className="mt-1 text-xs font-bold text-slate-600">الدور: {account.role}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button disabled={account.role === 'owner' || busyId === account.id} onClick={() => void updateRole(account)} className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">
                        <ShieldCheck className="h-4 w-4" /> {account.role === 'admin' ? 'سحب Admin' : 'تعيين Admin'}
                      </button>
                      <button disabled={account.role === 'owner' || busyId === account.id} onClick={() => void deleteAccount(account)} className="flex items-center gap-2 rounded-xl bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                        <Trash2 className="h-4 w-4" /> حذف الحساب
                      </button>
                    </div>
                  </article>
                ))}
              </div>}
          <footer className="flex items-center justify-between gap-3 border-t p-4">
            <button disabled={offset === 0 || loading} onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))} className="flex items-center gap-2 rounded-xl border px-4 py-2 font-bold disabled:opacity-40"><ChevronRight className="h-4 w-4" /> السابق</button>
            <span className="text-sm text-slate-600">صفحة {Math.floor(offset / PAGE_SIZE) + 1}</span>
            <button disabled={!hasMore || loading} onClick={() => setOffset(value => value + PAGE_SIZE)} className="flex items-center gap-2 rounded-xl border px-4 py-2 font-bold disabled:opacity-40">التالي <ChevronLeft className="h-4 w-4" /></button>
          </footer>
        </section>
        <p className="text-xs text-slate-400">إدارة الحسابات وتغيير الأدوار تتم على الخادم؛ إخفاء الأزرار ليس وسيلة الحماية الوحيدة.</p>
      </div>
    </main>
  );
}
