import React, { useState } from 'react';
import {
  X,
  Palette,
  Sparkles,
  Sliders,
  RotateCcw,
  Check,
  Eye,
  EyeOff,
  Layers,
  Zap,
  Box,
  LayoutGrid,
  SunMedium,
  CheckCircle2,
} from 'lucide-react';
import { Language, CardPreferences, CardStyleType, CardRadius, CardShadow, CardBlur, CardAnimation, CardDensity, CardPresetId, CardIconSize, CardBackgroundTheme } from '../types';
import {
  CARD_STYLES_LIST,
  CARD_PRESETS,
  resolveCardContainerClasses,
  getCardDensityClasses,
  getCardIconSizeClass,
} from '../utils/cardDesignHelper';
import { useCardPreferences } from '../context/CardSettingsContext';

interface CardCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  sections: Array<{ id: string; titleAr: string; titleEn: string; emoji?: string }>;
}

export const CardCustomizerModal: React.FC<CardCustomizerModalProps> = ({
  isOpen,
  onClose,
  language,
  sections,
}) => {
  const isAr = language === 'ar';
  const { preferences, updatePreferences, applyPreset, resetToDefaults } = useCardPreferences();

  const [activeTab, setActiveTab] = useState<'presets' | 'styles' | 'finetune'>('presets');
  const [localPrefs, setLocalPrefs] = useState<CardPreferences>(preferences);

  // Sync state when opened
  React.useEffect(() => {
    if (isOpen) {
      setLocalPrefs(preferences);
    }
  }, [isOpen, preferences]);

  if (!isOpen) return null;

  const handleApplyPreset = (presetId: CardPresetId) => {
    const found = CARD_PRESETS.find((p) => p.id === presetId);
    if (found) {
      const updated = {
        ...found.preferences,
        hiddenCardIds: localPrefs.hiddenCardIds,
        cardSizes: localPrefs.cardSizes,
        iconSize: localPrefs.iconSize,
        backgroundTheme: localPrefs.backgroundTheme,
      };
      setLocalPrefs(updated);
    }
  };

  const handleSave = () => {
    updatePreferences(localPrefs);
    onClose();
  };

  const handleReset = () => {
    if (window.confirm(isAr ? 'هل تريد استعادة الإعدادات الافتراضية للبطاقات؟' : 'Reset card settings to default?')) {
      resetToDefaults();
      onClose();
    }
  };

  const densityClasses = getCardDensityClasses(localPrefs.density);
  const iconSizeClass = localPrefs.iconSize
    ? getCardIconSizeClass(localPrefs.iconSize)
    : densityClasses.iconSize;
  const cardContainerClass = resolveCardContainerClasses(localPrefs, 'expenses', false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn select-none"
      id="card-customizer-modal"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20 shrink-0">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {isAr ? 'نظام تصميم وتخصيص البطاقات' : 'Card Design & Styling Studio'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {isAr
                  ? 'اختر النمط المناسب أو قم بضبط الحواف، التوهج والانعكاس ثلاثي الأبعاد'
                  : 'Select styles, adjust curvature, shadow depth & 3D tilt'}
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

        {/* Live Interactive Preview Box */}
        <div className="px-5 pt-4 pb-2 bg-gradient-to-b from-slate-100/70 to-slate-50/20 dark:from-slate-800/40 dark:to-transparent border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {isAr ? 'معاينة حية ومباشرة للبطاقة' : 'Live Interactive Preview'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {isAr ? 'نمط:' : 'Style:'} {CARD_STYLES_LIST.find((s) => s.id === localPrefs.style)?.[isAr ? 'nameAr' : 'nameEn']}
            </span>
          </div>

          <div className="flex justify-center p-2">
            <div
              style={{
                opacity: localPrefs.opacity / 100,
              }}
              className={`w-full max-w-sm ${cardContainerClass} ${densityClasses.padding} flex items-center justify-between gap-3`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`${iconSizeClass} rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 shadow-sm`}>
                  <Box className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`${densityClasses.titleSize} text-slate-900 dark:text-white block truncate`}>
                      {isAr ? 'المصاريف والميزانية' : 'Expenses & Budget'}
                    </span>
                    {localPrefs.showBadges && (
                      <span className={`${densityClasses.badgeSize} rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold shrink-0`}>
                        {isAr ? '12 سجل' : '12 logs'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {isAr ? 'الميزانية الشهرية والتقارير' : 'Monthly budget & analytics'}
                  </p>
                </div>
              </div>

              <div className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-slate-500 shrink-0">
                <Check className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-2 px-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'presets'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span>✨</span>
            <span>{isAr ? 'القوالب الجاهزة' : 'Presets'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('styles')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'styles'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span>🎨</span>
            <span>{isAr ? 'الأنماط الـ 10' : '10 Styles'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('finetune')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'finetune'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span>⚙️</span>
            <span>{isAr ? 'التخصيص الدقيق' : 'Fine-Tune'}</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: PRESETS */}
          {activeTab === 'presets' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CARD_PRESETS.map((preset) => {
                const isSelected = localPrefs.activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.id)}
                    className={`p-3.5 rounded-2xl border text-start flex items-start gap-3 transition-all ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 shadow-md ring-1 ring-amber-400'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-2xl p-2 rounded-xl bg-slate-100 dark:bg-slate-700/80 shrink-0">
                      {preset.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                          {isAr ? preset.nameAr : preset.nameEn}
                        </h4>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                        {isAr ? preset.descriptionAr : preset.descriptionEn}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* TAB 2: 10 DISTINCT CARD STYLES */}
          {activeTab === 'styles' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CARD_STYLES_LIST.map((styleItem) => {
                const isSelected = localPrefs.style === styleItem.id;
                return (
                  <button
                    key={styleItem.id}
                    type="button"
                    onClick={() =>
                      setLocalPrefs((prev) => ({
                        ...prev,
                        style: styleItem.id,
                        activePreset: undefined,
                      }))
                    }
                    className={`p-3 rounded-2xl border text-start flex items-center gap-3 transition-all ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 shadow-md ring-1 ring-amber-400'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xl p-2 rounded-xl bg-slate-100 dark:bg-slate-700/80 shrink-0">
                      {styleItem.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                          {isAr ? styleItem.nameAr : styleItem.nameEn}
                        </h4>
                        {isSelected && <Check className="w-4 h-4 text-amber-500 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {isAr ? styleItem.descriptionAr : styleItem.descriptionEn}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* TAB 3: FINE-TUNE CONTROLS */}
          {activeTab === 'finetune' && (
            <div className="space-y-4">
              {/* Border Radius */}
              <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{isAr ? 'انحناء الحواف (Border Radius)' : 'Border Radius'}</span>
                  <span className="text-amber-500 font-mono text-[11px] uppercase">{localPrefs.radius}</span>
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {(['none', 'sm', 'md', 'lg', 'xl', 'full'] as CardRadius[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setLocalPrefs((p) => ({ ...p, radius: r, activePreset: undefined }))}
                      className={`py-1.5 px-1 rounded-xl text-[11px] font-black transition-all ${
                        localPrefs.radius === r
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {r === 'none'
                        ? isAr
                          ? 'حاد'
                          : '0px'
                        : r === 'sm'
                        ? '8px'
                        : r === 'md'
                        ? '12px'
                        : r === 'lg'
                        ? '16px'
                        : r === 'xl'
                        ? '24px'
                        : isAr
                        ? 'دائري'
                        : 'Pill'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shadow Depth */}
              <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{isAr ? 'عمق الظلال (Shadow Depth)' : 'Shadow Depth'}</span>
                  <span className="text-amber-500 font-mono text-[11px] uppercase">{localPrefs.shadow}</span>
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['none', 'subtle', 'medium', 'deep', 'glow'] as CardShadow[]).map((sh) => (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => setLocalPrefs((p) => ({ ...p, shadow: sh, activePreset: undefined }))}
                      className={`py-1.5 px-1 rounded-xl text-[11px] font-black transition-all ${
                        localPrefs.shadow === sh
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {sh === 'none'
                        ? isAr
                          ? 'بدون'
                          : 'None'
                        : sh === 'subtle'
                        ? isAr
                          ? 'خفيف'
                          : 'Subtle'
                        : sh === 'medium'
                        ? isAr
                          ? 'متوسط'
                          : 'Med'
                        : sh === 'deep'
                        ? isAr
                          ? 'عميق'
                          : 'Deep'
                        : isAr
                        ? 'توهج'
                        : 'Glow'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transparency / Opacity */}
              <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{isAr ? 'الشفافية (Card Opacity)' : 'Transparency'}</span>
                  <span className="text-amber-500 font-mono text-[11px]">{localPrefs.opacity}%</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[100, 90, 80, 70].map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setLocalPrefs((p) => ({ ...p, opacity: op, activePreset: undefined }))}
                      className={`py-1.5 px-1 rounded-xl text-xs font-black transition-all ${
                        localPrefs.opacity === op
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {op}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Density / Spacing */}
              <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{isAr ? 'كثافة وحجم البطاقة (Card Density)' : 'Card Size & Density'}</span>
                  <span className="text-amber-500 font-mono text-[11px] uppercase">{localPrefs.density}</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['compact', 'normal', 'spacious'] as CardDensity[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setLocalPrefs((p) => ({ ...p, density: d, activePreset: undefined }))}
                      className={`py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
                        localPrefs.density === d
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {d === 'compact'
                        ? isAr
                          ? 'مضغوط'
                          : 'Compact'
                        : d === 'normal'
                        ? isAr
                          ? 'متوازن'
                          : 'Normal'
                        : isAr
                        ? 'فسيح'
                        : 'Spacious'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Size */}
              <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{isAr ? 'حجم أيقونات البطاقات' : 'Card Icon Size'}</span>
                  <span className="text-amber-500 font-mono text-[11px] uppercase">{localPrefs.iconSize || 'medium'}</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['small', 'medium', 'large'] as CardIconSize[]).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setLocalPrefs((p) => ({ ...p, iconSize: size, activePreset: undefined }))}
                      className={`py-2 px-2 rounded-xl text-xs font-black transition-all ${
                        localPrefs.iconSize === size
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {size === 'small' ? (isAr ? 'صغير' : 'Small') : size === 'medium' ? (isAr ? 'متوسط' : 'Medium') : (isAr ? 'كبير' : 'Large')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Background */}
              <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{isAr ? 'لون خلفية البطاقات' : 'Card Background'}</span>
                  <span className="text-amber-500 font-mono text-[11px] uppercase">{localPrefs.backgroundTheme || 'default'}</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { id: 'default', ar: 'افتراضي', en: 'Default', swatch: 'bg-white dark:bg-slate-900' },
                    { id: 'sky', ar: 'سماوي', en: 'Sky', swatch: 'bg-sky-50' },
                    { id: 'mint', ar: 'نعناعي', en: 'Mint', swatch: 'bg-emerald-50' },
                    { id: 'lavender', ar: 'لافندر', en: 'Lavender', swatch: 'bg-violet-50' },
                    { id: 'peach', ar: 'خوخي', en: 'Peach', swatch: 'bg-orange-50' },
                    { id: 'candy', ar: 'وردي', en: 'Candy', swatch: 'bg-pink-50' },
                  ] as Array<{id: CardBackgroundTheme; ar: string; en: string; swatch: string}>).map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setLocalPrefs((p) => ({ ...p, backgroundTheme: bg.id, activePreset: undefined }))}
                      className={`py-2 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                        localPrefs.backgroundTheme === bg.id || (!localPrefs.backgroundTheme && bg.id === 'default')
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600 ${bg.swatch}`} />
                      {isAr ? bg.ar : bg.en}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{isAr ? 'إظهار وإخفاء البطاقات' : 'Show / Hide Cards'}</span>
                  <span className="text-amber-500 font-mono text-[11px]">{(localPrefs.hiddenCardIds || []).length}</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {sections.map((section) => {
                    const hidden = (localPrefs.hiddenCardIds || []).includes(section.id);
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setLocalPrefs((p) => {
                          const current = p.hiddenCardIds || [];
                          return {
                            ...p,
                            hiddenCardIds: hidden ? current.filter((id) => id !== section.id) : [...current, section.id],
                          };
                        })}
                        className={`flex items-center gap-2 p-2.5 rounded-xl text-start border transition-all ${
                          hidden
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {hidden ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0 text-emerald-500" />}
                        <span className="truncate font-bold text-[11px]">{isAr ? section.titleAr : section.titleEn}</span>
                        {section.emoji && <span className="ms-auto">{section.emoji}</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400">{isAr ? 'الإخفاء لا يحذف بيانات البطاقة، ويمكن إظهارها لاحقًا.' : 'Hiding a card does not delete its data.'}</p>
              </div>

              {/* Feature Toggles (3D Tilt, Badges, Glow) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isAr ? 'تأثير الإمالة 3D واللمعان' : '3D Tilt & Specular Glare'}
                  </span>
                  <input
                    type="checkbox"
                    checked={localPrefs.tilt3D}
                    onChange={(e) => setLocalPrefs((p) => ({ ...p, tilt3D: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isAr ? 'شارات ومؤشرات البيانات الحية' : 'Live Stat Badges'}
                  </span>
                  <input
                    type="checkbox"
                    checked={localPrefs.showBadges}
                    onChange={(e) => setLocalPrefs((p) => ({ ...p, showBadges: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isAr ? 'استعادة الافتراضي' : 'Reset'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>{isAr ? 'تطبيق وحفظ النمط ✓' : 'Save & Apply'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
