import React, { useEffect, useState } from 'react';
import { Wallet, Send, Clock, CheckCircle2, XCircle, History, ShieldCheck } from 'lucide-react';
import { WalletService, WalletInfo, TopupRequest, WalletTransaction } from '../services/walletService';

const methodLabel: Record<string, string> = {
  vodafone_cash: 'فودافون كاش',
  instapay: 'إنستاباي',
  etisalat_cash: 'اتصالات كاش',
  other: 'وسيلة أخرى',
};

export default function WalletView({ onOpenAdmin }: { onOpenAdmin?: () => void }) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('vodafone_cash');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    try {
      setLoadError('');
      const [w, r, tx] = await Promise.all([
        WalletService.getMyWallet(),
        WalletService.getMyTopupRequests(),
        WalletService.getMyTransactions(),
      ]);
      setWallet(w);
      setRequests(r.requests || []);
      setTransactions(tx.transactions || []);
    } catch (e: any) {
      setLoadError(e?.message || 'تعذر تحميل المحفظة');
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    const amt = Number(amount);
    const min = wallet?.topupMin ?? 5;
    const max = wallet?.topupMax ?? 10000;
    if (!Number.isFinite(amt) || amt < min || amt > max) {
      setMessage(`أدخل مبلغًا من ${min} إلى ${max} ج.م`);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      await WalletService.requestTopup(amt, method, note.trim());
      setMessage('تم إرسال طلب الشحن للمراجعة. الرصيد لن يتغير إلا بعد موافقة صاحب البرنامج.');
      setAmount('');
      setNote('');
      await load();
    } catch (e: any) {
      setMessage(e.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = (s: string) => {
    if (s === 'approved') return { text: 'تمت الموافقة', color: '#16a34a', icon: CheckCircle2 };
    if (s === 'rejected') return { text: 'مرفوض', color: '#dc2626', icon: XCircle };
    return { text: 'قيد المراجعة', color: '#d97706', icon: Clock };
  };

  const paymentTarget = method === 'instapay' && wallet?.instapayAddress
    ? wallet.instapayAddress
    : wallet?.walletNumber;

  return (
    <div dir="rtl" className="max-w-xl mx-auto p-4 space-y-4">
      <div className="rounded-3xl p-5 text-white shadow-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center gap-3">
        <Wallet size={34} />
        <div className="flex-1">
          <div className="text-xs opacity-85">رصيدك الحالي</div>
          <div className="text-3xl font-extrabold">{wallet ? wallet.balance.toFixed(2) : '...'} ج.م</div>
          {wallet && <div className="text-xs opacity-85 mt-1">تكلفة المقارنة الواحدة: {wallet.tripCost.toFixed(2)} ج.م</div>}
        </div>
        <ShieldCheck size={24} className="opacity-90" />
      </div>

      {loadError && <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 p-3 text-sm">{loadError}</div>}

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
        <h3 className="font-bold mb-2">اشحن رصيدك</h3>
        <p className="text-xs text-slate-500 mb-3">
          حوّل المبلغ أولاً، ثم أرسل طلب الشحن. لن تتم إضافة أي رصيد إلا بعد مراجعة التحويل والموافقة عليه.
        </p>

        {paymentTarget ? (
          <div className="rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900 p-3 mb-3 text-sm">
            التحويل إلى: <strong dir="ltr">{paymentTarget}</strong>
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 p-3 mb-3 text-xs">
            رقم التحويل لم يتم ضبطه بعد من إعدادات السيرفر. اضبط OWNER_WALLET_NUMBER أو OWNER_INSTAPAY_ADDRESS في Railway.
          </div>
        )}

        <input type="number" min={wallet?.topupMin ?? 5} max={wallet?.topupMax ?? 10000} step="1"
          placeholder="المبلغ المحوّل (ج.م)" value={amount} onChange={(e) => setAmount(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent mb-2 text-right" />

        <select value={method} onChange={(e) => setMethod(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent mb-2 text-right">
          <option value="vodafone_cash">فودافون كاش</option>
          <option value="instapay">إنستاباي</option>
          <option value="etisalat_cash">اتصالات كاش</option>
          <option value="other">وسيلة أخرى</option>
        </select>

        <input type="text" maxLength={120} placeholder="رقم العملية أو آخر 4 أرقام من رقم التحويل (مستحسن)"
          value={note} onChange={(e) => setNote(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent mb-3 text-right" />

        <button onClick={handleSubmit} disabled={loading || !paymentTarget}
          className="w-full p-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2">
          <Send size={16} /> {loading ? 'جاري الإرسال...' : 'إرسال طلب الشحن'}
        </button>
        {message && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{message}</p>}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
        <h3 className="font-bold mb-3">طلبات الشحن</h3>
        {requests.length === 0 && <p className="text-xs text-slate-500">لا توجد طلبات حتى الآن</p>}
        {requests.slice(0, 10).map((r) => {
          const s = statusLabel(r.status); const Icon = s.icon;
          return <div key={r.id} className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <div><div className="font-bold">{Number(r.amount).toFixed(2)} ج.م</div><div className="text-xs text-slate-500">{methodLabel[r.method] || r.method}</div></div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: s.color }}><Icon size={15}/>{s.text}</div>
          </div>;
        })}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
        <h3 className="font-bold mb-3 flex items-center gap-2"><History size={17}/> آخر حركات المحفظة</h3>
        {transactions.length === 0 && <p className="text-xs text-slate-500">لا توجد حركات حتى الآن</p>}
        {transactions.slice(0, 15).map((tx) => (
          <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <div><div className="text-sm font-semibold">{tx.type === 'topup' ? 'شحن رصيد' : tx.type === 'trip_search' ? 'مقارنة رحلة' : tx.type}</div><div className="text-[11px] text-slate-500">الرصيد بعد العملية: {Number(tx.balance_after).toFixed(2)} ج.م</div></div>
            <div className={`font-bold text-sm ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{tx.amount >= 0 ? '+' : ''}{Number(tx.amount).toFixed(2)} ج.م</div>
          </div>
        ))}
      </div>

      {wallet?.isOwner && onOpenAdmin && (
        <button onClick={onOpenAdmin} className="w-full text-center p-3 rounded-xl border border-cyan-200 text-cyan-700 dark:text-cyan-300 text-sm font-bold">
          لوحة تحكم صاحب البرنامج
        </button>
      )}
    </div>
  );
}
