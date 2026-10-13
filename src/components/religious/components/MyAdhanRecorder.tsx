import React, { useEffect, useRef, useState } from 'react';

export default function MyAdhanRecorder() {
  const [status, setStatus] = useState('لم يبدأ التسجيل');
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);

  useEffect(() => () => {
    try { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); } catch { /* التنظيف أفضل محاولة */ }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('التسجيل غير مدعوم في هذا المتصفح. جرّب متصفحًا حديثًا عبر HTTPS.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const preferredType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => setStatus('حدث خطأ أثناء التسجيل. حاول مرة أخرى.');
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || chunksRef.current.length && chunksRef.current[0] instanceof Blob && chunksRef.current[0].type || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        setDuration(Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)));
        if (!blob.size) { setStatus('لم يتم تسجيل صوت. تأكد من الميكروفون ثم حاول مرة أخرى.'); return; }
        setAudioUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return URL.createObjectURL(blob); });
        setStatus('اكتمل التسجيل. استمع إليه أو نزّله للاحتفاظ به.');
      };
      recorder.start(250);
      startedAtRef.current = Date.now();
      setRecording(true);
      setStatus('جارٍ التسجيل… تحدث بالقرب من الميكروفون، ثم اضغط إيقاف.');
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStatus('لم يتم منح إذن الميكروفون أو تعذر بدء التسجيل. تحقق من إذن الموقع والمتصفح.');
    }
  };

  const stop = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      setStatus('جارٍ تجهيز ملف التسجيل…');
    }
  };

  const download = () => {
    if (!audioUrl) return;
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = 'my-adhan.webm';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus('بدأ تنزيل تسجيل الأذان إلى جهازك.');
  };

  return (
    <section dir="rtl" className="space-y-3">
      <div><h3 className="text-lg font-semibold">تسجيل الأذان بصوتك</h3><p className="mt-1 text-sm leading-6 text-slate-400">سجّل صوتك باستخدام MediaRecorder، ثم استمع إلى التسجيل أو نزّله. لا يُرفع الصوت إلى خادم.</p></div>
      <p aria-live="polite" className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">{status}</p>
      {recording && <p className="text-sm text-rose-200">● التسجيل جارٍ — {Math.floor((Date.now() - startedAtRef.current) / 1000)} ثانية تقريبًا</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={recording} onClick={() => void start()} className="rounded-lg bg-amber-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-40">بدء التسجيل</button>
        <button type="button" disabled={!recording} onClick={stop} className="rounded-lg border border-white/10 px-4 py-2 disabled:opacity-40">إيقاف التسجيل</button>
        <button type="button" disabled={!audioUrl} onClick={download} className="rounded-lg border border-emerald-300/30 px-4 py-2 text-emerald-100 disabled:opacity-40">تنزيل التسجيل</button>
      </div>
      {audioUrl && <div className="rounded-xl border border-white/10 p-3"><p className="mb-2 text-sm text-slate-300">معاينة التسجيل · المدة {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}</p><audio controls src={audioUrl} className="w-full">متصفحك لا يدعم تشغيل الصوت.</audio></div>}
      <p className="text-xs leading-6 text-slate-500">قد يتطلب الوصول إلى الميكروفون HTTPS وإذنًا صريحًا. يبقى التسجيل في ذاكرة الصفحة حتى تنزيله، وقد يُحذف عند إغلاقها أو تحديثها.</p>
    </section>
  );
}
