import React, { useEffect, useState } from 'react';
import PrayerTimes from './components/PrayerTimes';
import SearchAyah from './components/SearchAyah';
import TasmieGhaibi from './components/TasmieGhaibi';
import TasmieBattle from './components/TasmieBattle';
import Tasbeeh from './components/Tasbeeh';
import KhatmaTracker from './components/KhatmaTracker';
import TafsirPanel from './components/TafsirPanel';
import MyAdhanRecorder from './components/MyAdhanRecorder';
import DownloadManager from './components/DownloadManager';
import { saveOfflineAsset } from './offlineStore';

const tools = [
  { title: 'مواقيت الصلاة', description: 'مواقيت محلية مع عدّ تنازلي وتنبيهات', icon: '◷', Component: PrayerTimes },
  { title: 'البحث في الآيات', description: 'بحث مباشر في نص القرآن', icon: '⌕', Component: SearchAyah },
  { title: 'التسميع الغيبي', description: 'واجهة التسميع تُستكمل في Phase 3', icon: '♫', Component: TasmieGhaibi },
  { title: 'تحدي التسميع', description: 'واجهة التحدي تُستكمل في Phase 4', icon: '⚔', Component: TasmieBattle },
  { title: 'السبحة', description: 'عداد تسبيح محلي', icon: '◎', Component: Tasbeeh },
  { title: 'متابعة الختمة', description: 'حفظ التقدم على جهازك', icon: '▦', Component: KhatmaTracker },
  { title: 'التفسير', description: 'واجهة مبدئية — تُستكمل في Phase 4', icon: '☰', Component: TafsirPanel },
  { title: 'تسجيل الأذان', description: 'يتطلب إذن الميكروفون', icon: '◉', Component: MyAdhanRecorder },
  { title: 'إدارة التنزيلات', description: 'إدارة الموارد المحلية', icon: '↓', Component: DownloadManager },
];

export default function MuslimDashboard() {
  const [offlineStatus, setOfflineStatus] = useState('جارٍ تجهيز عينة المصحف المحلية…');
  const [activeTool, setActiveTool] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const prepareSample = async () => {
      try {
        const response = await fetch('/quran/1.json');
        if (!response.ok) throw new Error('تعذر تنزيل عينة سورة الفاتحة.');
        const sample = await response.json();
        await saveOfflineAsset('quran-surah-1-sample', sample);
        if (!cancelled) setOfflineStatus('تم حفظ عينة سورة الفاتحة على هذا الجهاز. المصحف الكامل غير متاح دون اتصال بعد.');
      } catch {
        if (!cancelled) setOfflineStatus('تعذر تجهيز العينة الآن. تأكد من الاتصال ثم أعد تحميل الصفحة.');
      }
    };
    void prepareSample();
    return () => { cancelled = true; };
  }, []);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <a href="/religious" className="text-sm text-amber-300 hover:underline">← اختيار القسم</a>
            <h1 className="mt-3 text-3xl font-bold">لوحة المسلم</h1>
            <p className="mt-2 text-slate-400">أدواتك الدينية في مكان واحد، مع تخزين محلي قدر الإمكان.</p>
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">Local-first</span>
        </header>
        <section aria-live="polite" className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
          <p className="font-semibold text-amber-200">حالة العمل دون إنترنت</p>
          <p className="mt-1 text-sm leading-7 text-slate-300">{offlineStatus}</p>
        </section>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <button key={tool.title} onClick={() => setActiveTool(activeTool === tool.title ? null : tool.title)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-right hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-amber-300">
              <span className="text-2xl text-amber-300" aria-hidden="true">{tool.icon}</span>
              <h2 className="mt-3 font-semibold">{tool.title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">{tool.description}</p>
            </button>
          ))}
        </div>
        {tools.map(({ title, Component }) => activeTool === title ? (
          <section key={title} className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold">{title}</h2>
              <button onClick={() => setActiveTool(null)} className="rounded-lg px-3 py-1 text-sm text-slate-300 hover:bg-white/10">إغلاق</button>
            </div>
            <Component />
          </section>
        ) : null)}
      </div>
    </main>
  );
}
