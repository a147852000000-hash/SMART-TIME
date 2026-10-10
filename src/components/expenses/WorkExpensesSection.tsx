import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Briefcase,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  FileSpreadsheet,
  Printer,
  X,
  Sparkles,
} from 'lucide-react';
import { formatMoney, isDateInMonth } from '../../services/financeCalculations';
import { Language } from '../../types';
import { financeService } from '../../services/financeService';
import type { SpecializedExpense } from './HouseExpensesSection';

interface WorkExpensesSectionProps {
  language: Language;
  currency: string;
  selectedMonth: string;
  onBack: () => void;
}

export const WorkExpensesSection: React.FC<WorkExpensesSectionProps> = ({
  language,
  currency,
  selectedMonth,
  onBack,
}) => {
  const isAr = language === 'ar';
  const [canonicalExpenses, setCanonicalExpenses] = useState<SpecializedExpense[]>([]);
  const loadCanonicalExpenses = async () => {
    const rows = await financeService.getExpenses({ type: 'work' });
    setCanonicalExpenses(rows.map((x) => ({ id: String(x.id), section: 'work', type: String(x.title || x.category || 'مصروف عمل'), amount: Number(x.amount) || 0, date: String(x.date || '').slice(0, 10), notes: x.notes ? String(x.notes) : undefined })));
  };
  useEffect(() => { void loadCanonicalExpenses(); }, []);
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState('أدوات مكتبية');
  const [customType, setCustomType] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const workTypesOptions = [
    'أدوات مكتبية',
    'صيانة أجهزة العمل',
    'اشتراكات برمجيات وسيرفرات',
    'ضيافة واجتماعات',
    'تنقلات ومواصلات عمل',
    'شحن وتوصيل مستندات',
    'دورات تدريبية وتطوير',
    'أخرى (مخصص)',
  ];

  const currentMonthExpenses = canonicalExpenses.filter((e) => isDateInMonth(e.date, selectedMonth));
  const monthTotal = currentMonthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const filteredList = canonicalExpenses.filter((item) => {
    const matchesSearch =
      item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.customType && item.customType.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = selectedTypeFilter === 'all' || item.type === selectedTypeFilter;
    return matchesSearch && matchesFilter;
  });

  const openAddModal = () => {
    setEditingId(null);
    setType('أدوات مكتبية');
    setCustomType('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: SpecializedExpense) => {
    setEditingId(item.id);
    setType(item.type);
    setCustomType(item.customType || '');
    setAmount(String(item.amount));
    setDate(item.date);
    setNotes(item.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { window.alert(isAr ? 'من فضلك أدخل مبلغًا صحيحًا أكبر من صفر.' : 'Please enter a valid amount greater than zero.'); return; }

    const newItem: SpecializedExpense = {
      id: editingId || `work_${Date.now()}`,
      section: 'work',
      type: type === 'أخرى (مخصص)' && customType.trim() ? customType.trim() : type,
      customType: type === 'أخرى (مخصص)' ? customType.trim() : undefined,
      amount: numAmount,
      date,
      notes: notes.trim() || undefined,
    };

    try {
      if (editingId) {
        await financeService.updateCanonicalFinanceExpense(editingId, { type: 'work', title: newItem.type, category: newItem.type, amount: newItem.amount, date: newItem.date, notes: newItem.notes });
      } else {
        await financeService.addExpense({ type: 'work', title: newItem.type, category: newItem.type, amount: newItem.amount, date: newItem.date, notes: newItem.notes });
      }
      await loadCanonicalExpenses();
      setIsModalOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'تعذر حفظ المصروف.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(isAr ? 'هل أنت متأكد من حذف هذا المصروف؟' : 'Delete this expense?')) {
      try {
        await financeService.deleteCanonicalFinanceExpense(id);
        await loadCanonicalExpenses();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'تعذر حذف المصروف.');
      }
    }
  };

  const exportData = (type: 'csv' | 'print') => {
    const headers = ['التاريخ', 'البند', 'المبلغ', 'الملاحظات'];
    const rows = filteredList.map((e) => [e.date, e.type, e.amount, e.notes || '']);

    if (type === 'csv') {
      const csvContent =
        '\uFEFF' +
        [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join(
          '\n'
        );
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `work-expenses-${selectedMonth}.csv`;
      a.click();
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
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-slate-700 dark:text-slate-200 hover:text-cyan-600 flex items-center justify-center transition-all active:scale-95"
            title={isAr ? 'رجوع' : 'Back'}
          >
            <BackIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">
                {isAr ? 'مصروفات العمل والمكتب' : 'Work Expenses'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'متابعة أدوات المكتب، اشتراكات البرامج، وصيانة أجهزة العمل' : 'Track office supplies, equipment & subscriptions'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{isAr ? 'إضافة مصروف +' : 'Add Expense +'}</span>
        </button>
      </div>

      {/* 2. Monthly Summary Card */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {isAr ? 'إجمالي مصروفات العمل لهذا الشهر' : 'Total Work Expenses This Month'}
          </span>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
            {formatMoney(monthTotal)} <span className="text-xs font-semibold text-slate-500">{currency}</span>
          </div>
        </div>
        <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
          {currentMonthExpenses.length} {isAr ? 'عملية مسجلة' : 'records'}
        </span>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isAr ? 'بحث في بنود العمل...' : 'Search work items...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">{isAr ? 'جميع التصنيفات' : 'All Categories'}</option>
            {workTypesOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          <button
            onClick={() => exportData('csv')}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={() => exportData('print')}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-600" />
            <span>{isAr ? 'طباعة' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* 4. Transactions List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
            <span>{isAr ? 'سجل عمليات مصروفات العمل' : 'Work Expenses Records'}</span>
          </h2>
          <span className="text-[11px] text-slate-400">
            {filteredList.length} {isAr ? 'عملية' : 'items'}
          </span>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-10 text-center text-slate-400 space-y-2">
            <Briefcase className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-xs">{isAr ? 'لا توجد مصروفات عمل مسجلة' : 'No work expenses recorded yet'}</p>
            <button
              onClick={openAddModal}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 text-white font-bold text-xs inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'إضافة أول مصروف' : 'Add First Expense'}</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredList.map((item) => (
              <div
                key={item.id}
                className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/40 flex items-center justify-center text-sky-600 dark:text-sky-400">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block">{item.type}</span>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{item.date}</span>
                      {item.notes && <span>• {item.notes}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-base font-black text-slate-900 dark:text-slate-100">
                    {formatMoney(item.amount)}{' '}
                    <span className="text-[10px] font-normal text-slate-500">{currency}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600">
                  <Briefcase className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">
                  {editingId ? (isAr ? 'تعديل مصروف عمل' : 'Edit Work Expense') : isAr ? 'إضافة مصروف عمل جديد' : 'New Work Expense'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'نوع مصروف العمل *' : 'Work Expense Category *'}
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                >
                  {workTypesOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {type === 'أخرى (مخصص)' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'اسم المصروف المخصص *' : 'Custom Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder={isAr ? 'مثال: تجديد ترخيص برمجيات' : 'e.g. License renewal'}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'المبلغ *' : 'Amount *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'التاريخ *' : 'Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'ملاحظات وتفاصيل' : 'Notes & Details'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isAr ? 'تفاصيل إضافية...' : 'Optional notes...'}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
                >
                  {editingId ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : isAr ? 'إضافة المصروف' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
