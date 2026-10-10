import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowLeft, BookOpen, GraduationCap, UserPlus, Plus, Trash2, Edit2, Printer, FileSpreadsheet, X, User } from 'lucide-react';
import { formatMoney, isDateInMonth } from '../../services/financeCalculations';
import { Language, StudentProfile, StudentExpenseRecord } from '../../types';
import { financeService } from '../../services/financeService';

interface EducationExpensesSectionProps {
  language: Language;
  currency: string;
  selectedMonth: string;
  onBack: () => void;
  students: StudentProfile[];
  onSaveStudents: (list: StudentProfile[]) => void;
}

type Screen = 'menu' | 'student';

const STAGES = ['رياض أطفال', 'ابتدائي', 'إعدادي', 'ثانوي', 'جامعي'];
const EXPENSE_TYPES: Array<{ value: StudentExpenseRecord['subCategory']; label: string }> = [
  { value: 'lessons', label: 'دروس ومجموعات' },
  { value: 'school', label: 'مصاريف وأقساط مدرسية' },
  { value: 'books', label: 'كتب ومذكرات وأدوات' },
  { value: 'transport', label: 'باص ومواصلات' },
  { value: 'personal', label: 'مصروف شخصي' },
];

export const EducationExpensesSection: React.FC<EducationExpensesSectionProps> = ({
  language, currency, selectedMonth, onBack, students, onSaveStudents,
}) => {
  const isAr = language === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  const [screen, setScreen] = useState<Screen>('menu');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentEditId, setStudentEditId] = useState<string | null>(null);
  const [expenseEditId, setExpenseEditId] = useState<string | null>(null);
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);

  const [stdName, setStdName] = useState('');
  const [stdStage, setStdStage] = useState('إعدادي');
  const [stdAge, setStdAge] = useState('');
  const [stdNatId, setStdNatId] = useState('');

  const [expenseType, setExpenseType] = useState<StudentExpenseRecord['subCategory']>('lessons');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenses, setExpenses] = useState<StudentExpenseRecord[]>([]);
  const loadCanonicalExpenses = async () => {
    const rows = await financeService.getExpenses({ type: 'student' });
    setExpenses(rows.map((x) => {
      let meta: any = {};
      try { meta = x.notes ? JSON.parse(String(x.notes)) : {}; } catch {}
      return { id: String(x.id), studentId: String(meta.studentId || ''), subCategory: (meta.subCategory || 'personal') as StudentExpenseRecord['subCategory'], title: String(x.title || x.category || 'مصروف تعليمي'), amount: Number(x.amount) || 0, date: String(x.date || '').slice(0, 10) };
    }));
  };
  useEffect(() => { void loadCanonicalExpenses(); }, []);

  const currentMonthExpenses = useMemo(() => expenses.filter(e => isDateInMonth(e.date, selectedMonth)), [expenses, selectedMonth]);
  const educationTotal = currentMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const selectedStudent = students.find(s => s.id === selectedStudentId) || null;
  const selectedStudentExpenses = selectedStudent ? expenses.filter(e => e.studentId === selectedStudent.id) : [];
  const selectedStudentMonthTotal = selectedStudentExpenses.filter(e => isDateInMonth(e.date, selectedMonth)).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const resetStudentForm = () => { setStudentEditId(null); setStdName(''); setStdStage('إعدادي'); setStdAge(''); setStdNatId(''); setStudentFormOpen(true); };
  const openStudentEdit = (student: StudentProfile) => { setStudentEditId(student.id); setStdName(student.name); setStdStage(student.stage); setStdAge(student.age || ''); setStdNatId(student.nationalId || ''); setStudentFormOpen(true); };
  const resetExpenseForm = () => { setExpenseEditId(null); setExpenseType('lessons'); setExpenseTitle(''); setExpenseAmount(''); setExpenseDate(new Date().toISOString().split('T')[0]); setExpenseFormOpen(true); };
  const openExpenseEdit = (e: StudentExpenseRecord) => { setExpenseEditId(e.id); setExpenseType(e.subCategory); setExpenseTitle(e.title); setExpenseAmount(String(e.amount)); setExpenseDate(e.date); setExpenseFormOpen(true); };

  const saveStudent = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!stdName.trim() || !stdStage || !stdAge.trim() || !stdNatId.trim()) { alert(isAr ? 'من فضلك أكمل بيانات الطالب الأربعة.' : 'Please complete all four student fields.'); return; }
    if (!/^\d{14}$/.test(stdNatId.trim())) { alert(isAr ? 'الرقم القومي يجب أن يكون 14 رقمًا.' : 'National ID must contain 14 digits.'); return; }
    const item: StudentProfile = { id: studentEditId || `std_${Date.now()}`, name: stdName.trim(), stage: stdStage, age: stdAge.trim(), nationalId: stdNatId.trim() };
    onSaveStudents(studentEditId ? students.map(s => s.id === studentEditId ? item : s) : [item, ...students]);
    setStudentFormOpen(false);
  };

  const saveExpense = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedStudent) { alert(isAr ? 'اختر الطالب أولاً.' : 'Select a student first.'); return; }
    const amount = Number(expenseAmount);
    if (!expenseTitle.trim() || !Number.isFinite(amount) || amount <= 0 || !expenseDate) { alert(isAr ? 'أكمل بيانات المصروف والقيمة.' : 'Complete the expense details and amount.'); return; }
    const item: StudentExpenseRecord = { id: expenseEditId || `edu_${Date.now()}`, studentId: selectedStudent.id, subCategory: expenseType, title: expenseTitle.trim(), amount, date: expenseDate };
    try {
      const notes = JSON.stringify({ studentId: item.studentId, subCategory: item.subCategory });
      if (expenseEditId) await financeService.updateCanonicalFinanceExpense(expenseEditId, { type: 'student', title: item.title, category: item.subCategory, amount: item.amount, date: item.date, notes });
      else await financeService.addExpense({ type: 'student', title: item.title, category: item.subCategory, amount: item.amount, date: item.date, notes });
      await loadCanonicalExpenses();
      setExpenseFormOpen(false);
    } catch (error) { alert(error instanceof Error ? error.message : 'تعذر حفظ المصروف التعليمي.'); }
  };

  const exportStudent = (student: StudentProfile) => {
    const rows = expenses.filter(e => e.studentId === student.id);
    const html = `<html dir="rtl"><head><meta charset="utf-8"><title>${student.name}</title></head><body><h2>${student.name}</h2><p>المرحلة: ${student.stage} | العمر: ${student.age} | الرقم القومي: ${student.nationalId}</p><table border="1" cellspacing="0" cellpadding="8"><tr><th>النوع</th><th>البيان</th><th>المبلغ</th><th>التاريخ</th></tr>${rows.map(e => `<tr><td>${EXPENSE_TYPES.find(x => x.value === e.subCategory)?.label || e.subCategory}</td><td>${e.title}</td><td>${e.amount}</td><td>${e.date}</td></tr>`).join('')}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `student-${student.name}.xls`; a.click(); URL.revokeObjectURL(url);
  };

  const exportStudentPrint = (student: StudentProfile) => {
    const rows = expenses.filter(e => e.studentId === student.id);
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>${student.name}</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px}</style></head><body><h2>ملف الطالب: ${student.name}</h2><p>المرحلة: ${student.stage} — العمر: ${student.age} — الرقم القومي: ${student.nationalId}</p><table><tr><th>النوع</th><th>البيان</th><th>المبلغ</th><th>التاريخ</th></tr>${rows.map(e => `<tr><td>${EXPENSE_TYPES.find(x => x.value === e.subCategory)?.label || e.subCategory}</td><td>${e.title}</td><td>${e.amount} ${currency}</td><td>${e.date}</td></tr>`).join('')}</table><script>window.print()</script></body></html>`); w.document.close();
  };

  if (screen === 'student' && selectedStudent) {
    return <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="w-full py-4 px-4 bg-slate-50 dark:bg-slate-800/70 border-b flex items-center gap-3"><button onClick={() => setScreen('menu')} className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border flex items-center justify-center"><BackIcon className="w-5 h-5" /></button><div className="flex-1 text-center font-black text-lg">المصروفات التعليمية</div><div className="w-10" /></div>
      </div>
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden"><div className="w-full py-3 text-center font-black bg-slate-50 dark:bg-slate-800/70 border-b">اسم الطالب</div><div className="p-4"><div className="rounded-2xl border p-4"><div className="font-black text-lg">{selectedStudent.name}</div><div className="text-xs text-slate-500 mt-1">{selectedStudent.stage} • العمر {selectedStudent.age} • {selectedStudent.nationalId}</div></div></div></div>
      <button onClick={resetExpenseForm} className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> إضافة مصروفات</button>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border shadow-sm p-4"><div className="flex justify-between items-center"><span className="font-black">إجمالي مصروفات {selectedStudent.name} هذا الشهر</span><span className="font-black text-indigo-600">{formatMoney(selectedStudentMonthTotal)} {currency}</span></div></div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden"><div className="p-4 font-black border-b">تفاصيل مصروفات الطالب</div>{selectedStudentExpenses.length === 0 ? <div className="p-10 text-center text-slate-400">لا توجد مصروفات مسجلة</div> : selectedStudentExpenses.map(e => <div key={e.id} className="p-4 border-b flex items-center justify-between gap-3"><div><div className="font-bold">{e.title}</div><div className="text-xs text-slate-400 mt-1">{EXPENSE_TYPES.find(x => x.value === e.subCategory)?.label || e.subCategory} • {e.date}</div></div><div className="flex items-center gap-2"><b className="text-indigo-600">{formatMoney(e.amount)} {currency}</b><button onClick={() => openExpenseEdit(e)} className="p-2 rounded-xl bg-slate-100"><Edit2 className="w-4 h-4" /></button><button onClick={() => void financeService.deleteCanonicalFinanceExpense(e.id).then(loadCanonicalExpenses).catch(error=>alert(error instanceof Error?error.message:'تعذر حذف المصروف'))} className="p-2 rounded-xl bg-slate-100 text-rose-600"><Trash2 className="w-4 h-4" /></button></div></div>)}</div>
      {expenseFormOpen && <ExpenseModal isAr={isAr} currency={currency} editing={!!expenseEditId} type={expenseType} setType={setExpenseType} title={expenseTitle} setTitle={setExpenseTitle} amount={expenseAmount} setAmount={setExpenseAmount} date={expenseDate} setDate={setExpenseDate} onClose={() => setExpenseFormOpen(false)} onSubmit={saveExpense} />}
    </div>;
  }

  return <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden"><div className="w-full py-4 px-4 bg-slate-50 dark:bg-slate-800/70 border-b flex items-center gap-3"><button onClick={onBack} className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border flex items-center justify-center"><BackIcon className="w-5 h-5" /></button><div className="flex-1 text-center font-black text-lg">المصروفات التعليمية</div><div className="w-10" /></div></div>
    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden"><div className="w-full py-3 text-center font-black bg-slate-50 dark:bg-slate-800/70 border-b">اسم الطالب</div><div className="p-3"><button onClick={resetStudentForm} className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center gap-2"><UserPlus className="w-5 h-5" /> إضافة طالب</button></div></div>
    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border shadow-sm p-4 flex justify-between items-center"><span className="font-black">إجمالي مصروفات التعليم لهذا الشهر</span><span className="font-black text-indigo-600">{formatMoney(educationTotal)} {currency}</span></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{students.map(student => { const total = expenses.filter(e => e.studentId === student.id && isDateInMonth(e.date, selectedMonth)).reduce((s,e)=>s+(Number(e.amount)||0),0); return <button key={student.id} onClick={() => { setSelectedStudentId(student.id); setScreen('student'); }} className="text-right bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm hover:border-indigo-400 transition-all"><div className="flex items-center justify-between gap-3"><div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600"><User className="w-5 h-5" /></div><span className="font-black text-indigo-600">-{formatMoney(total)} {currency}</span></div><div className="mt-3 font-black text-base">{student.name}</div><div className="text-xs text-slate-500 mt-1">{student.stage} • العمر {student.age}</div><div className="text-[11px] text-slate-400 mt-2">اضغط لعرض وإضافة المصروفات</div><div className="mt-3 flex gap-2"><span onClick={e=>{e.stopPropagation();openStudentEdit(student)}} className="flex-1 py-2 rounded-xl bg-slate-100 text-center font-bold text-xs">تعديل</span><span onClick={e=>{e.stopPropagation();onSaveStudents(students.filter(s=>s.id!==student.id));void Promise.all(expenses.filter(x=>x.studentId===student.id).map(x=>financeService.deleteCanonicalFinanceExpense(x.id))).then(loadCanonicalExpenses).catch(error=>alert(error instanceof Error?error.message:'تعذر حذف مصروفات الطالب'))}} className="flex-1 py-2 rounded-xl bg-slate-100 text-center font-bold text-xs text-rose-600">حذف</span><span onClick={e=>{e.stopPropagation();exportStudent(student)}} className="flex-1 py-2 rounded-xl bg-slate-100 text-center font-bold text-xs">تصدير</span></div></button>; })}</div>
    {studentFormOpen && <StudentModal isAr={isAr} editing={!!studentEditId} name={stdName} setName={setStdName} stage={stdStage} setStage={setStdStage} age={stdAge} setAge={setStdAge} nationalId={stdNatId} setNationalId={setStdNatId} onClose={()=>setStudentFormOpen(false)} onSubmit={saveStudent} />}
  </div>;
};

const StudentModal: React.FC<any> = ({ isAr, editing, name, setName, stage, setStage, age, setAge, nationalId, setNationalId, onClose, onSubmit }) => <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 space-y-4"><div className="flex justify-between items-center"><h3 className="font-black text-lg">{editing ? 'تعديل بيانات الطالب' : 'إضافة طالب'}</h3><button onClick={onClose}><X /></button></div><form onSubmit={onSubmit} className="space-y-3"><input required value={name} onChange={e=>setName(e.target.value)} placeholder="اسم الطالب" className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800" /><select value={stage} onChange={e=>setStage(e.target.value)} className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800">{STAGES.map(s=><option key={s}>{s}</option>)}</select><input required value={age} onChange={e=>setAge(e.target.value)} placeholder="العمر" className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800" /><input required inputMode="numeric" maxLength={14} value={nationalId} onChange={e=>setNationalId(e.target.value.replace(/\D/g,''))} placeholder="الرقم القومي (14 رقم)" className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800" /><button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black">{editing ? 'حفظ التعديل' : 'حفظ الطالب'}</button></form><div className="text-[11px] text-slate-400 text-center">{isAr ? 'بعد الحفظ يمكنك تعديل أو حذف أو تصدير بطاقة الطالب.' : ''}</div></div></div>;

const ExpenseModal: React.FC<any> = ({ isAr, currency, editing, type, setType, title, setTitle, amount, setAmount, date, setDate, onClose, onSubmit }) => <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 space-y-4"><div className="flex justify-between items-center"><h3 className="font-black text-lg">{editing ? 'تعديل مصروف تعليمي' : 'إضافة مصروفات'}</h3><button onClick={onClose}><X /></button></div><form onSubmit={onSubmit} className="space-y-3"><select value={type} onChange={e=>setType(e.target.value)} className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800">{EXPENSE_TYPES.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select><input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="بيان المصروف" className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800" /><input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder={`القيمة ${currency}`} className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800" /><input required type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800" /><button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black">حفظ المصروف</button></form></div></div>;
