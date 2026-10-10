import { BankCertificate, CertificateProfitFrequency, MonthlyIncome, Expense } from '../types';

export interface SpecializedExpenseItem {
  id: string;
  section: 'house' | 'work';
  type: string;
  customType?: string;
  amount: number;
  paymentType?: 'supply' | 'labor';
  date: string;
  notes?: string;
}

export interface VehicleFuelRecord {
  id: string;
  fuelType: string;
  price: number;
  odometer: number;
  dateTime: string;
}

export interface VehicleMaintenanceRecord {
  id: string;
  maintenanceType: string;
  description: string;
  supplyName: string;
  supplyPrice: number;
  laborDescription: string;
  laborPrice: number;
  total: number;
  date: string;
}

export interface StudentExpenseRecord {
  id: string;
  studentId: string;
  subCategory: 'lessons' | 'personal' | 'transport' | 'school' | 'books';
  title: string;
  amount: number;
  date: string;
  notes?: string;
}

/**
 * Returns current month string in format YYYY-MM
 */
export const getCurrentMonthKey = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Formats numbers into localized currency display
 */
export const formatMoney = (amount: number | string | undefined): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount || 0;
  return num.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
};

/**
 * Parses duration string to extract number of years
 */
export const extractDurationYears = (duration: string | undefined): number => {
  if (!duration) return 1;
  const match = duration.match(/(\d+(\.\d+)?)/);
  if (match) {
    const val = parseFloat(match[1]);
    if (duration.includes('شهر') || duration.includes('month')) {
      return val / 12;
    }
    return val || 1;
  }
  return 1;
};

/**
 * Automatically calculates certificate profits based on amount, annual rate, and frequency
 */
export const calculateCertificateProfits = (
  amount: number,
  annualRate: number,
  frequency: CertificateProfitFrequency,
  durationStr?: string
): {
  annualProfit: number;
  periodicProfit: number;
  monthlyEquivalent: number;
} => {
  if (!amount || amount <= 0 || !annualRate || annualRate <= 0) {
    return { annualProfit: 0, periodicProfit: 0, monthlyEquivalent: 0 };
  }

  const annualProfit = amount * (annualRate / 100);
  const years = extractDurationYears(durationStr);
  let periodicProfit = 0;
  let monthlyEquivalent = annualProfit / 12;

  switch (frequency) {
    case 'monthly':
      periodicProfit = annualProfit / 12;
      monthlyEquivalent = periodicProfit;
      break;
    case 'quarterly':
      periodicProfit = annualProfit / 4;
      monthlyEquivalent = annualProfit / 12;
      break;
    case 'semiannual':
      periodicProfit = annualProfit / 2;
      monthlyEquivalent = annualProfit / 12;
      break;
    case 'annual':
      periodicProfit = annualProfit;
      monthlyEquivalent = annualProfit / 12;
      break;
    case 'maturity':
      periodicProfit = annualProfit * years;
      monthlyEquivalent = (annualProfit * years) / Math.max(1, years * 12);
      break;
    default:
      periodicProfit = annualProfit / 12;
      monthlyEquivalent = periodicProfit;
  }

  return {
    annualProfit: Math.round(annualProfit * 100) / 100,
    periodicProfit: Math.round(periodicProfit * 100) / 100,
    monthlyEquivalent: Math.round(monthlyEquivalent * 100) / 100,
  };
};

/**
 * Calculate total monthly profit from active bank certificates for a given month
 */
export const getCertificatesProfitForMonth = (
  certificates: BankCertificate[],
  targetMonth: string
): number => {
  return certificates.reduce((sum, cert) => {
    // If cert has explicit profitAmount and monthlyEquivalent
    let monthlyProfit = 0;
    if (cert.monthlyEquivalentProfit && cert.monthlyEquivalentProfit > 0) {
      monthlyProfit = cert.monthlyEquivalentProfit;
    } else if (cert.annualRate && cert.annualRate > 0 && cert.amount > 0) {
      const calc = calculateCertificateProfits(cert.amount, cert.annualRate, cert.profitFrequency, cert.duration);
      monthlyProfit = calc.monthlyEquivalent;
    } else if (cert.profitAmount && cert.profitAmount > 0) {
      if (cert.profitFrequency === 'monthly') {
        monthlyProfit = cert.profitAmount;
      } else if (cert.profitFrequency === 'quarterly') {
        monthlyProfit = cert.profitAmount / 3;
      } else if (cert.profitFrequency === 'semiannual') {
        monthlyProfit = cert.profitAmount / 6;
      } else if (cert.profitFrequency === 'annual') {
        monthlyProfit = cert.profitAmount / 12;
      } else {
        monthlyProfit = cert.profitAmount / 12;
      }
    }

    if (monthlyProfit <= 0) return sum;

    // Check if certificate is active in targetMonth
    const issueMonth = (cert.issueDate || '').slice(0, 7);
    const maturityMonth = (cert.maturityDate || '').slice(0, 7);

    if (issueMonth && maturityMonth) {
      if (issueMonth <= targetMonth && targetMonth <= maturityMonth) {
        return sum + monthlyProfit;
      }
      return sum;
    }

    // Default to including if dates are not strictly formatted
    return sum + monthlyProfit;
  }, 0);
};

/**
 * Calculate total primary income for a given month from salary/sources
 */
export const getPrimaryIncomeForMonth = (
  incomes: MonthlyIncome[],
  targetMonth: string
): { total: number; salary: number; bonuses: number; other: number; sourcesCount: number } => {
  const currentIncomeDoc = incomes.find((i) => i.month === targetMonth);

  if (!currentIncomeDoc) {
    return { total: 0, salary: 0, bonuses: 0, other: 0, sourcesCount: 0 };
  }

  if (currentIncomeDoc.sources && currentIncomeDoc.sources.length > 0) {
    // Current-account deposits/withdrawals are tracked separately from earned income.
    // They are added to the master monthly balance in ExpensesView as a signed net value.
    const earnedSources = currentIncomeDoc.sources.filter(
      (src) => src.type !== 'current_deposit' && src.type !== 'current_withdrawal'
    );
    const total = earnedSources.reduce((s, src) => s + (Number(src.amount) || 0), 0);
    const salary = earnedSources
      .filter((s) => s.type === 'salary' || s.source.includes('راتب'))
      .reduce((s, src) => s + (Number(src.amount) || 0), 0);
    const other = total - salary;
    return {
      total,
      salary: salary || currentIncomeDoc.salary || 0,
      bonuses: currentIncomeDoc.bonuses || 0,
      other: other || currentIncomeDoc.otherIncome || 0,
      sourcesCount: currentIncomeDoc.sources.length,
    };
  }

  const salary = currentIncomeDoc.salary || 0;
  const bonuses = currentIncomeDoc.bonuses || 0;
  const other = currentIncomeDoc.otherIncome || 0;
  const total = salary + bonuses + other;

  return {
    total,
    salary,
    bonuses,
    other,
    sourcesCount: (salary > 0 ? 1 : 0) + (bonuses > 0 ? 1 : 0) + (other > 0 ? 1 : 0),
  };
};

/**
 * Checks if a date string falls inside the target YYYY-MM
 */
export const isDateInMonth = (dateStr: string | undefined, targetMonth: string): boolean => {
  if (!dateStr) return false;
  return dateStr.slice(0, 7) === targetMonth;
};
