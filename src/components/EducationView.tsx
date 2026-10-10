import React, { useState } from 'react';
import {
  GraduationCap,
  Plus,
  Calendar,
  Clock,
  User,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  School,
  Trash2,
  Edit,
} from 'lucide-react';
import { Student, LessonItem, EducationExpense, Language } from '../types';
import { translations } from '../services/i18n';
import { EducationRepository } from '../services';

interface EducationViewProps {
  language: Language;
  currency: string;
  students: Student[];
  lessons: LessonItem[];
  educationExpenses: EducationExpense[];
  onUpdateStudents: (students: Student[]) => void;
  onUpdateLessons: (lessons: LessonItem[]) => void;
  onUpdateEduExpenses: (expenses: EducationExpense[]) => void;
}

export const EducationView: React.FC<EducationViewProps> = ({
  language,
  currency,
  students,
  lessons,
  educationExpenses,
  onUpdateStudents,
  onUpdateLessons,
  onUpdateEduExpenses,
}) => {
  const t = translations[language];
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || 'all');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);

  // Forms
  const [studName, setStudName] = useState('');
  const [studGrade, setStudGrade] = useState('');
  const [studSchool, setStudSchool] = useState('');

  const [lessonSubject, setLessonSubject] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDay, setLessonDay] = useState('الأحد والثلاثاء');
  const [lessonTime, setLessonTime] = useState('05:00 م - 06:30 م');
  const [lessonTutor, setLessonTutor] = useState('');
  const [lessonFee, setLessonFee] = useState('600');
  const [lessonStudentId, setLessonStudentId] = useState(students[0]?.id || '');

  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('500');
  const [expCategory, setExpCategory] = useState<'tuition' | 'lessons' | 'books' | 'supplies' | 'transport'>('books');
  const [expStudentId, setExpStudentId] = useState(students[0]?.id || '');

  const currentStudent = students.find((s) => s.id === selectedStudentId);

  const filteredLessons = lessons.filter((l) => (selectedStudentId === 'all' ? true : l.studentId === selectedStudentId));
  const filteredExpenses = educationExpenses.filter((e) =>
    selectedStudentId === 'all' ? true : e.studentId === selectedStudentId
  );

  const totalMonthlyLessonsFee = filteredLessons.reduce((sum, l) => sum + l.monthlyFee, 0);
  const totalEduExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Toggle Lesson Payment
  const handleTogglePaid = (lessonId: string) => {
    const updated = lessons.map((l) => (l.id === lessonId ? { ...l, isPaid: !l.isPaid } : l));
    onUpdateLessons(updated);
    EducationRepository.saveLessons(updated);
  };

  // Save Student
  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studName.trim()) return;

    const newStud: Student = {
      id: 'stud_' + Date.now(),
      name: studName,
      grade: studGrade,
      schoolName: studSchool,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    };

    const updated = [...students, newStud];
    onUpdateStudents(updated);
    EducationRepository.saveStudents(updated);
    setSelectedStudentId(newStud.id);
    setShowAddStudentModal(false);
    setStudName('');
  };

  // Save Lesson
  const handleSaveLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonSubject.trim()) return;

    const newLesson: LessonItem = {
      id: 'les_' + Date.now(),
      studentId: lessonStudentId,
      subject: lessonSubject,
      title: lessonTitle || lessonSubject,
      dayOfWeek: lessonDay,
      time: lessonTime,
      tutorName: lessonTutor,
      monthlyFee: parseFloat(lessonFee) || 0,
      isPaid: false,
    };

    const updated = [newLesson, ...lessons];
    onUpdateLessons(updated);
    EducationRepository.saveLessons(updated);
    setShowAddLessonModal(false);
    setLessonSubject('');
  };

  // Save Edu Expense
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expAmount) || 0;
    if (!expTitle.trim() || amount <= 0) return;

    const newExp: EducationExpense = {
      id: 'eduexp_' + Date.now(),
      studentId: expStudentId,
      title: expTitle,
      amount,
      category: expCategory,
      date: new Date().toISOString().split('T')[0],
    };

    const updated = [newExp, ...educationExpenses];
    onUpdateEduExpenses(updated);
    EducationRepository.saveEducationExpenses(updated);
    setShowAddExpenseModal(false);
    setExpTitle('');
  };

  return (
    <div className="space-y-6" id="education-module">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
              <GraduationCap className="w-5 h-5" />
            </span>
            {t.education}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar'
              ? 'متابعة الأبناء، جداول ومواعيد الدروس الخصوصية، ورسوم التعليم والكتب'
              : 'Track students, lesson schedules, tutors & educational expenses'}
          </p>
        </div>

        {/* Student Selector Pills & Add Student */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedStudentId('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
              selectedStudentId === 'all'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {language === 'ar' ? 'الكل' : 'All'}
          </button>
          {students.map((stud) => (
            <button
              key={stud.id}
              onClick={() => setSelectedStudentId(stud.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedStudentId === stud.id
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <img src={stud.avatar} alt={stud.name} className="w-4 h-4 rounded-full object-cover" />
              <span>{stud.name}</span>
            </button>
          ))}
          <button
            onClick={() => setShowAddStudentModal(true)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-dashed border-emerald-400 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'إضافة طالب' : 'Add Student'}</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500">{language === 'ar' ? 'إجمالي رسوم الدروس الشهرية' : 'Monthly Lesson Fees'}</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono-num mt-1">
            {totalMonthlyLessonsFee.toLocaleString()} <span className="text-xs font-normal">{currency}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {filteredLessons.length} {language === 'ar' ? 'حصص مسجلة' : 'lessons on schedule'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500">{language === 'ar' ? 'المصاريف والكتب الإضافية' : 'Books & Extra Expenses'}</div>
          <div className="text-2xl font-black text-accent-600 dark:text-accent-400 font-mono-num mt-1">
            {totalEduExpenses.toLocaleString()} <span className="text-xs font-normal">{currency}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {filteredExpenses.length} {language === 'ar' ? 'بنود مصاريف' : 'expense entries'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500">{language === 'ar' ? 'حالة سداد الدروس' : 'Payment Status'}</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono-num mt-1">
            {filteredLessons.filter((l) => l.isPaid).length} / {filteredLessons.length}{' '}
            <span className="text-xs font-normal">{language === 'ar' ? 'مسدد' : 'paid'}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {filteredLessons.filter((l) => !l.isPaid).length > 0 ? (
              <span className="text-rose-500 font-semibold">
                ⚠️ يوجد {filteredLessons.filter((l) => !l.isPaid).length} دروس مستحقة
              </span>
            ) : (
              <span className="text-emerald-500 font-semibold">✓ جميع الدروس مسددة</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Lessons Schedule Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-500" />
            <span>{language === 'ar' ? 'جدول ومواعيد الدروس والحصص' : 'Lesson Schedule'}</span>
          </h3>

          <button
            onClick={() => setShowAddLessonModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'إضافة درس' : 'Add Lesson'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLessons.map((lesson) => {
            const student = students.find((s) => s.id === lesson.studentId);
            return (
              <div
                key={lesson.id}
                className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-bold text-base text-slate-900 dark:text-white">{lesson.subject}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{lesson.title}</p>
                    </div>
                    {student && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300">
                        {student.name}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{lesson.dayOfWeek}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono-num">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{lesson.time}</span>
                    </div>
                    {lesson.tutorName && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{lesson.tutorName}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="font-mono-num font-black text-sm text-slate-900 dark:text-white">
                    {lesson.monthlyFee.toLocaleString()} {currency} / شهر
                  </div>

                  <button
                    onClick={() => handleTogglePaid(lesson.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      lesson.isPaid
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 hover:scale-105'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{lesson.isPaid ? 'تم السداد' : 'غير مسدد'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-500" />
              <span>{language === 'ar' ? 'إضافة طالب جديد' : 'Add Student'}</span>
            </h3>
            <form onSubmit={handleSaveStudent} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'اسم الطالب' : 'Name'} *</label>
                <input
                  type="text"
                  required
                  value={studName}
                  onChange={(e) => setStudName(e.target.value)}
                  placeholder="مثال: يوسف، مريم..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'المرحلة الدراسية' : 'Grade'}</label>
                <input
                  type="text"
                  value={studGrade}
                  onChange={(e) => setStudGrade(e.target.value)}
                  placeholder="مثال: الصف الثاني الثانوي"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'المدرسة / الجامعة' : 'School'}</label>
                <input
                  type="text"
                  value={studSchool}
                  onChange={(e) => setStudSchool(e.target.value)}
                  placeholder="اسم المدرسة..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 rounded-xl border"
                >
                  {t.cancel}
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-500 text-white font-bold">
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Lesson Modal */}
      {showAddLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-500" />
              <span>{language === 'ar' ? 'إضافة موعد درس جديد' : 'Add Lesson'}</span>
            </h3>
            <form onSubmit={handleSaveLesson} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'الطالب' : 'Student'}</label>
                <select
                  value={lessonStudentId}
                  onChange={(e) => setLessonStudentId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.grade})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'المادة' : 'Subject'} *</label>
                  <input
                    type="text"
                    required
                    value={lessonSubject}
                    onChange={(e) => setLessonSubject(e.target.value)}
                    placeholder="مثال: رياضيات، فيزياء..."
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'اسم المدرس' : 'Tutor'}</label>
                  <input
                    type="text"
                    value={lessonTutor}
                    onChange={(e) => setLessonTutor(e.target.value)}
                    placeholder="أ. فلان"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'الأيام' : 'Days'}</label>
                  <input
                    type="text"
                    value={lessonDay}
                    onChange={(e) => setLessonDay(e.target.value)}
                    placeholder="السبت والثلاثاء"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'التوقيت' : 'Time'}</label>
                  <input
                    type="text"
                    value={lessonTime}
                    onChange={(e) => setLessonTime(e.target.value)}
                    placeholder="05:00 م"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'الرسوم الشهرية' : 'Monthly Fee'} ({currency})</label>
                <input
                  type="number"
                  value={lessonFee}
                  onChange={(e) => setLessonFee(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-num font-bold"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddLessonModal(false)}
                  className="px-4 py-2 rounded-xl border"
                >
                  {t.cancel}
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-500 text-white font-bold">
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
