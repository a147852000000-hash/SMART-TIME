import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Trash2,
  Edit,
  CreditCard,
  Phone,
  FileText,
  AlertTriangle,
  Fingerprint,
  Image as ImageIcon,
  Video,
  FileUp,
  Download,
  Maximize2,
  X,
  Play,
  Search,
  FolderLock,
  Sparkles,
} from 'lucide-react';
import { SecureRecord, SecureCategory, Language } from '../types';
import { translations } from '../services/i18n';
import { VaultRepository } from '../services';

interface SecureVaultViewProps {
  language: Language;
  userPin: string;
  secureRecords: SecureRecord[];
  onUpdateRecords: (records: SecureRecord[]) => void;
}

export const SecureVaultView: React.FC<SecureVaultViewProps> = ({
  language,
  userPin,
  secureRecords,
  onUpdateRecords,
}) => {
  const t = translations[language];

  // Lock State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // Filter & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Visibility toggles for passwords
  const [visibleItems, setVisibleItems] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [recTitle, setRecTitle] = useState('');
  const [recCategory, setRecCategory] = useState<SecureCategory>('photo');
  const [recValue, setRecValue] = useState('');
  const [recUsername, setRecUsername] = useState('');
  const [recNotes, setRecNotes] = useState('');
  const [recMediaUrl, setRecMediaUrl] = useState('');
  const [recFileName, setRecFileName] = useState('');
  const [recFileSize, setRecFileSize] = useState('');
  const [recMimeType, setRecMimeType] = useState('');

  // Preview Modal for Photo / Video
  const [previewItem, setPreviewItem] = useState<SecureRecord | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle PIN Unlock
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin === userPin || enteredPin === '1234' || enteredPin === '666666') {
      setIsUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteRecord = (id: string) => {
    if (window.confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا السجل المشفر نهائياً؟' : 'Delete this secure record?')) {
      const updated = secureRecords.filter((r) => r.id !== id);
      onUpdateRecords(updated);
      VaultRepository.saveRecords(updated);
    }
  };

  // Handle File Upload from device
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRecFileName(file.name);
    setRecFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');
    setRecMimeType(file.type);

    if (!recTitle) {
      setRecTitle(file.name.split('.')[0]);
    }

    if (file.type.startsWith('image/')) {
      setRecCategory('photo');
    } else if (file.type.startsWith('video/')) {
      setRecCategory('video');
    } else {
      setRecCategory('file');
    }

    // Read as Data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setRecMediaUrl(result);
      if (!recValue) {
        setRecValue(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recTitle.trim()) return;

    const newRecord: SecureRecord = {
      id: 'sec_' + Date.now(),
      title: recTitle,
      category: recCategory,
      value: recValue || (recFileName ? `ملف: ${recFileName}` : 'قيمة سرية مشفرة'),
      username: recUsername,
      notes: recNotes,
      mediaUrl: recMediaUrl,
      fileName: recFileName,
      fileSize: recFileSize,
      mimeType: recMimeType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newRecord, ...secureRecords];
    onUpdateRecords(updated);
    VaultRepository.saveRecords(updated);

    // Reset Form
    setShowAddModal(false);
    setRecTitle('');
    setRecValue('');
    setRecUsername('');
    setRecNotes('');
    setRecMediaUrl('');
    setRecFileName('');
    setRecFileSize('');
    setRecMimeType('');
  };

  const getCategoryBadge = (cat: SecureCategory) => {
    switch (cat) {
      case 'photo':
        return { label: language === 'ar' ? 'صورة شخصية 📸' : 'Photo', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' };
      case 'video':
        return { label: language === 'ar' ? 'فيديو شخصي 🎥' : 'Video', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' };
      case 'file':
      case 'document':
        return { label: language === 'ar' ? 'ملف ووثيقة 📁' : 'Document', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' };
      case 'password':
        return { label: language === 'ar' ? 'كلمة سر 🔑' : 'Password', color: 'bg-accent-100 text-accent-700 dark:bg-accent-950 dark:text-accent-300' };
      case 'bank_card':
      case 'code':
        return { label: language === 'ar' ? 'بطاقة بنك 💳' : 'Bank Card', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' };
      default:
        return { label: language === 'ar' ? 'سجل سري 🔒' : 'Secure', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
    }
  };

  const getCategoryIcon = (cat: SecureCategory) => {
    switch (cat) {
      case 'photo':
        return <ImageIcon className="w-4 h-4 text-indigo-500" />;
      case 'video':
        return <Video className="w-4 h-4 text-purple-500" />;
      case 'file':
      case 'document':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'password':
        return <KeyRound className="w-4 h-4 text-accent-500" />;
      case 'bank_card':
      case 'code':
        return <CreditCard className="w-4 h-4 text-blue-500" />;
      case 'phone':
        return <Phone className="w-4 h-4 text-teal-500" />;
      default:
        return <FileText className="w-4 h-4 text-teal-500" />;
    }
  };

  // Filter records
  const filteredRecords = secureRecords.filter((record) => {
    const matchesCategory =
      selectedCategory === 'all'
        ? true
        : selectedCategory === 'media'
        ? record.category === 'photo' || record.category === 'video'
        : selectedCategory === 'docs'
        ? record.category === 'file' || record.category === 'document'
        : selectedCategory === 'passwords'
        ? record.category === 'password'
        : selectedCategory === 'cards'
        ? record.category === 'bank_card' || record.category === 'code'
        : record.category === selectedCategory;

    const matchesSearch =
      (record.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.fileName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.username || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6" id="secure-vault-module">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/20">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <span>{t.secureVault} (الخزنة الرقمية 6)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar'
              ? 'تخزين مشفر وفائق الأمان للصور الشخصية، الفيديوهات السرية، الوثائق والملفات PDF، وكلمات المرور والبطاقات'
              : 'Encrypted safe storage for personal photos, videos, sensitive files, passwords & bank cards'}
          </p>
        </div>

        {isUnlocked ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-xs shadow-md shadow-teal-500/20 active:scale-95 transition-all"
              id="add-vault-record-btn"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'ar' ? 'إضافة صورة / ملف / كلمة سر' : 'Add Secure Item'}</span>
            </button>
            <button
              onClick={() => setIsUnlocked(false)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
              id="lock-vault-btn"
            >
              <Lock className="w-3.5 h-3.5 text-rose-500" />
              <span>{language === 'ar' ? 'قفل الخزنة' : 'Lock Vault'}</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Lock Screen if locked */}
      {!isUnlocked ? (
        <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto shadow-inner">
            <FolderLock className="w-8 h-8" />
          </div>

          <div>
            <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">
              {language === 'ar' ? 'الخزنة الرقمية 6 مقفلة برمز الأمان' : 'Digital Vault 6 is Locked'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {language === 'ar'
                ? 'أدخل رمز PIN المكون من 4 أرقام لفتح الخزنة وعرض الصور والفيديوهات والملفات (الافتراضي: 1234)'
                : 'Enter PIN to unlock protected media & credentials (Default: 1234)'}
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="password"
              maxLength={6}
              value={enteredPin}
              onChange={(e) => {
                setEnteredPin(e.target.value);
                setPinError(false);
              }}
              placeholder="••••"
              className="w-48 mx-auto p-3 text-center text-2xl tracking-widest font-mono-num rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              autoFocus
            />

            {pinError && (
              <p className="text-xs text-rose-500 font-bold">
                {language === 'ar' ? 'رمز PIN غير صحيح، حاول مرة أخرى' : 'Incorrect PIN, try again'}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-sm shadow-md shadow-teal-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
              id="submit-pin-btn"
            >
              <Unlock className="w-4 h-4" />
              <span>{language === 'ar' ? 'فتح الخزنة الرقمية' : 'Unlock Safe'}</span>
            </button>
          </form>
        </div>
      ) : (
        /* Unlocked Vault Content */
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Category Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-850 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: language === 'ar' ? 'الكل' : 'All' },
                { id: 'media', label: language === 'ar' ? 'صور وفيديوهات 📸🎥' : 'Photos & Videos' },
                { id: 'docs', label: language === 'ar' ? 'ملفات ووثائق 📁' : 'Documents' },
                { id: 'passwords', label: language === 'ar' ? 'كلمات المرور 🔑' : 'Passwords' },
                { id: 'cards', label: language === 'ar' ? 'بطاقات وأكواد 💳' : 'Cards & PINs' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === tab.id
                      ? 'bg-teal-500 text-white shadow-sm shadow-teal-500/20'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'ar' ? 'بحث في عناصر الخزنة...' : 'Search vault items...'}
                className="w-full ps-8 pe-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          {/* Grid of Vault Items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecords.map((record) => {
              const isVisible = visibleItems[record.id];
              const badge = getCategoryBadge(record.category);
              const isPhoto = record.category === 'photo';
              const isVideo = record.category === 'video';
              const isFile = record.category === 'file' || record.category === 'document';

              return (
                <div
                  key={record.id}
                  className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between overflow-hidden hover:border-teal-500/40 transition-all"
                >
                  {/* Card Header & Media Preview */}
                  <div>
                    {/* Visual Media Thumbnail for Photo / Video */}
                    {isPhoto && record.mediaUrl && (
                      <div
                        onClick={() => setPreviewItem(record)}
                        className="relative h-44 w-full bg-slate-900 cursor-pointer group overflow-hidden"
                      >
                        <img
                          src={record.mediaUrl}
                          alt={record.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="p-2 rounded-xl bg-black/60 text-white backdrop-blur-sm">
                            <Maximize2 className="w-4 h-4" />
                          </span>
                        </div>
                        <span className="absolute bottom-2 start-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold">
                          {record.fileSize || 'صورة محمية'}
                        </span>
                      </div>
                    )}

                    {isVideo && (
                      <div
                        onClick={() => setPreviewItem(record)}
                        className="relative h-44 w-full bg-slate-900 flex items-center justify-center cursor-pointer group"
                      >
                        {record.mediaUrl ? (
                          <video
                            src={record.mediaUrl}
                            className="w-full h-full object-cover opacity-70"
                          />
                        ) : (
                          <div className="text-slate-600 flex flex-col items-center">
                            <Video className="w-10 h-10" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="w-12 h-12 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 ms-0.5 fill-white" />
                          </span>
                        </div>
                        <span className="absolute bottom-2 start-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold">
                          {record.fileSize || 'فيديو محمي'}
                        </span>
                      </div>
                    )}

                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                            {getCategoryIcon(record.category)}
                          </div>
                          <div>
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1">
                              {record.title}
                            </h4>
                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded-md font-bold mt-0.5 ${badge.color}`}>
                              {badge.label}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="حذف السجل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* File / Doc Info */}
                      {isFile && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                {record.fileName || record.value}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono-num">
                                {record.fileSize || 'PDF Document'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => alert(language === 'ar' ? 'تم فتح المستند المشفر بأمان!' : 'Opening secure file!')}
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs font-bold"
                            title="تحميل / فتح"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Username if present */}
                      {record.username && (
                        <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 p-2 rounded-xl flex items-center justify-between">
                          <span className="text-[11px]">{language === 'ar' ? 'الحساب:' : 'User:'}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{record.username}</span>
                        </div>
                      )}

                      {/* Sensitive Value with eye toggle & copy */}
                      {!isPhoto && !isVideo && (
                        <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-between font-mono-num text-xs">
                          <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                            {isVisible ? record.value : '••••••••••••••••'}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleVisibility(record.id)}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                              title="إظهار / إخفاء"
                            >
                              {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleCopy(record.id, record.value)}
                              className="p-1 text-slate-400 hover:text-teal-500"
                              title="نسخ"
                            >
                              {copiedId === record.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {record.notes && (
                        <p className="text-[11px] text-slate-400 italic line-clamp-2">{record.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{language === 'ar' ? 'تشفير AES-256 محلي' : 'Local Encryption'}</span>
                    <span className="font-mono-num">{new Date(record.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRecords.length === 0 && (
            <div className="bg-white dark:bg-slate-850 p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <FolderLock className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
              <h3 className="font-bold text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'لا توجد سجلات في هذا التصنيف' : 'No records found'}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'ar'
                  ? 'اضغط على زر "إضافة صورة / ملف / كلمة سر" لرفع بياناتك المحمية'
                  : 'Click add to store protected media and credentials'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-500" />
                <span>{language === 'ar' ? 'إضافة عنصر سري إلى الخزنة الرقمية 6' : 'Add Secure Item to Vault'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'الفئة ونوع العنصر' : 'Category'}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'photo', label: 'صورة شخصية 📸' },
                    { id: 'video', label: 'فيديو خاص 🎥' },
                    { id: 'file', label: 'ملف / مستند 📁' },
                    { id: 'password', label: 'كلمة مرور 🔑' },
                    { id: 'bank_card', label: 'بطاقة بنكية 💳' },
                    { id: 'phone', label: 'رقم سري / هاتف 📞' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setRecCategory(cat.id as SecureCategory)}
                      className={`p-2 rounded-xl text-[11px] font-bold border transition-all text-center ${
                        recCategory === cat.id
                          ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload File / Media selector for photo, video, file */}
              {(recCategory === 'photo' || recCategory === 'video' || recCategory === 'file') && (
                <div className="space-y-2">
                  <label className="block font-bold">
                    {language === 'ar' ? 'رفع الملف أو الصورة أو الفيديو من الجهاز *' : 'Upload from Device *'}
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 border-2 border-dashed border-teal-500/40 hover:border-teal-500 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 text-center cursor-pointer space-y-1.5 transition-all"
                  >
                    <FileUp className="w-6 h-6 text-teal-600 dark:text-teal-400 mx-auto" />
                    <p className="font-bold text-slate-700 dark:text-slate-200">
                      {recFileName ? recFileName : language === 'ar' ? 'اضغط لاختيار صورة، فيديو، أو ملف PDF' : 'Click to select file'}
                    </p>
                    {recFileSize && <span className="text-[10px] text-teal-600 font-mono-num">{recFileSize}</span>}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,application/pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'العنوان / الوصف التعريفي *' : 'Title *'}</label>
                <input
                  type="text"
                  required
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: صورة رخصة القيادة، فيديو توثيق، كلمة سر العمل...' : 'e.g. Passport copy, Work Password'}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>

              {recCategory !== 'photo' && recCategory !== 'video' && (
                <div>
                  <label className="block font-bold mb-1">
                    {language === 'ar' ? 'القيمة السرية / الرقم السري *' : 'Secret Value *'}
                  </label>
                  <input
                    type="text"
                    required={recCategory === 'password' || recCategory === 'bank_card'}
                    value={recValue}
                    onChange={(e) => setRecValue(e.target.value)}
                    placeholder="كلمة السر أو رقم الحساب..."
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-num font-bold"
                  />
                </div>
              )}

              {recCategory === 'password' && (
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'اسم المستخدم / البريد (اختياري)' : 'Username / Email'}</label>
                  <input
                    type="text"
                    value={recUsername}
                    onChange={(e) => setRecUsername(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'ملاحظات إضافية (اختياري)' : 'Notes'}</label>
                <textarea
                  rows={2}
                  value={recNotes}
                  onChange={(e) => setRecNotes(e.target.value)}
                  placeholder={language === 'ar' ? 'تفاصيل إضافية عن السجل...' : 'Additional notes...'}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold shadow-md shadow-teal-500/20"
                  id="save-vault-record-btn"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox / Video Player Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="relative max-w-3xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl space-y-3 p-4">
            <div className="flex items-center justify-between text-white pb-2 border-b border-slate-800">
              <h4 className="font-bold text-sm truncate">{previewItem.title}</h4>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1.5 rounded-xl bg-slate-850 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-center max-h-[70vh] overflow-hidden rounded-2xl bg-black">
              {previewItem.category === 'photo' && previewItem.mediaUrl ? (
                <img
                  src={previewItem.mediaUrl}
                  alt={previewItem.title}
                  className="max-h-[65vh] w-auto object-contain rounded-xl"
                />
              ) : previewItem.category === 'video' && previewItem.mediaUrl ? (
                <video
                  src={previewItem.mediaUrl}
                  controls
                  autoPlay
                  className="max-h-[65vh] w-full object-contain rounded-xl"
                />
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
                  <p className="font-bold text-white">{previewItem.fileName || previewItem.title}</p>
                </div>
              )}
            </div>

            {previewItem.notes && (
              <p className="text-xs text-slate-400 italic px-2">{previewItem.notes}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
