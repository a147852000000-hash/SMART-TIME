import React, { useState } from 'react';
import { getOfflineAsset } from '../offlineStore';

export default function DownloadManager() {
  const [status, setStatus] = useState('');
  const checkSample = async () => {
    try {
      const sample = await getOfflineAsset<unknown>('quran-surah-1-sample');
      setStatus(sample ? 'عينة سورة الفاتحة محفوظة محليًا.' : 'لا توجد عينة محفوظة بعد. افتح لوحة المسلم واتصل بالإنترنت لتجهيزها.');
    } catch {
      setStatus('التخزين المحلي غير متاح في هذا المتصفح.');
    }
  };
  const chooseFolder = async () => {
    const picker = (window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
    if (!picker) {
      setStatus('اختيار مجلد مباشر غير مدعوم هنا. يمكنك استخدام تنزيلات المتصفح.');
      return;
    }
    try {
      await picker();
      setStatus('تم اختيار المجلد. تنزيلات الصوت الفعلية ستُضاف عند توفير ملفات الصوت.');
    } catch {
      setStatus('تم إلغاء اختيار المجلد.');
    }
  };
  return <section dir="rtl"><h3 className="text-lg font-semibold">إدارة التنزيلات</h3><p className="mt-2 text-sm leading-7 text-slate-400">التنزيل التلقائي في هذه المرحلة يقتصر على عينة سورة الفاتحة. ملفات الصوت الفعلية غير مضمّنة بعد، لذلك لن نعرض تنزيلًا وهميًا.</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void checkSample()} className="rounded-lg bg-amber-300 px-4 py-2 font-semibold text-slate-950">التحقق من العينة</button><button onClick={() => void chooseFolder()} className="rounded-lg border border-white/10 px-4 py-2">اختر مكان الحفظ</button></div>{status && <p aria-live="polite" className="mt-3 text-sm text-emerald-200">{status}</p>}</section>;
}
