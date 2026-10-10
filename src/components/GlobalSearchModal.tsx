import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  FileText,
  DollarSign,
  Car,
  GraduationCap,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Note, ExpenseItem, Vehicle, LessonItem, Language, AppView } from '../types';
import { translations } from '../services/i18n';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  notes: Note[];
  expenses: ExpenseItem[];
  vehicles: Vehicle[];
  lessons: LessonItem[];
  onNavigate: (view: AppView) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  language,
  notes,
  expenses,
  vehicles,
  lessons,
  onNavigate,
}) => {
  const t = translations[language];
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  // Search Results aggregation
  const matchingNotes = notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  const matchingExpenses = expenses.filter((e) => e.title.toLowerCase().includes(q) || e.notes?.toLowerCase().includes(q));
  const matchingVehicles = vehicles.filter((v) => v.name.toLowerCase().includes(q) || v.model.toLowerCase().includes(q));
  const matchingLessons = lessons.filter((l) => l.subject.toLowerCase().includes(q) || l.tutorName?.toLowerCase().includes(q));

  const totalResults =
    q === ''
      ? 0
      : matchingNotes.length +
        matchingExpenses.length +
        matchingVehicles.length +
        matchingLessons.length +
        0;

  const handleSelectResult = (view: AppView) => {
    onNavigate(view);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 overflow-hidden">
        {/* Search Input Bar */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute start-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              language === 'ar'
                ? 'ابحث في كل شيء: ملاحظات، مصاريف، سيارات، ودروس...'
                : 'Search everything: notes, expenses, cars, and lessons...'
            }
            className="w-full ps-12 pe-10 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute end-3 top-1/2 -translate-y-1/2 rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-[420px] overflow-y-auto space-y-3 pe-1">
          {q === '' ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-accent-500/70" />
              <p className="text-xs font-semibold">
                {language === 'ar' ? 'اكتب كلمة للبحث الفوري في جميع أقسام التطبيق' : 'Type to search across the entire Super App'}
              </p>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-xs">{language === 'ar' ? 'لا توجد نتائج مطابقة لبحثك' : 'No matching results found'}</p>
            </div>
          ) : (
            <>
              {/* Notes */}
              {matchingNotes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-accent-500" />
                    <span>{language === 'ar' ? 'الملاحظات' : 'Notes'}</span>
                  </div>
                  {matchingNotes.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleSelectResult('notes')}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-accent-50 dark:hover:bg-accent-950/40 border border-slate-100 dark:border-slate-800 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-900 dark:text-white">{n.title}</span>
                      <span className="text-[11px] text-accent-600 font-semibold">{n.date}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Expenses */}
              {matchingExpenses.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{language === 'ar' ? 'المصروفات' : 'Expenses'}</span>
                  </div>
                  {matchingExpenses.map((exp) => (
                    <div
                      key={exp.id}
                      onClick={() => handleSelectResult('expenses')}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-100 dark:border-slate-800 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-900 dark:text-white">{exp.title}</span>
                      <span className="font-bold font-mono-num text-rose-500">{exp.amount}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Lessons */}
              {matchingLessons.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-teal-500" />
                    <span>{language === 'ar' ? 'الدروس والتعليم' : 'Education'}</span>
                  </div>
                  {matchingLessons.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => handleSelectResult('education')}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-slate-100 dark:border-slate-800 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-900 dark:text-white">
                        {l.subject} - {l.tutorName}
                      </span>
                      <span className="text-[11px] text-teal-600 font-mono-num">{l.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
