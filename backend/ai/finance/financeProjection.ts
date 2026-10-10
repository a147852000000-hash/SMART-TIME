import { db } from "../../database.js";

export interface FinanceOverview {
  source: "smart-time-finance-sqlite";
  expenses: unknown[];
  monthlyIncome: unknown[];
  bankCertificates: unknown[];
  fuelRecords: unknown[];
  maintenanceRecords: unknown[];
  educationExpenses: unknown[];
  fetchedAt: string;
}

export function getFinanceOverview(userId: string): FinanceOverview {
  const expenses = db.prepare(`
    SELECT id, title, amount, currency, category, date,
           payment_method as paymentMethod, receipt_url as receiptUrl,
           notes, created_at as createdAt, updated_at as updatedAt
    FROM finance_expenses
    WHERE user_id = ?
    ORDER BY date DESC, created_at DESC
  `).all(userId);

  const monthlyIncome = db.prepare(`
    SELECT id, month, salary, bonuses,
           other_income as otherIncome,
           other_income_note as otherIncomeNote,
           sources_json as sourcesJson,
           created_at as createdAt, updated_at as updatedAt
    FROM finance_monthly_income
    WHERE user_id = ?
    ORDER BY month DESC
  `).all(userId).map((row: any) => ({
    ...row,
    sources: row.sourcesJson ? safeJsonArray(row.sourcesJson) : undefined,
    sourcesJson: undefined,
  }));

  const bankCertificates = db.prepare(`
    SELECT id, bank_name as bankName,
           certificate_number as certificateNumber,
           duration, amount, annual_rate as annualRate,
           annual_profit as annualProfit, periodic_profit as periodicProfit,
           monthly_equivalent_profit as monthlyEquivalentProfit,
           return_type as returnType, issue_date as issueDate,
           maturity_date as maturityDate, profit_date as profitDate,
           profit_amount as profitAmount, profit_frequency as profitFrequency,
           notes, created_at as createdAt, updated_at as updatedAt
    FROM finance_bank_certificates
    WHERE user_id = ?
    ORDER BY maturity_date ASC, created_at DESC
  `).all(userId);

  const fuelRecords = db.prepare(`
    SELECT id, vehicle_id as vehicleId, liters,
           price_per_liter as pricePerLiter, total_cost as totalCost,
           mileage, date, station_name as stationName,
           notes, created_at as createdAt, updated_at as updatedAt
    FROM finance_fuel_records
    WHERE user_id = ?
    ORDER BY date DESC, created_at DESC
  `).all(userId);

  const maintenanceRecords = db.prepare(`
    SELECT id, vehicle_id as vehicleId, system_type as systemType,
           title, cost, current_mileage as currentMileage,
           next_mileage_due as nextMileageDue, date,
           service_center as serviceCenter, notes,
           created_at as createdAt, updated_at as updatedAt
    FROM finance_maintenance_records
    WHERE user_id = ?
    ORDER BY date DESC, created_at DESC
  `).all(userId);

  const educationExpenses = db.prepare(`
    SELECT id, student_id as studentId, title, amount,
           category, date, notes, created_at as createdAt,
           updated_at as updatedAt
    FROM finance_education_expenses
    WHERE user_id = ?
    ORDER BY date DESC, created_at DESC
  `).all(userId);

  return {
    source: "smart-time-finance-sqlite",
    expenses,
    monthlyIncome,
    bankCertificates,
    fuelRecords,
    maintenanceRecords,
    educationExpenses,
    fetchedAt: new Date().toISOString(),
  };
}

function safeJsonArray(value: string): unknown[] | undefined {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
