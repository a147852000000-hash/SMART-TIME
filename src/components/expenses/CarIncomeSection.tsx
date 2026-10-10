import React, { useState, useMemo, useEffect } from 'react';
import {
  Car,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Clock,
  FileSpreadsheet,
  FileText,
  Printer,
  Copy,
  Check,
  BarChart3,
  CheckCircle2,
  X,
  Search,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { Language, CarTripIncomeRecord } from '../../types';
import { StorageAdapter } from '../../services';
import { formatMoney } from '../../services/financeCalculations';

interface CarIncomeSectionProps {
  language: Language;
  currency: string;
  selectedMonth: string; // YYYY-MM
  onSyncWithMonthlyIncome?: (trips: CarTripIncomeRecord[]) => void;
}

const STORAGE_KEY = 'smart_time_car_income_trips';

const TRIP_TYPES = [
  { id: 'cash', label: 'كاش 💵' },
  { id: 'uber', label: 'أوبر Uber' },
  { id: 'didi', label: 'ديدي DiDi' },
  { id: 'indrive', label: 'إندرايف inDrive' },
  { id: 'private', label: 'مشوار خاص 🚘' },
  { id: 'delivery', label: 'توصيل وطلبات 📦' },
  { id: 'other', label: 'أخرى 🏷️' },
];

export const CarIncomeSection: React.FC<CarIncomeSectionProps> = ({
  language,
  currency,
  selectedMonth,
  onSyncWithMonthlyIncome,
}) => {
  const isAr = language === 'ar';

  // Helper to format 24h time to 12h Arabic string
  const formatTime12H = (time24: string) => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr || '0', 10);
    const m = mStr || '00';
    if (isNaN(h)) return time24;
    const period = h >= 12 ? (isAr ? 'م' : 'PM') : (isAr ? 'ص' : 'AM');
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${period}`;
  };

  // Helper to get Arabic day name
  const getDayName = (dateStr: string) => {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return days[d.getDay()];
      }
    } catch {}
    return '';
  };

  // State: List of all car trips
  const [trips, setTrips] = useState<CarTripIncomeRecord[]>(() => {
    return StorageAdapter.getItem<CarTripIncomeRecord[]>(STORAGE_KEY, [
      {
        id: 'trip_1',
        tripNumber: 'رحلة 1',
        amount: 85,
        date: `${selectedMonth}-01`,
        dayName: 'الأحد',
        time: '09:30',
        tripType: 'أوبر Uber',
        notes: 'مشوار من مدينة نصر إلى التجمع الخامس',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'trip_2',
        tripNumber: 'رحلة 2',
        amount: 120,
        date: `${selectedMonth}-01`,
        dayName: 'الأحد',
        time: '12:15',
        tripType: 'إندرايف inDrive',
        notes: 'مشوار من المعادي إلى مصر الجديدة',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'trip_3',
        tripNumber: 'رحلة 3',
        amount: 150,
        date: `${selectedMonth}-02`,
        dayName: 'الإثنين',
        time: '16:45',
        tripType: 'مشوار خاص 🚘',
        notes: 'توصيل مطار القاهرة الدولي',
        createdAt: new Date().toISOString(),
      },
    ]);
  });

  // Active view: 'entry' (تسجيل الرحلات) | 'report' (تقرير ومعاينة الدخل)
  const [activeSubTab, setActiveSubTab] = useState<'entry' | 'report'>('entry');

  // Form states
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [tripNumber, setTripNumber] = useState<string>('');
  const [tripAmount, setTripAmount] = useState<string>('');
  const [tripNotes, setTripNotes] = useState<string>('');
  const [tripType, setTripType] = useState<string>('كاش 💵');

  // Date and Time states
  const getCurrentDateStr = () => new Date().toISOString().split('T')[0];
  const getCurrentTimeStr = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const [tripDate, setTripDate] = useState<string>(getCurrentDateStr);
  const [tripTime, setTripTime] = useState<string>(getCurrentTimeStr);

  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Report filter states
  const [reportFilterPeriod, setReportFilterPeriod] = useState<'all' | 'month' | 'week' | 'today'>('month');
  const [reportFilterType, setReportFilterType] = useState<string>('all');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');

  // Persist trips to storage whenever changed
  useEffect(() => {
    StorageAdapter.setItem(STORAGE_KEY, trips);
    if (onSyncWithMonthlyIncome) {
      onSyncWithMonthlyIncome(trips);
    }
  }, [trips, onSyncWithMonthlyIncome]);

  // Next recommended trip number
  const nextTripNumberName = useMemo(() => {
    const targetDate = tripDate || getCurrentDateStr();
    const sameDateTrips = trips.filter((t) => t.date === targetDate);
    return `رحلة ${sameDateTrips.length + 1}`;
  }, [trips, tripDate]);

  // Set initial default trip number if empty
  useEffect(() => {
    if (!editingTripId && !tripNumber) {
      setTripNumber(nextTripNumberName);
    }
  }, [nextTripNumberName, editingTripId, tripNumber]);

  // Reset date & time to right now
  const setToCurrentDateTime = () => {
    const d = getCurrentDateStr();
    const t = getCurrentTimeStr();
    setTripDate(d);
    setTripTime(t);
  };

  // Handle Save / Update Trip
  const handleSaveTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(tripAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      window.alert(isAr ? 'من فضلك أدخل سعر الرحلة بشكل صحيح.' : 'Please enter a valid trip fare.');
      return;
    }

    const assignedDate = tripDate || getCurrentDateStr();
    const assignedDay = getDayName(assignedDate);
    const assignedTime = tripTime || getCurrentTimeStr();
    const assignedNumber = tripNumber.trim() || nextTripNumberName;

    const newRecord: CarTripIncomeRecord = {
      id: editingTripId || `trip_${Date.now()}`,
      tripNumber: assignedNumber,
      amount: amountVal,
      date: assignedDate,
      dayName: assignedDay,
      time: assignedTime,
      tripType: tripType,
      notes: tripNotes.trim() || undefined,
      createdAt: editingTripId
        ? trips.find((t) => t.id === editingTripId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
    };

    if (editingTripId) {
      setTrips((prev) => prev.map((t) => (t.id === editingTripId ? newRecord : t)));
      setSaveToast(isAr ? 'تم تحديث بيانات الرحلة بنجاح! ✨' : 'Trip updated successfully!');
      setEditingTripId(null);
    } else {
      setTrips((prev) => [newRecord, ...prev]);
      setSaveToast(
        isAr
          ? `تم حفظ ${assignedNumber} بمبلغ ${formatMoney(amountVal)} ${currency} بنجاح! 🚗`
          : 'Trip saved successfully!'
      );
    }

    // Reset form for next trip
    setTripAmount('');
    setTripNotes('');
    const nextCount = trips.filter((t) => t.date === assignedDate).length + (editingTripId ? 0 : 2);
    setTripNumber(`رحلة ${nextCount}`);

    // Update time to now for subsequent entries
    setTripTime(getCurrentTimeStr());

    // Auto hide toast after 3.5s
    setTimeout(() => {
      setSaveToast(null);
    }, 3500);
  };

  // Edit Trip
  const startEdit = (trip: CarTripIncomeRecord) => {
    setEditingTripId(trip.id);
    setTripNumber(String(trip.tripNumber));
    setTripAmount(String(trip.amount));
    setTripNotes(trip.notes || '');
    setTripType(trip.tripType || 'كاش 💵');
    setTripDate(trip.date || getCurrentDateStr());
    setTripTime(trip.time || getCurrentTimeStr());
    setActiveSubTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete Trip
  const handleDeleteTrip = (id: string) => {
    if (window.confirm(isAr ? 'هل أنت متأكد من حذف هذه الرحلة؟' : 'Are you sure you want to delete this trip?')) {
      setTrips((prev) => prev.filter((t) => t.id !== id));
      if (editingTripId === id) {
        cancelEdit();
      }
    }
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingTripId(null);
    setTripAmount('');
    setTripNotes('');
    setTripNumber(nextTripNumberName);
    setTripDate(getCurrentDateStr());
    setTripTime(getCurrentTimeStr());
  };

  // Filtered trips for reporting
  const filteredReportTrips = useMemo(() => {
    const todayStr = getCurrentDateStr();

    // 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    return trips.filter((trip) => {
      // Period filter
      if (reportFilterPeriod === 'month') {
        if (!trip.date.startsWith(selectedMonth)) return false;
      } else if (reportFilterPeriod === 'today') {
        if (trip.date !== todayStr) return false;
      } else if (reportFilterPeriod === 'week') {
        if (trip.date < sevenDaysAgoStr || trip.date > todayStr) return false;
      }

      // Type filter
      if (reportFilterType !== 'all') {
        if (trip.tripType && !trip.tripType.includes(reportFilterType) && reportFilterType !== trip.tripType) {
          return false;
        }
      }

      // Search query filter
      if (reportSearchQuery.trim()) {
        const q = reportSearchQuery.trim().toLowerCase();
        const str = `${trip.tripNumber} ${trip.notes || ''} ${trip.tripType || ''} ${trip.dayName || ''} ${trip.date}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }, [trips, reportFilterPeriod, reportFilterType, reportSearchQuery, selectedMonth]);

  // Statistics
  const stats = useMemo(() => {
    const totalIncome = filteredReportTrips.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const count = filteredReportTrips.length;
    const avgFare = count > 0 ? totalIncome / count : 0;
    const maxFare = count > 0 ? Math.max(...filteredReportTrips.map((t) => Number(t.amount) || 0)) : 0;
    const minFare = count > 0 ? Math.min(...filteredReportTrips.map((t) => Number(t.amount) || 0)) : 0;

    // Today stats
    const todayStr = getCurrentDateStr();
    const todayTripsList = trips.filter((t) => t.date === todayStr);
    const todayTotal = todayTripsList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // Current month total
    const monthTrips = trips.filter((t) => t.date.startsWith(selectedMonth));
    const monthTotal = monthTrips.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
      totalIncome,
      count,
      avgFare,
      maxFare,
      minFare,
      todayCount: todayTripsList.length,
      todayTotal,
      monthCount: monthTrips.length,
      monthTotal,
    };
  }, [filteredReportTrips, trips, selectedMonth]);

  // --- EXPORT TO EXCEL (CSV with UTF-8 BOM) ---
  const handleExportExcel = () => {
    const headers = ['م', 'رقم الرحلة', 'اليوم', 'التاريخ', 'الوقت', 'سعر الرحلة', 'نوع الرحلة / التطبيق', 'ملاحظات'];
    const rows = filteredReportTrips.map((t, idx) => [
      idx + 1,
      t.tripNumber,
      t.dayName || getDayName(t.date),
      t.date,
      formatTime12H(t.time || '') || t.time || '-',
      t.amount,
      t.tripType || 'كاش',
      t.notes || '-',
    ]);

    rows.push([
      'الإجمالي الكلي',
      `${stats.count} رحلة`,
      '',
      '',
      '',
      stats.totalIncome,
      '',
      `متوسط سعر الرحلة: ${formatMoney(stats.avgFare)} ${currency}`,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير-دخل-السيارة-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- EXPORT TO WORD (.doc) ---
  const handleExportWord = () => {
    const periodLabel =
      reportFilterPeriod === 'month'
        ? `شهر ${selectedMonth}`
        : reportFilterPeriod === 'today'
        ? 'اليوم'
        : reportFilterPeriod === 'week'
        ? 'آخر 7 أيام'
        : 'كافة الفترات';

    const tableRowsHtml = filteredReportTrips
      .map(
        (t, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; text-align: center;">
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${t.tripNumber}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${t.dayName || getDayName(t.date)}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${t.date}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${formatTime12H(t.time || '') || t.time || '-'}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #059669;">${formatMoney(t.amount)} ${currency}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${t.tripType || 'كاش'}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${t.notes || '-'}</td>
        </tr>
      `
      )
      .join('');

    const wordHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>تقرير دخل السيارة</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right; margin: 20px; }
          h1 { color: #047857; text-align: center; margin-bottom: 5px; }
          .subtitle { text-align: center; color: #64748b; font-size: 14px; margin-bottom: 20px; }
          .summary-card { background: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; padding: 15px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background-color: #047857; color: white; padding: 10px; border: 1px solid #047857; font-size: 14px; }
          .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <h1>🚗 تقرير دخل مشاوير السيارة</h1>
        <div class="subtitle">الفترة: ${periodLabel} • تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}</div>
        
        <div class="summary-card">
          <table style="width: 100%; border: none;">
            <tr>
              <td style="text-align: center; border: none;"><strong>إجمالي الدخل:</strong> <span style="color: #059669; font-size: 18px;">${formatMoney(stats.totalIncome)} ${currency}</span></td>
              <td style="text-align: center; border: none;"><strong>عدد الرحلات:</strong> <span>${stats.count} رحلة</span></td>
              <td style="text-align: center; border: none;"><strong>متوسط الرحلة:</strong> <span>${formatMoney(stats.avgFare)} ${currency}</span></td>
            </tr>
          </table>
        </div>

        <table>
          <thead>
            <tr>
              <th>م</th>
              <th>رقم الرحلة</th>
              <th>اليوم</th>
              <th>التاريخ</th>
              <th>الوقت</th>
              <th>سعر الرحلة</th>
              <th>نوع الرحلة / التطبيق</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #047857;">
              <td colspan="5" style="padding: 10px; text-align: center; border: 1px solid #cbd5e1;">الإجمالي الكلي (${stats.count} رحلة)</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; color: #047857; font-size: 16px;">${formatMoney(stats.totalIncome)} ${currency}</td>
              <td colspan="2" style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">متوسط سعر الرحلة: ${formatMoney(stats.avgFare)} ${currency}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          تم إنشاء هذا التقرير تلقائياً عبر تطبيق Remix SMART TIME • وقتك من ذهب
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + wordHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير-دخل-السيارة-${selectedMonth}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- COPY TEXT SUMMARY ---
  const handleCopyTextReport = () => {
    let text = `🚗 *تقرير دخل مشاوير السيارة*\n`;
    text += `📅 الفترة: ${reportFilterPeriod === 'month' ? selectedMonth : reportFilterPeriod}\n`;
    text += `💰 *إجمالي الدخل:* ${formatMoney(stats.totalIncome)} ${currency}\n`;
    text += `🔢 *عدد الرحلات:* ${stats.count} رحلة\n`;
    text += `📊 *متوسط سعر الرحلة:* ${formatMoney(stats.avgFare)} ${currency}\n\n`;
    text += `📋 *تفاصيل الرحلات:*\n`;

    filteredReportTrips.forEach((t, i) => {
      text += `${i + 1}. *${t.tripNumber}* | ${t.dayName || ''} ${t.date} (${formatTime12H(t.time || '') || t.time || ''})\n`;
      text += `   💵 السعر: ${formatMoney(t.amount)} ${currency} [${t.tripType || 'كاش'}]\n`;
      if (t.notes) text += `   📝 ملاحظات: ${t.notes}\n`;
    });

    text += `\n✨ تم الاستخراج عبر تطبيق SMART TIME`;

    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Toast Notification */}
      {saveToast && (
        <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center justify-between text-xs font-black animate-bounce">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-200" />
            <span>{saveToast}</span>
          </div>
          <button onClick={() => setSaveToast(null)} className="p-1 hover:bg-emerald-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* UNIFIED SUB-TABS (Clean, Non-Duplicated) */}
      <div className="w-full bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-1.5">
        <button
          type="button"
          onClick={() => setActiveSubTab('entry')}
          className={`flex-1 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'entry'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>{isAr ? 'تسجيل وإدخال الرحلات' : 'Record Trips'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('report')}
          className={`flex-1 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'report'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{isAr ? '📊 تقرير الدخل والمعاينة' : '📊 Income Report & Preview'}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. ENTRY VIEW (تسجيل الرحلات اليومية) */}
      {/* ========================================================================= */}
      {activeSubTab === 'entry' && (
        <div className="space-y-4">
          {/* Quick Summary Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
              <span className="text-[11px] font-bold text-slate-400 block mb-1">
                {isAr ? 'دخل رحلات اليوم' : "Today's Income"}
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                +{formatMoney(stats.todayTotal)}{' '}
                <span className="text-xs font-semibold text-slate-500">{currency}</span>
              </div>
              <span className="text-[11px] text-slate-500 font-bold mt-0.5 block">{stats.todayCount} رحلة اليوم</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
              <span className="text-[11px] font-bold text-slate-400 block mb-1">
                {isAr ? `إجمالي شهر ${selectedMonth}` : 'Month Total'}
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                +{formatMoney(stats.monthTotal)}{' '}
                <span className="text-xs font-semibold text-slate-500">{currency}</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-bold mt-0.5 block">
                {stats.monthCount} رحلة بالشهر
              </span>
            </div>
          </div>

          {/* TRIP INPUT FORM */}
          <form
            onSubmit={handleSaveTrip}
            noValidate={false}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
                    {editingTripId
                      ? isAr
                        ? 'تعديل بيانات الرحلة'
                        : 'Edit Trip Details'
                      : isAr
                      ? 'تسجيل رحلة جديدة'
                      : 'Record New Trip'}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {isAr ? 'أدخل سعر الرحلة وبياناتها واحفظ مباشرة' : 'Enter trip fare and details'}
                  </p>
                </div>
              </div>
              {editingTripId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 text-xs font-bold hover:bg-rose-50 hover:text-rose-600"
                >
                  {isAr ? 'إلغاء التعديل' : 'Cancel'}
                </button>
              )}
            </div>

            {/* Price & Trip Number Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Field 1: Trip Price / Fare (FIXED: step="any" min="0") */}
              <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                    {isAr ? 'سعر الرحلة *' : 'Trip Price *'}
                  </label>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">{currency}</span>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  required
                  autoFocus={!editingTripId}
                  value={tripAmount}
                  onChange={(e) => setTripAmount(e.target.value)}
                  placeholder="320"
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 font-black text-2xl text-emerald-600 dark:text-emerald-400"
                />
              </div>

              {/* Field 2: Trip Number */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {isAr ? 'رقم الرحلة / الوصف' : 'Trip Number / Title'}
                  </label>
                  <span className="text-[10px] text-slate-400 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-md">
                    {isAr ? 'تلقائي / قابل للتعديل' : 'Auto / Editable'}
                  </span>
                </div>
                <input
                  type="text"
                  value={tripNumber}
                  onChange={(e) => setTripNumber(e.target.value)}
                  placeholder="مثال: رحلة 1، مشوار التجمع"
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-black text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Quick Price Increment Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">{isAr ? 'مبالغ سريعة:' : 'Quick:'}</span>
              {[25, 50, 75, 100, 150, 200, 250, 300, 320, 350].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setTripAmount(String(amt))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition active:scale-95 ${
                    tripAmount === String(amt)
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 hover:text-emerald-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {amt}
                </button>
              ))}
            </div>

            {/* Trip Type / Service Selection */}
            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
                {isAr ? 'نوع الرحلة / وسيلة الدفع' : 'Trip Type / App'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {TRIP_TYPES.map((type) => (
                  <button
                    type="button"
                    key={type.id}
                    onClick={() => setTripType(type.label)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-black border transition-all ${
                      tripType === type.label
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Field 3: Notes / Destination */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
                {isAr ? 'ملاحظات (الجهة، الوجهة، تفاصيل المشوار)' : 'Notes / Destination'}
              </label>
              <input
                type="text"
                value={tripNotes}
                onChange={(e) => setTripNotes(e.target.value)}
                placeholder={isAr ? 'مثال: من المعادي إلى مصر الجديدة، انتظار 15 دقيقة' : 'Trip notes...'}
                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-xs sm:text-sm"
              />
            </div>

            {/* DIRECT, CLEAR & FULLY EDITABLE DATE & TIME CARD */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                      {isAr ? 'تاريخ ووقت الرحلة' : 'Date & Time'}
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                      {getDayName(tripDate)} {tripDate} • {formatTime12H(tripTime)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={setToCurrentDateTime}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-black flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 transition active:scale-95"
                  title={isAr ? 'ضبط على الوقت والتاريخ الحالي' : 'Set to current time'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isAr ? 'الآن ⚡' : 'Now'}</span>
                </button>
              </div>

              {/* Editable inputs row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">
                    {isAr ? '📅 التاريخ (يوم / شهر / سنة)' : 'Date'}
                  </label>
                  <input
                    type="date"
                    value={tripDate}
                    onChange={(e) => setTripDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">
                    {isAr ? '⏰ وقت الرحلة (ساعة : دقيقة)' : 'Time'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={tripTime}
                      onChange={(e) => setTripTime(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SAVE BUTTON */}
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all active:scale-[.99]"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {editingTripId
                  ? isAr
                    ? 'حفظ تعديل بيانات الرحلة'
                    : 'Save Trip Update'
                  : isAr
                  ? 'حفظ الرحلة الآن'
                  : 'Save Trip'}
              </span>
            </button>
          </form>

          {/* RECENT TRIPS LIST */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm">
                  {isAr ? 'سجل المشاوير الأخيرة' : 'Recent Trips Log'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {trips.length} {isAr ? 'رحلة مسجلة بالنظام' : 'trips recorded'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveSubTab('report')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center gap-1"
              >
                <span>{isAr ? 'عرض الكشف والتصدير' : 'View Full Table'}</span>
              </button>
            </div>

            {trips.length === 0 ? (
              <div className="p-10 text-center text-slate-400 space-y-2">
                <Car className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs">
                  {isAr ? 'لا توجد رحلات مسجلة بعد. ابدأ بإدخال رحلتك الأولى بالأعلى.' : 'No trips yet.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {trips.slice(0, 10).map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 font-black text-xs shrink-0">
                        <Car className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-slate-900 dark:text-white">{t.tripNumber}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {t.tripType || 'كاش'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                          <span>{t.dayName || getDayName(t.date)}</span>
                          <span>•</span>
                          <span>{t.date}</span>
                          {t.time && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5 text-slate-500 font-medium">
                                <Clock className="w-3 h-3" />
                                {formatTime12H(t.time)}
                              </span>
                            </>
                          )}
                        </div>
                        {t.notes && (
                          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 truncate max-w-xs sm:max-w-md">
                            {t.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-left rtl:text-right">
                        <span className="font-black text-base text-emerald-600 dark:text-emerald-400 block">
                          +{formatMoney(t.amount)} {currency}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={isAr ? 'تعديل' : 'Edit'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTrip(t.id)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={isAr ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. REPORT VIEW (تقرير الدخل والمعاينة والتصدير) */}
      {/* ========================================================================= */}
      {activeSubTab === 'report' && (
        <div className="space-y-4">
          {/* Header & Export Actions Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {isAr ? 'تقرير دخل مشاوير السيارة' : 'Car Income Report'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {isAr
                      ? 'كشف تفصيلي وإحصائيات مع إمكانية التصدير والطباعة'
                      : 'Detailed report with export and print capabilities'}
                  </p>
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition active:scale-95"
                  title={isAr ? 'تصدير إكسيل Excel' : 'Export Excel'}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{isAr ? 'تصدير إكسيل' : 'Excel'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportWord}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition active:scale-95"
                  title={isAr ? 'تصدير وورد Word' : 'Export Word'}
                >
                  <FileText className="w-4 h-4" />
                  <span>{isAr ? 'تصدير وورد' : 'Word'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-xs font-black flex items-center gap-1.5 transition active:scale-95"
                  title={isAr ? 'طباعة ومعاينة PDF' : 'Print / PDF'}
                >
                  <Printer className="w-4 h-4" />
                  <span>{isAr ? 'طباعة / PDF' : 'Print'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyTextReport}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-xs font-black transition active:scale-95"
                  title={isAr ? 'نسخ ملخص نصي' : 'Copy Text'}
                >
                  {copiedSuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Filter and Period Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Period Filter */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  {isAr ? 'الفترة الزمنية للتقرير' : 'Period'}
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: 'month', label: `شهر ${selectedMonth.split('-')[1] || ''}` },
                    { id: 'today', label: 'اليوم' },
                    { id: 'week', label: 'أسبوع' },
                    { id: 'all', label: 'الكل' },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setReportFilterPeriod(p.id as any)}
                      className={`py-2 rounded-xl text-xs font-black transition ${
                        reportFilterPeriod === p.id
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Service Type Filter */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  {isAr ? 'نوع الرحلة / التطبيق' : 'Trip Type'}
                </label>
                <select
                  value={reportFilterType}
                  onChange={(e) => setReportFilterType(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  <option value="all">{isAr ? 'جميع أنواع الرحلات' : 'All Types'}</option>
                  <option value="كاش">{isAr ? 'كاش 💵' : 'Cash'}</option>
                  <option value="أوبر">{isAr ? 'أوبر Uber' : 'Uber'}</option>
                  <option value="ديدي">{isAr ? 'ديدي DiDi' : 'DiDi'}</option>
                  <option value="إندرايف">{isAr ? 'إندرايف inDrive' : 'inDrive'}</option>
                  <option value="خاص">{isAr ? 'مشوار خاص 🚘' : 'Private'}</option>
                </select>
              </div>

              {/* Search in Report */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  {isAr ? 'بحث سريع داخل الكشف' : 'Search'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={reportSearchQuery}
                    onChange={(e) => setReportSearchQuery(e.target.value)}
                    placeholder={isAr ? 'بحث بالرقم أو الملاحظات...' : 'Search...'}
                    className="w-full p-2 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                </div>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-3">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block mb-1">
                  {isAr ? 'إجمالي الدخل المحسوب' : 'Total Income'}
                </span>
                <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatMoney(stats.totalIncome)} {currency}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3">
                <span className="text-[11px] font-bold text-slate-500 block mb-1">
                  {isAr ? 'إجمالي عدد الرحلات' : 'Total Trips'}
                </span>
                <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                  {stats.count} رحلة
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3">
                <span className="text-[11px] font-bold text-slate-500 block mb-1">
                  {isAr ? 'متوسط سعر الرحلة' : 'Avg Fare'}
                </span>
                <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                  {formatMoney(stats.avgFare)} {currency}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3">
                <span className="text-[11px] font-bold text-slate-500 block mb-1">
                  {isAr ? 'أعلى رحلة سجّلتها' : 'Max Fare'}
                </span>
                <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatMoney(stats.maxFare)} {currency}
                </div>
              </div>
            </div>
          </div>

          {/* PREVIEW TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                {isAr ? 'جدول معاينة البيانات قبل التصدير' : 'Preview Table'}
              </span>
              <span className="text-xs text-slate-500 font-bold">
                {filteredReportTrips.length} {isAr ? 'سجل مطابق' : 'records matching'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">{isAr ? 'رقم الرحلة' : 'Trip'}</th>
                    <th className="p-3">{isAr ? 'اليوم والتاريخ' : 'Day & Date'}</th>
                    <th className="p-3">{isAr ? 'الوقت' : 'Time'}</th>
                    <th className="p-3">{isAr ? 'السعر' : 'Fare'}</th>
                    <th className="p-3">{isAr ? 'النوع / التطبيق' : 'Type'}</th>
                    <th className="p-3">{isAr ? 'ملاحظات' : 'Notes'}</th>
                    <th className="p-3 text-center">{isAr ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredReportTrips.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        {isAr ? 'لا توجد بيانات مطابقة لخيارات الفلترة.' : 'No matching records found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredReportTrips.map((t, idx) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-3 font-black text-slate-900 dark:text-slate-100">{t.tripNumber}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {t.dayName || getDayName(t.date)}
                          </span>{' '}
                          <span className="text-[11px] text-slate-400">{t.date}</span>
                        </td>
                        <td className="p-3 text-slate-500 font-medium whitespace-nowrap">
                          {formatTime12H(t.time || '') || t.time || '-'}
                        </td>
                        <td className="p-3 font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          +{formatMoney(t.amount)} {currency}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-[11px]">
                            {t.tripType || 'كاش'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">{t.notes || '-'}</td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(t)}
                              className="p-1 rounded-lg text-slate-400 hover:text-cyan-600"
                              title={isAr ? 'تعديل' : 'Edit'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTrip(t.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600"
                              title={isAr ? 'حذف' : 'Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredReportTrips.length > 0 && (
                  <tfoot>
                    <tr className="bg-emerald-50/80 dark:bg-emerald-950/40 font-black border-t-2 border-emerald-500 text-slate-900 dark:text-white">
                      <td colSpan={4} className="p-3 text-center">
                        {isAr ? `الإجمالي الكلي (${stats.count} رحلة)` : `Total (${stats.count} trips)`}
                      </td>
                      <td className="p-3 text-emerald-700 dark:text-emerald-300 text-sm whitespace-nowrap">
                        +{formatMoney(stats.totalIncome)} {currency}
                      </td>
                      <td colSpan={3} className="p-3 text-xs text-slate-500">
                        {isAr ? `متوسط: ${formatMoney(stats.avgFare)} ${currency}` : `Avg: ${formatMoney(stats.avgFare)}`}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
