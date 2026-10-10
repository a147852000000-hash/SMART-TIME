import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Building,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Percent,
  Calculator,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  X,
  Sparkles,
  CheckCircle2,
  Coins,
  Receipt,
  Layers,
  Car,
} from 'lucide-react';
import { CarIncomeSection } from './CarIncomeSection';
import {
  formatMoney,
  calculateCertificateProfits,
  getCertificatesProfitForMonth,
  getPrimaryIncomeForMonth,
} from '../../services/financeCalculations';
import {
  Language,
  MonthlyIncome,
  BankCertificate,
  CertificateProfitFrequency,
  IncomeSourceItem,
} from '../../types';

interface IncomeAndCertificatesSectionProps {
  language: Language;
  currency: string;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  onBack: () => void;
  incomeList: MonthlyIncome[];
  onSaveIncome: (list: MonthlyIncome[]) => void;
  certificates: BankCertificate[];
  onSaveCertificates: (list: BankCertificate[]) => void;
  onIncomeChanged?: () => void;
}

export const IncomeAndCertificatesSection: React.FC<IncomeAndCertificatesSectionProps> = ({
  language,
  currency,
  selectedMonth,
  onSelectMonth,
  onBack,
  incomeList,
  onSaveIncome,
  certificates,
  onSaveCertificates,
}) => {
  const isAr = language === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const [activeTab, setActiveTab] = useState<'menu' | 'income' | 'certificates' | 'all'>('menu');
  const [bankTab, setBankTab] = useState<'certificates' | 'current'>('certificates');
  const [incomeMode, setIncomeMode] = useState<'job' | 'free' | 'car'>('job');
  const [incomeJobTab, setIncomeJobTab] = useState<'salary' | 'bonus' | 'transfer' | 'other'>('salary');

  // --- 1. INCOME SOURCES STATE ---
  const currentMonthDoc = useMemo(() => {
    return incomeList.find((i) => i.month === selectedMonth);
  }, [incomeList, selectedMonth]);

  const currentSources: IncomeSourceItem[] = useMemo(() => {
    const stored = currentMonthDoc?.sources?.filter((s) => s.type !== 'current_deposit' && s.type !== 'current_withdrawal') || [];
    if (stored.length > 0) return stored;
    // Fallback migration from legacy fields
    const legacy: IncomeSourceItem[] = [];
    if (currentMonthDoc?.salary && currentMonthDoc.salary > 0) {
      legacy.push({ id: `src_sal_${selectedMonth}`, source: isAr ? 'الراتب الأساسي' : 'Base Salary', amount: currentMonthDoc.salary, date: `${selectedMonth}-01`, type: 'salary', notes: isAr ? 'الراتب الشهري' : 'Monthly Salary', createdAt: currentMonthDoc.createdAt || new Date().toISOString() });
    }
    if (currentMonthDoc?.bonuses && currentMonthDoc.bonuses > 0) {
      legacy.push({ id: `src_bon_${selectedMonth}`, source: isAr ? 'مكافآت وحوافز' : 'Bonuses', amount: currentMonthDoc.bonuses, date: `${selectedMonth}-01`, type: 'bonus', notes: isAr ? 'مكافآت شهرية' : 'Bonuses', createdAt: currentMonthDoc.createdAt || new Date().toISOString() });
    }
    if (currentMonthDoc?.otherIncome && currentMonthDoc.otherIncome > 0) {
      legacy.push({ id: `src_oth_${selectedMonth}`, source: isAr ? 'دخل إضافي' : 'Other Income', amount: currentMonthDoc.otherIncome, date: `${selectedMonth}-01`, type: 'extra', notes: currentMonthDoc.otherIncomeNote || (isAr ? 'دخل إضافي' : 'Other income'), createdAt: currentMonthDoc.createdAt || new Date().toISOString() });
    }
    return legacy;
  }, [currentMonthDoc, selectedMonth, isAr]);

  const currentAccountTransactions: IncomeSourceItem[] = useMemo(() =>
    (currentMonthDoc?.sources || []).filter((s) => s.type === 'current_deposit' || s.type === 'current_withdrawal'),
    [currentMonthDoc]
  );
  const currentAccountBalance = currentAccountTransactions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);


  // Modals
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [sourceAmount, setSourceAmount] = useState('');
  const [sourceDate, setSourceDate] = useState(`${selectedMonth}-01`);
  const [sourceType, setSourceType] = useState('salary');
  const [sourceNotes, setSourceNotes] = useState('');

  // --- 1B. CURRENT ACCOUNT STATE ---
  const [currentAccountMode, setCurrentAccountMode] = useState<'deposit' | 'withdrawal'>('deposit');
  const [currentAccountDescription, setCurrentAccountDescription] = useState('');
  const [currentAccountAmount, setCurrentAccountAmount] = useState('');
  const [currentAccountDate, setCurrentAccountDate] = useState(`${selectedMonth}-01`);
  const [editingCurrentAccountId, setEditingCurrentAccountId] = useState<string | null>(null);

  // --- 2. BANK CERTIFICATES STATE ---
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [editingCertId, setEditingCertId] = useState<string | null>(null);

  const [certBankName, setCertBankName] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [certAmount, setCertAmount] = useState('');
  const [certAnnualRate, setCertAnnualRate] = useState('18');
  const [certDuration, setCertDuration] = useState('1 سنة');
  const [certIssueDate, setCertIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [certMaturityDate, setCertMaturityDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [certProfitDate, setCertProfitDate] = useState(new Date().toISOString().split('T')[0]);
  const [certFrequency, setCertFrequency] = useState<CertificateProfitFrequency>('monthly');
  const [certReturnType, setCertReturnType] = useState<'simple' | 'compound' | 'variable'>('simple');
  const [certNotes, setCertNotes] = useState('');

  // Live profit calculation inside Certificate Modal
  const calculatedProfits = useMemo(() => {
    const amt = parseFloat(certAmount) || 0;
    const rate = parseFloat(certAnnualRate) || 0;
    return calculateCertificateProfits(amt, rate, certFrequency, certDuration);
  }, [certAmount, certAnnualRate, certFrequency, certDuration]);

  // Auto update maturity date when issueDate or duration changes
  const handleDurationChange = (val: string) => {
    setCertDuration(val);
    try {
      const issue = new Date(certIssueDate);
      if (!isNaN(issue.getTime())) {
        if (val.includes('3')) {
          issue.setFullYear(issue.getFullYear() + 3);
        } else if (val.includes('2')) {
          issue.setFullYear(issue.getFullYear() + 2);
        } else if (val.includes('6') && val.includes('شهر')) {
          issue.setMonth(issue.getMonth() + 6);
        } else {
          issue.setFullYear(issue.getFullYear() + 1);
        }
        setCertMaturityDate(issue.toISOString().split('T')[0]);
      }
    } catch {}
  };

  // --- 3. TOTALS & LINKING CALCULATIONS ---
  const primaryIncomeTotal = currentSources.reduce((s, src) => s + (Number(src.amount) || 0), 0) + currentAccountBalance;
  const monthlyCertsProfit = getCertificatesProfitForMonth(certificates, selectedMonth);
  const grandTotalIncome = primaryIncomeTotal + monthlyCertsProfit;

  // --- SAVE INCOME SOURCE ---
  const handleSaveSource = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(sourceAmount);
    if (isNaN(p) || p <= 0 || !sourceName.trim()) { window.alert(isAr ? 'من فضلك أدخل اسم مصدر الدخل والمبلغ بشكل صحيح.' : 'Please enter a valid income source and amount.'); return; }

    const effectiveSourceType = incomeMode === 'free' ? 'extra' : incomeJobTab;
    const newSource: IncomeSourceItem = {
      id: editingSourceId || `src_${Date.now()}`,
      source: sourceName.trim(),
      amount: p,
      date: sourceDate,
      type: effectiveSourceType,
      notes: sourceNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    let updatedSources: IncomeSourceItem[];
    if (editingSourceId) {
      updatedSources = currentSources.map((s) => (s.id === editingSourceId ? newSource : s));
    } else {
      updatedSources = [newSource, ...currentSources];
    }

    // Update or create MonthlyIncome document
    const salary = updatedSources.filter((s) => s.type === 'salary').reduce((s, x) => s + x.amount, 0);
    const bonuses = updatedSources.filter((s) => s.type === 'bonus').reduce((s, x) => s + x.amount, 0);
    const otherIncome = updatedSources.filter((s) => s.type !== 'salary' && s.type !== 'bonus').reduce((s, x) => s + x.amount, 0);

    const newMonthDoc: MonthlyIncome = {
      id: currentMonthDoc?.id || `income_${selectedMonth}`,
      month: selectedMonth,
      salary,
      bonuses,
      otherIncome,
      sources: updatedSources,
      createdAt: currentMonthDoc?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextIncomeList = currentMonthDoc
      ? incomeList.map((doc) => (doc.month === selectedMonth ? newMonthDoc : doc))
      : [newMonthDoc, ...incomeList];

    onSaveIncome(nextIncomeList);
    setIsIncomeModalOpen(false);
  };

  const handleDeleteSource = (id: string) => {
    if (window.confirm(isAr ? 'هل أنت متأكد من حذف مصدر الدخل هذا؟' : 'Delete this income source?')) {
      const updatedSources = currentSources.filter((s) => s.id !== id);
      const salary = updatedSources.filter((s) => s.type === 'salary').reduce((s, x) => s + x.amount, 0);
      const bonuses = updatedSources.filter((s) => s.type === 'bonus').reduce((s, x) => s + x.amount, 0);
      const otherIncome = updatedSources.filter((s) => s.type !== 'salary' && s.type !== 'bonus').reduce((s, x) => s + x.amount, 0);

      const newMonthDoc: MonthlyIncome = {
        id: currentMonthDoc?.id || `income_${selectedMonth}`,
        month: selectedMonth,
        salary,
        bonuses,
        otherIncome,
        sources: updatedSources,
        createdAt: currentMonthDoc?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const nextIncomeList = currentMonthDoc
        ? incomeList.map((doc) => (doc.month === selectedMonth ? newMonthDoc : doc))
        : [newMonthDoc, ...incomeList];

      onSaveIncome(nextIncomeList);
    }
  };

  const saveCurrentAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(currentAccountAmount);
    if (!currentAccountDescription.trim() || isNaN(value) || value <= 0) {
      window.alert(isAr ? 'من فضلك أدخل وصف العملية وقيمتها بشكل صحيح.' : 'Please enter a valid description and amount.');
      return;
    }
    const signedAmount = currentAccountMode === 'withdrawal' ? -value : value;
    const newTx: IncomeSourceItem = {
      id: editingCurrentAccountId || `current_${Date.now()}`,
      source: currentAccountDescription.trim(),
      amount: signedAmount,
      date: currentAccountDate,
      type: currentAccountMode === 'withdrawal' ? 'current_withdrawal' : 'current_deposit',
      notes: currentAccountMode === 'withdrawal' ? 'سحب من الحساب الجاري' : 'إيداع في الحساب الجاري',
      createdAt: editingCurrentAccountId ? (currentAccountTransactions.find(x => x.id === editingCurrentAccountId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };
    const allSources = [...currentSources, ...currentAccountTransactions];
    const updatedSources = editingCurrentAccountId
      ? allSources.map(x => x.id === editingCurrentAccountId ? newTx : x)
      : [newTx, ...allSources];
    const salary = updatedSources.filter(s => s.type === 'salary').reduce((sum, x) => sum + x.amount, 0);
    const bonuses = updatedSources.filter(s => s.type === 'bonus').reduce((sum, x) => sum + x.amount, 0);
    const otherIncome = updatedSources.filter(s => s.type !== 'salary' && s.type !== 'bonus' && s.type !== 'current_deposit' && s.type !== 'current_withdrawal').reduce((sum, x) => sum + x.amount, 0);
    const nextDoc: MonthlyIncome = {
      id: currentMonthDoc?.id || `income_${selectedMonth}`,
      month: selectedMonth, salary, bonuses, otherIncome, sources: updatedSources,
      createdAt: currentMonthDoc?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const nextList = currentMonthDoc ? incomeList.map(doc => doc.month === selectedMonth ? nextDoc : doc) : [nextDoc, ...incomeList];
    onSaveIncome(nextList);
    setEditingCurrentAccountId(null); setCurrentAccountDescription(''); setCurrentAccountAmount(''); setCurrentAccountDate(`${selectedMonth}-01`);
  };

  const deleteCurrentAccount = (id: string) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذه العملية؟' : 'Delete this transaction?')) return;
    const updatedSources = [...currentSources, ...currentAccountTransactions].filter(x => x.id !== id);
    const salary = updatedSources.filter(s => s.type === 'salary').reduce((sum, x) => sum + x.amount, 0);
    const bonuses = updatedSources.filter(s => s.type === 'bonus').reduce((sum, x) => sum + x.amount, 0);
    const otherIncome = updatedSources.filter(s => s.type !== 'salary' && s.type !== 'bonus' && s.type !== 'current_deposit' && s.type !== 'current_withdrawal').reduce((sum, x) => sum + x.amount, 0);
    const nextDoc: MonthlyIncome = { id: currentMonthDoc?.id || `income_${selectedMonth}`, month: selectedMonth, salary, bonuses, otherIncome, sources: updatedSources, createdAt: currentMonthDoc?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    const nextList = currentMonthDoc ? incomeList.map(doc => doc.month === selectedMonth ? nextDoc : doc) : incomeList;
    onSaveIncome(nextList);
  };

  const exportCurrentAccount = (type: 'csv' | 'print') => {
    if (type === 'print') { window.print(); return; }
    const rows = currentAccountTransactions.map(x => [x.type === 'current_withdrawal' ? 'سحب' : 'إيداع', x.source, x.amount, x.date]);
    const csv = '\uFEFF' + [['النوع','الوصف','القيمة','التاريخ'], ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`current-account-${selectedMonth}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  // --- SAVE CERTIFICATE ---
  const handleSaveCertificate = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(certAmount);
    const rate = parseFloat(certAnnualRate);
    if (isNaN(amt) || amt <= 0 || !certBankName.trim()) { window.alert(isAr ? 'من فضلك أدخل البنك وقيمة الشهادة بشكل صحيح.' : 'Please enter a valid bank and certificate amount.'); return; }

    const calc = calculateCertificateProfits(amt, rate || 0, certFrequency, certDuration);

    const newCert: BankCertificate = {
      id: editingCertId || `cert_${Date.now()}`,
      bankName: certBankName.trim(),
      certificateNumber: certNumber.trim() || undefined,
      duration: certDuration.trim(),
      amount: amt,
      annualRate: rate || 0,
      annualProfit: calc.annualProfit,
      periodicProfit: calc.periodicProfit,
      monthlyEquivalentProfit: calc.monthlyEquivalent,
      returnType: certReturnType,
      issueDate: certIssueDate,
      maturityDate: certMaturityDate,
      profitDate: certProfitDate,
      profitAmount: calc.periodicProfit,
      profitFrequency: certFrequency,
      notes: certNotes.trim() || undefined,
      createdAt: editingCertId ? certificates.find((c) => c.id === editingCertId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextCerts = editingCertId
      ? certificates.map((c) => (c.id === editingCertId ? newCert : c))
      : [newCert, ...certificates];

    onSaveCertificates(nextCerts);
    setIsCertModalOpen(false);
  };

  const handleDeleteCert = (id: string) => {
    if (window.confirm(isAr ? 'هل أنت متأكد من حذف هذه الشهادة البنكية؟' : 'Delete this certificate?')) {
      const nextCerts = certificates.filter((c) => c.id !== id);
      onSaveCertificates(nextCerts);
    }
  };

  const openEditCert = (c: BankCertificate) => {
    setEditingCertId(c.id);
    setCertBankName(c.bankName);
    setCertNumber(c.certificateNumber || '');
    setCertAmount(String(c.amount));
    setCertAnnualRate(String(c.annualRate || '18'));
    setCertDuration(c.duration);
    setCertIssueDate(c.issueDate);
    setCertMaturityDate(c.maturityDate);
    setCertProfitDate(c.profitDate);
    setCertFrequency(c.profitFrequency || 'monthly');
    setCertReturnType(c.returnType || 'simple');
    setCertNotes(c.notes || '');
    setIsCertModalOpen(true);
  };

  const exportIncomeData = (type: 'csv' | 'print') => {
    if (type === 'csv') {
      const headers = ['الفئة', 'الوصف', 'القيمة', 'التاريخ'];
      const rows = currentSources.map((s) => [
        s.type === 'salary' ? 'الراتب الشهري' : s.type === 'bonus' ? 'مكافآت' : s.type === 'transfer' ? 'انتقالات' : 'أخرى/دخل حر',
        s.source,
        s.amount,
        s.date,
      ]);
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monthly-income-${selectedMonth}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      window.print();
    }
  };


  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* 1. Header with Back Button */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (activeTab === 'menu' ? onBack() : setActiveTab('menu'))}
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-slate-700 dark:text-slate-200 hover:text-cyan-600 flex items-center justify-center transition-all active:scale-95"
            title={isAr ? 'رجوع' : 'Back'}
          >
            <BackIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">
                {isAr ? 'الدخل الشهري ومعاملات البنكية' : 'Monthly Income & Bank Transactions'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'إدارة الدخل الشهري والمعاملات البنكية بنفس نظام المصروفات' : 'Manage monthly income and bank transactions'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2"></div>
      </div>

      {/* 2. Main section menu — same philosophy as My Car */}
      {activeTab === 'menu' && (
        <>
          <div className="w-full bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-1.5">
            <button onClick={() => setActiveTab('income')} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[.99]">
              <Coins className="w-4 h-4" />
              <span>{isAr ? 'الدخل الشهري' : 'Monthly Income'}</span>
            </button>
            <button onClick={() => setActiveTab('certificates')} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black text-sm flex items-center justify-center gap-2 active:scale-[.99]">
              <Building className="w-4 h-4" />
              <span>{isAr ? 'معاملات البنكية' : 'Bank Transactions'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => setActiveTab('income')} className="text-right bg-white dark:bg-slate-900 p-5 rounded-3xl border border-emerald-200 dark:border-emerald-900/40 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all active:scale-[.99]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600"><Coins className="w-6 h-6" /></div>
                <div className="flex-1">
                  <h2 className="font-black text-slate-900 dark:text-white">{isAr ? 'الدخل الشهري' : 'Monthly Income'}</h2>
                  <p className="text-xs text-slate-500 mt-1">{isAr ? `${currentSources.length} مصدر دخل • ${formatMoney(primaryIncomeTotal)} ${currency}` : `${currentSources.length} sources • ${formatMoney(primaryIncomeTotal)} ${currency}`}</p>
                </div>
                <ArrowLeft className="w-5 h-5 text-slate-400 rtl:rotate-180" />
              </div>
            </button>

            <button onClick={() => setActiveTab('certificates')} className="text-right bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all active:scale-[.99]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600"><Building className="w-6 h-6" /></div>
                <div className="flex-1">
                  <h2 className="font-black text-slate-900 dark:text-white">{isAr ? 'المعاملات البنكية' : 'Bank Transactions'}</h2>
                  <p className="text-xs text-slate-500 mt-1">{isAr ? `${certificates.length} معاملة/شهادة • ${formatMoney(monthlyCertsProfit)} ${currency} عائد شهري` : `${certificates.length} records • ${formatMoney(monthlyCertsProfit)} ${currency} monthly return`}</p>
                </div>
                <ArrowLeft className="w-5 h-5 text-slate-400 rtl:rotate-180" />
              </div>
            </button>
          </div>
        </>
      )}

      {/* 2. Income detail screen — organized like My Car */}
      {activeTab === 'income' && (
        <div className="space-y-4">
          <div className="w-full bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-1.5">
            <button onClick={() => setActiveTab('income')} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-black text-sm">{isAr ? 'الدخل الشهري' : 'Monthly Income'}</button>
            <button onClick={() => setActiveTab('certificates')} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black text-sm">{isAr ? 'معاملات البنكية' : 'Bank Transactions'}</button>
          </div>

          <div className="w-full bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-1.5">
            <button
              onClick={() => setIncomeMode('job')}
              className={`flex-1 py-3 rounded-xl font-black text-xs sm:text-sm transition-all ${incomeMode === 'job' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
            >{isAr ? 'الوظيفة' : 'Job'}</button>
            <button
              onClick={() => setIncomeMode('free')}
              className={`flex-1 py-3 rounded-xl font-black text-xs sm:text-sm transition-all ${incomeMode === 'free' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
            >{isAr ? 'دخل حر' : 'Freelance'}</button>
            <button
              onClick={() => setIncomeMode('car')}
              className={`flex-1 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${incomeMode === 'car' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
            >
              <Car className="w-4 h-4" />
              <span>{isAr ? 'دخل سيارة 🚗' : 'Car Income'}</span>
            </button>
          </div>

          {incomeMode === 'car' ? (
            <CarIncomeSection
              language={language}
              currency={currency}
              selectedMonth={selectedMonth}
            />
          ) : (
            <>
              {incomeMode === 'job' && (
                <div className="w-full bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    ['salary', 'الراتب الشهري'],
                    ['bonus', 'مكافآت'],
                    ['transfer', 'انتقالات'],
                    ['other', 'أخرى'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setIncomeJobTab(key as typeof incomeJobTab)}
                      className={`py-2.5 rounded-xl text-xs font-black transition-all ${incomeJobTab === key ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >{isAr ? label : key === 'salary' ? 'Monthly Salary' : key === 'bonus' ? 'Bonuses' : key === 'transfer' ? 'Transfers' : 'Other'}</button>
                  ))}
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                    <div className="text-[11px] font-black text-slate-500 mb-2">{isAr ? 'الوصف' : 'Description'}</div>
                    <input
                      type="text"
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                      placeholder={isAr ? (incomeMode === 'job' ? ({salary:'مثال: الراتب الأساسي',bonus:'مثال: مكافأة الأداء',transfer:'مثال: بدل انتقالات',other:'مثال: دخل آخر'} as Record<string,string>)[incomeJobTab] : 'مثال: عمل حر / مشروع') : 'Income description'}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                    <div className="text-[11px] font-black text-slate-500 mb-2">{isAr ? 'القيمة' : 'Amount'}</div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={sourceAmount}
                      onChange={(e) => setSourceAmount(e.target.value)}
                      placeholder="0"
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-black text-emerald-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 p-3">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{isAr ? 'الإجمالي المحسوب تلقائياً' : 'Auto Calculated Total'}</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatMoney(currentSources.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) + (parseFloat(sourceAmount) || 0))} {currency}</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
                    handleSaveSource(syntheticEvent);
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black shadow-sm active:scale-[.99]"
                >
                  {editingSourceId ? (isAr ? 'حفظ التعديل' : 'Save Edit') : (isAr ? 'حفظ الدخل' : 'Save Income')}
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">{isAr ? 'الدخل المحفوظ' : 'Saved Income'}</h2>
                    <p className="text-[11px] text-slate-400 mt-1">{formatMoney(primaryIncomeTotal)} {currency}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => exportIncomeData('csv')} className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center gap-1"><FileSpreadsheet className="w-3.5 h-3.5" />{isAr ? 'تصدير' : 'Export'}</button>
                    <button onClick={() => exportIncomeData('print')} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" title={isAr ? 'طباعة / PDF' : 'Print / PDF'}><Printer className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {currentSources.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">{isAr ? 'لم يتم حفظ أي دخل بعد.' : 'No income saved yet.'}</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentSources.map((src) => (
                      <div key={src.id} className="p-3.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{src.source}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{src.type === 'salary' ? 'الراتب الشهري' : src.type === 'bonus' ? 'مكافآت' : src.type === 'transfer' ? 'انتقالات' : 'دخل حر / أخرى'} • {src.date}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-black text-emerald-600">+{formatMoney(src.amount)} {currency}</span>
                          <button onClick={() => { setEditingSourceId(src.id); setSourceName(src.source); setSourceAmount(String(src.amount)); setSourceDate(src.date); setSourceType(src.type); setSourceNotes(src.notes || ''); setIncomeMode(src.type === 'extra' ? 'free' : 'job'); setIncomeJobTab((src.type === 'salary' || src.type === 'bonus' || src.type === 'transfer' || src.type === 'other') ? src.type as typeof incomeJobTab : 'other'); }} className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteSource(src.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. Bank transactions detail — existing certificate properties preserved */}
      {activeTab === 'certificates' && (
        <div className="space-y-4">
          <div className="w-full bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-1.5">
            <button onClick={() => setActiveTab('income')} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black text-sm">{isAr ? 'الدخل الشهري' : 'Monthly Income'}</button>
            <button onClick={() => setActiveTab('certificates')} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-black text-sm">{isAr ? 'معاملات بنكية' : 'Bank Transactions'}</button>
          </div>

          <div className="w-full bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-1.5">
            <button onClick={() => setBankTab('certificates')} className={`flex-1 py-3 rounded-xl font-black text-sm ${bankTab === 'certificates' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>{isAr ? 'الشهادات البنكية' : 'Bank Certificates'}</button>
            <button onClick={() => setBankTab('current')} className={`flex-1 py-3 rounded-xl font-black text-sm ${bankTab === 'current' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>{isAr ? 'الحساب الجاري' : 'Current Account'}</button>
          </div>

          {bankTab === 'certificates' && <>
          <button
            type="button"
            onClick={() => {
              setEditingCertId(null);
              setCertBankName('');
              setCertNumber('');
              setCertAmount('');
              setCertAnnualRate('18');
              setCertDuration('1 سنة');
              setCertFrequency('monthly');
              setCertNotes('');
              setIsCertModalOpen(true);
            }}
            className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[.99]"
          >
            <Building className="w-4 h-4" />
            <span>{isAr ? 'إضافة معاملة +' : 'Add Transaction +'}</span>
          </button>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 block mb-1">{isAr ? 'إجمالي أصل المعاملات البنكية المحفوظة' : 'Total Bank Principal'}</span>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{formatMoney(certificates.reduce((s, c) => s + (Number(c.amount) || 0), 0))} <span className="text-xs font-semibold text-slate-500">{currency}</span></div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-500 block mb-1">{isAr ? 'العائد الشهري المحسوب' : 'Monthly Return'}</span>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">+{formatMoney(monthlyCertsProfit)} {currency}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {certificates.length === 0 ? (
              <div className="col-span-2 bg-white dark:bg-slate-900 p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 space-y-2">
                <Building className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs">{isAr ? 'لا توجد معاملات بنكية مضافة بعد' : 'No bank transactions added yet'}</p>
              </div>
            ) : (
              certificates.map((cert) => {
                const calc = calculateCertificateProfits(cert.amount, cert.annualRate || 0, cert.profitFrequency, cert.duration);
                return (
                  <div key={cert.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600"><Building className="w-4 h-4" /></div>
                          <div><h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{cert.bankName}</h3>{cert.certificateNumber && <span className="text-[10px] text-slate-400 block">{cert.certificateNumber}</span>}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditCert(cert)} className="p-1 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteCert(cert.id)} className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between mt-3 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl">
                        <div><span className="text-[10px] text-slate-400 block">{isAr ? 'قيمة المعاملة' : 'Principal'}</span><span className="text-lg font-black text-slate-900 dark:text-white">{formatMoney(cert.amount)} {currency}</span></div>
                        <div className="text-right"><span className="text-[10px] text-slate-400 block">{isAr ? 'العائد' : 'Return'}</span><span className="text-sm font-black text-emerald-600">{formatMoney(calc.monthlyEquivalent)} {currency}/شهر</span></div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </>}

          {bankTab === 'current' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs font-bold text-slate-500 mb-1">{isAr ? 'قيمة الحساب الجاري الحالية' : 'Current Account Balance'}</div>
                <div className={`text-3xl font-black ${currentAccountBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{currentAccountBalance >= 0 ? '+' : ''}{formatMoney(currentAccountBalance)} {currency}</div>
                <div className="text-[11px] text-slate-400 mt-1">{isAr ? 'تضاف القيمة الصافية تلقائياً إلى إجمالي الدخل الشهري' : 'Net balance is automatically included in monthly income.'}</div>
              </div>

              <div className="w-full bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-1.5">
                <button onClick={() => setCurrentAccountMode('deposit')} className={`flex-1 py-3 rounded-xl font-black text-sm ${currentAccountMode === 'deposit' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>{isAr ? 'إيداع' : 'Deposit'}</button>
                <button onClick={() => setCurrentAccountMode('withdrawal')} className={`flex-1 py-3 rounded-xl font-black text-sm ${currentAccountMode === 'withdrawal' ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>{isAr ? 'سحب' : 'Withdrawal'}</button>
              </div>

              <form onSubmit={saveCurrentAccount} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold block mb-1">{isAr ? 'الوصف' : 'Description'}</label><input value={currentAccountDescription} onChange={e => setCurrentAccountDescription(e.target.value)} required className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border" placeholder={isAr ? 'مثال: تحويل من البنك' : 'e.g. Bank transfer'} /></div>
                  <div><label className="text-xs font-bold block mb-1">{isAr ? 'قيمة الإيداع' : 'Amount'}</label><input type="number" min="0.01" step="0.01" value={currentAccountAmount} onChange={e => setCurrentAccountAmount(e.target.value)} required className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border font-black" placeholder="0" /></div>
                </div>
                <div><label className="text-xs font-bold block mb-1">{isAr ? 'التاريخ' : 'Date'}</label><input type="date" value={currentAccountDate} onChange={e => setCurrentAccountDate(e.target.value)} required className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border" /></div>
                <div className={`rounded-xl p-3 border ${currentAccountMode === 'withdrawal' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                  <div className="text-xs font-bold">{isAr ? 'القيمة التي ستضاف للحساب الجاري' : 'Value added to current account'}</div>
                  <div className="text-2xl font-black">{currentAccountMode === 'withdrawal' ? '-' : '+'}{formatMoney(parseFloat(currentAccountAmount) || 0)} {currency}</div>
                </div>
                <button type="submit" className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black">{editingCurrentAccountId ? (isAr ? 'حفظ التعديل' : 'Save Edit') : (isAr ? 'حفظ العملية' : 'Save Transaction')}</button>
              </form>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"><div><h2 className="text-sm font-black">{isAr ? 'عمليات الحساب الجاري' : 'Current Account Transactions'}</h2><p className="text-[11px] text-slate-400 mt-1">{formatMoney(currentAccountBalance)} {currency}</p></div><div className="flex gap-1.5"><button onClick={() => exportCurrentAccount('csv')} className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center gap-1"><FileSpreadsheet className="w-3.5 h-3.5" />{isAr ? 'تصدير' : 'Export'}</button><button onClick={() => exportCurrentAccount('print')} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"><Printer className="w-3.5 h-3.5" /></button></div></div>
                {currentAccountTransactions.length === 0 ? <div className="p-8 text-center text-slate-400 text-xs">{isAr ? 'لا توجد عمليات محفوظة.' : 'No transactions saved.'}</div> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{currentAccountTransactions.map(tx => <div key={tx.id} className="p-3.5 flex items-center justify-between gap-3"><div><div className="font-bold text-sm">{tx.source}</div><div className="text-[10px] text-slate-400">{tx.type === 'current_withdrawal' ? 'سحب' : 'إيداع'} • {tx.date}</div></div><div className="flex items-center gap-2"><span className={`font-black ${tx.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{tx.amount < 0 ? '' : '+'}{formatMoney(tx.amount)} {currency}</span><button onClick={() => { setEditingCurrentAccountId(tx.id); setCurrentAccountDescription(tx.source); setCurrentAccountAmount(String(Math.abs(tx.amount))); setCurrentAccountDate(tx.date); setCurrentAccountMode(tx.amount < 0 ? 'withdrawal' : 'deposit'); }} className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600"><Edit2 className="w-3.5 h-3.5" /></button><button onClick={() => deleteCurrentAccount(tx.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button></div></div>)}</div>}
              </div>
            </div>
          )}
        </div>
      )}
      {/* --- MODAL 1: ADD / EDIT INCOME SOURCE --- */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                {editingSourceId ? (isAr ? 'تعديل مصدر الدخل' : 'Edit Income Source') : isAr ? 'إضافة مصدر دخل جديد' : 'New Income Source'}
              </h3>
              <button onClick={() => setIsIncomeModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSource} className="space-y-3 text-xs">
              <div>
                <label className="font-bold block mb-1">{isAr ? 'مصدر الدخل / المسمى *' : 'Income Source Name *'}</label>
                <input
                  type="text"
                  required
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder={isAr ? 'مثال: الراتب الشهري، عمل حر، تجارة' : 'e.g. Base Salary, Freelance'}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">{isAr ? 'قيمة الدخل *' : 'Amount *'}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    value={sourceAmount}
                    onChange={(e) => setSourceAmount(e.target.value)}
                    placeholder="25000"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                  />
                </div>

                <div>
                  <label className="font-bold block mb-1">{isAr ? 'التاريخ *' : 'Date *'}</label>
                  <input
                    type="date"
                    required
                    value={sourceDate}
                    onChange={(e) => setSourceDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">{isAr ? 'نوع الدخل' : 'Income Category'}</label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                >
                  <option value="salary">{isAr ? 'راتب أساسي' : 'Base Salary'}</option>
                  <option value="extra">{isAr ? 'دخل إضافي / عمل حر' : 'Extra Income / Freelance'}</option>
                  <option value="bonus">{isAr ? 'مكافآت وحوافز' : 'Bonuses'}</option>
                  <option value="investment">{isAr ? 'أرباح استثمار وتجارة' : 'Investment'}</option>
                  <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">{isAr ? 'ملاحظات (اختياري)' : 'Notes'}</label>
                <input
                  type="text"
                  value={sourceNotes}
                  onChange={(e) => setSourceNotes(e.target.value)}
                  placeholder={isAr ? 'ملاحظات وتفاصيل...' : 'Optional notes...'}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-sm"
              >
                {editingSourceId ? (isAr ? 'حفظ التعديل' : 'Update') : isAr ? 'حفظ مصدر الدخل' : 'Save Source'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: ADD / EDIT BANK CERTIFICATE (WITH REALTIME AUTO CALCULATION) --- */}
      {isCertModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100">
                  {editingCertId ? (isAr ? 'تعديل الشهادة البنكية' : 'Edit Certificate') : isAr ? 'إضافة شهادة بنكية جديدة' : 'Add Bank Certificate'}
                </h3>
              </div>
              <button onClick={() => setIsCertModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCertificate} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">{isAr ? 'اسم البنك *' : 'Bank Name *'}</label>
                  <input
                    type="text"
                    required
                    value={certBankName}
                    onChange={(e) => setCertBankName(e.target.value)}
                    placeholder={isAr ? 'مثال: البنك الأهلي، بنك مصر' : 'e.g. NBE, Banque Misr'}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                  />
                </div>

                <div>
                  <label className="font-bold block mb-1">{isAr ? 'رقم الشهادة (اختياري)' : 'Certificate No.'}</label>
                  <input
                    type="text"
                    value={certNumber}
                    onChange={(e) => setCertNumber(e.target.value)}
                    placeholder="CERT-10293"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">{isAr ? 'قيمة الشهادة (الأصل) *' : 'Certificate Amount *'}</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={certAmount}
                    onChange={(e) => setCertAmount(e.target.value)}
                    placeholder="مثال: 5000"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border font-bold text-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-bold block mb-1">{isAr ? 'نسبة العائد السنوية % *' : 'Annual Rate % *'}</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={certAnnualRate}
                      onChange={(e) => setCertAnnualRate(e.target.value)}
                      placeholder="18"
                      className="w-full p-2.5 pr-7 rounded-xl bg-slate-50 dark:bg-slate-800 border font-bold"
                    />
                    <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">{isAr ? 'مدة الشهادة *' : 'Duration *'}</label>
                  <select
                    value={certDuration}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border font-medium"
                  >
                    <option value="1 سنة">{isAr ? 'سنة واحدة (12 شهر)' : '1 Year'}</option>
                    <option value="2 سنة">{isAr ? 'سنتان (24 شهر)' : '2 Years'}</option>
                    <option value="3 سنوات">{isAr ? '3 سنوات (36 شهر)' : '3 Years'}</option>
                    <option value="6 شهور">{isAr ? '6 شهور' : '6 Months'}</option>
                    <option value="5 سنوات">{isAr ? '5 سنوات' : '5 Years'}</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">{isAr ? 'دورية صرف الأرباح *' : 'Profit Frequency *'}</label>
                  <select
                    value={certFrequency}
                    onChange={(e) => setCertFrequency(e.target.value as CertificateProfitFrequency)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border font-medium"
                  >
                    <option value="monthly">{isAr ? 'شهري (كل شهر)' : 'Monthly'}</option>
                    <option value="quarterly">{isAr ? 'ربع سنوي (كل 3 شهور)' : 'Quarterly'}</option>
                    <option value="semiannual">{isAr ? 'نصف سنوي (كل 6 شهور)' : 'Semi-Annual'}</option>
                    <option value="annual">{isAr ? 'سنوي (كل سنة)' : 'Annual'}</option>
                    <option value="maturity">{isAr ? 'عند الاستحقاق (نهاية المدة)' : 'At Maturity'}</option>
                  </select>
                </div>
              </div>

              {/* LIVE PROFIT PREVIEW BOX */}
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <Calculator className="w-4 h-4" />
                  <span>{isAr ? 'محرك الحساب التلقائي للأرباح' : 'Automated Returns Engine'}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-500 block">{isAr ? 'الربح السنوي المتوقع' : 'Annual Return'}</span>
                    <span className="font-black text-emerald-600 text-sm">
                      {formatMoney(calculatedProfits.annualProfit)} {currency}
                    </span>
                  </div>

                  <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-500 block">
                      {isAr ? `الربح لكل دورية (${certFrequency})` : 'Per Period Return'}
                    </span>
                    <span className="font-black text-emerald-600 text-sm">
                      {formatMoney(calculatedProfits.periodicProfit)} {currency}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {isAr
                    ? `* يتم احتساب ${formatMoney(calculatedProfits.monthlyEquivalent)} ${currency} كعائد شهري تلقائي ضمن ملخص الدخل في الـ Dashboard.`
                    : `* ${formatMoney(calculatedProfits.monthlyEquivalent)} ${currency} will be included in monthly income.`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">{isAr ? 'تاريخ الإصدار *' : 'Issue Date *'}</label>
                  <input
                    type="date"
                    required
                    value={certIssueDate}
                    onChange={(e) => setCertIssueDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                  />
                </div>

                <div>
                  <label className="font-bold block mb-1">{isAr ? 'تاريخ الاستحقاق *' : 'Maturity Date *'}</label>
                  <input
                    type="date"
                    required
                    value={certMaturityDate}
                    onChange={(e) => setCertMaturityDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">{isAr ? 'ملاحظات (اختياري)' : 'Notes'}</label>
                <input
                  type="text"
                  value={certNotes}
                  onChange={(e) => setCertNotes(e.target.value)}
                  placeholder={isAr ? 'شروط الاسترداد، حساب الصرف...' : 'Optional notes...'}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-sm"
              >
                {editingCertId ? (isAr ? 'حفظ التعديلات' : 'Update Certificate') : isAr ? 'حفظ الشهادة وتفعيل الأرباح' : 'Save & Link Certificate'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
