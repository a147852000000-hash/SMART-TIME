import React, { useEffect, useState } from 'react';

type Chapter = { id: number; name_arabic: string; verses_count: number };
type ChaptersResponse = { chapters?: Chapter[] };

export default function TasmieBattle() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [surah, setSurah] = useState('1');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('7');
  const [challengeUrl, setChallengeUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const selected = chapters.find((chapter) => chapter.id === Number(surah));

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const incomingSurah = Number(params.get('battleSurah'));
    const incomingFrom = Number(params.get('battleFrom'));
    const incomingTo = Number(params.get('battleTo'));
    if (Number.isInteger(incomingSurah) && incomingSurah > 0) setSurah(String(incomingSurah));
    if (Number.isInteger(incomingFrom) && incomingFrom > 0) setFrom(String(incomingFrom));
    if (Number.isInteger(incomingTo) && incomingTo > 0) setTo(String(incomingTo));
    fetch('https://api.quran.com/api/v4/chapters?language=ar')
      .then((response) => { if (!response.ok) throw new Error('تعذر تحميل السور'); return response.json() as Promise<ChaptersResponse>; })
      .then((data) => { if (active && Array.isArray(data.chapters)) setChapters(data.chapters); })
      .catch(() => { if (active) setNotice('تعذر تحميل قائمة السور. تحقق من اتصال الإنترنت ثم أعد المحاولة.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    setFrom((value) => String(Math.min(Math.max(Number(value) || 1, 1), selected.verses_count)));
    setTo((value) => String(Math.min(Math.max(Number(value) || selected.verses_count, Number(from) || 1), selected.verses_count)));
  }, [selected?.id, selected?.verses_count]);

  const createChallenge = () => {
    const first = Number(from);
    const last = Number(to);
    if (!selected || !Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > selected.verses_count) {
      setNotice(`اختر نطاقًا صحيحًا من 1 إلى ${selected?.verses_count ?? '—'}.`);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('battleSurah', String(selected.id));
    url.searchParams.set('battleFrom', String(first));
    url.searchParams.set('battleTo', String(last));
    setChallengeUrl(url.toString());
    setNotice('جهزنا رابط التحدي. شاركه مع صاحبك ليختار نفس نطاق الآيات.');
  };

  const shareChallenge = async () => {
    if (!challengeUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'تحدي التسميع', text: `تحدي تسميع: ${selected?.name_arabic ?? 'السورة المختارة'}، من الآية ${from} إلى ${to}`, url: challengeUrl });
        setNotice('تم فتح نافذة المشاركة.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(challengeUrl);
        setNotice('تم نسخ رابط التحدي.');
      } else {
        setNotice('انسخ الرابط من الحقل يدويًا لمشاركته.');
      }
    } catch {
      setNotice('لم تكتمل المشاركة. يمكنك نسخ الرابط يدويًا.');
    }
  };

  return (
    <section dir="rtl" className="space-y-4">
      <div><h3 className="text-lg font-semibold">تحدي التسميع</h3><p className="mt-1 text-sm leading-6 text-slate-400">أنشئ تحديًا بنطاق آيات محدد وشارك الرابط. الرابط يحدد النطاق فقط؛ لا يرفع تسجيلًا صوتيًا ولا يرسل نتائجك.</p></div>
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3">
        <label className="text-sm text-slate-300">السورة<select value={surah} disabled={loading || !chapters.length} onChange={(event) => { setSurah(event.target.value); setFrom('1'); setTo(''); setChallengeUrl(''); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-slate-100">{chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.id}. {chapter.name_arabic}</option>)}</select></label>
        <label className="text-sm text-slate-300">من الآية<input type="number" min={1} max={selected?.verses_count ?? 1} value={from} onChange={(event) => { setFrom(event.target.value); setChallengeUrl(''); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-slate-100" /></label>
        <label className="text-sm text-slate-300">إلى الآية<input type="number" min={1} max={selected?.verses_count ?? 1} value={to} onChange={(event) => { setTo(event.target.value); setChallengeUrl(''); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-slate-100" /></label>
        <p className="text-xs text-slate-500 sm:col-span-3">عدد آيات السورة: {selected?.verses_count ?? '—'}</p>
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={createChallenge} disabled={loading || !selected} className="rounded-xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">إنشاء رابط التحدي</button><button type="button" onClick={() => void shareChallenge()} disabled={!challengeUrl} className="rounded-xl border border-white/10 px-4 py-3 disabled:opacity-40">مشاركة / نسخ الرابط</button><button type="button" onClick={() => { const url = new URL(window.location.href); url.searchParams.set('tool', 'tasmi-battle'); url.searchParams.set('battleSurah', surah); url.searchParams.set('battleFrom', from); url.searchParams.set('battleTo', to); window.location.href = url.toString(); }} disabled={!challengeUrl} className="rounded-xl border border-white/10 px-4 py-3 disabled:opacity-40">فتح التحدي</button></div>
      {challengeUrl && <label className="block text-sm text-slate-300">رابط التحدي<input readOnly value={challengeUrl} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-left text-xs text-slate-200" dir="ltr" /></label>}
      {notice && <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-slate-300">{notice}</p>}
    </section>
  );
}
