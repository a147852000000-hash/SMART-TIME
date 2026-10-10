import React, { useState } from 'react';
import {
  X,
  Plus,
  Home,
  UserRound,
  Car,
  BookOpen,
  DollarSign,
  Calendar,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import { Language } from '../../types';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  currency: string;
  selectedMonth: string;
  onAddExpense: (data: {
    section: 'house' | 'work' | 'personal' | 'vehicle' | 'education';
    category: string;
    amount: number;
    date: string;
    paymentMethod: string;
    notes?: string;
  }) => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  language,
  currency,
  selectedMonth,
  onAddExpense,
}) => {
  const isAr = language === 'ar';

  const [section, setSection] = useState<'house' | 'work' | 'personal' | 'vehicle' | 'education'>('house');
  const [category, setCategory] = useState('فطار');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('نقدي (كاش)');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const sectionOptions = [
    { id: 'house' as const, label: isAr ? 'مصروفات المنزل' : 'Home', icon: Home },
    { id: 'personal' as const, label: isAr ? 'المصروفات الشخصية' : 'Personal', icon: UserRound },
    { id: 'vehicle' as const, label: isAr ? 'المركبة والوقود' : 'Vehicle', icon: Car },
    { id: 'education' as const, label: isAr ? 'التعليم والطلاب' : 'Education', icon: BookOpen },
  ];

  const categoryMap: Record<string, string[]> = {
    house: [
      'فطار',
      'غداء',
      'عشاء',
      'إصلاحات كهربائية',
      'إصلاحات سباكة',
      'إصلاحات دهان',
      'شراء أجهزة منزلية',
      'شراء مفروشات',
      'فواتير ومستحقات منزلية',
      'منظفات ومستلزمات',
      'أخرى',
    ],
    work: [
      'أدوات مكتبية',
      'صيانة أجهزة العمل',
      'اشتراكات برمجيات',
      'ضيافة واجتماعات',
      'تنقلات عمل',
      'شحن وتوصيل',
      'أخرى',
    ],
    personal: [
      'طعام ومشروبات',
      'مواصلات وتنقلات',
      'ملابس ومستلزمات شخصية',
      'صحة وعناية شخصية',
      'ترفيه وخروج',
      'هدايا ومناسبات',
      'اشتراكات شخصية',
      'فواتير واتصالات شخصية',
      'أخرى',
    ],
    vehicle: [
      'وقود وبنزين 92',
      'وقود وبنزين 95',
      'وقود وبنزين 80',
      'سولار (ديزل)',
      'غاز طبيعي',
      'صيانة دورية وتغيير زيت',
      'قطع غيار وإطارات',
      'غسيل ونظافة',
      'أخرى',
    ],
    education: [
      'دروس خصوصية ومجموعات',
      'مصاريف وأقساط مدرسية',
      'كتب ومذكرات خارجية',
      'اشتراك باص المدرسة',
      'أدوات ومستلزمات دراسية',
      'مصروف شخصي',
      'أخرى',
    ],
  };

  const handleSectionChange = (sec: 'house' | 'work' | 'personal' | 'vehicle' | 'education') => {
    setSection(sec);
    setCategory(categoryMap[sec][0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    onAddExpense({
      section,
      category,
      amount: numAmount,
      date,
      paymentMethod,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                {isAr ? 'إضافة مصروف جديد' : 'Add New Expense'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isAr ? 'اختر القسم وسجل بيانات العملية فورًا' : 'Quickly record an expense to any section'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
          {/* 1. Section Selector Buttons */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? '1. اختر القسم المالي *' : '1. Select Section *'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {sectionOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = section === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSectionChange(opt.id)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-cyan-500 border-cyan-500 text-white shadow-xs font-bold'
                        : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-cyan-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px]">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Category inside Section */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? '2. التصنيف داخل القسم *' : '2. Category *'}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
            >
              {(categoryMap[section] || []).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Amount & Date */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? '3. المبلغ *' : '3. Amount *'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-cyan-600 dark:text-cyan-400 text-sm focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? '4. التاريخ *' : '4. Date *'}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 4. Payment Method */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? '5. طريقة الدفع' : '5. Payment Method'}
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
            >
              <option value="نقدي (كاش)">{isAr ? 'نقدي (كاش)' : 'Cash'}</option>
              <option value="بطاقة فيزا / ماستركارد">{isAr ? 'بطاقة بنكية / فيزا / ماستركارد' : 'Credit / Debit Card'}</option>
              <option value="تحويل بنكي / انستاباي">{isAr ? 'تحويل بنكي / InstaPay' : 'Bank Transfer / InstaPay'}</option>
              <option value="محفظة إلكترونية (فودافون كاش / وغيرها)">{isAr ? 'محفظة إلكترونية (فودافون كاش / وغيرها)' : 'E-Wallet'}</option>
              <option value="شيك / آجل">{isAr ? 'شيك / آجل' : 'Cheque / Deferred'}</option>
            </select>
          </div>

          {/* 5. Notes */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? '6. ملاحظات وتفاصيل' : '6. Notes'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isAr ? 'تفاصيل إضافية عن المصروف...' : 'Optional notes...'}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition-colors"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold shadow-sm transition-all active:scale-95"
            >
              {isAr ? 'حفظ المصروف وتحديث الحسابات' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
