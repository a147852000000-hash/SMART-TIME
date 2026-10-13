import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Timings = Record<string, string>;
type ApiResponse = { code?: number; status?: string; data?: { timings?: Timings; date?: { readable?: string } } };
type Prayer = { key: string; label: string; time: string };

const PRAYERS: Prayer[] = [
  { key: 'Fajr', label: 'الفجر', time: '' },
  { key: 'Dhuhr', label: 'الظهر', time: '' },
  { key: 'Asr', label: 'العصر', time: '' },
  { key: 'Maghrib', label: 'المغرب', time: '' },
  { key: 'Isha', label: 'العشاء', time: '' },
];
const CAIRO = { latitude: 30.0444, longitude: 31.2357 };
const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const apiDate = (date: Date) => `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;

function timeToDate(time: string, base: Date): Date | null {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const result = new Date(base);
  result.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return result;
}
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}
function cleanTime(value?: string) {
  return value?.match(/\d{1,2}:\d{2}/)?.[0] ?? '--:--';
}

export default function PrayerTimes() {
  const [timings, setTimings] = useState<Timings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationLabel, setLocationLabel] = useState('القاهرة (الموقع الافتراضي)');
  const [coordinates, setCoordinates] = useState(CAIRO);
  const [now, setNow] = useState(() => new Date());
  const [notifications, setNotifications] = useState(false);
  const [adhanEnabled, setAdhanEnabled] = useState(false);
  const [audioError, setAudioError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const firedRef = useRef<string>('');

  const loadTimings = useCallback(async (coords: { latitude: number; longitude: number }, date = new Date()) => {
    setLoading(true);
    setError('');
    try {
      const url = `https://api.aladhan.com/v1/timings/${apiDate(date)}?latitude=${coords.latitude}&longitude=${coords.longitude}&method=5`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('خدمة المواقيت غير متاحة الآن.');
      const json = await response.json() as ApiResponse;
      if (json.code !== 200 || !json.data?.timings) throw new Error('لم تصل مواقيت صحيحة من الخدمة.');
      setTimings(json.data.timings);
      try { localStorage.setItem(`prayer_${dateKey(date)}`, JSON.stringify({ timings: json.data.timings, coordinates: coords, savedAt: new Date().toISOString() })); } catch { /* التخزين المحلي اختياري */ }
    } catch (cause) {
      let cached: { timings?: Timings } | null = null;
      try { cached = JSON.parse(localStorage.getItem(`prayer_${dateKey(date)}`) || 'null'); } catch { /* تجاهل البيانات التالفة */ }
      if (cached?.timings) {
        setTimings(cached.timings);
        setError('تعذر الاتصال بالخدمة؛ نعرض المواقيت المحفوظة لهذا اليوم.');
      } else {
        setError(cause instanceof Error ? cause.message : 'تعذر تحميل المواقيت. تحقق من اتصال الإنترنت.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const applyPosition = (position?: GeolocationPosition) => {
      if (cancelled) return;
      const coords = position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : CAIRO;
      setCoordinates(coords);
      setLocationLabel(position ? 'موقعك الحالي' : 'القاهرة (الموقع الافتراضي)');
      void loadTimings(coords);
    };
    if (!navigator.geolocation) applyPosition();
    else navigator.geolocation.getCurrentPosition(applyPosition, () => applyPosition(), { enableHighAccuracy: false, timeout: 7000, maximumAge: 15 * 60 * 1000 });
    return () => { cancelled = true; };
  }, [loadTimings]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const prayers = useMemo(() => PRAYERS.map((prayer) => ({ ...prayer, time: cleanTime(timings?.[prayer.key]) })), [timings]);
  const nextPrayer = useMemo(() => {
    if (!timings) return null;
    const upcoming = prayers.map((prayer) => ({ ...prayer, at: timeToDate(prayer.time, now) })).filter((p): p is typeof p & { at: Date } => p.at !== null).find((p) => p.at.getTime() > now.getTime());
    if (upcoming) return upcoming;
    const fajr = timeToDate(cleanTime(timings.Fajr), now);
    if (!fajr) return null;
    fajr.setDate(fajr.getDate() + 1);
    return { ...prayers[0], at: fajr };
  }, [now, prayers, timings]);

  const currentPrayer = useMemo(() => {
    if (!timings) return null;
    const elapsed = [...prayers].reverse().map((prayer) => ({ ...prayer, at: timeToDate(prayer.time, now) })).find((p) => p.at && p.at.getTime() <= now.getTime());
    if (elapsed) return elapsed;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const fajrYesterday = timeToDate(cleanTime(timings.Fajr), yesterday);
    return fajrYesterday ? { ...prayers[4], at: fajrYesterday } : null;
  }, [now, prayers, timings]);

  const enableNotifications = async () => {
    if (!('Notification' in window)) { setError('الإشعارات غير مدعومة في هذا المتصفح.'); return; }
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      setNotifications(permission === 'granted');
      if (permission !== 'granted') setError('لم يتم السماح بالإشعارات. يمكنك تفعيلها من إعدادات المتصفح.');
    } catch { setError('تعذر طلب إذن الإشعارات في هذا المتصفح.'); }
  };

  const playAdhan = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      await audio.play();
      setAdhanEnabled(true);
      setAudioError('');
    } catch {
      setAdhanEnabled(false);
      setAudioError('ملف الأذان الحالي عنصر نائب؛ أضف تسجيلًا حقيقيًا صالحًا إلى public/sounds/adhan.mp3.');
    }
  };

  useEffect(() => {
    if (!timings || !nextPrayer || !currentPrayer) return;
    const key = `${dateKey(now)}-${nextPrayer.key}-${nextPrayer.time}`;
    if (now.getTime() < nextPrayer.at.getTime() || firedRef.current === key) return;
    firedRef.current = key;
    try {
      if (notifications && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('حان وقت الصلاة', { body: `حان الآن وقت صلاة ${nextPrayer.label}` });
      }
    } catch { /* قد تمنع بعض البيئات الإشعارات */ }
    if (adhanEnabled) void playAdhan();
    try { localStorage.setItem(`prayer_${dateKey(now)}`, JSON.stringify({ timings, coordinates, lastPrayerAlert: nextPrayer.key, alertedAt: now.toISOString() })); } catch { /* اختياري */ }
  }, [adhanEnabled, coordinates, currentPrayer, nextPrayer, now, notifications, timings]);

  const iqamaAt = currentPrayer?.at ? new Date(currentPrayer.at.getTime() + 15 * 60 * 1000) : null;
  const iqamaRemaining = iqamaAt && now.getTime() < iqamaAt.getTime() ? iqamaAt.getTime() - now.getTime() : null;

  return (
    <section dir="rtl" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">مواقيت الصلاة</h3>
          <p className="mt-1 text-sm text-slate-400">{now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · {locationLabel}</p>
        </div>
        <button onClick={() => void loadTimings(coordinates)} disabled={loading} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50">{loading ? 'جارٍ التحديث…' : 'تحديث المواقيت'}</button>
      </div>
      {error && <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm leading-6 text-amber-100">{error}</p>}
      {loading && !timings && <p className="text-sm text-slate-400">جارٍ تحميل مواقيت اليوم…</p>}
      {timings && (
        <>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
            <p className="text-sm text-amber-200">الصلاة القادمة</p>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-2xl font-bold">{nextPrayer?.label ?? '—'}</h4><span className="text-xl font-semibold tabular-nums text-amber-100">{nextPrayer?.time ?? '--:--'}</span></div>
            <p className="mt-3 text-sm text-slate-300">الوقت المتبقي: <span className="font-mono text-lg tabular-nums">{nextPrayer ? formatCountdown(nextPrayer.at.getTime() - now.getTime()) : '--:--:--'}</span></p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {prayers.map((prayer) => <div key={prayer.key} className={`flex items-center justify-between rounded-xl border p-3 ${nextPrayer?.key === prayer.key ? 'border-amber-300/40 bg-amber-300/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}><span className="font-medium">{prayer.label}</span><time className="font-mono text-lg tabular-nums" dir="ltr">{prayer.time}</time></div>)}
          </div>
          {iqamaRemaining !== null && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-3 text-sm text-emerald-100">وقت الإقامة التقديري لصلاة {currentPrayer?.label}: خلال {formatCountdown(iqamaRemaining)} (بعد 15 دقيقة من الأذان؛ قابل للتغيير حسب المسجد).</p>}
        </>
      )}
      <audio ref={audioRef} src="/sounds/adhan.mp3" preload="none" onError={() => setAudioError('لا يوجد تسجيل أذان صالح حاليًا.')} />
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void playAdhan()} className="rounded-xl bg-amber-300 px-4 py-2 font-semibold text-slate-950">اختبار صوت الأذان</button>
        <button onClick={() => void enableNotifications()} className="rounded-xl border border-white/10 px-4 py-2 text-sm">{notifications ? 'الإشعارات مفعّلة' : 'تفعيل الإشعارات'}</button>
      </div>
      {audioError && <p role="status" className="text-sm leading-6 text-amber-200">{audioError}</p>}
      <p className="text-xs leading-6 text-slate-500">المواقيت تُجلب مباشرة من خدمة AlAdhan، مع حفظ نسخة يومية على جهازك. العدّ التنازلي يعمل والصفحة مفتوحة؛ الإشعارات والتنبيه الصوتي قد يتأثران بقيود المتصفح. الإقامة تقديرية وليست موعدًا رسميًا للمسجد.</p>
    </section>
  );
}
