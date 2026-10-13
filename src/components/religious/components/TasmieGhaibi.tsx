import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getOfflineAsset, saveOfflineAsset } from '../offlineStore';
import CorrectionPanel from './CorrectionPanel';

type Chapter = { id: number; name_arabic: string; name_simple?: string; verses_count: number };
type Verse = { verse_number?: number; text_uthmani?: string; text?: string };
type ChaptersResponse = { chapters?: Chapter[] };
type VersesResponse = { verses?: Verse[] };
type StoredQuran = { surah?: number; name?: string; ayahCount?: number; ayahs?: Array<{ number?: number; text?: string }>; verses?: Verse[] };
type SpeechAlternative = { transcript: string };
type SpeechResult = { 0: SpeechAlternative; isFinal: boolean; length: number };
type SpeechResultList = { [index: number]: SpeechResult; length: number };
type SpeechEvent = { results: SpeechResultList; resultIndex: number };
type SpeechErrorEvent = { error?: string; message?: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const normalize = (value: string) => value
  .replace(/[ًٌٍَُِّْـ]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي')
  .replace(/[،؛:!؟,.\u06D4]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const toWords = (value: string) => normalize(value).split(' ').filter(Boolean);
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export default function TasmieGhaibi() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [surahId, setSurahId] = useState('1');
  const [fromAyah, setFromAyah] = useState('1');
  const [toAyah, setToAyah] = useState('7');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [listening, setListening] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [heardWords, setHeardWords] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [correction, setCorrection] = useState<{ expected: string; heard: string } | null>(null);
  const [score, setScore] = useState<{ correct: number; total: number; percent: number } | null>(null);
  const [supported, setSupported] = useState(true);
  const expectedWordsRef = useRef<string[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mismatchHandledRef = useRef(false);
  const stoppingRef = useRef(false);

  const selectedChapter = chapters.find((chapter) => chapter.id === Number(surahId));
  const maxAyah = selectedChapter?.verses_count ?? 1;

  useEffect(() => {
    let active = true;
    const loadChapters = async () => {
      try {
        const response = await fetch('https://api.quran.com/api/v4/chapters?language=ar');
        if (!response.ok) throw new Error('تعذر تحميل قائمة السور.');
        const data = await response.json() as ChaptersResponse;
        if (active && Array.isArray(data.chapters) && data.chapters.length) {
          setChapters(data.chapters);
          const first = data.chapters.find((chapter) => chapter.id === 1);
          setToAyah(String(first?.verses_count ?? 7));
        } else if (active) {
          setNotice('قائمة السور غير متاحة الآن. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
        }
      } catch {
        if (active) setNotice('تعذر تحميل قائمة السور. يحتاج اختيار السورة لأول مرة إلى اتصال بالإنترنت.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadChapters();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const chapter = chapters.find((item) => item.id === Number(surahId));
    if (!chapter) return;
    setFromAyah('1');
    setToAyah(String(chapter.verses_count));
    setScore(null);
    setCorrection(null);
    setHeardWords([]);
  }, [surahId, chapters]);

  useEffect(() => {
    if (!listening) return;
    const id = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(id);
  }, [listening]);

  const stopRecognition = useCallback(() => {
    stoppingRef.current = true;
    try { recognitionRef.current?.stop(); } catch { /* قد يكون التعرف متوقفًا بالفعل */ }
    setListening(false);
  }, []);

  useEffect(() => () => {
    stoppingRef.current = true;
    try { recognitionRef.current?.abort(); } catch { /* لا شيء لتنظيفه */ }
  }, []);

  const loadHiddenWords = useCallback(async (chapterId: number, first: number, last: number) => {
    const key = `quran-surah-${chapterId}`;
    let verses: Array<{ number: number; text: string }> = [];
    try {
      const cached = await getOfflineAsset<StoredQuran>(key);
      if (cached?.ayahs?.length) {
        verses = cached.ayahs.map((ayah) => ({ number: Number(ayah.number ?? 0), text: ayah.text ?? '' }));
      } else if (cached?.verses?.length) {
        verses = cached.verses.map((verse) => ({ number: Number(verse.verse_number ?? 0), text: verse.text_uthmani ?? verse.text ?? '' }));
      } else {
        const sample = await getOfflineAsset<StoredQuran>('quran-surah-1-sample');
        if (chapterId === 1 && sample?.ayahs?.length) {
          verses = sample.ayahs.map((ayah) => ({ number: Number(ayah.number ?? 0), text: ayah.text ?? '' }));
        }
      }
    } catch {
      // إذا تعذر IndexedDB، نحاول تنزيل النص ثم نستخدمه في الذاكرة فقط.
    }

    if (!verses.length) {
      const response = await fetch(`https://api.quran.com/api/v4/verses/by_chapter/${chapterId}?fields=text_uthmani&per_page=300`);
      if (!response.ok) throw new Error('تعذر تحميل نص السورة. تحقق من اتصال الإنترنت.');
      const data = await response.json() as VersesResponse;
      if (!Array.isArray(data.verses) || !data.verses.length) throw new Error('لم يصل نص صالح للسورة المختارة.');
      verses = data.verses.map((verse) => ({ number: Number(verse.verse_number ?? 0), text: verse.text_uthmani ?? verse.text ?? '' }));
      try {
        await saveOfflineAsset(key, { surah: chapterId, verses: data.verses });
      } catch {
        // التخزين المحلي تحسين اختياري؛ لا نعرض النص القرآني على الشاشة.
      }
    }

    const selected = verses.filter((verse) => verse.number >= first && verse.number <= last).sort((a, b) => a.number - b.number);
    const hiddenText = selected.map((verse) => verse.text).filter(Boolean).join(' ');
    const words = toWords(hiddenText);
    if (!words.length) throw new Error('النص غير متاح للنطاق المحدد.');
    return words;
  }, []);

  const startRecitation = async () => {
    setNotice('');
    setCorrection(null);
    setScore(null);
    setHeardWords([]);
    setElapsed(0);
    mismatchHandledRef.current = false;
    stoppingRef.current = false;

    const chapterId = Number(surahId);
    const first = Number(fromAyah);
    const last = Number(toAyah);
    if (!chapterId || !Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > maxAyah) {
      setNotice(`اختر نطاق آيات صحيحًا من 1 إلى ${maxAyah}.`);
      return;
    }

    const SpeechRecognition = (window as WindowWithSpeech).SpeechRecognition || (window as WindowWithSpeech).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      setNotice('المتصفح لا يدعم التعرف العربي Offline، جرب Chrome على أندرويد. قد يحتاج التعرف إلى الإنترنت حتى في المتصفحات المدعومة.');
      return;
    }

    setStarting(true);
    try {
      // يُحفظ النص المتوقع في ref فقط؛ لا يُعرض للمستخدم أثناء التسميع.
      expectedWordsRef.current = await loadHiddenWords(chapterId, first, last);
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        if (mismatchHandledRef.current) return;
        let transcript = '';
        for (let index = 0; index < event.results.length; index += 1) {
          transcript += ` ${event.results[index][0]?.transcript ?? ''}`;
        }
        const spoken = toWords(transcript);
        setHeardWords(spoken);
        const expected = expectedWordsRef.current;
        for (let index = 0; index < spoken.length; index += 1) {
          if (normalize(spoken[index]) !== normalize(expected[index] ?? '')) {
            if (!expected[index]) continue;
            mismatchHandledRef.current = true;
            const expectedWord = expected[index];
            const heardWord = spoken[index];
            setCorrection({ expected: expectedWord, heard: heardWord });
            setNotice('تم إيقاف التسميع عند أول كلمة تحتاج إلى مراجعة.');
            setScore({ correct: index, total: expected.length, percent: Math.round((index / Math.max(expected.length, 1)) * 100) });
            try {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                void audioRef.current.play().catch(() => undefined);
              }
            } catch { /* الصوت اختياري */ }
            stopRecognition();
            return;
          }
        }
        if (spoken.length >= expected.length && expected.length > 0) {
          setScore({ correct: expected.length, total: expected.length, percent: 100 });
          setNotice('أحسنت! انتهيت من النطاق المحدد.');
          stopRecognition();
        }
      };
      recognition.onerror = (event) => {
        if (stoppingRef.current) return;
        const message = event.error === 'not-allowed'
          ? 'لم يتم السماح باستخدام الميكروفون. فعّل الإذن من إعدادات المتصفح.'
          : event.error === 'no-speech'
            ? 'لم نلتقط صوتًا واضحًا. جرّب التحدث بالقرب من الميكروفون.'
            : 'تعذر التعرف على الكلام. تأكد من إذن الميكروفون واتصال الإنترنت.';
        setNotice(message);
        setListening(false);
      };
      recognition.onend = () => {
        setListening(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'تعذر تجهيز النص للتسميع.');
      expectedWordsRef.current = [];
    } finally {
      setStarting(false);
    }
  };

  const finishRecitation = () => {
    stopRecognition();
    const expected = expectedWordsRef.current;
    const spoken = heardWords;
    let correct = 0;
    while (correct < spoken.length && correct < expected.length && normalize(spoken[correct]) === normalize(expected[correct])) correct += 1;
    setScore({ correct, total: expected.length, percent: Math.round((correct / Math.max(expected.length, 1)) * 100) });
    setNotice('تم إنهاء جلسة التسميع.');
  };

  return (
    <section dir="rtl" className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">التسميع الغيبي</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">اختر السورة ونطاق الآيات، ثم سمّع من حفظك. لن يظهر نص الآيات أثناء الجلسة.</p>
      </div>

      {!listening && <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3">
        <label className="block text-sm text-slate-300">
          السورة
          <select value={surahId} onChange={(event) => setSurahId(event.target.value)} disabled={loading || starting || !chapters.length} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-slate-100 outline-none focus:border-amber-300 disabled:opacity-50">
            {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.id}. {chapter.name_arabic || chapter.name_simple}</option>)}
          </select>
        </label>
        <label className="block text-sm text-slate-300">
          من الآية
          <input type="number" min={1} max={maxAyah} value={fromAyah} onChange={(event) => setFromAyah(event.target.value)} disabled={starting} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-slate-100 outline-none focus:border-amber-300" />
        </label>
        <label className="block text-sm text-slate-300">
          إلى الآية
          <input type="number" min={1} max={maxAyah} value={toAyah} onChange={(event) => setToAyah(event.target.value)} disabled={starting} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-slate-100 outline-none focus:border-amber-300" />
        </label>
        <p className="text-xs leading-6 text-slate-500 sm:col-span-3">النطاق المتاح: {maxAyah} آية في السورة المختارة. يحتاج تحميل السورة لأول مرة إلى الإنترنت؛ تُحفظ محليًا بعد ذلك إذا سمح المتصفح.</p>
      </div>}

      {listening && <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-6 text-center" aria-live="polite">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-2xl text-emerald-200" aria-hidden="true">🎙️</div>
        <p className="mt-3 text-lg font-semibold text-emerald-100">بسمعك...</p>
        <p className="mt-1 font-mono text-xl tabular-nums text-slate-200">{formatTime(elapsed)}</p>
      </div>}

      {heardWords.length > 0 && <div className="rounded-2xl border border-white/10 bg-white p-4 text-right" aria-live="polite">
        <p className="mb-3 text-xs font-semibold text-slate-500">الكلمات التي التقطها الميكروفون</p>
        <p className="text-lg leading-10">
          {heardWords.map((word, index) => {
            const expected = expectedWordsRef.current[index];
            const isCorrect = Boolean(expected) && normalize(word) === normalize(expected);
            const isWrong = Boolean(expected) && !isCorrect;
            return <React.Fragment key={`${index}-${word}`}><span className={isWrong ? 'text-rose-600 underline decoration-rose-300 decoration-2 underline-offset-4' : 'text-black'}>{word}</span>{' '}</React.Fragment>;
          })}
        </p>
      </div>}

      {notice && <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-slate-300">{notice}</p>}

      {correction && <CorrectionPanel expected={correction.expected} heard={correction.heard} onDismiss={() => setCorrection(null)} />}

      {score && <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4" aria-live="polite">
        <h4 className="font-semibold text-amber-200">نتيجة التسميع</h4>
        <p className="mt-2 text-sm text-slate-200">الكلمات الصحيحة المتتالية: {score.correct} من {score.total}</p>
        <p className="mt-1 text-2xl font-bold text-amber-100">{score.percent}%</p>
      </div>}

      <div className="flex flex-wrap gap-2">
        {!listening ? <button type="button" onClick={() => void startRecitation()} disabled={loading || starting || !chapters.length} className="rounded-xl bg-amber-300 px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{starting ? 'جارٍ تجهيز التسميع…' : score ? 'إعادة التسميع' : 'ابدأ التسميع'}</button>
          : <button type="button" onClick={finishRecitation} className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-5 py-3 font-semibold text-rose-100">إنهاء التسميع</button>}
        {!supported && <span className="self-center text-xs text-slate-400">التعرف على الكلام غير مدعوم هنا.</span>}
      </div>
      <audio ref={audioRef} src="/sounds/error.mp3" preload="auto" />
    </section>
  );
}
