import React, { useEffect, useState } from 'react';

const KEY = 'smart-time-khatma-surahs';
const names = ['الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال','التوبة','يونس','هود','يوسف'];
export default function KhatmaTracker() {
  const [done, setDone] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') as number[]; } catch { return []; } });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch { /* التخزين المحلي اختياري */ } }, [done]);
  const percent = Math.round((done.length / 114) * 100);
  return <section dir="rtl"><h3 className="text-lg font-semibold">متابعة الختمة</h3><p className="mt-2 text-sm text-slate-400">علّم السور التي أتممتها. القائمة الحالية تعرض أول 12 سورة كنموذج.</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: percent + '%' }} /></div><p className="mt-2 text-xs text-slate-400">المحدد: {done.length} من 114 · النسبة المحسوبة من إجمالي 114 سورة: {percent}%</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{names.map((name, index) => <label key={name} className="flex items-center gap-2 rounded-lg border border-white/10 p-3 text-sm"><input type="checkbox" checked={done.includes(index + 1)} onChange={(event) => setDone((current) => event.target.checked ? [...current, index + 1] : current.filter((n) => n !== index + 1))} />{name}</label>)}</div></section>;
}
