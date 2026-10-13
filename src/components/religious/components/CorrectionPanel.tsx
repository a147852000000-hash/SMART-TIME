import React from 'react';
import TafsirPanel from './TafsirPanel';

type Props = { expected?: string; heard?: string; onDismiss?: () => void; chapterId?: number; ayahNumber?: number };

export default function CorrectionPanel({ expected, heard, onDismiss, chapterId, ayahNumber }: Props) {
  return (
    <section dir="rtl" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4">
      <h3 className="font-semibold text-rose-200">مراجعة التصحيح</h3>
      {expected && <p className="mt-2 text-sm">الكلمة المتوقعة: <strong>{expected}</strong></p>}
      {heard && <p className="mt-1 text-sm text-slate-300">الكلمة المسموعة: {heard}</p>}
      {chapterId && ayahNumber && <TafsirPanel chapterId={chapterId} ayahNumber={ayahNumber} compact />}
      {onDismiss && <button type="button" onClick={onDismiss} className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-sm">إغلاق المراجعة</button>}
    </section>
  );
}
