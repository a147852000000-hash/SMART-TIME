import React, { useState } from 'react';
import {
  X,
  Sliders,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  LayoutGrid,
  Sparkles,
  MessageSquare,
  Image as ImageIcon,
  BookOpen,
  FileText,
  Wallet,
  ShieldCheck,
  Bot,
  UtensilsCrossed,
  Navigation,
  Car,
  GraduationCap,
} from 'lucide-react';
import {
  DashboardLayoutSettings,
  DashboardModuleItem,
  DashboardLayoutRepository,
} from '../services/repositories/dashboardLayoutRepository';
import { Language } from '../types';

interface DashboardCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  settings: DashboardLayoutSettings;
  onSaveSettings: (newSettings: DashboardLayoutSettings) => void;
}

const getModuleIcon = (iconName: string) => {
  switch (iconName) {
    case 'MessageSquare':
      return <MessageSquare className="w-5 h-5" />;
    case 'Image':
      return <ImageIcon className="w-5 h-5" />;
    case 'BookOpen':
      return <BookOpen className="w-5 h-5" />;
    case 'FileText':
      return <FileText className="w-5 h-5" />;
    case 'Wallet':
      return <Wallet className="w-5 h-5" />;
    case 'ShieldCheck':
      return <ShieldCheck className="w-5 h-5" />;
    case 'Bot':
      return <Bot className="w-5 h-5" />;
    case 'UtensilsCrossed':
      return <UtensilsCrossed className="w-5 h-5" />;
    case 'Navigation':
      return <Navigation className="w-5 h-5" />;
    case 'Car':
      return <Car className="w-5 h-5" />;
    case 'GraduationCap':
      return <GraduationCap className="w-5 h-5" />;
    default:
      return <Sparkles className="w-5 h-5" />;
  }
};

export const DashboardCustomizerModal: React.FC<DashboardCustomizerModalProps> = ({
  isOpen,
  onClose,
  language,
  settings,
  onSaveSettings,
}) => {
  const isAr = language === 'ar';
  const [localSettings, setLocalSettings] = useState<DashboardLayoutSettings>(settings);

  // Sync with prop when opened
  React.useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleToggleVisibility = (id: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      modules: prev.modules.map((m) =>
        m.id === id ? { ...m, visible: !m.visible } : m
      ),
    }));
  };

  const handleMove = (id: string, direction: 'up' | 'down') => {
    const modules = [...localSettings.modules];
    const index = modules.findIndex((m) => m.id === id);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    const temp = modules[index];
    modules[index] = modules[targetIndex];
    modules[targetIndex] = temp;

    modules.forEach((m, idx) => {
      m.order = idx;
    });

    setLocalSettings((prev) => ({
      ...prev,
      modules,
    }));
  };

  const handleReset = () => {
    const defaultSettings = DashboardLayoutRepository.resetToDefault();
    setLocalSettings(defaultSettings);
    onSaveSettings(defaultSettings);
  };

  const handleSaveAndApply = () => {
    DashboardLayoutRepository.saveSettings(localSettings);
    onSaveSettings(localSettings);
    onClose();
  };

  const visibleCount = localSettings.modules.filter((m) => m.visible).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      id="dashboard-customizer-modal"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-500/10 text-accent-600 dark:text-accent-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {isAr ? 'تخصيص وتحرير الواجهة الرئيسية' : 'Customize Dashboard Layout'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? `قم بترتيب الأقسام أو إخفاء ما لا تحتاجه (${visibleCount} من ${localSettings.modules.length} مفعّل)`
                  : `Reorder or toggle modules (${visibleCount} of ${localSettings.modules.length} active)`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Quick Layout Options */}
          <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-accent-500" />
                {isAr ? 'كثافة عرض البطاقات (الأعمدة)' : 'Grid Density'}
              </span>
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                {[2, 3, 4].map((col) => (
                  <button
                    key={col}
                    onClick={() =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        columns: col as 2 | 3 | 4,
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      localSettings.columns === col
                        ? 'bg-accent-500 text-white font-bold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {col} {isAr ? 'أعمدة' : 'cols'}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles for Hero */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={localSettings.showHeroBanner}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      showHeroBanner: e.target.checked,
                    }))
                  }
                  className="rounded text-accent-500 focus:ring-accent-500 w-4 h-4"
                />
                <span>{isAr ? 'بانر الترحيب وشعار البرنامج' : 'Hero Welcome Banner & Logo'}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={localSettings.showHeroSearch}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      showHeroSearch: e.target.checked,
                    }))
                  }
                  className="rounded text-accent-500 focus:ring-accent-500 w-4 h-4"
                />
                <span>{isAr ? 'شريط البحث السريع والبحث الصوتي' : 'Quick Search & Voice'}</span>
              </label>
            </div>
          </div>

          {/* Module List with Drag/Move controls */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
              <span>{isAr ? 'ترتيب الأقسام وحالتها' : 'Module Order & Visibility'}</span>
              <span>{isAr ? 'استخدم الأسهم لتغيير الترتيب' : 'Use arrows to reorder'}</span>
            </div>

            <div className="space-y-2">
              {localSettings.modules.map((mod, index) => {
                const isFirst = index === 0;
                const isLast = index === localSettings.modules.length - 1;

                return (
                  <div
                    key={mod.id}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      mod.visible
                        ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-900/50 border-dashed border-slate-300 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    {/* Left: Icon & Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700/80 text-[11px] font-mono font-bold flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                        {index + 1}
                      </span>

                      <div className="w-10 h-10 rounded-xl bg-accent-500/10 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0">
                        {getModuleIcon(mod.iconName)}
                      </div>

                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {isAr ? mod.nameAr : mod.nameEn}
                          </h4>
                          {mod.category === 'featured' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-accent-500/15 text-accent-600 dark:text-accent-400">
                              {isAr ? 'مميز' : 'Featured'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                          {isAr ? mod.descriptionAr : mod.descriptionEn}
                        </p>
                      </div>
                    </div>

                    {/* Right: Actions (Move up, Move down, Toggle visibility) */}
                    <div className="flex items-center gap-1 shrink-0 ms-2">
                      <button
                        onClick={() => handleMove(mod.id, 'up')}
                        disabled={isFirst}
                        title={isAr ? 'تحريك لأعلى' : 'Move Up'}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isFirst
                            ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleMove(mod.id, 'down')}
                        disabled={isLast}
                        title={isAr ? 'تحريك لأسفل' : 'Move Down'}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isLast
                            ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleToggleVisibility(mod.id)}
                        title={
                          mod.visible
                            ? isAr
                              ? 'إخفاء من الواجهة'
                              : 'Hide from dashboard'
                            : isAr
                            ? 'إظهار في الواجهة'
                            : 'Show on dashboard'
                        }
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                          mod.visible
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}
                      >
                        {mod.visible ? (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isAr ? 'ظاهر' : 'Visible'}</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>{isAr ? 'مخفي' : 'Hidden'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isAr ? 'استعادة الافتراضي' : 'Reset to Default'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              onClick={handleSaveAndApply}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-yellow-500 text-white font-bold text-xs shadow-lg shadow-accent-500/25 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>{isAr ? 'حفظ وتطبيق' : 'Save & Apply'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
