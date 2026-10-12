import React, { useState } from 'react';

export default function SearchAyah() {
  const [query, setQuery] = useState('');
  return <section dir="rtl"><h3 className="text-lg font-semibold">البحث في الآيات</h3><label className="mt-3 block text-sm text-slate-300" htmlFor="ayah-search">كلمة أو عبارة</label><input id="ayah-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="اكتب عبارة للبحث" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-slate-100 outline-none focus:border-amber-300" /><p className="mt-2 text-sm text-slate-400">{query.trim() ? 'واجهة البحث جاهزة؛ سيتم توصيل مصدر البحث في Phase 2.' : 'اكتب كلمة للبدء.'}</p></section>;
}
