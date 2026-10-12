import React, { useState } from 'react';

export default function MyAdhanRecorder() {
  const [status, setStatus] = useState('لم يبدأ التسجيل');
  const [recording, setRecording] = useState(false);
  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('التسجيل غير مدعوم في هذا المتصفح.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = 'my-adhan.webm'; link.click();
        URL.revokeObjectURL(url);
        stream.getTracks().forEach((track) => track.stop());
        setStatus('تم تنزيل التسجيل إلى جهازك.');
      };
      recorder.start();
      setRecording(true);
      setStatus('جارٍ التسجيل… اضغط إيقاف عند الانتهاء.');
      (window as Window & { __smartTimeAdhanRecorder?: MediaRecorder }).__smartTimeAdhanRecorder = recorder;
    } catch {
      setStatus('لم يتم منح إذن الميكروفون أو تعذر بدء التسجيل.');
    }
  };
  const stop = () => {
    const recorder = (window as Window & { __smartTimeAdhanRecorder?: MediaRecorder }).__smartTimeAdhanRecorder;
    if (recorder?.state === 'recording') recorder.stop();
    setRecording(false);
  };
  return <section dir="rtl"><h3 className="text-lg font-semibold">تسجيل الأذان بصوتك</h3><p aria-live="polite" className="mt-2 text-sm text-slate-400">{status}</p><div className="mt-3 flex gap-2"><button disabled={recording} onClick={() => void start()} className="rounded-lg bg-amber-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-40">بدء التسجيل</button><button disabled={!recording} onClick={stop} className="rounded-lg border border-white/10 px-4 py-2 disabled:opacity-40">إيقاف وتنزيل</button></div><p className="mt-2 text-xs text-slate-500">يتطلب إذن الميكروفون؛ يحفظ هذا الإصدار التسجيل كملف تنزيل، وليس في IndexedDB.</p></section>;
}
