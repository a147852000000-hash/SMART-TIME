import React from 'react';
import { LogOut, LifeBuoy, MessageCircle } from 'lucide-react';
import { logout } from '../services/authService';

export default function AdminCenter({ onLogout }: { onLogout: () => void }) {
  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center justify-between gap-4 rounded-3xl bg-white p-5 text-slate-950">
          <div className="flex items-center gap-3">
            <LifeBuoy className="h-9 w-9 text-amber-700" />
            <div>
              <h1 className="text-2xl font-black">صلاحيات المسؤول Admin</h1>
              <p className="text-sm text-slate-500">دور دعم محدود فقط</p>
            </div>
          </div>
          <button onClick={() => { void logout(); onLogout(); }} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 font-bold text-white"><LogOut className="h-4 w-4" /> تسجيل الخروج</button>
        </header>
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-slate-300" />
            <h2 className="text-lg font-black">الدعم الفني</h2>
          </div>
          <p className="mt-3 leading-7 text-slate-300">لا توجد في هذه النسخة شاشة أو واجهة API مخصصة لرسائل دعم المسؤول. توجد غرفة دردشة عامة باسم الدعم الفني، لكنها ليست نظام تذاكر أو صندوق وارد خاصًا بالـ Admin. لم يتم إنشاء نظام دعم جديد ضمن هذا التعديل.</p>
          <p className="mt-3 text-sm text-slate-400">لا تتوفر من هذه الشاشة أدوات عرض الحسابات أو حذفها أو تغيير أدوارها.</p>
        </section>
      </div>
    </main>
  );
}
