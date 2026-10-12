import React, { useEffect, useState } from 'react';

const KEY = 'smart-time-tasbeeh-count';
export default function Tasbeeh() {
  const [count, setCount] = useState(() => { try { return Number(localStorage.getItem(KEY) || 0); } catch { return 0; } });
  useEffect(() => { try { localStorage.setItem(KEY, String(count)); } catch { /* التخزين المحلي اختياري */ } }, [count]);
  return <section dir="rtl"><h3 className="text-lg font-semibold">السبحة الإلكترونية</h3><div className="mt-4 flex items-center gap-4"><span aria-live="polite" className="text-3xl font-bold text-amber-200">{count}</span><button onClick={() => setCount((value) => value + 1)} className="rounded-xl bg-amber-300 px-5 py-3 font-semibold text-slate-950">سبّح +1</button><button onClick={() => setCount(0)} className="rounded-xl border border-white/10 px-4 py-3 text-sm">تصفير</button></div><p className="mt-3 text-xs text-slate-400">يُحفظ العدد على هذا الجهاز فقط.</p></section>;
}
