import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Home,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  CreditCard,
  Banknote,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  X,
  Sparkles,
} from 'lucide-react';
import { formatMoney, isDateInMonth } from '../../services/financeCalculations';
import { Language, MedicalExpenseRecord } from '../../types';
import { financeService } from '../../services/financeService';

export interface SpecializedExpense {
  id: string;
  section: 'house' | 'work' | 'personal';
  type: string;
  customType?: string;
  amount: number;
  paymentType?: 'supply' | 'labor';
  date: string;
  notes?: string;
}

interface HouseExpensesSectionProps {
  language: Language;
  currency: string;
  selectedMonth: string;
  onBack: () => void;
}

export const HouseExpensesSection: React.FC<HouseExpensesSectionProps> = ({
  language,
  currency,
  selectedMonth,
  onBack,
}) => {
  const isAr = language === 'ar';
  const [expenses, setExpenses] = useState<SpecializedExpense[]>([]);
  const [medicalExpenses, setMedicalExpenses] = useState<MedicalExpenseRecord[]>([]);
  const loadCanonicalExpenses = async () => {
    const [houseRows, medicalRows] = await Promise.all([
      financeService.getExpenses({ type: 'house' }),
      financeService.getExpenses({ type: 'medical' }),
    ]);
    setExpenses(houseRows.map(x => {
      let meta:any={}; try{meta=x.notes?JSON.parse(String(x.notes)):{};}catch{}
      return {id:String(x.id),section:'house',type:String(x.title||x.category||'مصروف منزلي'),customType:meta.customType,amount:Number(x.amount)||0,paymentType:meta.paymentType,date:String(x.date||'').slice(0,10),notes:meta.notes||String(x.notes||'')||undefined};
    }));
    setMedicalExpenses(medicalRows.map(x => {
      let meta:any={}; try{meta=x.notes?JSON.parse(String(x.notes)):{};}catch{}
      return {id:String(x.id),familyMember:String(meta.familyMember||x.title||'فرد الأسرة'),facilityName:meta.facilityName||undefined,facilityType:meta.facilityType||'مستشفى',conditionDescription:String(meta.conditionDescription||''),doctorDiagnosis:meta.doctorDiagnosis||undefined,examinationCost:Number(meta.examinationCost)||0,medicationCost:Number(meta.medicationCost)||0,date:String(x.date||'').slice(0,10),notes:meta.notes||undefined};
    }));
  };
  useEffect(() => { void loadCanonicalExpenses(); }, []);
  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  const [activeTab, setActiveTab] = useState<'home' | 'medical'>('home');
  const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);
  const [editingMedicalId, setEditingMedicalId] = useState<string | null>(null);
  const [medicalFamilyMember, setMedicalFamilyMember] = useState('');
  const [medicalFacilityName, setMedicalFacilityName] = useState('');
  const [medicalFacilityType, setMedicalFacilityType] = useState<MedicalExpenseRecord['facilityType']>('مستشفى');
  const [medicalCondition, setMedicalCondition] = useState('');
  const [medicalDiagnosis, setMedicalDiagnosis] = useState('');
  const [medicalExamCost, setMedicalExamCost] = useState('');
  const [medicalMedicationCost, setMedicalMedicationCost] = useState('');
  const [medicalDate, setMedicalDate] = useState(new Date().toISOString().split('T')[0]);
  const [medicalNotes, setMedicalNotes] = useState('');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState('فطار');
  const [customType, setCustomType] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'supply' | 'labor'>('supply');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const houseTypesOptions = [
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
    'أخرى (مخصص)',
  ];

  const currentMonthMedical = medicalExpenses.filter((e) => isDateInMonth(e.date, selectedMonth));
  const medicalMonthTotal = currentMonthMedical.reduce((sum, e) => sum + (Number(e.examinationCost) || 0) + (Number(e.medicationCost) || 0), 0);
  const currentMonthExpenses = expenses.filter((e) => isDateInMonth(e.date, selectedMonth));
  const monthTotal = currentMonthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const supplyTotal = currentMonthExpenses.filter((e) => e.paymentType === 'supply').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const laborTotal = currentMonthExpenses.filter((e) => e.paymentType === 'labor').reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const filteredList = expenses.filter((item) => {
    const matchesSearch =
      item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.customType && item.customType.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = selectedTypeFilter === 'all' || item.type === selectedTypeFilter;
    return matchesSearch && matchesFilter;
  });

  const openAddModal = () => {
    setEditingId(null);
    setType('فطار');
    setCustomType('');
    setAmount('');
    setPaymentType('supply');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: SpecializedExpense) => {
    setEditingId(item.id);
    setType(item.type);
    setCustomType(item.customType || '');
    setAmount(String(item.amount));
    setPaymentType(item.paymentType || 'supply');
    setDate(item.date);
    setNotes(item.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { window.alert(isAr ? 'من فضلك أدخل مبلغًا صحيحًا أكبر من صفر.' : 'Please enter a valid amount greater than zero.'); return; }

    const newItem: SpecializedExpense = {
      id: editingId || `house_${Date.now()}`,
      section: 'house',
      type: type === 'أخرى (مخصص)' && customType.trim() ? customType.trim() : type,
      customType: type === 'أخرى (مخصص)' ? customType.trim() : undefined,
      amount: numAmount,
      paymentType,
      date,
      notes: notes.trim() || undefined,
    };

    try {
      const notesPayload = JSON.stringify({ customType: newItem.customType, paymentType: newItem.paymentType, notes: newItem.notes });
      if (editingId) await financeService.updateCanonicalFinanceExpense(editingId,{type:'house',title:newItem.type,category:newItem.type,amount:newItem.amount,date:newItem.date,notes:notesPayload});
      else await financeService.addExpense({type:'house',title:newItem.type,category:newItem.type,amount:newItem.amount,date:newItem.date,notes:notesPayload});
      await loadCanonicalExpenses(); setIsModalOpen(false);
    } catch(error){ window.alert(error instanceof Error?error.message:'تعذر حفظ المصروف المنزلي.'); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(isAr ? 'هل أنت متأكد من حذف هذا المصروف؟' : 'Delete this expense?')) {
      try { await financeService.deleteCanonicalFinanceExpense(id); await loadCanonicalExpenses(); }
      catch(error){ window.alert(error instanceof Error?error.message:'تعذر حذف المصروف.'); }
    }
  };

  const openAddMedical = () => {
    setEditingMedicalId(null);
    setMedicalFamilyMember(''); setMedicalFacilityName(''); setMedicalFacilityType('مستشفى');
    setMedicalCondition(''); setMedicalDiagnosis(''); setMedicalExamCost(''); setMedicalMedicationCost('');
    setMedicalDate(new Date().toISOString().split('T')[0]); setMedicalNotes('');
    setIsMedicalModalOpen(true);
  };

  const openEditMedical = (item: MedicalExpenseRecord) => {
    setEditingMedicalId(item.id); setMedicalFamilyMember(item.familyMember); setMedicalFacilityName(item.facilityName || '');
    setMedicalFacilityType(item.facilityType); setMedicalCondition(item.conditionDescription); setMedicalDiagnosis(item.doctorDiagnosis || '');
    setMedicalExamCost(String(item.examinationCost || '')); setMedicalMedicationCost(String(item.medicationCost || ''));
    setMedicalDate(item.date); setMedicalNotes(item.notes || ''); setIsMedicalModalOpen(true);
  };

  const handleSaveMedical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicalFamilyMember.trim() || !medicalCondition.trim()) { window.alert(isAr ? 'من فضلك أدخل اسم فرد الأسرة وتوصيف الحالة.' : 'Please enter family member and condition.'); return; }
    const exam = Number(medicalExamCost) || 0; const meds = Number(medicalMedicationCost) || 0;
    if (exam < 0 || meds < 0 || exam + meds <= 0) { window.alert(isAr ? 'يجب إدخال تكلفة الكشف أو الأدوية بقيمة أكبر من صفر.' : 'Enter examination or medication cost greater than zero.'); return; }
    const item: MedicalExpenseRecord = {
      id: editingMedicalId || `medical_${Date.now()}`, familyMember: medicalFamilyMember.trim(), facilityName: medicalFacilityName.trim() || undefined,
      facilityType: medicalFacilityType, conditionDescription: medicalCondition.trim(), doctorDiagnosis: medicalDiagnosis.trim() || undefined,
      examinationCost: exam, medicationCost: meds, date: medicalDate, notes: medicalNotes.trim() || undefined,
    };
    try {
      const notesPayload=JSON.stringify({familyMember:item.familyMember,facilityName:item.facilityName,facilityType:item.facilityType,conditionDescription:item.conditionDescription,doctorDiagnosis:item.doctorDiagnosis,examinationCost:item.examinationCost,medicationCost:item.medicationCost,notes:item.notes});
      if(editingMedicalId) await financeService.updateCanonicalFinanceExpense(editingMedicalId,{type:'medical',title:item.familyMember,category:item.facilityType,amount:item.examinationCost+item.medicationCost,date:item.date,notes:notesPayload});
      else await financeService.addExpense({type:'medical',title:item.familyMember,category:item.facilityType,amount:item.examinationCost+item.medicationCost,date:item.date,notes:notesPayload});
      await loadCanonicalExpenses(); setIsMedicalModalOpen(false);
    } catch(error){ window.alert(error instanceof Error?error.message:'تعذر حفظ المصروف الطبي.'); }
  };

  const deleteMedical = async (id: string) => {
    if (window.confirm(isAr ? 'هل أنت متأكد من حذف المصروف الطبي؟' : 'Delete this medical expense?')) { try { await financeService.deleteCanonicalFinanceExpense(id); await loadCanonicalExpenses(); } catch(error){ window.alert(error instanceof Error?error.message:'تعذر حذف المصروف الطبي.'); } }
  };

  const exportMedical = (mode: 'excel' | 'print') => {
    const rows = currentMonthMedical.map(e => [e.date, e.familyMember, e.facilityType, e.facilityName || '', e.conditionDescription, e.doctorDiagnosis || '', e.examinationCost, e.medicationCost, (e.examinationCost || 0) + (e.medicationCost || 0), e.notes || '']);
    if (mode === 'print') {
      const w = window.open('', '_blank'); if (!w) return;
      w.document.write(`<html dir="rtl"><head><title>المصروفات الطبية</title><meta charset="utf-8"><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:right}</style></head><body><h2>القسم الطبي - المصروفات الطبية</h2><table><tr><th>التاريخ</th><th>الفرد</th><th>الجهة</th><th>الحالة</th><th>التشخيص</th><th>الكشف</th><th>الأدوية</th><th>الإجمالي</th></tr>${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]} ${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td><td>${r[7]}</td><td>${r[8]}</td></tr>`).join('')}</table><script>window.print()</script></body></html>`); w.document.close(); return;
    }
    const csv='\uFEFF'+[['التاريخ','فرد الأسرة','نوع الجهة','الجهة','توصيف الحالة','تشخيص الدكتور','تكلفة الكشف','تكلفة الأدوية','الإجمالي','ملاحظات'],...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); const a=document.createElement('a'); a.href=url; a.download=`medical-expenses-${selectedMonth}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportData = (type: 'csv' | 'excel' | 'print') => {
    const headers = ['التاريخ', 'التصنيف', 'النوع', 'المبلغ', 'الملاحظات'];
    const rows = filteredList.map((e) => [
      e.date,
      e.type,
      e.paymentType === 'labor' ? 'مصنعية/أجرة' : 'مشتريات/مستلزمات',
      e.amount,
      e.notes || '',
    ]);

    if (type === 'csv' || type === 'excel') {
      const csvContent =
        '\uFEFF' +
        [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join(
          '\n'
        );
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `house-expenses-${selectedMonth}.csv`;
      a.click();
    } else if (type === 'print') {
      window.print();
    }
  };

  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* 1. Header with Back Button & Action */}
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
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">
                {isAr ? 'مصروفات منزلية' : 'Home Expenses'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'متابعة طعام، إصلاحات، مفروشات ومستلزمات البيت' : 'Track groceries, repairs, home utilities & furnishings'}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Main section tabs */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setActiveTab('home')} className={`py-3 rounded-2xl border font-black text-sm transition-all ${activeTab === 'home' ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'}`}>🏠 {isAr ? 'مصروفات منزلية' : 'Home Expenses'}</button>
        <button onClick={() => setActiveTab('medical')} className={`py-3 rounded-2xl border font-black text-sm transition-all ${activeTab === 'medical' ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'}`}>🩺 {isAr ? 'القسم الطبي' : 'Medical'}</button>
      </div>
      <button onClick={activeTab === 'medical' ? openAddMedical : openAddModal} className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"><Plus className="w-5 h-5"/><span>{activeTab === 'medical' ? (isAr ? 'إضافة كشف +' : 'Add Medical Record +') : (isAr ? 'إضافة مصروفات +' : 'Add Home Expense +')}</span></button>

      {activeTab === 'medical' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-xs font-bold text-slate-500 mb-1">{isAr ? 'إجمالي المصروفات الطبية لهذا الشهر' : 'Medical expenses this month'}</div>
            <div className="text-2xl font-black text-cyan-600">{formatMoney(medicalMonthTotal)} <span className="text-xs text-slate-500">{currency}</span></div>
            <div className="text-[11px] text-slate-400 mt-1">{currentMonthMedical.length} {isAr ? 'حالة/كشف مسجل' : 'medical records'}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"><span className="font-black text-sm">🩺 {isAr ? 'سجل الكشوفات الطبية' : 'Medical Records'}</span><button onClick={openAddMedical} className="px-4 py-2 rounded-xl bg-cyan-500 text-white text-xs font-bold"><Plus className="w-4 h-4 inline ml-1"/>{isAr ? 'إضافة كشف' : 'Add'}</button></div>
            {currentMonthMedical.length === 0 ? <div className="p-10 text-center text-slate-400 text-xs">{isAr ? 'لا توجد كشوفات طبية مسجلة لهذا الشهر' : 'No medical records for this month'}</div> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{currentMonthMedical.map(item => <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div className="font-black text-slate-900 dark:text-white">{item.familyMember} <span className="text-[10px] px-2 py-1 rounded-full bg-cyan-100 text-cyan-800">{item.facilityType}</span></div><div className="text-xs text-slate-500 mt-1">{item.facilityName || '—'} • {item.conditionDescription}</div>{item.doctorDiagnosis && <div className="text-xs text-slate-500 mt-1">{isAr ? 'التشخيص: ' : 'Diagnosis: '}{item.doctorDiagnosis}</div>}<div className="text-[11px] text-slate-400 mt-1">{item.date}</div></div><div className="flex items-center gap-3"><div className="text-sm font-black">{formatMoney((Number(item.examinationCost)||0)+(Number(item.medicationCost)||0))} {currency}</div><div className="flex gap-1"><button onClick={() => openEditMedical(item)} className="p-2 rounded-lg text-slate-500 hover:text-cyan-600"><Edit2 className="w-4 h-4"/></button><button onClick={() => deleteMedical(item.id)} className="p-2 rounded-lg text-slate-500 hover:text-rose-600"><Trash2 className="w-4 h-4"/></button></div></div></div>)}</div>}
          </div>
          <div className="flex gap-2"><button onClick={() => exportMedical('excel')} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold"><FileSpreadsheet className="w-4 h-4 inline ml-1 text-emerald-600"/>Excel</button><button onClick={() => exportMedical('print')} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold"><Printer className="w-4 h-4 inline ml-1 text-cyan-600"/>{isAr ? 'طباعة / PDF' : 'Print / PDF'}</button></div>
        </div>
      )}
      {activeTab === 'home' && (
        <div className="space-y-4">
            {/* 2. Monthly Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {isAr ? 'إجمالي مصروفات المنزل لهذا الشهر' : 'Total Home Expenses'}
          </span>
          <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
            {formatMoney(monthTotal)} <span className="text-xs font-semibold text-slate-500">{currency}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {currentMonthExpenses.length} {isAr ? 'عملية مسجلة' : 'records in selected month'}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {isAr ? 'مشتريات ومستلزمات طعام ومواد' : 'Supplies & Groceries'}
          </span>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {formatMoney(supplyTotal)} <span className="text-xs font-semibold text-slate-500">{currency}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">{isAr ? 'بند مستلزمات' : 'items'}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {isAr ? 'مصنعيات وأجور صيانة وتركيب' : 'Labor & Services'}
          </span>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {formatMoney(laborTotal)} <span className="text-xs font-semibold text-slate-500">{currency}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">{isAr ? 'خدمات مصنعية' : 'labor services'}</span>
        </div>
      </div>

      {/* 3. Search & Filter & Export Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isAr ? 'بحث في المصروفات أو الملاحظات...' : 'Search home expenses...'}
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
            {houseTypesOptions.map((opt) => (
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
            title="Excel / CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={() => exportData('print')}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Print"
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
            <span>{isAr ? 'سجل عمليات مصروفات المنزل' : 'Home Expenses Records'}</span>
          </h2>
          <span className="text-[11px] text-slate-400">
            {filteredList.length} {isAr ? 'عملية' : 'items'}
          </span>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-10 text-center text-slate-400 space-y-2">
            <Home className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-xs">{isAr ? 'لا توجد مصروفات مسجلة' : 'No expenses recorded yet'}</p>
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
                  <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-100 dark:border-cyan-900/40 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.type}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.paymentType === 'labor'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300'
                        }`}
                      >
                        {item.paymentType === 'labor' ? (isAr ? 'مصنعية' : 'Labor') : isAr ? 'مستلزمات' : 'Supply'}
                      </span>
                    </div>

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
                      title={isAr ? 'تعديل' : 'Edit'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title={isAr ? 'حذف' : 'Delete'}
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

      {/* 5. Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 flex items-center justify-center text-cyan-600">
                  <Home className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">
                  {editingId ? (isAr ? 'تعديل مصروف منزل' : 'Edit Home Expense') : isAr ? 'إضافة مصروف منزل جديد' : 'New Home Expense'}
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
              {/* Type selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'تصنيف المصروف *' : 'Expense Category *'}
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                >
                  {houseTypesOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {type === 'أخرى (مخصص)' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'اكتب اسم المصروف المخصص *' : 'Custom Expense Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder={isAr ? 'مثال: صيانة فلتر المياه' : 'e.g. Water filter maintenance'}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Amount & Date in 2 columns */}
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

              {/* Payment Type: Supply or Labor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'نوع الصرف' : 'Payment Type'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('supply')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      paymentType === 'supply'
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isAr ? 'مشتريات ومستلزمات' : 'Supplies / Goods'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('labor')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      paymentType === 'labor'
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isAr ? 'مصنعية وأجرة يد' : 'Labor / Service Fee'}
                  </button>
                </div>
              </div>

              {/* Notes */}
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

              {/* Submit Buttons */}
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
      )}

      {isMedicalModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"><h3 className="font-black">🩺 {editingMedicalId ? (isAr ? 'تعديل كشف طبي' : 'Edit Medical Record') : (isAr ? 'إضافة كشف طبي' : 'Add Medical Record')}</h3><button onClick={() => setIsMedicalModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><X className="w-4 h-4"/></button></div>
            <form onSubmit={handleSaveMedical} className="p-4 space-y-3">
              <input required value={medicalFamilyMember} onChange={e=>setMedicalFamilyMember(e.target.value)} placeholder={isAr ? 'اسم فرد الأسرة *' : 'Family member *'} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"/>
              <div className="grid grid-cols-2 gap-2"><select value={medicalFacilityType} onChange={e=>setMedicalFacilityType(e.target.value as any)} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"><option>مستشفى</option><option>عيادة خاصة</option><option>عيادة أسنان</option><option>صيدلية</option><option>أخرى</option></select><input value={medicalFacilityName} onChange={e=>setMedicalFacilityName(e.target.value)} placeholder={isAr ? 'اسم المستشفى / العيادة' : 'Facility name'} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"/></div>
              <textarea required rows={2} value={medicalCondition} onChange={e=>setMedicalCondition(e.target.value)} placeholder={isAr ? 'توصيف الحالة المرضية *' : 'Condition description *'} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"/>
              <textarea rows={2} value={medicalDiagnosis} onChange={e=>setMedicalDiagnosis(e.target.value)} placeholder={isAr ? 'تشخيص الدكتور' : 'Doctor diagnosis'} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"/>
              <div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="0.01" value={medicalExamCost} onChange={e=>setMedicalExamCost(e.target.value)} placeholder={isAr ? 'تكلفة الكشف' : 'Exam cost'} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"/><input type="number" min="0" step="0.01" value={medicalMedicationCost} onChange={e=>setMedicalMedicationCost(e.target.value)} placeholder={isAr ? 'تكلفة الأدوية' : 'Medication cost'} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"/></div>
              <div className="grid grid-cols-2 gap-2"><input type="date" required value={medicalDate} onChange={e=>setMedicalDate(e.target.value)} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"/><input value={medicalNotes} onChange={e=>setMedicalNotes(e.target.value)} placeholder={isAr ? 'ملاحظات' : 'Notes'} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"/></div>
              <div className="flex gap-2 pt-2"><button type="button" onClick={()=>setIsMedicalModalOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">{isAr ? 'إلغاء' : 'Cancel'}</button><button type="submit" className="flex-1 py-3 rounded-xl bg-cyan-500 text-white text-xs font-black">{isAr ? 'حفظ' : 'Save'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
