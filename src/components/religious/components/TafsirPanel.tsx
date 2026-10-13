import React, { useEffect, useState } from 'react';

type Props = { chapterId?: number; ayahNumber?: number; compact?: boolean };
type TafsirItem = { id: number; name?: string; author_name?: string; language_name?: string };
type TafsirsResponse = { tafsirs?: TafsirItem[] };
type TafsirContent = { text?: string; resource_name?: string };
type TafsirResponse = { tafsir?: TafsirContent };

export default function TafsirPanel({ chapterId: initialChapter = 1, ayahNumber: initialAyah = 1, compact = false }: Props) {
  const [chapterId, setChapterId] = useState(String(initialChapter));
  const [ayahNumber, setAyahNumber] = useState(String(initialAyah));
  const [tafsirs, setTafsirs] = useState<TafsirItem[]>([]);
  const [tafsirId, setTafsirId] = useState('');
  const [content, setContent] = useState('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { setChapterId(String(initialChapter)); setAyahNumber(String(initialAyah)); }, [initialChapter, initialAyah]);

  useEffect(() => {
    let active = true;
    fetch('https://api.quran.com/api/v4/tafsirs?language=ar')
      .then((response) => { if (!response.ok) throw new Error('تعذر تحميل قائمة التفاسير.'); return response.json() as Promise<TafsirsResponse>; })
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data.tafsirs) ? data.tafsirs.filter((item) => Number.isInteger(item.id)) : [];
        setTafsirs(list);
        const preferred = list.find((item) => /الميسر|muyassar/i.test(`${item.name ?? ''} ${item.author_name ?? ''}`)) ?? list[0];
        if (preferred) setTafsirId(String(preferred.id));
        else setError('لم تتوفر قائمة تفسير باللغة العربية من المصدر.');
      })
      .catch(() => { if (active) setError('تعذر تحميل قائمة التفاسير. تحقق من اتصال الإنترنت.'); })
      .finally(() => { if (active) setLoadingList(false); });
    return () => { active = false; };
  }, []);

  const loadTafsir = async () => {
    const chapter = Number(chapterId);
    const ayah = Number(ayahNumber);
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 114 || !Number.isInteger(ayah) || ayah < 1 || !tafsirId) {
      setError('أدخل رقم سورة من 1 إلى 114 ورقم آية صحيحًا.');
      return;
    }
    setLoading(true); setError(''); setContent(''); setSource('');
    try {
      const response = await fetch(`https://api.quran.com/api/v4/tafsirs/${encodeURIComponent(tafsirId)}/by_ayah/${chapter}:${ayah}`);
      if (!response.ok) throw new Error('لم يتوفر تفسير لهذه الآية من المصدر.');
      const data = await response.json() as TafsirResponse;
      const text = data.tafsir?.text?.trim();
      if (!text) throw new Error('المصدر لم يُرجع نص تفسير لهذه الآية.');
      setContent(text.replace(/<\/?[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      setSource(data.tafsir?.resource_name ?? tafsirs.find((item) => String(item.id) === tafsirId)?.name ?? 'Quran.com');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر جلب التفسير الآن.');
    } finally { setLoading(false); }
  };

  return (
    <section dir="rtl" className={compact ? 'mt-4 rounded-xl border border-white/10 p-3' : 'space-y-4'}>
      <div><h3 className="text-lg font-semibold">{compact ? 'تفسير للمراجعة' : 'التفسير'}</h3>{!compact && <p className="mt-1 text-sm leading-6 text-slate-400">اختر السورة والآية لعرض تفسيرها من واجهة Quran.com.</p>}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-slate-300">رقم السورة<input type="number" min={1} max={114} value={chapterId} onChange={(event) => setChapterId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-slate-100" /></label>
        <label className="text-sm text-slate-300">رقم الآية<input type="number" min={1} value={ayahNumber} onChange={(event) => setAyahNumber(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-slate-100" /></label>
        <label className="text-sm text-slate-300">مصدر التفسير<select value={tafsirId} onChange={(event) => setTafsirId(event.target.value)} disabled={loadingList || !tafsirs.length} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-slate-100">{tafsirs.map((item) => <option key={item.id} value={item.id}>{item.name ?? item.author_name ?? `تفسير ${item.id}`}</option>)}</select></label>
      </div>
      <button type="button" onClick={() => void loadTafsir()} disabled={loading || loadingList || !tafsirId} className="rounded-xl bg-amber-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">{loading ? 'جارٍ تحميل التفسير…' : 'عرض التفسير'}</button>
      {error && <p role="status" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.06] p-3 text-sm text-rose-100">{error}</p>}
      {content && <article className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4"><p className="mb-2 text-xs text-emerald-200">المصدر: {source}</p><p className="text-sm leading-8 text-slate-100">{content}</p><p className="mt-3 text-xs text-slate-500">للمطالعة والفهم؛ ارجع إلى أهل العلم عند الحاجة إلى حكم شرعي.</p></article>}
    </section>
  );
}
