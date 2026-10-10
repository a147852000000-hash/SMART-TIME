import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { Language } from '../types';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  itemName?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
  language: Language;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  itemName,
  message,
  onConfirm,
  onCancel,
  language,
}) => {
  if (!isOpen) return null;
  const isAr = language === 'ar';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="bg-[#1a1a1a] border border-rose-500/40 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 text-white text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h3 className="font-extrabold text-base text-white">
            {title || (isAr ? 'تأكيد حذف السجل' : 'Confirm Deletion')}
          </h3>
          {itemName && (
            <p className="text-xs font-bold text-accent-500 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 line-clamp-2">
              {itemName}
            </p>
          )}
          <p className="text-xs text-slate-400">
            {message || (isAr ? 'هل أنت متأكد من رغبتك في حذف هذا البند نهائياً؟ لا يمكن استرجاعه بعد الحذف.' : 'Are you sure you want to permanently delete this record? This action cannot be undone.')}
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-extrabold text-xs shadow-lg shadow-rose-900/40 transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isAr ? 'نعم، احذف' : 'Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
