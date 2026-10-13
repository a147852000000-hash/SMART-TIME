import React, { useEffect, useRef, useState } from 'react';

type SearchResult = {
  verse_key?: string;
  verse_id?: number;
  text?: string;
  highlighted?: string;
  surah?: { name?: string; name_simple?: string; id?: number };
  verse_number?: number;
  [key: string]: unknown;
};
type SearchResponse = { search?: { query?: string; total_results?: number; results?: SearchResult[] } };

export default function SearchAyah() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const search = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) { setError('اكتب كلمة أو عبارة للبحث أولًا.'); return; }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError('');
    setSubmittedQuery(term);
    try {
      const url = new URL('https://api.quran.com/api/v4/search');
      url.searchParams.set('q', term);
      url.searchParams.set('size', '20');
      url.searchParams.set('language', 'ar');
      const response = await fetch(url.toString(), { signal: controller.signal });
      if (!response.ok) throw new Error('خدمة البحث غير متاحة الآن.');
      const data = await response.json() as SearchResponse;
      const found = Array.isArray(data.search?.results) ? data.search.results : [];
      setResults(found);
      setTotal(Number(data.search?.total_results ?? found.length));
      if (!found.length) setError('لم نعثر على نتائج مطابقة. جرّب كلمة أخرى.');
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return;
      setResults([]);
      setTotal(0);
      setError(cause instanceof Error ? cause.message : 'تعذر إتمام البحث. تحقق من اتصال الإنترنت.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const textOf = (result: SearchResult) => {
    const raw = result.text ?? result.highlighted ?? '';
    return raw.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  };

  return (
    <section dir="rtl" className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">البحث في الآيات</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">ابحث عن كلمة أو عبارة في نص القرآن. يحتاج البحث إلى اتصال بالإنترنت.</p>
      </div>
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="ayah-search">كلمة أو عبارة</label>
        <input id="ayah-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: الصابرين" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-slate-100 outline-none focus:border-amber-300" />
        <button type="submit" disabled={loading} className="rounded-xl bg-amber-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{loading ? 'جارٍ البحث…' : 'بحث'}</button>
      </form>
      {error && <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-slate-300">{error}</p>}
      {!loading && results.length > 0 && <p className="text-sm text-slate-400">نتائج البحث عن «{submittedQuery}» — {total} نتيجة إجمالًا، مع عرض {results.length}.</p>}
      <div className="space-y-3">
        {results.map((result, index) => {
          const key = result.verse_key ?? `result-${index}`;
          const surah = result.surah?.name ?? result.surah?.name_simple ?? (result.verse_key ? `سورة ${result.verse_key.split(':')[0]}` : 'نتيجة البحث');
          const verse = result.verse_number ?? Number(result.verse_key?.split(':')[1]) || 0;
          return <article key={key} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-amber-200">{surah}</h4><span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-slate-300">الآية {verse || '—'}</span></div>
            <p className="mt-3 text-lg leading-9 text-slate-100">{textOf(result) || 'النص غير متاح في استجابة الخدمة.'}</p>
            {result.verse_key && <p className="mt-2 text-xs text-slate-500">مرجع الآية: {result.verse_key}</p>}
          </article>;
        })}
      </div>
    </section>
  );
}
