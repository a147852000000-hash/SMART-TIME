import React from 'react';

export default function ChristianDashboard() {
  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
      <section className="mx-auto max-w-3xl">
        <a href="/religious" className="text-sm text-amber-300 hover:underline">← اختيار القسم</a>
        <h1 className="mt-4 text-3xl font-bold">القسم المسيحي</h1>
        <p className="mt-3 leading-8 text-slate-300">تم تجهيز الهيكل الأساسي. يمكن إضافة أقسام القراءة والصلاة والملاحظات في مراحل لاحقة.</p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="font-semibold text-amber-200">مساحة قيد التجهيز</h2>
          <p className="mt-2 text-sm leading-7 text-slate-400">هذه نسخة تأسيسية ولا تحتوي بعد على محتوى ديني أو مصادر نصية مضمّنة.</p>
        </div>
      </section>
    </main>
  );
}
