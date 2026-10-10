import React, { useState, useEffect } from 'react';
import { Bookmark, Search, X, Trash2, ArrowUpRight, Copy, Check, MessageSquare } from 'lucide-react';
import { SavedMessageItem } from '../types';
import { chatService } from '../services/chatService';

interface SavedMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
  isDark: boolean;
  onJumpToMessage?: (roomId: string, messageId: string) => void;
}

export const SavedMessagesModal: React.FC<SavedMessagesModalProps> = ({
  isOpen,
  onClose,
  isAr,
  isDark,
  onJumpToMessage,
}) => {
  const [savedMessages, setSavedMessages] = useState<SavedMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSaved = async () => {
    setLoading(true);
    try {
      const list = await chatService.getSavedMessages();
      setSavedMessages(list);
    } catch (err) {
      console.warn('Failed to load saved messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSaved();
    }
  }, [isOpen]);

  const handleUnsave = async (messageId: string) => {
    try {
      await chatService.unsaveMessage(messageId);
      setSavedMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err: any) {
      alert(err.message || 'حدث خطأ');
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  const filtered = savedMessages.filter((m) =>
    (m.text || m.body || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.senderName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.roomTitle || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[85] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      <div className={`w-full max-w-xl rounded-3xl border ${isDark ? 'bg-slate-900 border-amber-500/40 text-white' : 'bg-white border-amber-500/40 text-slate-900'} shadow-2xl overflow-hidden flex flex-col max-h-[85vh]`}>
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold shadow-xs">
              <Bookmark className="w-5 h-5 fill-amber-500" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">
                {isAr ? 'الرسائل المحفوظة' : 'Saved Messages'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {isAr ? `${savedMessages.length} رسالة محفوظة في حسابك` : `${savedMessages.length} saved messages in your account`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث في الرسائل المحفوظة...' : 'Search saved messages...'}
              className="w-full ps-9 pe-4 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-amber-500/80"
            />
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
              {isAr ? 'جاري تحميل الرسائل المحفوظة...' : 'Loading saved messages...'}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-30 text-amber-500" />
              <p className="font-bold text-sm text-slate-600 dark:text-slate-300">
                {isAr ? 'لا توجد رسائل محفوظة' : 'No saved messages'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                {isAr
                  ? 'يمكنك حفظ أي رسالة مهمة بالضغط على زر الحفظ بجانب الرسالة للرجوع إليها لاحقاً.'
                  : 'You can bookmark any important message by clicking the save icon next to it.'}
              </p>
            </div>
          ) : (
            filtered.map((msg) => (
              <div
                key={msg.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isDark
                    ? 'bg-slate-850/70 border-slate-800 hover:border-amber-500/40'
                    : 'bg-slate-50 border-slate-200 hover:border-amber-500/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={msg.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <span className="text-xs font-bold text-amber-500">{msg.senderName}</span>
                    <span className="text-[10px] text-slate-400">في {msg.roomTitle}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.text || msg.body || '')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-750 transition-colors"
                      title={isAr ? 'نسخ النص' : 'Copy text'}
                    >
                      {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    {onJumpToMessage && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onJumpToMessage(msg.roomId, msg.id);
                        }}
                        className="p-1.5 rounded-lg text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors flex items-center gap-1 text-[10px] font-bold"
                        title={isAr ? 'الانتقال للرسالة' : 'Jump to message'}
                      >
                        <span>{isAr ? 'فتح' : 'Open'}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleUnsave(msg.id)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                      title={isAr ? 'إلغاء الحفظ' : 'Remove bookmark'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs leading-relaxed break-words font-medium">
                  {msg.text || msg.body}
                </div>

                {msg.mediaUrl && (
                  <div className="mt-2">
                    <img src={msg.mediaUrl} alt="" className="max-h-40 rounded-xl object-contain border border-slate-700" />
                  </div>
                )}

                <div className="mt-2 text-[10px] text-slate-500 text-end">
                  {new Date(msg.savedAt || msg.timestamp).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
