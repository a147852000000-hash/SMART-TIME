import React, { useState, useEffect, useMemo } from 'react';
import { Language, VehicleAccidentRecord, StudentProfile, MonthlyIncome, BankCertificate } from '../types';
import { StorageAdapter, VehiclesRepository, ExpensesRepository, createCanonicalFinanceExpense, getAllExpenses } from '../services';
import type { CanonicalExpenseInput } from '../services/financeService';
import type { ExpenseType } from '../contracts/financeContract';
import { isDateInMonth, getCertificatesProfitForMonth, getPrimaryIncomeForMonth } from '../services/financeCalculations';
import { FinancialDashboard } from './expenses/FinancialDashboard';
import { SectionsMenuScreen } from './expenses/SectionsMenuScreen';
import { HouseExpensesSection, SpecializedExpense } from './expenses/HouseExpensesSection';
import { WorkExpensesSection } from './expenses/WorkExpensesSection';
import { PersonalExpensesSection, AssociationRecord } from './expenses/PersonalExpensesSection';
import { VehicleExpensesSection, VehicleFuelRecord, VehicleMaintenanceRecord, VehicleOilFilterRecord } from './expenses/VehicleExpensesSection';
import { EducationExpensesSection } from './expenses/EducationExpensesSection';
import { IncomeAndCertificatesSection } from './expenses/IncomeAndCertificatesSection';
import { FinancialReportsSection } from './expenses/FinancialReportsSection';
import { AddExpenseModal } from './expenses/AddExpenseModal';

interface ExpensesViewProps {
  language: Language;
  currency: string;
  userProfile?: import('../types').UserProfile;
  onBackToHome?: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  language,
  currency,
  userProfile,
  onBackToHome,
}) => {
  const isAr = language === 'ar';

  // --- 1. CURRENT SCREEN STATE ---
  // 'dashboard' | 'sections_menu' | 'house' | 'work' | 'vehicle' | 'education' | 'income_certs' | 'reports'
  const [currentScreen, setCurrentScreen] = useState<
    'dashboard' | 'sections_menu' | 'house' | 'work' | 'personal' | 'vehicle' | 'education' | 'income_certs' | 'reports'
  >('sections_menu');

  // Month selector (default: current year-month YYYY-MM)
  const currentYearMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);

  // Universal Add Expense Modal
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [allExpenses, setAllExpenses] = useState<Array<Record<string, unknown>>>([]);
  const [canonicalFinanceError, setCanonicalFinanceError] = useState<string | null>(null);
  const refreshCanonicalExpenses = async () => {
    try {
      setCanonicalFinanceError(null);
      setAllExpenses(await getAllExpenses());
    } catch (error) {
      setCanonicalFinanceError(error instanceof Error ? error.message : 'تعذر قراءة البيانات المالية الموحدة.');
    }
  };
  useEffect(() => { void refreshCanonicalExpenses(); }, []);


  // --- 2. DATA STATES (PERSISTED) ---

  // Canonical expense data is loaded from finance_expenses only.
  // Personal associations (جمعياتي) remain in their existing non-expense source.
  const [associationsList, setAssociationsList] = useState<AssociationRecord[]>(() => {
    return StorageAdapter.getItem<AssociationRecord[]>('smart_time_personal_associations', []);
  });

  // Vehicle accidents are non-expense records and remain in their existing source.
  const [accidentList, setAccidentList] = useState<VehicleAccidentRecord[]>(() => {
    return VehiclesRepository.getAccidentRecords();
  });

  // Education: Students & Records
  const [students, setStudents] = useState<StudentProfile[]>(() => {
    const defaultStudents: StudentProfile[] = [
      { id: 'std_salma', name: 'سلمى ممدوح سعد', nationalId: '31406150102468', age: '14', stage: 'إعدادي' },
      { id: 'std_1', name: 'يوسف محمد', nationalId: '31205120102034', age: '16', stage: 'ثانوي' },
      { id: 'std_2', name: 'فاطمة محمد', nationalId: '31808220105068', age: '11', stage: 'ابتدائي' },
    ];
    return StorageAdapter.getItem<StudentProfile[]>('smart_time_students', defaultStudents);
  });

  // Income Sources List
  const [incomeList, setIncomeList] = useState<MonthlyIncome[]>(() => {
    const existing = ExpensesRepository.getMonthlyIncome();
    if (existing && existing.length > 0) return existing;
    // Default initial income for current month
    const defaultIncome: MonthlyIncome = {
      id: `income_${currentYearMonth}`,
      month: currentYearMonth,
      salary: 25000,
      bonuses: 2000,
      otherIncome: 3000,
      sources: [
        { id: 'src_1', source: 'الراتب الأساسي', amount: 25000, date: `${currentYearMonth}-01`, type: 'salary', notes: 'الراتب الشهري الرئيسي', createdAt: new Date().toISOString() },
        { id: 'src_2', source: 'دخل عمل حر (Freelance)', amount: 5000, date: `${currentYearMonth}-05`, type: 'extra', notes: 'تطوير تطبيق ويب', createdAt: new Date().toISOString() },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    ExpensesRepository.saveMonthlyIncome([defaultIncome]);
    return [defaultIncome];
  });

  // Bank Certificates
  const [certificates, setCertificates] = useState<BankCertificate[]>(() => {
    const existing = ExpensesRepository.getBankCertificates();
    if (existing && existing.length > 0) return existing;
    // Default initial certificate as requested in prompt (240,000 at 18% = 43,200 annual, 3,600 monthly)
    const defaultCert: BankCertificate = {
      id: 'cert_sample_1',
      bankName: 'البنك الأهلي المصري',
      certificateNumber: 'CERT-884920',
      duration: '1 سنة',
      amount: 240000,
      annualRate: 18,
      annualProfit: 43200,
      periodicProfit: 3600,
      monthlyEquivalentProfit: 3600,
      returnType: 'simple',
      issueDate: `${currentYearMonth}-01`,
      maturityDate: `${new Date().getFullYear() + 1}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
      profitDate: `${currentYearMonth}-01`,
      profitAmount: 3600,
      profitFrequency: 'monthly',
      notes: 'شهادة العائد البلاتيني الشهري 18%',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    ExpensesRepository.saveBankCertificates([defaultCert]);
    return [defaultCert];
  });

  // --- 3. PERSISTENCE WRAPPERS ---
  const handleSaveAssociations = (list: AssociationRecord[]) => {
    setAssociationsList(list);
    StorageAdapter.setItem('smart_time_personal_associations', list);
  };

  const handleSaveAccidents = (list: VehicleAccidentRecord[]) => {
    setAccidentList(list);
    VehiclesRepository.saveAccidentRecords(list);
  };

  const handleSaveStudents = (list: StudentProfile[]) => {
    setStudents(list);
    StorageAdapter.setItem('smart_time_students', list);
  };

  const handleSaveIncome = (list: MonthlyIncome[]) => {
    setIncomeList(list);
    ExpensesRepository.saveMonthlyIncome(list);
  };

  const handleSaveCertificates = (list: BankCertificate[]) => {
    setCertificates(list);
    ExpensesRepository.saveBankCertificates(list);
  };

  // --- 4. CANONICAL FINANCIAL CALCULATIONS FOR SELECTED MONTH ---
  const currentMonthExpenses = useMemo(
    () => allExpenses.filter((expense) => isDateInMonth(String(expense.date ?? ''), selectedMonth)),
    [allExpenses, selectedMonth]
  );
  const expensesByType = (type: ExpenseType) =>
    currentMonthExpenses.filter((expense) => String(expense.type ?? '') === type);
  const currentMonthHouse = useMemo(() => expensesByType('house'), [currentMonthExpenses]);
  const currentMonthMedical = useMemo(() => expensesByType('medical'), [currentMonthExpenses]);
  const currentMonthWork = useMemo(() => expensesByType('work'), [currentMonthExpenses]);
  const currentMonthPersonal = useMemo(() => expensesByType('personal'), [currentMonthExpenses]);
  const currentMonthFuel = useMemo(() => expensesByType('vehicle_fuel'), [currentMonthExpenses]);
  const currentMonthMaint = useMemo(() => expensesByType('vehicle_maint'), [currentMonthExpenses]);
  const currentMonthOil = useMemo(() => expensesByType('vehicle_oil'), [currentMonthExpenses]);
  const currentMonthEducation = useMemo(() => expensesByType('student'), [currentMonthExpenses]);
  const sumCanonicalAmounts = (items: Array<Record<string, unknown>>) =>
    items.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const houseTotal = useMemo(() => sumCanonicalAmounts(currentMonthHouse), [currentMonthHouse]);
  const medicalTotal = useMemo(() => sumCanonicalAmounts(currentMonthMedical), [currentMonthMedical]);
  const homeAndMedicalTotal = houseTotal + medicalTotal;
  const workTotal = useMemo(() => sumCanonicalAmounts(currentMonthWork), [currentMonthWork]);
  const personalTotal = useMemo(() => sumCanonicalAmounts(currentMonthPersonal), [currentMonthPersonal]);
  const fuelTotal = useMemo(() => sumCanonicalAmounts(currentMonthFuel), [currentMonthFuel]);
  const maintTotal = useMemo(() => sumCanonicalAmounts(currentMonthMaint), [currentMonthMaint]);
  const oilTotal = useMemo(() => sumCanonicalAmounts(currentMonthOil), [currentMonthOil]);
  const educationTotal = useMemo(() => sumCanonicalAmounts(currentMonthEducation), [currentMonthEducation]);
  const currentMonthAccidents = useMemo(
    () => accidentList.filter((a) => isDateInMonth(a.date, selectedMonth)),
    [accidentList, selectedMonth]
  );
  const vehicleTotal = fuelTotal + maintTotal + oilTotal;
  const monthlyExpenses = useMemo(
    () => houseTotal + medicalTotal + workTotal + personalTotal + fuelTotal + maintTotal + oilTotal + educationTotal,
    [houseTotal, medicalTotal, workTotal, personalTotal, fuelTotal, maintTotal, oilTotal, educationTotal]
  );

  const associationFinancials = useMemo(() => {
    let installments = 0;
    let earned = 0;
    const [yy, mm] = selectedMonth.split('-').map(Number);
    const monthStart = new Date(yy, mm - 1, 1, 0, 0, 0);
    associationsList.forEach((a) => {
      const start = new Date(`${a.startDate}T00:00:00`);
      if (!Number.isNaN(start.getTime()) && start <= monthStart) {
        const monthIndex = (yy - start.getFullYear()) * 12 + (mm - 1 - start.getMonth());
        if (monthIndex >= 0 && monthIndex < Math.max(1, Math.floor(Number(a.memberCount) || 1))) {
          installments += Number(a.installment) || 0;
        }
      }
      if ((a.payoutDate || '').slice(0, 7) === selectedMonth) earned += Number(a.value) || 0;
    });
    return { installments, earned };
  }, [associationsList, selectedMonth]);

  // Primary Income from Salary & Extra streams
  const primaryIncome = useMemo(
    () => getPrimaryIncomeForMonth(incomeList, selectedMonth),
    [incomeList, selectedMonth]
  );

  // Profit from Bank Certificates synced to current month
  const certificatesProfit = useMemo(
    () => getCertificatesProfitForMonth(certificates, selectedMonth),
    [certificates, selectedMonth]
  );

  // Current account is part of the master financial balance. Deposits are positive and withdrawals negative.
  const currentAccountNet = useMemo(
    () => (incomeList.find((doc) => doc.month === selectedMonth)?.sources || [])
      .filter((src) => src.type === 'current_deposit' || src.type === 'current_withdrawal')
      .reduce((sum, src) => sum + (Number(src.amount) || 0), 0),
    [incomeList, selectedMonth]
  );

  // Master monthly income = earned income + certificate returns + current-account movement + association payouts.
  const monthlyIncome = primaryIncome.total + certificatesProfit + currentAccountNet + associationFinancials.earned;

  // Master net income is always derived from the same monthly income and all expense sections.
  const netIncome = monthlyIncome - monthlyExpenses;

  // Recent Transactions Stream: canonical finance_expenses only.
  const recentTransactions = useMemo(() => {
    const labels: Record<string, { section: 'house' | 'work' | 'personal' | 'vehicle' | 'education'; badgeAr: string; badgeEn: string }> = {
      house: { section: 'house', badgeAr: 'منزل', badgeEn: 'Home' },
      medical: { section: 'house', badgeAr: 'طبي', badgeEn: 'Medical' },
      work: { section: 'work', badgeAr: 'عمل', badgeEn: 'Work' },
      personal: { section: 'personal', badgeAr: 'شخصي', badgeEn: 'Personal' },
      vehicle_fuel: { section: 'vehicle', badgeAr: 'وقود', badgeEn: 'Fuel' },
      vehicle_maint: { section: 'vehicle', badgeAr: 'صيانة', badgeEn: 'Maint' },
      vehicle_oil: { section: 'vehicle', badgeAr: 'زيوت', badgeEn: 'Oil' },
      student: { section: 'education', badgeAr: 'تعليم', badgeEn: 'Edu' },
    };
    return [...allExpenses].map((expense) => {
      const type = String(expense.type ?? '');
      const label = labels[type];
      if (!label) return null;
      const date = String(expense.date ?? '').slice(0, 10);
      return {
        id: String(expense.id ?? `${type}-${date}-${String(expense.title ?? expense.category ?? 'expense')}`),
        section: label.section,
        title: String(expense.title ?? expense.category ?? type),
        amount: Number(expense.amount) || 0,
        date,
        badge: isAr ? label.badgeAr : label.badgeEn,
      };
    }).filter((item): item is NonNullable<typeof item> => Boolean(item?.date))
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  }, [allExpenses, isAr]);

  // Phase 6 canonical mutation path.
  const handleUniversalAddExpense = async (data: {
    section: 'house' | 'work' | 'personal' | 'vehicle' | 'education';
    category: string;
    amount: number;
    date: string;
    paymentMethod: string;
    notes?: string;
  }) => {
    const type: ExpenseType =
      data.section === 'house' ? 'house' :
      data.section === 'work' ? 'work' :
      data.section === 'personal' ? 'personal' :
      data.section === 'education' ? 'student' :
      (data.category.includes('وقود') || data.category.includes('بنزين') || data.category.includes('سولار'))
        ? 'vehicle_fuel' : 'vehicle_maint';

    const input: CanonicalExpenseInput = {
      type, title: data.category, amount: data.amount, category: data.category,
      date: data.date, paymentMethod: data.paymentMethod, notes: data.notes ?? null,
    };

    try {
      await createCanonicalFinanceExpense(input);
      await refreshCanonicalExpenses();
      setIsAddExpenseModalOpen(false);
    } catch (error) {
      setCanonicalFinanceError(error instanceof Error ? error.message : 'تعذر حفظ المصروف الموحد.');
    }
  };

  return (
    <div className="w-full pb-12" dir={isAr ? 'rtl' : 'ltr'}>
      {/* 1. SCREEN: FINANCIAL DASHBOARD (Default Main View) */}
      {currentScreen === 'dashboard' && (
        <FinancialDashboard
          language={language}
          currency={currency}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          monthlyIncome={monthlyIncome}
          monthlyExpenses={monthlyExpenses}
          netIncome={netIncome}
          onOpenSectionsMenu={() => setCurrentScreen('sections_menu')}
          onOpenAddExpense={() => setIsAddExpenseModalOpen(true)}
          onSelectSection={(sec) => setCurrentScreen(sec)}
          houseTotal={homeAndMedicalTotal}
          houseCount={currentMonthHouse.length + currentMonthMedical.length}
          workTotal={personalTotal}
          workCount={currentMonthPersonal.length}
          vehicleTotal={vehicleTotal}
          vehicleCount={currentMonthFuel.length + currentMonthMaint.length + currentMonthOil.length + currentMonthAccidents.length}
          educationTotal={educationTotal}
          educationCount={currentMonthEducation.length}
          certsCount={certificates.length}
          recentTransactions={recentTransactions}
        />
      )}

      {/* 2. SCREEN: SECTIONS MENU (Grid of 6 Cards) */}
      {currentScreen === 'sections_menu' && (
        <SectionsMenuScreen
          language={language}
          currency={currency}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          onBack={() => { if (onBackToHome) onBackToHome(); else setCurrentScreen('dashboard'); }}
          onSelectSection={(sec) => setCurrentScreen(sec)}
          houseTotal={homeAndMedicalTotal}
          houseCount={currentMonthHouse.length + currentMonthMedical.length}
          workTotal={personalTotal + associationFinancials.installments}
          workCount={currentMonthPersonal.length + associationsList.length}
          vehicleTotal={vehicleTotal}
          vehicleCount={currentMonthFuel.length + currentMonthMaint.length + currentMonthOil.length + currentMonthAccidents.length}
          educationTotal={educationTotal}
          educationCount={currentMonthEducation.length}
          monthlyIncome={monthlyIncome}
          certsCount={certificates.length}
          monthlyExpenses={monthlyExpenses}
          netIncome={netIncome}
          certificatesProfit={certificatesProfit}
          currentAccountNet={currentAccountNet}
          userProfile={userProfile}
        />
      )}

      {/* 3. FULL SCREEN: HOUSE EXPENSES */}
      {currentScreen === 'house' && (
        <HouseExpensesSection
          language={language}
          currency={currency}
          selectedMonth={selectedMonth}
          onBack={() => setCurrentScreen('sections_menu')}
        />
      )}

      {/* 4. FULL SCREEN: WORK EXPENSES */}
      {currentScreen === 'work' && (
        <WorkExpensesSection
          language={language}
          currency={currency}
          selectedMonth={selectedMonth}
          onBack={() => setCurrentScreen('sections_menu')}
        />
      )}

      {/* 5. FULL SCREEN: PERSONAL EXPENSES */}
      {currentScreen === 'personal' && (
        <PersonalExpensesSection
          language={language}
          currency={currency}
          selectedMonth={selectedMonth}
          onBack={() => setCurrentScreen('sections_menu')}
          associations={associationsList}
          onSaveAssociations={handleSaveAssociations}
        />
      )}

      {/* 6. FULL SCREEN: VEHICLE EXPENSES */}
      {currentScreen === 'vehicle' && (
        <VehicleExpensesSection
          language={language}
          currency={currency}
          selectedMonth={selectedMonth}
          onBack={() => setCurrentScreen('sections_menu')}
          accidentList={accidentList}
          onSaveAccidents={handleSaveAccidents}
        />
      )}

      {/* 6. FULL SCREEN: EDUCATION EXPENSES */}
      {currentScreen === 'education' && (
        <EducationExpensesSection
          language={language}
          currency={currency}
          selectedMonth={selectedMonth}
          onBack={() => setCurrentScreen('sections_menu')}
          students={students}
          onSaveStudents={handleSaveStudents}
        />
      )}

      {/* 7. FULL SCREEN: INCOME AND BANK CERTIFICATES */}
      {currentScreen === 'income_certs' && (
        <IncomeAndCertificatesSection
          language={language}
          currency={currency}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          onBack={() => setCurrentScreen('sections_menu')}
          incomeList={incomeList}
          onSaveIncome={handleSaveIncome}
          certificates={certificates}
          onSaveCertificates={handleSaveCertificates}
        />
      )}

      {/* 8. FULL SCREEN: REPORTS AND ANALYTICS */}
      {currentScreen === 'reports' && (
        <FinancialReportsSection
          language={language}
          currency={currency}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          onBack={() => setCurrentScreen('sections_menu')}
          monthlyIncome={monthlyIncome}
          monthlyExpenses={monthlyExpenses}
          netIncome={netIncome}
          houseTotal={homeAndMedicalTotal}
          workTotal={personalTotal}
          vehicleTotal={vehicleTotal}
          educationTotal={educationTotal}
          associationsList={associationsList}
          incomeList={incomeList}
        />
      )}

      {/* --- UNIVERSAL ADD EXPENSE MODAL --- */}
      <AddExpenseModal
        isOpen={isAddExpenseModalOpen}
        onClose={() => setIsAddExpenseModalOpen(false)}
        language={language}
        currency={currency}
        selectedMonth={selectedMonth}
        onAddExpense={handleUniversalAddExpense}
      />

    </div>
  );
};
