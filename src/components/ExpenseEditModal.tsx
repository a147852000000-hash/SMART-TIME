import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Calendar,
  DollarSign,
  Wrench,
  Fuel,
  AlertTriangle,
  User,
  BookOpen,
  Home,
  Briefcase,
  Save,
  Gauge,
  MapPin,
  FileText,
  ShieldCheck,
  Tag,
  Plus,
  Trash2,
  Edit2,
  GraduationCap,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Language, VehicleAccidentRecord, StudentExpenseRecord } from '../types';

export type ExpenseEditItem =
  | {
      kind: 'house';
      item: {
        id: string;
        section: 'house';
        type: string;
        customType?: string;
        amount: number;
        paymentType?: 'supply' | 'labor';
        date: string;
        notes?: string;
      };
    }
  | {
      kind: 'work';
      item: {
        id: string;
        section: 'work';
        type: string;
        amount: number;
        date: string;
        notes?: string;
      };
    }
  | {
      kind: 'fuel';
      item: {
        id: string;
        fuelType: string;
        price: number;
        odometer: number;
        dateTime: string;
      };
    }
  | {
      kind: 'maintenance';
      item: {
        id: string;
        maintenanceType: string;
        description: string;
        supplyName: string;
        supplyPrice: number;
        laborDescription: string;
        laborPrice: number;
        total: number;
        date: string;
      };
    }
  | {
      kind: 'accident';
      item: VehicleAccidentRecord;
    }
  | {
      kind: 'student';
      item: {
        id: string;
        name: string;
        nationalId: string;
        age: string;
        stage: string;
      };
    }
  | {
      kind: 'studentExpense';
      item: {
        id: string;
        studentId: string;
        subCategory: 'lessons' | 'personal' | 'transport' | 'school' | 'books';
        title: string;
        amount: number;
        date: string;
      };
    };

interface ExpenseEditModalProps {
  isOpen: boolean;
  editItem: ExpenseEditItem | null;
  onClose: () => void;
  onSave: (updated: ExpenseEditItem) => void;
  currency: string;
  language: Language;
  studentExpenses?: StudentExpenseRecord[];
  onAddStudentExpense?: (expense: Omit<StudentExpenseRecord, 'id'>) => void;
  onUpdateStudentExpense?: (expense: StudentExpenseRecord) => void;
  onDeleteStudentExpense?: (id: string) => void;
  initialStudentTab?: 'profile' | 'addExpense' | 'expensesList';
}

export const ExpenseEditModal: React.FC<ExpenseEditModalProps> = ({
  isOpen,
  editItem,
  onClose,
  onSave,
  currency,
  language,
  studentExpenses = [],
  onAddStudentExpense,
  onUpdateStudentExpense,
  onDeleteStudentExpense,
  initialStudentTab = 'profile',
}) => {
  const isAr = language === 'ar';

  // Local Form States
  const [houseType, setHouseType] = useState('');
  const [houseCustomType, setHouseCustomType] = useState('');
  const [houseAmount, setHouseAmount] = useState('');
  const [housePaymentType, setHousePaymentType] = useState<'supply' | 'labor'>('supply');
  const [houseDate, setHouseDate] = useState('');

  const [workType, setWorkType] = useState('');
  const [workAmount, setWorkAmount] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [workNotes, setWorkNotes] = useState('');

  const [fuelType, setFuelType] = useState('بنزين 92');
  const [fuelPrice, setFuelPrice] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');
  const [fuelDateTime, setFuelDateTime] = useState('');

  const [maintType, setMaintType] = useState('كهرباء');
  const [maintDesc, setMaintDesc] = useState('');
  const [supplyName, setSupplyName] = useState('');
  const [supplyPrice, setSupplyPrice] = useState('');
  const [laborDesc, setLaborDesc] = useState('');
  const [laborPrice, setLaborPrice] = useState('');
  const [maintTotal, setMaintTotal] = useState('');
  const [maintDate, setMaintDate] = useState('');

  const [accidentTitle, setAccidentTitle] = useState('');
  const [accidentLocation, setAccidentLocation] = useState('');
  const [accidentDamage, setAccidentDamage] = useState('');
  const [accidentNotes, setAccidentNotes] = useState('');
  const [accidentDateTime, setAccidentDateTime] = useState('');
  const [accidentVault, setAccidentVault] = useState(false);

  // Student Profile State
  const [studentName, setStudentName] = useState('');
  const [studentNationalId, setStudentNationalId] = useState('');
  const [studentAge, setStudentAge] = useState('');
  const [studentStage, setStudentStage] = useState('');
  const [studentActiveTab, setStudentActiveTab] = useState<'profile' | 'addExpense' | 'expensesList'>('profile');

  // Student New Expense Form State
  const [newExpCategory, setNewExpCategory] = useState<'lessons' | 'personal' | 'transport' | 'school' | 'books'>('lessons');
  const [newExpTitle, setNewExpTitle] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');
  const [newExpDate, setNewExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [newExpFeedback, setNewExpFeedback] = useState<string | null>(null);

  // Student Expense Inline Edit State
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [inlineExpTitle, setInlineExpTitle] = useState('');
  const [inlineExpAmount, setInlineExpAmount] = useState('');
  const [inlineExpCategory, setInlineExpCategory] = useState<'lessons' | 'personal' | 'transport' | 'school' | 'books'>('lessons');
  const [inlineExpDate, setInlineExpDate] = useState('');

  const [stdExpTitle, setStdExpTitle] = useState('');
  const [stdExpAmount, setStdExpAmount] = useState('');
  const [stdExpSubCategory, setStdExpSubCategory] = useState<'lessons' | 'personal' | 'transport' | 'school' | 'books'>('lessons');
  const [stdExpDate, setStdExpDate] = useState('');

  // Populate fields whenever editItem changes
  useEffect(() => {
    if (!editItem) return;

    switch (editItem.kind) {
      case 'house':
        setHouseType(editItem.item.type || '');
        setHouseCustomType(editItem.item.customType || '');
        setHouseAmount(editItem.item.amount ? editItem.item.amount.toString() : '');
        setHousePaymentType(editItem.item.paymentType || 'supply');
        setHouseDate(editItem.item.date || new Date().toISOString().split('T')[0]);
        break;

      case 'work':
        setWorkType(editItem.item.type || '');
        setWorkAmount(editItem.item.amount ? editItem.item.amount.toString() : '');
        setWorkDate(editItem.item.date || new Date().toISOString().split('T')[0]);
        setWorkNotes(editItem.item.notes || '');
        break;

      case 'fuel':
        setFuelType(editItem.item.fuelType || 'بنزين 92');
        setFuelPrice(editItem.item.price ? editItem.item.price.toString() : '');
        setFuelOdometer(editItem.item.odometer ? editItem.item.odometer.toString() : '');
        setFuelDateTime(editItem.item.dateTime || new Date().toISOString().slice(0, 16));
        break;

      case 'maintenance':
        setMaintType(editItem.item.maintenanceType || 'كهرباء');
        setMaintDesc(editItem.item.description || '');
        setSupplyName(editItem.item.supplyName || '');
        setSupplyPrice(editItem.item.supplyPrice ? editItem.item.supplyPrice.toString() : '');
        setLaborDesc(editItem.item.laborDescription || '');
        setLaborPrice(editItem.item.laborPrice ? editItem.item.laborPrice.toString() : '');
        setMaintTotal(editItem.item.total ? editItem.item.total.toString() : '');
        setMaintDate(editItem.item.date || new Date().toISOString().split('T')[0]);
        break;

      case 'accident':
        setAccidentTitle(editItem.item.title || '');
        setAccidentLocation(editItem.item.location || '');
        setAccidentDamage(editItem.item.estimatedDamage ? editItem.item.estimatedDamage.toString() : '');
        setAccidentNotes(editItem.item.notes || '');
        setAccidentDateTime(editItem.item.dateTime || new Date().toISOString().slice(0, 16));
        setAccidentVault(!!editItem.item.savedToVault);
        break;

      case 'student':
        setStudentName(editItem.item.name || '');
        setStudentNationalId(editItem.item.nationalId || '');
        setStudentAge(editItem.item.age || '');
        setStudentStage(editItem.item.stage || (isAr ? 'إعدادي' : 'Preparatory'));
        setStudentActiveTab(initialStudentTab || 'profile');
        setNewExpFeedback(null);
        setEditingExpId(null);
        setNewExpTitle('');
        setNewExpAmount('');
        setNewExpDate(new Date().toISOString().split('T')[0]);
        break;

      case 'studentExpense':
        setStdExpTitle(editItem.item.title || '');
        setStdExpAmount(editItem.item.amount ? editItem.item.amount.toString() : '');
        setStdExpSubCategory(editItem.item.subCategory || 'lessons');
        setStdExpDate(editItem.item.date || new Date().toISOString().split('T')[0]);
        break;
    }
  }, [editItem, isAr, initialStudentTab]);

  if (!isOpen || !editItem) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    switch (editItem.kind) {
      case 'house': {
        const amt = parseFloat(houseAmount);
        if (isNaN(amt) || amt <= 0) return;
        const finalType = houseType.includes('أخرى') && houseCustomType ? houseCustomType : houseType;
        onSave({
          kind: 'house',
          item: {
            ...editItem.item,
            type: finalType,
            customType: houseCustomType,
            amount: amt,
            paymentType: housePaymentType,
            date: houseDate,
          },
        });
        break;
      }

      case 'work': {
        const amt = parseFloat(workAmount);
        if (isNaN(amt) || amt <= 0) return;
        onSave({
          kind: 'work',
          item: {
            ...editItem.item,
            type: workType,
            amount: amt,
            date: workDate,
            notes: workNotes,
          },
        });
        break;
      }

      case 'fuel': {
        const priceNum = parseFloat(fuelPrice);
        if (isNaN(priceNum) || priceNum <= 0) return;
        const odomNum = parseInt(fuelOdometer);
        onSave({
          kind: 'fuel',
          item: {
            ...editItem.item,
            fuelType,
            price: priceNum,
            odometer: isNaN(odomNum) ? 0 : odomNum,
            dateTime: fuelDateTime,
          },
        });
        break;
      }

      case 'maintenance': {
        const supP = parseFloat(supplyPrice) || 0;
        const labP = parseFloat(laborPrice) || 0;
        const tot = parseFloat(maintTotal) || (supP + labP);
        if (tot <= 0) return;
        onSave({
          kind: 'maintenance',
          item: {
            ...editItem.item,
            maintenanceType: maintType,
            description: maintDesc,
            supplyName,
            supplyPrice: supP,
            laborDescription: laborDesc,
            laborPrice: labP,
            total: tot,
            date: maintDate,
          },
        });
        break;
      }

      case 'accident': {
        const dmg = parseFloat(accidentDamage) || 0;
        onSave({
          kind: 'accident',
          item: {
            ...editItem.item,
            title: accidentTitle || (isAr ? 'حادث موثق' : 'Documented Accident'),
            location: accidentLocation,
            estimatedDamage: dmg,
            notes: accidentNotes,
            dateTime: accidentDateTime,
            savedToVault: accidentVault,
          },
        });
        break;
      }

      case 'student': {
        if (!studentName.trim()) return;
        onSave({
          kind: 'student',
          item: {
            ...editItem.item,
            name: studentName.trim(),
            nationalId: studentNationalId.trim() || 'N/A',
            age: studentAge || '0',
            stage: studentStage,
          },
        });
        break;
      }

      case 'studentExpense': {
        const amt = parseFloat(stdExpAmount);
        if (isNaN(amt) || amt <= 0 || !stdExpTitle.trim()) return;
        onSave({
          kind: 'studentExpense',
          item: {
            ...editItem.item,
            title: stdExpTitle.trim(),
            amount: amt,
            subCategory: stdExpSubCategory,
            date: stdExpDate,
          },
        });
        break;
      }
    }

    onClose();
  };

  // Student Expenses derived & helpers
  const currentStudentExpenses =
    editItem.kind === 'student'
      ? studentExpenses.filter((x) => x.studentId === editItem.item.id)
      : [];
  const currentStudentTotal = currentStudentExpenses.reduce((sum, r) => sum + r.amount, 0);

  const handleAddNewStudentExpense = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editItem.kind !== 'student') return;
    const amt = parseFloat(newExpAmount);
    if (isNaN(amt) || amt <= 0) return;
    if (!newExpTitle.trim()) return;

    if (onAddStudentExpense) {
      onAddStudentExpense({
        studentId: editItem.item.id,
        subCategory: newExpCategory,
        title: newExpTitle.trim(),
        amount: amt,
        date: newExpDate,
      });

      setNewExpFeedback(
        isAr
          ? `تمت إضافة المصروف (${newExpTitle.trim()}) بمبلغ ${amt.toLocaleString()} ${currency} لحساب الطالب بنجاح! 🎉`
          : `Expense added to student account successfully!`
      );
      setNewExpTitle('');
      setNewExpAmount('');
      setTimeout(() => setNewExpFeedback(null), 4000);
    }
  };

  const handleStartEditExpense = (rec: StudentExpenseRecord) => {
    setEditingExpId(rec.id);
    setInlineExpTitle(rec.title);
    setInlineExpAmount(rec.amount.toString());
    setInlineExpCategory(rec.subCategory);
    setInlineExpDate(rec.date);
  };

  const handleSaveInlineExpense = (id: string) => {
    const amt = parseFloat(inlineExpAmount);
    if (isNaN(amt) || amt <= 0 || !inlineExpTitle.trim()) return;
    if (onUpdateStudentExpense && editItem.kind === 'student') {
      onUpdateStudentExpense({
        id,
        studentId: editItem.item.id,
        title: inlineExpTitle.trim(),
        amount: amt,
        subCategory: inlineExpCategory,
        date: inlineExpDate,
      });
      setEditingExpId(null);
    }
  };

  const getModalTitle = () => {
    switch (editItem.kind) {
      case 'house':
        return isAr ? 'تعديل وحفظ مصروف منزلي' : 'Edit & Save House Expense';
      case 'work':
        return isAr ? 'تعديل وحفظ مصروف عمل' : 'Edit & Save Work Expense';
      case 'fuel':
        return isAr ? 'تعديل وحفظ تموين وقود' : 'Edit & Save Fuel Record';
      case 'maintenance':
        return isAr ? 'تعديل وحفظ سجل صيانة' : 'Edit & Save Maintenance Record';
      case 'accident':
        return isAr ? 'تعديل وحفظ سجل الحادث' : 'Edit & Save Accident Record';
      case 'student':
        return isAr
          ? `إدارة وتعديل حساب الطالب: ${studentName || editItem.item.name}`
          : `Manage Student Account: ${studentName || editItem.item.name}`;
      case 'studentExpense':
        return isAr ? 'تعديل وحفظ مصروف تعليمي' : 'Edit & Save Student Expense';
      default:
        return isAr ? 'تعديل وحفظ' : 'Edit & Save';
    }
  };

  const getModalIcon = () => {
    switch (editItem.kind) {
      case 'house':
        return <Home className="w-5 h-5 text-accent-500" />;
      case 'work':
        return <Briefcase className="w-5 h-5 text-accent-500" />;
      case 'fuel':
        return <Fuel className="w-5 h-5 text-accent-500" />;
      case 'maintenance':
        return <Wrench className="w-5 h-5 text-accent-500" />;
      case 'accident':
        return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      case 'student':
        return <GraduationCap className="w-5 h-5 text-accent-500" />;
      case 'studentExpense':
        return <BookOpen className="w-5 h-5 text-accent-500" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div
        className={`bg-[#181818] border border-accent-500/50 w-full ${
          editItem.kind === 'student' ? 'max-w-2xl' : 'max-w-lg'
        } rounded-3xl shadow-2xl text-white overflow-hidden my-6 transition-all`}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-[#1c1c1c] to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-500/15 border border-accent-500/30 flex items-center justify-center">
              {getModalIcon()}
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">{getModalTitle()}</h3>
              <p className="text-[11px] text-slate-400">
                {editItem.kind === 'student'
                  ? isAr
                    ? 'تعديل بيانات الطالب، إضافة مصاريف جديدة، وتعديل كشف الحساب بالكامل'
                    : 'Edit student profile, add new expenses, and manage full ledger'
                  : isAr
                  ? 'قم بتعديل البيانات المطلوبة ثم اضغط حفظ التعديلات'
                  : 'Modify the fields and click Save Changes'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* 1. HOUSE FORM */}
          {editItem.kind === 'house' && (
            <>
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'نوع المصروف' : 'Expense Type'} *
                </label>
                <select
                  value={houseType}
                  onChange={(e) => setHouseType(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:border-accent-500"
                >
                  {[
                    isAr ? 'فطار' : 'Breakfast',
                    isAr ? 'غداء' : 'Lunch',
                    isAr ? 'عشاء' : 'Dinner',
                    isAr ? 'إصلاحات كهربائية' : 'Electrical Repairs',
                    isAr ? 'إصلاحات دهان' : 'Painting Repairs',
                    isAr ? 'إصلاحات سباكة' : 'Plumbing Repairs',
                    isAr ? 'شراء أجهزة منزلية' : 'Home Appliances',
                    isAr ? 'شراء مفروشات' : 'Furnishing',
                    isAr ? 'شراء أخرى (أخرى)' : 'Other (Custom)',
                  ].map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {houseType.includes('أخرى') && (
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'وصف المصروف الآخر' : 'Custom Description'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={houseCustomType}
                    onChange={(e) => setHouseCustomType(e.target.value)}
                    placeholder={isAr ? 'اكتب الوصف...' : 'Description...'}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'المبلغ' : 'Amount'} ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={houseAmount}
                    onChange={(e) => setHouseAmount(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono-num font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'التاريخ' : 'Date'} *
                  </label>
                  <input
                    type="date"
                    required
                    value={houseDate}
                    onChange={(e) => setHouseDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'طبيعة الدفع' : 'Payment Nature'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'supply', label: isAr ? '📦 توريد (قطع ومواد)' : 'Supply' },
                    { id: 'labor', label: isAr ? '🛠️ مصنعية (عمل وأجور)' : 'Labor' },
                  ].map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => setHousePaymentType(pt.id as any)}
                      className={`p-2 rounded-xl font-bold border transition-all text-center ${
                        housePaymentType === pt.id
                          ? 'bg-accent-500 text-slate-950 border-accent-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 2. WORK FORM */}
          {editItem.kind === 'work' && (
            <>
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'نوع المصروف' : 'Expense Type'} *
                </label>
                <select
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:border-accent-500"
                >
                  {[
                    isAr ? 'أدوات مكتبية' : 'Office Supplies',
                    isAr ? 'صيانة أجهزة العمل' : 'Work Gear Maintenance',
                    isAr ? 'اشتراكات برمجيات' : 'Software Subscriptions',
                    isAr ? 'مطبوعات وأوراق' : 'Printing & Paper',
                    isAr ? 'مستلزمات عامة' : 'General Supplies',
                    isAr ? 'أخرى' : 'Other',
                  ].map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'المبلغ' : 'Amount'} ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={workAmount}
                    onChange={(e) => setWorkAmount(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono-num font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'التاريخ' : 'Date'} *
                  </label>
                  <input
                    type="date"
                    required
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'ملاحظات' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>
            </>
          )}

          {/* 3. FUEL FORM */}
          {editItem.kind === 'fuel' && (
            <>
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'نوع الوقود' : 'Fuel Type'} *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['بنزين 92', 'بنزين 95', 'سولار', 'غاز طبيعي', 'شحن كهربائي'].map((ft) => (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => setFuelType(ft)}
                      className={`p-2 rounded-xl font-bold border transition-all text-center text-xs ${
                        fuelType === ft
                          ? 'bg-accent-500 text-slate-950 border-accent-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {ft}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'المبلغ المدفوع' : 'Price'} ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={fuelPrice}
                    onChange={(e) => setFuelPrice(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono-num font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'قراءة العداد (كم)' : 'Odometer (km)'}
                  </label>
                  <input
                    type="number"
                    value={fuelOdometer}
                    onChange={(e) => setFuelOdometer(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'التاريخ والوقت' : 'Date & Time'} *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={fuelDateTime}
                  onChange={(e) => setFuelDateTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>
            </>
          )}

          {/* 4. MAINTENANCE FORM */}
          {editItem.kind === 'maintenance' && (
            <>
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'نوع الصيانة' : 'Maintenance Type'} *
                </label>
                <select
                  value={maintType}
                  onChange={(e) => setMaintType(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:border-accent-500"
                >
                  {[
                    'دهان', 'سمكرة', 'كهرباء', 'عفشة', 'نظام التبريد', 'نظام التكييف',
                    'المحرك', 'الغاز', 'الكاوتش', 'السروجي', 'الزجاج', 'الشكمان', 'الحساسات'
                  ].map((m, i) => (
                    <option key={i} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'وصف الصيانة' : 'Description'}
                </label>
                <input
                  type="text"
                  value={maintDesc}
                  onChange={(e) => setMaintDesc(e.target.value)}
                  placeholder={isAr ? 'وصف تفصيلي...' : 'Description...'}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div>
                  <label className="block font-bold text-slate-300 text-[11px] mb-1">
                    {isAr ? 'اسم القطعة (توريد)' : 'Supply Name'}
                  </label>
                  <input
                    type="text"
                    value={supplyName}
                    onChange={(e) => setSupplyName(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 text-[11px] mb-1">
                    {isAr ? 'سعر التوريد' : 'Supply Price'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={supplyPrice}
                    onChange={(e) => setSupplyPrice(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono-num text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div>
                  <label className="block font-bold text-slate-300 text-[11px] mb-1">
                    {isAr ? 'وصف المصنعية' : 'Labor Desc'}
                  </label>
                  <input
                    type="text"
                    value={laborDesc}
                    onChange={(e) => setLaborDesc(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 text-[11px] mb-1">
                    {isAr ? 'سعر المصنعية' : 'Labor Price'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={laborPrice}
                    onChange={(e) => setLaborPrice(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono-num text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'الإجمالي النهائي' : 'Total'} ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={maintTotal}
                    onChange={(e) => setMaintTotal(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-accent-500/50 text-accent-500 font-mono-num font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'التاريخ' : 'Date'} *
                  </label>
                  <input
                    type="date"
                    required
                    value={maintDate}
                    onChange={(e) => setMaintDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>
              </div>
            </>
          )}

          {/* 5. ACCIDENT FORM */}
          {editItem.kind === 'accident' && (
            <>
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'عنوان أو وصف الحادث' : 'Accident Title'} *
                </label>
                <input
                  type="text"
                  required
                  value={accidentTitle}
                  onChange={(e) => setAccidentTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'الموقع الجغرافي' : 'Location'}
                  </label>
                  <input
                    type="text"
                    value={accidentLocation}
                    onChange={(e) => setAccidentLocation(e.target.value)}
                    placeholder="موقع الحادث..."
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'التلفيات التقديرية' : 'Estimated Damage'} ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={accidentDamage}
                    onChange={(e) => setAccidentDamage(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono-num font-bold text-rose-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'التاريخ والوقت' : 'Date & Time'}
                </label>
                <input
                  type="text"
                  value={accidentDateTime}
                  onChange={(e) => setAccidentDateTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'ملاحظات تفصيلية' : 'Detailed Notes'}
                </label>
                <textarea
                  rows={2}
                  value={accidentNotes}
                  onChange={(e) => setAccidentNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800">
                <input
                  type="checkbox"
                  id="acc-vault-check"
                  checked={accidentVault}
                  onChange={(e) => setAccidentVault(e.target.checked)}
                  className="w-4 h-4 rounded text-accent-500 focus:ring-0 bg-slate-950 border-slate-700"
                />
                <label htmlFor="acc-vault-check" className="text-xs text-slate-300 font-bold cursor-pointer">
                  {isAr ? 'حفظ ومزامنة مع الخزنة الرقمية المشفرة' : 'Sync with Digital Secure Vault'}
                </label>
              </div>
            </>
          )}

          {/* 6. STUDENT PROFILE & EXPENSE MANAGEMENT FORM */}
          {editItem.kind === 'student' && (
            <div className="space-y-4">
              {/* Student Header Navigation Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setStudentActiveTab('profile')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                    studentActiveTab === 'profile'
                      ? 'bg-accent-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{isAr ? 'بيانات الطالب' : 'Student Info'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudentActiveTab('addExpense')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                    studentActiveTab === 'addExpense'
                      ? 'bg-accent-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? '➕ إضافة مصروف' : '+ Add Expense'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudentActiveTab('expensesList')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                    studentActiveTab === 'expensesList'
                      ? 'bg-accent-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    {isAr
                      ? `سجل المصروفات (${currentStudentExpenses.length})`
                      : `Expenses (${currentStudentExpenses.length})`}
                  </span>
                </button>
              </div>

              {/* TAB 1: PROFILE DATA */}
              {studentActiveTab === 'profile' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      {isAr ? 'اسم الطالب' : 'Student Name'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-bold focus:border-accent-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        {isAr ? 'السن' : 'Age'}
                      </label>
                      <input
                        type="number"
                        value={studentAge}
                        onChange={(e) => setStudentAge(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono-num focus:border-accent-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        {isAr ? 'المرحلة الدراسية' : 'Stage'}
                      </label>
                      <select
                        value={studentStage}
                        onChange={(e) => setStudentStage(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:border-accent-500"
                      >
                        {[
                          isAr ? 'ابتدائي' : 'Primary',
                          isAr ? 'إعدادي' : 'Preparatory',
                          isAr ? 'ثانوي' : 'Secondary',
                          isAr ? 'جامعي' : 'University',
                        ].map((st, i) => (
                          <option key={i} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      {isAr ? 'الرقم القومي (اختياري)' : 'National ID (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={studentNationalId}
                      onChange={(e) => setStudentNationalId(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono-num focus:border-accent-500"
                    />
                  </div>

                  {/* Financial Summary Card for Student */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-accent-500/10 via-slate-900/80 to-accent-500/5 border border-accent-500/30 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-slate-400">
                        {isAr ? 'إجمالي المصروفات المسجلة لهذا الطالب' : 'Total Expenses Logged'}
                      </p>
                      <p className="text-lg font-black text-accent-500 font-mono-num">
                        {currentStudentTotal.toLocaleString()} {currency}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStudentActiveTab('addExpense')}
                      className="px-3.5 py-2 rounded-xl bg-accent-500/20 hover:bg-accent-500/30 text-accent-500 border border-accent-500/40 font-bold text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAr ? 'إضافة مصروف' : 'Add Expense'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: ADD EXPENSE TO THIS STUDENT */}
              {studentActiveTab === 'addExpense' && (
                <div className="space-y-3.5 pt-1">
                  {newExpFeedback && (
                    <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
                      <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{newExpFeedback}</span>
                    </div>
                  )}

                  <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-accent-500" />
                      <span className="font-bold text-white text-xs">
                        {isAr ? `إضافة مصروف مباشر لحساب الطالب:` : 'Adding expense for:'}{' '}
                        <span className="text-accent-500 font-black">{studentName || editItem.item.name}</span>
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono-num">
                      {studentStage}
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5 text-xs">
                      {isAr ? 'نوع أو قسم المصروف' : 'Expense Category'} *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'lessons', label: isAr ? '📚 دروس خصوصية' : 'Lessons' },
                        { id: 'personal', label: isAr ? '💳 مصروف شخصي' : 'Personal' },
                        { id: 'transport', label: isAr ? '🚌 مواصلات وباص' : 'Transport' },
                        { id: 'school', label: isAr ? '🏫 مصاريف مدرسية' : 'School Fees' },
                        { id: 'books', label: isAr ? '📖 كتب ومذكرات' : 'Books & Notes' },
                      ].map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setNewExpCategory(sub.id as any)}
                          className={`p-2.5 rounded-xl font-bold border transition-all text-center text-xs ${
                            newExpCategory === sub.id
                              ? 'bg-accent-500 text-slate-950 border-accent-500 shadow-md font-black'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-850'
                          }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1 text-xs">
                      {isAr ? 'بيان أو وصف المصروف' : 'Description / Title'} *
                    </label>
                    <input
                      type="text"
                      value={newExpTitle}
                      onChange={(e) => setNewExpTitle(e.target.value)}
                      placeholder={
                        isAr
                          ? 'مثال: اشتراك شهر أكتوبر، مذكرة لغة عربية، قسط الباص، مصروف يومي...'
                          : 'e.g. October private lesson, Arabic book, bus fee...'
                      }
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:border-accent-500 placeholder:text-slate-600 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1 text-xs">
                        {isAr ? 'المبلغ المطلوب' : 'Amount'} ({currency}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newExpAmount}
                        onChange={(e) => setNewExpAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono-num font-bold focus:border-accent-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1 text-xs">
                        {isAr ? 'تاريخ المصروف' : 'Date'} *
                      </label>
                      <input
                        type="date"
                        value={newExpDate}
                        onChange={(e) => setNewExpDate(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:border-accent-500 text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddNewStudentExpense}
                      disabled={!newExpTitle.trim() || !newExpAmount || parseFloat(newExpAmount) <= 0}
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-accent-500 to-[#b39127] hover:from-accent-600 hover:to-accent-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-accent-500/20 transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isAr ? 'حفظ وإضافة المصروف لحساب الطالب فوراً' : 'Add Expense To Student'}</span>
                    </button>
                    {currentStudentExpenses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setStudentActiveTab('expensesList')}
                        className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                      >
                        {isAr ? `عرض السجل (${currentStudentExpenses.length})` : 'View Ledger'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: STUDENT EXPENSES LEDGER WITH INLINE EDIT */}
              {studentActiveTab === 'expensesList' && (
                <div className="space-y-3 pt-1">
                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400">
                        {isAr ? 'إجمالي المصروفات:' : 'Total Spent:'}
                      </span>
                      <span className="mr-2 ml-2 font-mono-num font-black text-accent-500 text-sm">
                        {currentStudentTotal.toLocaleString()} {currency}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ({currentStudentExpenses.length} {isAr ? 'عملية' : 'records'})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStudentActiveTab('addExpense')}
                      className="px-3 py-1.5 rounded-xl bg-accent-500 text-slate-950 font-bold text-xs flex items-center gap-1 hover:bg-[#c49e28] transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAr ? 'إضافة مصروف' : 'Add'}</span>
                    </button>
                  </div>

                  {currentStudentExpenses.length === 0 ? (
                    <div className="py-10 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
                      <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-400 text-xs font-bold">
                        {isAr ? 'لا توجد مصاريف مسجلة حتى الآن لهذا الطالب' : 'No expense records found for this student'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setStudentActiveTab('addExpense')}
                        className="mt-3 px-4 py-2 rounded-xl bg-accent-500/20 border border-accent-500/40 text-accent-500 font-bold text-xs hover:bg-accent-500/30 transition-all inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAr ? 'إضافة أول مصروف للطالب' : 'Add First Expense'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {currentStudentExpenses.map((rec) => {
                        const isEditing = editingExpId === rec.id;
                        const subLabels: Record<string, string> = {
                          lessons: isAr ? 'دروس خصوصية' : 'Lessons',
                          personal: isAr ? 'شخصي' : 'Personal',
                          transport: isAr ? 'مواصلات' : 'Transport',
                          school: isAr ? 'مدرسة' : 'School',
                          books: isAr ? 'كتب ومذكرات' : 'Books',
                        };

                        if (isEditing) {
                          return (
                            <div
                              key={rec.id}
                              className="p-3 rounded-2xl bg-slate-900 border border-accent-500 space-y-2.5 animate-fade-in"
                            >
                              <div className="text-[11px] font-bold text-accent-500">
                                {isAr ? 'تعديل المصروف' : 'Edit Expense Record'}
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {[
                                  { id: 'lessons', label: isAr ? 'دروس' : 'Lessons' },
                                  { id: 'personal', label: isAr ? 'شخصي' : 'Personal' },
                                  { id: 'transport', label: isAr ? 'مواصلات' : 'Transport' },
                                  { id: 'school', label: isAr ? 'مدرسة' : 'School' },
                                  { id: 'books', label: isAr ? 'كتب' : 'Books' },
                                ].map((sub) => (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => setInlineExpCategory(sub.id as any)}
                                    className={`py-1 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                                      inlineExpCategory === sub.id
                                        ? 'bg-accent-500 text-slate-950 border-accent-500'
                                        : 'bg-slate-950 text-slate-400 border-slate-800'
                                    }`}
                                  >
                                    {sub.label}
                                  </button>
                                ))}
                              </div>

                              <input
                                type="text"
                                value={inlineExpTitle}
                                onChange={(e) => setInlineExpTitle(e.target.value)}
                                placeholder={isAr ? 'بيان المصروف' : 'Description'}
                                className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-accent-500"
                              />

                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={inlineExpAmount}
                                  onChange={(e) => setInlineExpAmount(e.target.value)}
                                  placeholder={isAr ? 'المبلغ' : 'Amount'}
                                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono-num font-bold text-xs focus:border-accent-500"
                                />
                                <input
                                  type="date"
                                  value={inlineExpDate}
                                  onChange={(e) => setInlineExpDate(e.target.value)}
                                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-accent-500"
                                />
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingExpId(null)}
                                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs font-bold"
                                >
                                  {isAr ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveInlineExpense(rec.id)}
                                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{isAr ? 'حفظ التعديل' : 'Save'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={rec.id}
                            className="p-3 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 flex items-center justify-between gap-3 transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300 font-bold shrink-0">
                                {subLabels[rec.subCategory] || rec.subCategory}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate">{rec.title}</div>
                                <div className="text-[10px] text-slate-500 font-mono-num">{rec.date}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-mono-num font-black text-sm text-accent-500">
                                -{rec.amount.toLocaleString()} {currency}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStartEditExpense(rec)}
                                title={isAr ? 'تعديل هذا المصروف' : 'Edit Expense'}
                                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-blue-600/30 text-slate-400 hover:text-blue-400 flex items-center justify-center transition-all"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {onDeleteStudentExpense && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteStudentExpense(rec.id)}
                                  title={isAr ? 'حذف هذا المصروف' : 'Delete Expense'}
                                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 7. STUDENT EXPENSE FORM */}
          {editItem.kind === 'studentExpense' && (
            <>
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'قسم المصروف' : 'Subcategory'} *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'lessons', label: isAr ? 'دروس خصوصية' : 'Lessons' },
                    { id: 'personal', label: isAr ? 'مصروف شخصي' : 'Personal' },
                    { id: 'transport', label: isAr ? 'مواصلات' : 'Transport' },
                    { id: 'school', label: isAr ? 'مصاريف مدرسية' : 'School' },
                    { id: 'books', label: isAr ? 'كتب خارجية' : 'Books' },
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setStdExpSubCategory(sub.id as any)}
                      className={`p-2 rounded-xl font-bold border transition-all text-center text-xs ${
                        stdExpSubCategory === sub.id
                          ? 'bg-accent-500 text-slate-950 border-accent-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'بيان أو وصف المصروف' : 'Description'} *
                </label>
                <input
                  type="text"
                  required
                  value={stdExpTitle}
                  onChange={(e) => setStdExpTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'المبلغ' : 'Amount'} ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={stdExpAmount}
                    onChange={(e) => setStdExpAmount(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono-num font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? 'التاريخ' : 'Date'} *
                  </label>
                  <input
                    type="date"
                    required
                    value={stdExpDate}
                    onChange={(e) => setStdExpDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              {editItem.kind === 'student' && (
                <span className="font-mono-num text-accent-500 font-bold">
                  {isAr ? 'إجمالي حساب الطالب:' : 'Total:'} {currentStudentTotal.toLocaleString()} {currency}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all text-xs"
              >
                {isAr ? (editItem.kind === 'student' && studentActiveTab !== 'profile' ? 'إغلاق' : 'إلغاء') : 'Cancel'}
              </button>

              {editItem.kind !== 'student' || studentActiveTab === 'profile' ? (
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-accent-500 to-accent-700 hover:from-accent-600 hover:to-accent-800 text-slate-950 font-black shadow-lg shadow-accent-500/20 transition-all active:scale-95 text-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>{isAr ? 'حفظ التعديلات' : 'Save Changes'}</span>
                </button>
              ) : studentActiveTab === 'addExpense' ? (
                <button
                  type="button"
                  onClick={handleAddNewStudentExpense}
                  disabled={!newExpTitle.trim() || !newExpAmount || parseFloat(newExpAmount) <= 0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-accent-500 to-accent-700 hover:from-accent-600 hover:to-accent-800 disabled:opacity-50 text-slate-950 font-black shadow-lg shadow-accent-500/20 transition-all active:scale-95 text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAr ? 'إضافة المصروف' : 'Add Expense'}</span>
                </button>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
