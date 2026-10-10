import { Expense, BudgetSummary, MonthlyIncome, BankCertificate } from '../../types';
import { STORAGE_KEYS } from '../storageKeys';
import { StorageAdapter } from '../storageAdapter';
import { DEFAULT_EXPENSES, DEFAULT_BUDGET } from '../seedData';

export class ExpensesRepository {
  static getExpenses(): Expense[] {
    return StorageAdapter.getItem<Expense[]>(STORAGE_KEYS.EXPENSES, DEFAULT_EXPENSES);
  }

  static saveExpenses(_expenses: Expense[]): never {
    throw new Error("Legacy expense writes are disabled; use FinanceRepository or the canonical Finance API.");
  }

  static addExpense(_expense: Expense): never {
    throw new Error("Legacy expense writes are disabled; use FinanceRepository or the canonical Finance API.");
  }

  static updateExpense(_expense: Expense): never {
    throw new Error("Legacy expense writes are disabled; use FinanceRepository or the canonical Finance API.");
  }

  static deleteExpense(_id: string): never {
    throw new Error("Legacy expense writes are disabled; use FinanceRepository or the canonical Finance API.");
  }

  static getBudget(): BudgetSummary {
    return StorageAdapter.getItem<BudgetSummary>(STORAGE_KEYS.BUDGET, DEFAULT_BUDGET);
  }

  static saveBudget(budget: BudgetSummary): void {
    StorageAdapter.setItem(STORAGE_KEYS.BUDGET, budget);
  }

  static getMonthlyIncome(): MonthlyIncome[] {
    return StorageAdapter.getItem<MonthlyIncome[]>(STORAGE_KEYS.MONTHLY_INCOME, []);
  }

  static saveMonthlyIncome(items: MonthlyIncome[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.MONTHLY_INCOME, items);
  }

  static getBankCertificates(): BankCertificate[] {
    return StorageAdapter.getItem<BankCertificate[]>(STORAGE_KEYS.BANK_CERTIFICATES, []);
  }

  static saveBankCertificates(items: BankCertificate[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.BANK_CERTIFICATES, items);
  }
}
