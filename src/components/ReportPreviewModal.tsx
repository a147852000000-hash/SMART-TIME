import React, { useState, useEffect } from 'react';
import {
  FileText,
  X,
  Printer,
  Download,
  Calendar,
  Layers,
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  TrendingDown,
  DollarSign,
  Building,
  Car,
  Home,
  BookOpen,
} from 'lucide-react';
import { Language, VehicleAccidentRecord } from '../types';
import { VaultRepository } from '../services';

export interface ReportItem {
  id: string;
  date: string;
  section: string;
  subCategory: string;
  title: string;
  amount: number;
  notes?: string;
  studentName?: string;
}

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: string;
  language: Language;
  initialPeriod?: 'day' | 'week' | 'month' | 'all';
  initialSection?: 'all' | 'house' | 'work' | 'vehicle' | 'education' | 'students';
  initialStudentId?: string;
  houseList: any[];
  workList: any[];
  fuelList: any[];
  maintList: any[];
  accidentList: VehicleAccidentRecord[];
  studentExpensesList: any[];
  students: any[];
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  isOpen,
  onClose,
  currency,
  language,
  initialPeriod = 'month',
  initialSection = 'all',
  initialStudentId,
  houseList,
  workList,
  fuelList,
  maintList,
  accidentList,
  studentExpensesList,
  students,
}) => {
  const isAr = language === 'ar';

  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'all'>(initialPeriod);
  const [selectedSection, setSelectedSection] = useState<'all' | 'house' | 'work' | 'vehicle' | 'education' | 'students'>(initialSection);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || students[0]?.id || '');
  const [savedVaultNotification, setSavedVaultNotification] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialPeriod) setSelectedPeriod(initialPeriod);
      if (initialSection) setSelectedSection(initialSection);
      if (initialStudentId) {
        setSelectedStudentId(initialStudentId);
      } else if (students.length > 0 && !selectedStudentId) {
        setSelectedStudentId(students[0].id);
      }
    }
  }, [isOpen, initialPeriod, initialSection, initialStudentId, students]);

  if (!isOpen) return null;

  // Date Filtering Logic
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  
  // Start of week (last 7 days)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);
  const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

  // Start of month (1st day of current month)
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const isDateInPeriod = (dateStr: string) => {
    if (!dateStr) return true;
    const cleanDate = dateStr.slice(0, 10);
    if (selectedPeriod === 'day') {
      return cleanDate === todayStr;
    }
    if (selectedPeriod === 'week') {
      return cleanDate >= oneWeekAgoStr && cleanDate <= todayStr;
    }
    if (selectedPeriod === 'month') {
      return cleanDate >= firstDayOfMonth && cleanDate <= todayStr;
    }
    return true; // 'all'
  };

  // Compile Unified Report Items
  const allItems: ReportItem[] = [];

  // House
  if (selectedSection === 'all' || selectedSection === 'house') {
    houseList.forEach((h) => {
      if (isDateInPeriod(h.date)) {
        allItems.push({
          id: `h_${h.id}`,
          date: h.date,
          section: isAr ? 'المنزل' : 'House',
          subCategory: h.paymentType === 'labor' ? (isAr ? 'مصنعية' : 'Labor') : (isAr ? 'خامات ومشتريات' : 'Supplies'),
          title: h.type || (isAr ? 'مصروف منزلي' : 'House Expense'),
          amount: h.amount,
          notes: h.notes,
        });
      }
    });
  }

  // Work
  if (selectedSection === 'all' || selectedSection === 'work') {
    workList.forEach((w) => {
      if (isDateInPeriod(w.date)) {
        allItems.push({
          id: `w_${w.id}`,
          date: w.date,
          section: isAr ? 'العمل' : 'Work',
          subCategory: isAr ? 'مصروف عمل' : 'Work',
          title: w.type || (isAr ? 'مصروف عمل' : 'Work Expense'),
          amount: w.amount,
          notes: w.notes,
        });
      }
    });
  }

  // Vehicle (Fuel, Maintenance, Accidents)
  if (selectedSection === 'all' || selectedSection === 'vehicle') {
    fuelList.forEach((f) => {
      if (isDateInPeriod(f.dateTime)) {
        allItems.push({
          id: `f_${f.id}`,
          date: f.dateTime?.slice(0, 10) || todayStr,
          section: isAr ? 'المركبة' : 'Vehicle',
          subCategory: isAr ? 'وقود وتموين' : 'Fuel',
          title: `${f.fuelType} (عداد: ${f.odometer || '-'} كم)`,
          amount: f.price,
        });
      }
    });

    maintList.forEach((m) => {
      if (isDateInPeriod(m.date)) {
        allItems.push({
          id: `m_${m.id}`,
          date: m.date,
          section: isAr ? 'المركبة' : 'Vehicle',
          subCategory: isAr ? `صيانة (${m.maintenanceType})` : `Maintenance (${m.maintenanceType})`,
          title: m.description || m.supplyName || (isAr ? 'صيانة دورية' : 'Periodic Maintenance'),
          amount: m.total,
          notes: m.laborDescription,
        });
      }
    });

    accidentList.forEach((a) => {
      if (isDateInPeriod(a.date)) {
        allItems.push({
          id: `a_${a.id}`,
          date: a.date,
          section: isAr ? 'المركبة' : 'Vehicle',
          subCategory: isAr ? '🚨 حادث وتلفيات' : 'Accident Damage',
          title: a.title,
          amount: a.estimatedDamage || 0,
          notes: a.location ? `${isAr ? 'الموقع:' : 'Loc:'} ${a.location}` : a.notes,
        });
      }
    });
  }

  // Education (All students or single student)
  if (selectedSection === 'all' || selectedSection === 'education' || selectedSection === 'students') {
    studentExpensesList.forEach((se) => {
      if (isDateInPeriod(se.date)) {
        if (selectedSection === 'students' && se.studentId !== selectedStudentId) {
          return;
        }
        const std = students.find((s) => s.id === se.studentId);
        allItems.push({
          id: `se_${se.id}`,
          date: se.date,
          section: isAr ? 'التعليم' : 'Education',
          subCategory: getCategoryArabic(se.subCategory),
          title: se.title,
          amount: se.amount,
          studentName: std?.name || (isAr ? 'طالب' : 'Student'),
        });
      }
    });
  }

  // Sort descending by date
  allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalReportAmount = allItems.reduce((acc, curr) => acc + curr.amount, 0);

  function getCategoryArabic(sub: string): string {
    if (!isAr) return sub;
    switch (sub) {
      case 'lessons':
        return 'دروس خصوصية';
      case 'school':
        return 'مصاريف مدرسية';
      case 'books':
        return 'كتب ومذكرات';
      case 'transport':
        return 'مواصلات وباص';
      case 'personal':
        return 'مصروف شخصي';
      default:
        return sub;
    }
  }

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      isAr ? 'التاريخ' : 'Date',
      isAr ? 'القسم' : 'Section',
      isAr ? 'التصنيف الفرعي' : 'Subcategory',
      isAr ? 'البيان / الوصف' : 'Title',
      isAr ? 'الطالب' : 'Student',
      isAr ? 'المبلغ' : 'Amount',
      isAr ? 'ملاحظات' : 'Notes',
    ];

    const rows = allItems.map((item) => [
      `"${item.date}"`,
      `"${item.section}"`,
      `"${item.subCategory}"`,
      `"${item.title.replace(/"/g, '""')}"`,
      `"${item.studentName || '-'}"`,
      item.amount,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const fileName =
      selectedSection === 'students' && currentStudent
        ? `student_report_${currentStudent.name.replace(/\s+/g, '_')}_${selectedPeriod}_${todayStr}.csv`
        : `financial_report_${selectedPeriod}_${selectedSection}_${todayStr}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Window
  const handlePrint = () => {
    window.print();
  };

  // Save report summary to vault
  const handleSaveToVault = () => {
    const reportTitle =
      selectedSection === 'students' && currentStudent
        ? `${isAr ? 'تقرير مصروفات الطالب' : 'Student Expense Report'} - ${currentStudent.name} (${
            selectedPeriod === 'day'
              ? isAr ? 'يومي' : 'Daily'
              : selectedPeriod === 'week'
              ? isAr ? 'أسبوعي' : 'Weekly'
              : selectedPeriod === 'month'
              ? isAr ? 'شهري' : 'Monthly'
              : isAr ? 'شامل' : 'All Time'
          }) - ${totalReportAmount.toLocaleString()} ${currency}`
        : `${isAr ? 'تقرير مالي' : 'Financial Report'} - ${
            selectedPeriod === 'day'
              ? isAr ? 'يومي' : 'Daily'
              : selectedPeriod === 'week'
              ? isAr ? 'أسبوعي' : 'Weekly'
              : selectedPeriod === 'month'
              ? isAr ? 'شهري' : 'Monthly'
              : isAr ? 'شامل' : 'All'
          } (${totalReportAmount.toLocaleString()} ${currency})`;

    VaultRepository.addRecord({
      id: `vault_rep_${Date.now()}`,
      title: `📄 ${reportTitle}`,
      category: 'document',
      value: `${isAr ? 'إجمالي المبالغ:' : 'Total:'} ${totalReportAmount.toLocaleString()} ${currency} • ${isAr ? 'عدد البنود:' : 'Items:'} ${allItems.length}`,
      notes: `${isAr ? 'تاريخ الإصدار:' : 'Date:'} ${todayStr}\n${isAr ? 'القسم المختار:' : 'Section:'} ${
        selectedSection === 'students' && currentStudent ? `${isAr ? 'طالب:' : 'Student:'} ${currentStudent.name}` : selectedSection
      }`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setSavedVaultNotification(true);
    setTimeout(() => setSavedVaultNotification(false), 3000);
  };

  const currentStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-[#121212] border border-accent-500/50 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header with Controls */}
        <div className="p-4 border-b border-slate-800 bg-[#171717] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-500/15 border border-accent-500/40 flex items-center justify-center text-accent-500">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                <span>{isAr ? 'معاينة التقرير المالي قبل التصدير' : 'Report Preview & Export'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-500/20 text-accent-500 font-bold border border-accent-500/30">
                  {isAr ? 'معاينة رسمية' : 'Official Preview'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {isAr
                  ? 'عرض تفصيلي فوري يومي أو أسبوعي أو شهري لكافة الأقسام أو للطلاب'
                  : 'Daily, weekly, or monthly preview for all sections or individual students'}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={handleSaveToVault}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-accent-500 text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700"
              title={isAr ? 'حفظ نسخة بالخزنة الرقمية' : 'Save copy in vault'}
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">{isAr ? 'إيداع بالخزنة' : 'Vault'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700"
              title={isAr ? 'تصدير كملف CSV' : 'Export CSV'}
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">{isAr ? 'تصدير Excel' : 'Export'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-gradient-to-r from-accent-500 to-accent-700 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{isAr ? 'طباعة / PDF' : 'Print'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar (فترة التقرير + القسم / الطالب) */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          {/* Period Filter (يوم - اسبوع - شهر - الكل) */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-accent-500" />
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              {[
                { id: 'day', label: isAr ? 'يومي (اليوم)' : 'Day' },
                { id: 'week', label: isAr ? 'أسبوعي (7 أيام)' : 'Week' },
                { id: 'month', label: isAr ? 'شهري (الشهر)' : 'Month' },
                { id: 'all', label: isAr ? 'شامل (الكل)' : 'All Time' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriod(p.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    selectedPeriod === p.id
                      ? 'bg-accent-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section Filter */}
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value as any)}
              className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-bold"
            >
              <option value="all">{isAr ? '📁 كافة الأقسام المجمعة' : 'All Sections'}</option>
              <option value="house">{isAr ? '🏠 مصروفات المنزل' : 'House'}</option>
              <option value="work">{isAr ? '💼 مصروفات العمل' : 'Work'}</option>
              <option value="vehicle">{isAr ? '🚗 المركبة (وقود، صيانة، حوادث)' : 'Vehicle'}</option>
              <option value="education">{isAr ? '🎓 التعليم (كافة الطلاب)' : 'Education (All)'}</option>
              <option value="students">{isAr ? '👤 طالب محدد' : 'Individual Student'}</option>
            </select>

            {/* Individual Student Picker */}
            {selectedSection === 'students' && (
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="p-1.5 rounded-xl bg-slate-900 border border-accent-500/40 text-accent-300 text-xs font-bold"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.stage})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Vault notification toast */}
        {savedVaultNotification && (
          <div className="bg-emerald-600/90 text-white text-xs py-2 px-4 flex items-center justify-center gap-2 font-bold animate-fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{isAr ? 'تم إيداع نسخة من هذا التقرير بأمان داخل الخزنة الرقمية!' : 'Report deposited in secure vault!'}</span>
          </div>
        )}

        {/* Printable Report Document Body */}
        <div id="printable-report-area" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#141414]">
          {/* Document Header */}
          <div className="p-6 rounded-2xl bg-[#1c1c1c] border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">⭐</span>
                <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                  Remix SMART TIME — وقتك من ذهب
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isAr ? 'التقرير المالي الرسمي المعتمد والمفصل' : 'Official Detailed Financial Statement'}
              </p>
            </div>

            <div className="text-start sm:text-end text-xs space-y-1">
              <div className="text-slate-400">
                {isAr ? 'تاريخ التوليد:' : 'Generated:'} <span className="text-white font-mono">{todayStr}</span>
              </div>
              <div className="text-slate-400">
                {isAr ? 'الفترة:' : 'Period:'}{' '}
                <span className="text-accent-500 font-bold">
                  {selectedPeriod === 'day'
                    ? isAr
                      ? 'يومي (اليوم)'
                      : 'Daily'
                    : selectedPeriod === 'week'
                    ? isAr
                      ? 'أسبوعي (آخر 7 أيام)'
                      : 'Weekly'
                    : selectedPeriod === 'month'
                    ? isAr
                      ? 'شهري (الشهر الحالي)'
                      : 'Monthly'
                    : isAr
                    ? 'شامل كافة الفترات'
                    : 'All Time'}
                </span>
              </div>
              {selectedSection === 'students' && currentStudent && (
                <div className="text-accent-400 font-bold">
                  {isAr ? 'الطالب:' : 'Student:'} {currentStudent.name} ({currentStudent.stage})
                </div>
              )}
            </div>
          </div>

          {/* Student Specific Header Banner when viewing student */}
          {selectedSection === 'students' && currentStudent && (
            <div className="p-4 rounded-2xl bg-accent-500/10 border border-accent-500/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-accent-500/20 border border-accent-500/40 text-accent-500 flex items-center justify-center text-xl font-bold">
                  🎓
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base text-white">
                      {isAr ? 'بيان مصروفات الطالب:' : 'Student Statement:'} {currentStudent.name}
                    </h3>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-accent-500/20 text-accent-500 font-bold border border-accent-500/40">
                      {currentStudent.stage}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                    <span>{isAr ? 'السن:' : 'Age:'} <strong className="text-white">{currentStudent.age} {isAr ? 'سنة' : 'yrs'}</strong></span>
                    <span>•</span>
                    <span>{isAr ? 'الرقم القومي:' : 'National ID:'} <strong className="text-white font-mono">{currentStudent.nationalId || '-'}</strong></span>
                  </p>
                </div>
              </div>

              <div className="text-end bg-slate-900/90 px-4 py-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-accent-300 block font-bold">{isAr ? 'إجمالي مصروفات الطالب' : 'Student Total'}</span>
                <span className="text-lg font-black text-accent-500 font-mono-num">{totalReportAmount.toLocaleString()} {currency}</span>
              </div>
            </div>
          )}

          {/* Metric Summary Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">{isAr ? 'إجمالي المصروفات في الفترة' : 'Total Expenditures'}</div>
              <div className="text-xl sm:text-2xl font-black text-accent-500 font-mono-num">
                {totalReportAmount.toLocaleString()} <span className="text-xs">{currency}</span>
              </div>
            </div>

            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">{isAr ? 'عدد العمليات والبنود' : 'Total Items / Records'}</div>
              <div className="text-xl sm:text-2xl font-black text-cyan-400 font-mono-num">
                {allItems.length} <span className="text-xs text-slate-400">{isAr ? 'بند' : 'records'}</span>
              </div>
            </div>

            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">{isAr ? 'القسم المحدد' : 'Selected Scope'}</div>
              <div className="text-sm font-black text-white truncate">
                {selectedSection === 'all'
                  ? isAr
                    ? 'كافة الأقسام الرئيسية'
                    : 'All Sections'
                  : selectedSection === 'house'
                  ? isAr
                    ? 'المنزل'
                    : 'House'
                  : selectedSection === 'work'
                  ? isAr
                    ? 'العمل'
                    : 'Work'
                  : selectedSection === 'vehicle'
                  ? isAr
                    ? 'المركبة (وقود/صيانة/حوادث)'
                    : 'Vehicle'
                  : selectedSection === 'education'
                  ? isAr
                    ? 'التعليم العام'
                    : 'Education'
                  : currentStudent?.name || (isAr ? 'طالب' : 'Student')}
              </div>
            </div>
          </div>

          {/* Detailed Line Items Table */}
          <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/70">
            <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <h4 className="font-extrabold text-xs text-white flex items-center gap-2">
                <span>📋 {isAr ? 'جدول بنود المصروفات المفصلة' : 'Detailed Records'}</span>
              </h4>
              <span className="text-[11px] font-bold text-slate-400 font-mono-num">
                {allItems.length} {isAr ? 'سجل' : 'entries'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 text-slate-400 text-[11px] border-b border-slate-800 font-bold">
                    <th className="p-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="p-3 text-start">{isAr ? 'القسم' : 'Section'}</th>
                    <th className="p-3 text-start">{isAr ? 'التصنيف الفرعي' : 'Category'}</th>
                    <th className="p-3 text-start">{isAr ? 'البيان / الوصف' : 'Description'}</th>
                    {selectedSection !== 'house' && selectedSection !== 'work' && selectedSection !== 'vehicle' && (
                      <th className="p-3 text-start">{isAr ? 'الطالب' : 'Student'}</th>
                    )}
                    <th className="p-3 text-end">{isAr ? 'المبلغ' : 'Amount'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {allItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-500">
                        {isAr ? 'لا توجد مصروفات مسجلة ضمن هذه الفترة أو القسم المختار.' : 'No records found for this period.'}
                      </td>
                    </tr>
                  ) : (
                    allItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 text-slate-300 font-mono">{item.date}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold text-[10px]">
                            {item.section}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300 font-bold">{item.subCategory}</td>
                        <td className="p-3 text-white">
                          <div>{item.title}</div>
                          {item.notes && <div className="text-[10px] text-slate-400">{item.notes}</div>}
                        </td>
                        {selectedSection !== 'house' && selectedSection !== 'work' && selectedSection !== 'vehicle' && (
                          <td className="p-3 text-accent-300 font-bold">{item.studentName || '-'}</td>
                        )}
                        <td className="p-3 text-end font-black font-mono-num text-accent-500">
                          -{item.amount.toLocaleString()} {currency}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {allItems.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-950 font-black text-xs border-t-2 border-slate-800">
                      <td colSpan={selectedSection !== 'house' && selectedSection !== 'work' && selectedSection !== 'vehicle' ? 5 : 4} className="p-3 text-end text-white">
                        {isAr ? 'الإجمالي العام للتقرير:' : 'Grand Total:'}
                      </td>
                      <td className="p-3 text-end font-mono-num text-accent-500 text-sm">
                        {totalReportAmount.toLocaleString()} {currency}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Footer Official Seal & Notes */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 gap-2">
            <div>
              {isAr ? 'تم استخراج هذا التقرير تلقائياً بواسطة نظام Remix SMART TIME' : 'Generated automatically by Remix SMART TIME'}
            </div>
            <div className="flex items-center gap-1 text-accent-500">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isAr ? 'نظام مشفر ومحمي ومحفوظ سحابياً' : 'Encrypted & Secured'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
