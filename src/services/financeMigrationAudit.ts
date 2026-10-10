import type {
  BankCertificate,
  EducationExpense,
  Expense,
  FuelRecord,
  MaintenanceRecord,
  MonthlyIncome,
} from "../types";
import { ExpensesRepository } from "./repositories/expensesRepository";
import { VehiclesRepository } from "./repositories/vehiclesRepository";
import { EducationRepository } from "./repositories/educationRepository";
import { fetchCanonicalFinanceOverview, type FinanceOverview } from "./financeService";

type LocalFinanceSnapshot = {
  expenses: Expense[];
  monthlyIncome: MonthlyIncome[];
  bankCertificates: BankCertificate[];
  fuelRecords: FuelRecord[];
  maintenanceRecords: MaintenanceRecord[];
  educationExpenses: EducationExpense[];
};

export type FinanceMigrationDomain = keyof LocalFinanceSnapshot;

export interface FinanceMigrationDomainAudit {
  domain: FinanceMigrationDomain;
  localCount: number;
  canonicalCount: number;
  localOnlyIds: string[];
  canonicalOnlyIds: string[];
  sharedIds: string[];
  duplicateLocalIds: string[];
  status: "empty" | "needs_import" | "in_sync" | "review";
}

export interface FinanceMigrationAudit {
  source: "local-storage-vs-smart-time-finance-sqlite";
  generatedAt: string;
  domains: FinanceMigrationDomainAudit[];
  safeToImport: boolean;
  requiresReview: boolean;
}

const DOMAINS: FinanceMigrationDomain[] = [
  "expenses",
  "monthlyIncome",
  "bankCertificates",
  "fuelRecords",
  "maintenanceRecords",
  "educationExpenses",
];

function localSnapshot(): LocalFinanceSnapshot {
  return {
    expenses: ExpensesRepository.getExpenses(),
    monthlyIncome: ExpensesRepository.getMonthlyIncome(),
    bankCertificates: ExpensesRepository.getBankCertificates(),
    fuelRecords: VehiclesRepository.getFuelRecords(),
    maintenanceRecords: VehiclesRepository.getMaintenanceRecords(),
    educationExpenses: EducationRepository.getEducationExpenses(),
  };
}

function ids(items: Array<{ id?: string }>): string[] {
  return items.map((item) => item.id).filter((id): id is string => Boolean(id));
}

function duplicates(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

function canonicalItems(overview: FinanceOverview, domain: FinanceMigrationDomain): Array<{ id?: string }> {
  return overview[domain].filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) as Array<{ id?: string }>;
}

export function buildFinanceMigrationAudit(
  local: LocalFinanceSnapshot,
  canonical: FinanceOverview,
): FinanceMigrationAudit {
  const domains = DOMAINS.map((domain): FinanceMigrationDomainAudit => {
    const localIds = ids(local[domain]);
    const canonicalIds = ids(canonicalItems(canonical, domain));
    const localSet = new Set(localIds);
    const canonicalSet = new Set(canonicalIds);
    const localOnlyIds = localIds.filter((id) => !canonicalSet.has(id));
    const canonicalOnlyIds = canonicalIds.filter((id) => !localSet.has(id));
    const sharedIds = localIds.filter((id) => canonicalSet.has(id));
    const duplicateLocalIds = duplicates(localIds);

    let status: FinanceMigrationDomainAudit["status"] = "empty";
    if (localIds.length > 0 && duplicateLocalIds.length > 0) status = "review";
    else if (localIds.length === 0 && canonicalIds.length === 0) status = "empty";
    else if (localOnlyIds.length > 0) status = "needs_import";
    else if (localIds.length === canonicalIds.length && canonicalOnlyIds.length === 0) status = "in_sync";
    else status = "review";

    return {
      domain,
      localCount: local[domain].length,
      canonicalCount: canonicalItems(canonical, domain).length,
      localOnlyIds: [...new Set(localOnlyIds)],
      canonicalOnlyIds: [...new Set(canonicalOnlyIds)],
      sharedIds: [...new Set(sharedIds)],
      duplicateLocalIds,
      status,
    };
  });

  const requiresReview = domains.some((domain) => domain.status === "review");
  return {
    source: "local-storage-vs-smart-time-finance-sqlite",
    generatedAt: new Date().toISOString(),
    domains,
    safeToImport: !requiresReview && domains.some((domain) => domain.status === "needs_import"),
    requiresReview,
  };
}

export async function auditFinanceMigration(): Promise<FinanceMigrationAudit> {
  const [canonical, local] = await Promise.all([
    fetchCanonicalFinanceOverview(),
    Promise.resolve(localSnapshot()),
  ]);
  return buildFinanceMigrationAudit(local, canonical);
}

export function getLocalFinanceSnapshot(): LocalFinanceSnapshot {
  return localSnapshot();
}
