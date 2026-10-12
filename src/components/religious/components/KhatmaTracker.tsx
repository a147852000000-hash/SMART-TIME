import React, { useEffect, useState } from 'react';

const KEY = 'smart-time-khatma-surahs';
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

export default function KhatmaTracker() {
  const [done, setDone] = useState<number[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown;
      return Array.isArray(saved) ? saved.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 114) : [];
    } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch { /* التخزين المحلي اختياري */ } }, [done]);
  const percent = Math.round((done.length / 114) * 100);
  return (
    <section dir="rtl">
      <h3 className="text-lg font-semibold">متابعة الختمة</h3>
      <p className="mt-2 text-sm text-slate-400">علّم كل سورة بعد إتمامها. تقدمك محفوظ على هذا الجهاز.</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: percent + '%' }} /></div>
      <p className="mt-2 text-xs text-slate-400">المكتمل: {done.length} من 114 سورة · {percent}%</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {names.map((name, index) => <label key={name} className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${done.includes(index + 1) ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100' : 'border-white/10'}`}><input type="checkbox" checked={done.includes(index + 1)} onChange={(event) => setDone((current) => event.target.checked ? Array.from(new Set([...current, index + 1])).sort((a, b) => a - b) : current.filter((n) => n !== index + 1))} />{name}</label>)}
      </div>
    </section>
  );
}
