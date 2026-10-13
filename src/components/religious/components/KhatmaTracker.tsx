import React, { useEffect, useMemo, useState } from 'react';

const KEY = 'smart-time-khatma-surahs';
const ACTIVITY_KEY = 'smart-time-khatma-activity';
const names = [
  'الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال','التوبة','يونس',
  'هود','يوسف','الرعد','إبراهيم','الحجر','النحل','الإسراء','الكهف','مريم','طه',
  'الأنبياء','الحج','المؤمنون','النور','الفرقان','الشعراء','النمل','القصص','العنكبوت','الروم',
  'لقمان','السجدة','الأحزاب','سبأ','فاطر','يس','الصافات','ص','الزمر','غافر',
  'فصلت','الشورى','الزخرف','الدخان','الجاثية','الأحقاف','محمد','الفتح','الحجرات','ق',
  'الذاريات','الطور','النجم','القمر','الرحمن','الواقعة','الحديد','المجادلة','الحشر','الممتحنة',
  'الصف','الجمعة','المنافقون','التغابن','الطلاق','التحريم','الملك','القلم','الحاقة','المعارج',
  'نوح','الجن','المزمل','المدثر','القيامة','الإنسان','المرسلات','النبأ','النازعات','عبس',
  'التكوير','الانفطار','المطففين','الانشقاق','البروج','الطارق','الأعلى','الغاشية','الفجر','البلد',
  'الشمس','الليل','الضحى','الشرح','التين','العلق','القدر','البينة','الزلزلة','العاديات',
  'القارعة','التكاثر','العصر','الهمزة','الفيل','قريش','الماعون','الكوثر','الكافرون','النصر',
  'المسد','الإخلاص','الفلق','الناس'
];

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const readArray = (key: string): unknown[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]') as unknown;
    return Array.isArray(value) ? value : [];
  } catch { return []; }
};
const getStreak = (days: string[]) => {
  const set = new Set(days);
  const cursor = new Date();
  if (!set.has(todayKey())) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`)) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

export default function KhatmaTracker() {
  const [done, setDone] = useState<number[]>(() => readArray(KEY).filter((n): n is number => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 114) as number[]);
  const [activity, setActivity] = useState<string[]>(() => readArray(ACTIVITY_KEY).filter((day): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)));
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch { /* التخزين المحلي اختياري */ } }, [done]);
  useEffect(() => { try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity)); } catch { /* التخزين المحلي اختياري */ } }, [activity]);
  const percent = Math.round((done.length / 114) * 100);
  const streak = useMemo(() => getStreak(activity), [activity]);

  const toggleSurah = (number: number, checked: boolean) => {
    setDone((current) => checked ? Array.from(new Set([...current, number])).sort((a, b) => a - b) : current.filter((n) => n !== number));
    if (checked) setActivity((current) => Array.from(new Set([...current, todayKey()])).sort());
  };

  return (
    <section dir="rtl">
      <h3 className="text-lg font-semibold">متابعة الختمة</h3>
      <p className="mt-2 text-sm text-slate-400">علّم كل سورة بعد إتمامها. تقدمك وسجل أيام القراءة محفوظان على هذا الجهاز.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3"><p className="text-xs text-slate-400">نسبة الختمة</p><p className="mt-1 text-2xl font-bold text-emerald-200">{percent}%</p><p className="text-xs text-slate-400">{done.length} من 114 سورة</p></div>
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3"><p className="text-xs text-slate-400">سلسلة القراءة</p><p className="mt-1 text-2xl font-bold text-amber-200">🔥 {streak} {streak === 1 ? 'يوم' : 'أيام'}</p><p className="text-xs text-slate-400">أيام متتالية سجّلت فيها إتمام سورة</p></div>
        <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-400">آخر نشاط</p><p className="mt-1 text-lg font-semibold">{activity.length ? activity[activity.length - 1] : 'لم يُسجّل بعد'}</p><p className="text-xs text-slate-400">يتحدث عند تحديد سورة مكتملة</p></div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: percent + '%' }} /></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {names.map((name, index) => <label key={name} className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${done.includes(index + 1) ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100' : 'border-white/10'}`}><input type="checkbox" checked={done.includes(index + 1)} onChange={(event) => toggleSurah(index + 1, event.target.checked)} />{name}</label>)}
      </div>
    </section>
  );
}
