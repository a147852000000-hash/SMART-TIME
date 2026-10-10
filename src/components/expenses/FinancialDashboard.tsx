import React from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  ChevronLeft,
  Calendar,
  Sparkles,
  PieChart,
  Home,
  UserRound,
  Car,
  BookOpen,
  Briefcase,
  DollarSign,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { formatMoney } from '../../services/financeCalculations';
import { Language } from '../../types';

export interface RecentTransactionItem {
  id: string;
  section: 'house' | 'work' | 'personal' | 'vehicle' | 'education';
  title: string;
  amount: number;
  date: string;
  badge: string;
}

interface FinancialDashboardProps {
  language: Language;
  currency: string;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  monthlyIncome: number;
  monthlyExpenses: number;
  netIncome: number;
  certificatesProfit?: number;
  houseTotal: number;
  houseCount?: number;
  workTotal: number;
  workCount?: number;
  vehicleTotal: number;
  vehicleCount?: number;
  educationTotal: number;
  educationCount?: number;
  certsCount?: number;
  onOpenSectionsMenu: () => void;
  onSelectSection?: (section: 'house' | 'work' | 'personal' | 'vehicle' | 'education' | 'income_certs' | 'reports') => void;
  onOpenSection?: (section: 'house' | 'work' | 'personal' | 'vehicle' | 'education' | 'income_certs' | 'reports') => void;
  onOpenAddExpense: () => void;
  recentTransactions?: RecentTransactionItem[];
}

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  language,
  currency,
  selectedMonth,
  onSelectMonth,
  monthlyIncome,
  monthlyExpenses,
  netIncome,
  certificatesProfit = 0,
  houseTotal,
  houseCount = 0,
  workTotal,
  workCount = 0,
  vehicleTotal,
  vehicleCount = 0,
  educationTotal,
  educationCount = 0,
  certsCount = 0,
  onOpenSectionsMenu,
  onSelectSection,
  onOpenSection,
  onOpenAddExpense,
  recentTransactions = [],
}) => {
  const isAr = language === 'ar';
  const isSurplus = netIncome >= 0;
  const savingsRate = monthlyIncome > 0 ? Math.max(0, Math.min(100, Math.round((netIncome / monthlyIncome) * 100))) : 0;
  const expenseRatio = monthlyIncome > 0 ? Math.min(100, Math.round((monthlyExpenses / monthlyIncome) * 100)) : 100;

  const handleNavigateSection = (sec: 'house' | 'work' | 'personal' | 'vehicle' | 'education' | 'income_certs' | 'reports') => {
    if (onSelectSection) {
      onSelectSection(sec);
    } else if (onOpenSection) {
      onOpenSection(sec);
    }
  };

  // Format month for display (e.g. 2026-03 -> مارس 2026)
  const formatMonthLabel = (monthStr: string) => {
    try {
      const [year, month] = monthStr.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return date.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
    } catch {
      return monthStr;
    }
  };

  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* 1. Header Bar with Month Switcher & Title */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {isAr ? 'الملخص المالي والمصروفات' : 'Financial Summary & Expenses'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr ? 'متابعة الدخل، المصروفات وصافي الفائض المالي' : 'Track income, expenses and monthly net balance'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            />
          </div>
          <button
            onClick={onOpenAddExpense}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
          >
            <span>+</span>
            <span>{isAr ? 'إضافة مصروف' : 'Add Expense'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary Row (الدخل الشهري | إجمالي المصروفات) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Monthly Income Card */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-cyan-300 dark:hover:border-cyan-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {isAr ? 'الدخل الشهري' : 'Monthly Income'}
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>

          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {formatMoney(monthlyIncome)}{' '}
            <span className="text-xs font-semibold text-slate-500">{currency}</span>
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>{formatMonthLabel(selectedMonth)}</span>
            {certificatesProfit > 0 && (
              <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                {isAr ? `يتضمن ${formatMoney(certificatesProfit)} أرباح شهادات` : `Includes ${formatMoney(certificatesProfit)} certs`}
              </span>
            )}
          </div>
        </div>

        {/* Total Monthly Expenses Card */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-cyan-300 dark:hover:border-cyan-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              {isAr ? 'إجمالي المصروفات' : 'Total Expenses'}
            </span>
            <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>

          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {formatMoney(monthlyExpenses)}{' '}
            <span className="text-xs font-semibold text-slate-500">{currency}</span>
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>{isAr ? 'نسبة الاستهلاك:' : 'Used of Income:'}</span>
            <span className={`font-bold ${expenseRatio > 90 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>
              {expenseRatio}%
            </span>
          </div>
        </div>
      </div>

      {/* 3. Middle Full Card: Net Monthly Income (صافي الدخل الشهري) */}
      <div
        className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm transition-all ${
          isSurplus
            ? 'border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-br from-white via-white to-emerald-50/30 dark:from-slate-900 dark:to-emerald-950/20'
            : 'border-rose-200 dark:border-rose-900/60 bg-gradient-to-br from-white via-white to-rose-50/30 dark:from-slate-900 dark:to-rose-950/20'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isSurplus ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              {isAr ? 'صافي الدخل الشهري' : 'Net Monthly Income'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {isAr ? 'إجمالي الدخل الشهري - إجمالي المصروفات الشهرية' : 'Total Monthly Income - Total Monthly Expenses'}
            </div>
          </div>

          <div
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
              isSurplus
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
            }`}
          >
            {isSurplus ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            <span>{isSurplus ? (isAr ? 'فائض مالي' : 'Surplus') : (isAr ? 'عجز مالي' : 'Deficit')}</span>
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className={`text-3xl font-black tracking-tight ${isSurplus ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {isSurplus ? '+' : ''}
            {formatMoney(netIncome)}{' '}
            <span className="text-sm font-semibold text-slate-500">{currency}</span>
          </div>

          {monthlyIncome > 0 && (
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              {isAr ? `نسبة الفائض: ${savingsRate}%` : `Savings: ${savingsRate}%`}
            </div>
          )}
        </div>

        {/* Progress Ratio Bar */}
        <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
          <div
            className={`h-full transition-all duration-500 ${expenseRatio > 90 ? 'bg-rose-500' : 'bg-cyan-500'}`}
            style={{ width: `${Math.min(100, expenseRatio)}%` }}
            title={`المصروفات: ${expenseRatio}%`}
          />
          {savingsRate > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${savingsRate}%` }}
              title={`الفائض: ${savingsRate}%`}
            />
          )}
        </div>
      </div>

      {/* 4. Primary Call To Action Button: [ الدخل والمصروفات ] */}
      <button
        onClick={onOpenSectionsMenu}
        className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-600 hover:from-cyan-600 hover:to-teal-600 text-white font-black text-base shadow-md hover:shadow-lg transition-all flex items-center justify-between group active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div className="text-right">
            <div className="font-black text-base leading-tight">
              {isAr ? 'الدخل والمصروفات' : 'Income & Expenses'}
            </div>
            <div className="text-xs font-normal text-cyan-50 opacity-90">
              {isAr ? 'فتح شاشة الأقسام والتفاصيل الكاملة' : 'Browse all sections & categories'}
            </div>
          </div>
        </div>

        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:translate-x-[-4px] transition-transform">
          <ChevronLeft className="w-5 h-5" />
        </div>
      </button>

      {/* 5. Quick Access Sections Grid */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
            {isAr ? 'نظرة سريعة على الأقسام' : 'Quick Sections Overview'}
          </h2>
          <button
            onClick={onOpenSectionsMenu}
            className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
          >
            <span>{isAr ? 'عرض الكل' : 'View All'}</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {/* Home */}
          <div
            onClick={() => handleNavigateSection('house')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer transition-all hover:border-cyan-300"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-cyan-600" />
                {isAr ? 'المنزل' : 'Home'}
              </span>
            </div>
            <div className="text-sm font-black text-slate-900 dark:text-slate-100">
              {formatMoney(houseTotal)} <span className="text-[10px] font-normal text-slate-500">{currency}</span>
            </div>
          </div>

          {/* Personal */}
          <div
            onClick={() => handleNavigateSection('personal')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer transition-all hover:border-cyan-300"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <UserRound className="w-3.5 h-3.5 text-cyan-600" />
                {isAr ? 'المصروفات الشخصية' : 'Personal'}
              </span>
            </div>
            <div className="text-sm font-black text-slate-900 dark:text-slate-100">
              {formatMoney(workTotal)} <span className="text-[10px] font-normal text-slate-500">{currency}</span>
            </div>
          </div>

          {/* Vehicle */}
          <div
            onClick={() => handleNavigateSection('vehicle')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer transition-all hover:border-cyan-300"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-cyan-600" />
                {isAr ? 'المركبة' : 'Vehicle'}
              </span>
            </div>
            <div className="text-sm font-black text-slate-900 dark:text-slate-100">
              {formatMoney(vehicleTotal)} <span className="text-[10px] font-normal text-slate-500">{currency}</span>
            </div>
          </div>

          {/* Education */}
          <div
            onClick={() => handleNavigateSection('education')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer transition-all hover:border-cyan-300"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-cyan-600" />
                {isAr ? 'التعليم' : 'Education'}
              </span>
            </div>
            <div className="text-sm font-black text-slate-900 dark:text-slate-100">
              {formatMoney(educationTotal)} <span className="text-[10px] font-normal text-slate-500">{currency}</span>
            </div>
          </div>

          {/* Income & Certificates */}
          <div
            onClick={() => handleNavigateSection('income_certs')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer transition-all hover:border-cyan-300"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                {isAr ? 'الدخل والشهادات' : 'Income & Certs'}
              </span>
            </div>
            <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {formatMoney(monthlyIncome)} <span className="text-[10px] font-normal text-slate-500">{currency}</span>
            </div>
          </div>

          {/* Reports */}
          <div
            onClick={() => handleNavigateSection('reports')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer transition-all hover:border-cyan-300"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-600" />
                {isAr ? 'التقارير والتحليلات' : 'Reports & Analytics'}
              </span>
            </div>
            <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
              {isAr ? 'فتح الرسوم والتقارير' : 'View Charts'}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Recent Transactions Stream */}
      {recentTransactions.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-500" />
              <span>{isAr ? 'أحدث العمليات المسجلة' : 'Recent Expenses Stream'}</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              {recentTransactions.length} {isAr ? 'عمليات حديثة' : 'recent items'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                onClick={() => handleNavigateSection(tx.section)}
                className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 rounded-xl px-2 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-100 dark:border-cyan-900/40 flex items-center justify-center text-cyan-600 text-xs font-bold">
                    {tx.section === 'house' ? <Home className="w-3.5 h-3.5" /> : tx.section === 'work' ? <Briefcase className="w-3.5 h-3.5" /> : tx.section === 'vehicle' ? <Car className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      {tx.title}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {tx.date} • <span className="text-cyan-600 dark:text-cyan-400">{tx.badge}</span>
                    </span>
                  </div>
                </div>

                <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                  {formatMoney(tx.amount)} <span className="text-[10px] font-normal text-slate-500">{currency}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
