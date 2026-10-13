import React from 'react';
import ReligiousPwaSetup from './ReligiousPwaSetup';

type Props = { onNavigate?: (path: string) => void };

const choices = [
  { id: 'muslim', title: 'القسم الإسلامي', subtitle: 'القرآن والعبادات والأذكار', icon: '☾', path: '/religious/muslim' },
  { id: 'christian', title: 'القسم المسيحي', subtitle: 'مساحة منظمة للمحتوى المسيحي', icon: '✝', path: '/religious/christian' },
];

export default function ReligiousChoice({ onNavigate }: Props) {
  const go = (path: string, id: string) => {
    try { localStorage.setItem('smart-time-religious-choice', id); } catch { /* التخزين اختياري */ }
    if (onNavigate) onNavigate(path);
    else window.location.assign(path);
  };

  return (
    <>
      <ReligiousPwaSetup />
    <main dir="rtl" className="religious-shell min-h-screen bg-slate-950 text-slate-100 px-5 py-12">
      <section className="mx-auto max-w-3xl">
        <p className="text-sm tracking-wide text-amber-300">SMART-TIME · RELIGIOUS</p>
        <h1 className="mt-3 text-3xl font-bold md:text-4xl">مساحتك الروحانية</h1>
        <p className="mt-3 max-w-xl leading-8 text-slate-300">اختر القسم المناسب لك. اختيارك يُحفظ محليًا على هذا الجهاز ويمكن تغييره لاحقًا.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {choices.map((choice) => (
            <button key={choice.id} onClick={() => go(choice.path, choice.id)} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-right transition hover:border-amber-300/50 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-amber-300">
              <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-300/10 text-3xl text-amber-300">{choice.icon}</span>
              <h2 className="mt-5 text-xl font-semibold">{choice.title}</h2>
              <p className="mt-2 leading-7 text-slate-400">{choice.subtitle}</p>
              <span className="mt-6 inline-block text-sm font-semibold text-amber-300">الدخول ←</span>
            </button>
          ))}
        </div>
      </section>
    </main>
    </>
  );
}
