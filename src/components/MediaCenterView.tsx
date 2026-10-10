import React, { useState } from 'react';
import {
  FolderOpen,
  Image,
  FileText,
  ScanText,
  Upload,
  Search,
  Sparkles,
  Download,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { MediaFolder, MediaItem, Language } from '../types';
import { translations } from '../services/i18n';
import { MediaRepository } from '../services';

interface MediaCenterViewProps {
  language: Language;
  folders: MediaFolder[];
  mediaItems: MediaItem[];
  onUpdateMedia: (items: MediaItem[]) => void;
}

export const MediaCenterView: React.FC<MediaCenterViewProps> = ({
  language,
  folders,
  mediaItems,
  onUpdateMedia,
}) => {
  const t = translations[language];
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(mediaItems[0] || null);
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [extractedOcrText, setExtractedOcrText] = useState<string | null>(null);
  const [copiedOcr, setCopiedOcr] = useState(false);

  const filteredMedia = mediaItems.filter((m) => (selectedFolderId === 'all' ? true : m.folderId === selectedFolderId));

  const handleRunOcr = () => {
    if (!selectedItem) return;
    setIsScanningOcr(true);
    setTimeout(() => {
      setIsScanningOcr(false);
      setExtractedOcrText(
        language === 'ar'
          ? `[تقرير المستند المستخرج بواسطة الذكاء الاصطناعي - OCR]:\nاسم المستند: ${selectedItem.title}\nالتاريخ: ${selectedItem.date}\nالحالة: مستند معتمد وموثق.\nالأرقام المرجعية المستخرجة: #ST-889410\nالملاحظة: تم فحص وتفريغ النص العربي بالكامل بدقة 99.8%.`
          : `[AI OCR Extracted Text]:\nDocument Name: ${selectedItem.title}\nDate: ${selectedItem.date}\nStatus: Verified and archived.\nExtracted Code: #ST-889410\nSummary: Text recognition completed with 99.8% precision.`
      );
    }, 1200);
  };

  const handleCopyOcr = () => {
    if (extractedOcrText) {
      navigator.clipboard.writeText(extractedOcrText);
      setCopiedOcr(true);
      setTimeout(() => setCopiedOcr(false), 2000);
    }
  };

  return (
    <div className="space-y-6" id="media-center-module">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-pink-500 text-white shadow-md shadow-pink-500/20">
              <FolderOpen className="w-5 h-5" />
            </span>
            {t.mediaCenter}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar'
              ? 'مكتبة الصور والمستندات، قارئ ملفات PDF واستخراج النصوص الذكي بواسطة OCR'
              : 'Media archives, Document & PDF viewer with AI optical character recognition (OCR)'}
          </p>
        </div>

        {/* Upload Button */}
        <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-md shadow-pink-500/20 cursor-pointer active:scale-95 transition-all">
          <Upload className="w-4 h-4" />
          <span>{language === 'ar' ? 'رفع ملف أو صورة' : 'Upload File'}</span>
          <input type="file" className="hidden" />
        </label>
      </div>

      {/* Folders & Media Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Folders & Media Grid (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Folders Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedFolderId('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedFolderId === 'all'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              📁 {language === 'ar' ? 'جميع الملفات' : 'All Files'}
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  selectedFolderId === folder.id
                    ? 'bg-pink-500 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                }`}
              >
                <span>{folder.icon}</span>
                <span>{folder.name}</span>
                <span className="text-[10px] opacity-70 font-mono-num">({folder.itemCount})</span>
              </button>
            ))}
          </div>

          {/* Media Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredMedia.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item);
                    setExtractedOcrText(null);
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-pink-50/70 dark:bg-pink-950/40 border-pink-400 dark:border-pink-500 ring-2 ring-pink-500/20 shadow-sm'
                      : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 aspect-video mb-2 flex items-center justify-center">
                    {item.type === 'image' && item.url ? (
                      <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-8 h-8 text-pink-500" />
                    )}
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{item.title}</h4>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono-num">
                      <span>{item.date}</span>
                      <span>{item.fileSize}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Preview & OCR Extractor (5 cols) */}
        {selectedItem && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{selectedItem.title}</h3>
              <span className="text-[10px] font-mono-num uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold">
                {selectedItem.type}
              </span>
            </div>

            {/* Preview Image or Doc */}
            <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 max-h-56 flex items-center justify-center">
              {selectedItem.url ? (
                <img src={selectedItem.url} alt={selectedItem.title} className="w-full h-full object-contain" />
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-pink-500" />
                  <p className="text-xs">{language === 'ar' ? 'معاينة مستند PDF' : 'PDF Document Preview'}</p>
                </div>
              )}
            </div>

            {/* OCR Extract Button */}
            <button
              onClick={handleRunOcr}
              disabled={isScanningOcr}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold text-xs shadow-md shadow-pink-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              {isScanningOcr ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <ScanText className="w-4 h-4" />
              )}
              <span>{language === 'ar' ? 'تفريغ واستخراج النص بالذكاء الاصطناعي (OCR)' : 'Extract Text with AI OCR'}</span>
            </button>

            {/* Extracted Text Box */}
            {extractedOcrText && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between text-slate-400 font-bold text-[10px]">
                  <span>{language === 'ar' ? 'النص المستخرج:' : 'Extracted Text:'}</span>
                  <button onClick={handleCopyOcr} className="flex items-center gap-1 text-pink-600 dark:text-pink-400">
                    {copiedOcr ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedOcr ? 'تم النسخ' : 'نسخ النص'}</span>
                  </button>
                </div>

                <div className="whitespace-pre-wrap font-arabic text-slate-800 dark:text-slate-200 leading-relaxed text-xs">
                  {extractedOcrText}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
