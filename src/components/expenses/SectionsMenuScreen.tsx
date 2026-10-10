import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Home,
  UserRound,
  Car,
  BookOpen,
  DollarSign,
  BarChart3,
  Layers,
  Wallet,
  Move,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  GripVertical,
} from 'lucide-react';
import { formatMoney } from '../../services/financeCalculations';
import { Language, UserProfile } from '../../types';
import { STORAGE_KEYS } from '../../services/storageKeys';
import { StorageAdapter } from '../../services/storageAdapter';

interface SectionsMenuScreenProps {
  language: Language;
  currency: string;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  onBack: () => void;
  onSelectSection: (section: 'house' | 'work' | 'personal' | 'vehicle' | 'education' | 'income_certs' | 'reports') => void;
  houseTotal: number;
  houseCount: number;
  workTotal: number;
  workCount: number;
  vehicleTotal: number;
  vehicleCount: number;
  educationTotal: number;
  educationCount: number;
  monthlyIncome: number;
  certsCount: number;
  monthlyExpenses: number;
  netIncome: number;
  certificatesProfit?: number;
  currentAccountNet?: number;
  userProfile?: UserProfile;
}

type SectionKey = 'vehicle' | 'income_certs' | 'education' | 'house' | 'personal' | 'reports';

const DEFAULT_SECTIONS_ORDER: SectionKey[] = [
  'vehicle',
  'income_certs',
  'education',
  'house',
  'personal',
  'reports',
];

export const SectionsMenuScreen: React.FC<SectionsMenuScreenProps> = ({
  language,
  currency,
  selectedMonth,
  onSelectMonth,
  onBack,
  onSelectSection,
  houseTotal,
  houseCount,
  workTotal,
  workCount,
  vehicleTotal,
  vehicleCount,
  educationTotal,
  educationCount,
  monthlyIncome,
  certsCount,
  monthlyExpenses,
  netIncome,
  certificatesProfit = 0,
  currentAccountNet = 0,
  userProfile,
}) => {
  const isAr = language === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatMoney(Math.abs(value))}`;
  const isSurplus = netIncome >= 0;

  const [isReorderMode, setIsReorderMode] = useState(false);
  const [draggedId, setDraggedId] = useState<SectionKey | null>(null);

  // Section order state loaded from localStorage
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EXPENSES_SECTIONS_ORDER);
      if (saved) {
        const parsed: SectionKey[] = JSON.parse(saved);
        const valid = parsed.filter((k) => DEFAULT_SECTIONS_ORDER.includes(k));
        DEFAULT_SECTIONS_ORDER.forEach((k) => {
          if (!valid.includes(k)) valid.push(k);
        });
        return valid;
      }
    } catch (e) {}
    return DEFAULT_SECTIONS_ORDER;
  });

  useEffect(() => {
    try {
      StorageAdapter.setItem(STORAGE_KEYS.EXPENSES_SECTIONS_ORDER, sectionOrder);
    } catch (e) {}
  }, [sectionOrder]);

  const rawSections: Record<SectionKey, {
    id: SectionKey;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    total: number;
    count: number;
    desc: string;
    noMoney?: boolean;
  }> = {
    vehicle: {
      id: 'vehicle',
      title: isAr ? 'سيارتي' : 'My Car',
      icon: Car,
      total: -Math.abs(vehicleTotal),
      count: vehicleCount,
      desc: isAr
        ? `${userProfile?.vehiclePreferences?.vehicleType || userProfile?.vehiclePreferences?.primaryVehicleName || 'السيارة الأساسية'} • ${userProfile?.vehiclePreferences?.vehicleShape || 'سيدان'}`
        : 'Vehicle expenses',
    },
    income_certs: {
      id: 'income_certs',
      title: isAr ? 'الدخل والشهادات' : 'Income & Certificates',
      icon: DollarSign,
      total: monthlyIncome,
      count: certsCount,
      desc: isAr ? 'الدخل، الشهادات البنكية والحساب الجاري' : 'Income, certificates and current account',
    },
    education: {
      id: 'education',
      title: isAr ? 'التعليم' : 'Education',
      icon: BookOpen,
      total: -Math.abs(educationTotal),
      count: educationCount,
      desc: isAr ? 'مصاريف التعليم والطلاب' : 'Education expenses',
    },
    house: {
      id: 'house',
      title: isAr ? 'مصروفات المنزل' : 'Home Expenses',
      icon: Home,
      total: -Math.abs(houseTotal),
      count: houseCount,
      desc: isAr ? 'كل مصروفات المنزل' : 'All home expenses',
    },
    personal: {
      id: 'personal',
      title: isAr ? 'المصروفات الشخصية' : 'Personal Expenses',
      icon: UserRound,
      total: -Math.abs(workTotal),
      count: workCount,
      desc: isAr ? 'المصروفات الشخصية اليومية' : 'Personal daily expenses',
    },
    reports: {
      id: 'reports',
      title: isAr ? 'التقارير' : 'Reports',
      icon: BarChart3,
      total: 0,
      count: 0,
      desc: isAr ? 'التقارير والتحليلات والتصدير' : 'Reports, analytics and export',
      noMoney: true,
    },
  };

  const orderedSections = sectionOrder.map((key) => rawSections[key]).filter(Boolean);

  const handleMove = (index: number, direction: 'up' | 'down', e?: React.MouseEvent) => {
    e?.stopPropagation();
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sectionOrder.length) return;

    const newOrder = [...sectionOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setSectionOrder(newOrder);

    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(10);
      } catch (err) {}
    }
  };

  const handleResetOrder = () => {
    setSectionOrder(DEFAULT_SECTIONS_ORDER);
    setIsReorderMode(false);
  };

  const handleDragStart = (e: React.DragEvent, id: SectionKey) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: SectionKey) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const fromIndex = sectionOrder.indexOf(draggedId);
    const toIndex = sectionOrder.indexOf(targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const newOrder = [...sectionOrder];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    setSectionOrder(newOrder);
    setDraggedId(null);
  };

  return (
    <div className="space-y-4 select-none" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Master section title with Reorder Control */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-cyan-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-2xs"
          >
            <BackIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <div className="font-black text-base sm:text-lg flex items-center justify-center gap-2">
              <Layers className="w-5 h-5 text-cyan-600" />
              <span>{isAr ? 'أقسام الدخل والمصروفات' : 'Income & Expenses Sections'}</span>
            </div>
          </div>
          {/* Reorder Button */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsReorderMode(!isReorderMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-2xs ${
                isReorderMode
                  ? 'bg-amber-500 text-slate-950 animate-pulse'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }`}
              title={isAr ? 'تحريك وترتيب بطاقات الأقسام' : 'Reorder sections'}
            >
              <Move className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isReorderMode ? (isAr ? 'تم ✓' : 'Done') : isAr ? 'ترتيب' : 'Reorder'}
              </span>
            </button>
            {isReorderMode && (
              <button
                type="button"
                onClick={handleResetOrder}
                className="p-1.5 rounded-xl text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition"
                title={isAr ? 'استعادة الترتيب الافتراضي' : 'Reset default'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Income data tab */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="w-full py-3 text-center font-black text-sm bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
          {isAr ? 'بيانات الدخل' : 'Income Data'}
        </div>
        <div className="grid grid-cols-3 gap-2 p-3 text-center">
          <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900">
            <div className="text-[11px] font-bold text-slate-500">الدخل</div>
            <div className="font-black text-emerald-600">+{formatMoney(monthlyIncome)} {currency}</div>
          </div>
          <div className="rounded-xl p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900">
            <div className="text-[11px] font-bold text-slate-500">المصروفات</div>
            <div className="font-black text-rose-600">-{formatMoney(Math.abs(monthlyExpenses))} {currency}</div>
          </div>
          <div className={`rounded-xl p-3 border ${isSurplus ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900' : 'bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900'}`}>
            <div className="text-[11px] font-bold text-slate-500">الصافي</div>
            <div className={`font-black ${isSurplus ? 'text-emerald-600' : 'text-rose-600'}`}>
              {signed(netIncome)} {currency}
            </div>
          </div>
        </div>
      </div>

      {/* Reordering helper hint */}
      {isReorderMode && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl flex items-center justify-between gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-amber-600" />
            <span>{isAr ? 'استخدم أزرار الأسهم أو اسحب البطاقات لتغيير ترتيبها.' : 'Use arrow buttons or drag cards to reorder.'}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsReorderMode(false)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black text-xs shrink-0"
          >
            {isAr ? 'حفظ والانتهاء ✓' : 'Done'}
          </button>
        </div>
      )}

      {/* Section cards with Touch Reordering & Drag & Drop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {orderedSections.map((sec, idx) => {
          const Icon = sec.icon;
          const positive = sec.total > 0;
          return (
            <div
              key={sec.id}
              draggable
              onDragStart={(e) => handleDragStart(e, sec.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, sec.id)}
              onClick={isReorderMode ? undefined : () => onSelectSection(sec.id)}
              className={`text-right bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all relative ${
                isReorderMode
                  ? 'border-amber-400 dark:border-amber-500 shadow-md ring-1 ring-amber-400 cursor-move'
                  : 'border-slate-200 dark:border-slate-800 shadow-xs hover:border-cyan-400 hover:shadow-md cursor-pointer active:scale-[.99]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {isReorderMode && (
                    <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                  )}
                  <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-cyan-600" />
                  </div>
                </div>

                {isReorderMode ? (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={(e) => handleMove(idx, 'up', e)}
                      className={`p-1.5 rounded-lg text-xs font-black transition-all ${
                        idx === 0
                          ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                          : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 hover:bg-amber-200'
                      }`}
                      title={isAr ? 'تحريك لأعلى ⬆️' : 'Move Up'}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === orderedSections.length - 1}
                      onClick={(e) => handleMove(idx, 'down', e)}
                      className={`p-1.5 rounded-lg text-xs font-black transition-all ${
                        idx === orderedSections.length - 1
                          ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                          : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 hover:bg-amber-200'
                      }`}
                      title={isAr ? 'تحريك لأسفل ⬇️' : 'Move Down'}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  !sec.noMoney && (
                    <span className={`font-black text-sm ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {signed(sec.total)} {currency}
                    </span>
                  )
                )}
              </div>

              <div className="mt-3">
                <div className="font-black text-base text-slate-900 dark:text-white">{sec.title}</div>
                <div className="text-xs text-slate-500 mt-1 line-clamp-1">{sec.desc}</div>
              </div>

              {!sec.noMoney && (
                <div className="mt-3 text-[11px] text-slate-400">
                  {sec.count} {isAr ? 'عملية/سجل' : 'records'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Master financial summary */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="w-full py-3 text-center font-black text-sm bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2">
          <Wallet className="w-4 h-4 text-cyan-600" />
          <span>{isAr ? 'الملخص المالي والمصروفات' : 'Financial Summary & Expenses'}</span>
        </div>
        <div className="p-3 space-y-2 text-sm">
          <SummaryRow label="الدخل والشهادات والحساب الجاري" value={monthlyIncome} positive />
          <SummaryRow label="سيارتي" value={-Math.abs(vehicleTotal)} />
          <SummaryRow label="التعليم" value={-Math.abs(educationTotal)} />
          <SummaryRow label="مصروفات المنزل" value={-Math.abs(houseTotal)} />
          <SummaryRow label="المصروفات الشخصية" value={-Math.abs(workTotal)} />
          <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
            <SummaryRow label="الإجمالي بعد المصروفات" value={netIncome} positive={netIncome >= 0} bold />
          </div>
          <div className="text-[11px] text-slate-400 pt-1">
            {isAr
              ? `أرباح الشهادات: +${formatMoney(certificatesProfit)} • صافي حركة الحساب الجاري: ${signed(currentAccountNet)}`
              : `Certificate profit: +${formatMoney(certificatesProfit)} • Current account net: ${signed(currentAccountNet)}`}
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryRow: React.FC<{ label: string; value: number; positive?: boolean; bold?: boolean }> = ({
  label,
  value,
  positive,
  bold,
}) => {
  const cls = value > 0 || positive ? 'text-emerald-600' : value < 0 ? 'text-rose-600' : 'text-slate-500';
  return (
    <div className={`flex items-center justify-between gap-3 ${bold ? 'font-black' : 'font-bold'}`}>
      <span>{label}</span>
      <span className={cls}>
        {value > 0 ? '+' : value < 0 ? '-' : ''}
        {formatMoney(Math.abs(value))}
      </span>
    </div>
  );
};
