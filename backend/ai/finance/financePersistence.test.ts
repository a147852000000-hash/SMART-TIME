import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "smart-time-finance-"));
process.env.SMART_TIME_DB_PATH = path.join(directory, "finance-test.db");

const repository = await import("./financeRepository.js");
const projection = await import("./financeProjection.js");
const { db } = await import("../../database.js");

try {
  repository.ensureFinanceMutationSchema();
  const income = [{
    id: "income_2026-11", month: "2026-11", salary: 25000, bonuses: 2000,
    otherIncome: 3000, otherIncomeNote: "Freelance",
    sources: [{ id: "src-1", source: "Salary", amount: 25000, type: "salary" }],
    createdAt: "2026-11-01T00:00:00.000Z",
  }];
  assert.equal(repository.upsertCanonicalMonthlyIncome("user-a", income), 1);
  assert.equal(repository.upsertCanonicalMonthlyIncome("user-a", [{ ...income[0], salary: 26000 }]), 1);
  const incomeRows = projection.getFinanceOverview("user-a").monthlyIncome as any[];
  assert.equal(incomeRows.length, 1, "monthly income upsert must not duplicate a month");
  assert.equal(Number(incomeRows[0].salary), 26000);
  assert.equal((incomeRows[0].sources as any[]).length, 1);
  assert.equal(projection.getFinanceOverview("user-b").monthlyIncome.length, 0, "income must be user-scoped");

  const certificate = {
    id: "cert-a", bankName: "Test Bank", certificateNumber: "A-001", duration: "1 year",
    amount: 240000, annualRate: 18, annualProfit: 43200, periodicProfit: 3600,
    monthlyEquivalentProfit: 3600, returnType: "simple", issueDate: "2026-11-01",
    maturityDate: "2027-11-01", profitDate: "2026-12-01", profitAmount: 3600,
    profitFrequency: "monthly", notes: "test", createdAt: "2026-11-01T00:00:00.000Z",
  };
  assert.equal(repository.upsertCanonicalBankCertificates("user-a", [certificate]), 1);
  assert.equal(repository.upsertCanonicalBankCertificates("user-a", [{ ...certificate, amount: 250000 }]), 1);
  const certificates = projection.getFinanceOverview("user-a").bankCertificates as any[];
  assert.equal(certificates.length, 1, "certificate upsert must not duplicate an id");
  assert.equal(Number(certificates[0].amount), 250000);
  assert.equal(projection.getFinanceOverview("user-b").bankCertificates.length, 0, "certificates must be user-scoped");
  assert.throws(() => repository.upsertCanonicalBankCertificates("user-b", [certificate]), /another user/);
  assert.throws(() => repository.deleteCanonicalBankCertificate("user-b", "cert-a"), /not found/);
  assert.equal(projection.getFinanceOverview("user-a").bankCertificates.length, 1, "another user cannot delete the certificate");
  repository.deleteCanonicalBankCertificate("user-a", "cert-a");
  assert.equal(projection.getFinanceOverview("user-a").bankCertificates.length, 0);

  const trips = [
    { id: "trip-1", tripNumber: "رحلة 1", amount: 85, date: "2026-11-01", dayName: "الأحد", time: "09:30", tripType: "uber", notes: "test trip", createdAt: "2026-11-01T09:30:00.000Z" },
    { id: "trip-2", tripNumber: "رحلة 2", amount: 120, date: "2026-11-02", dayName: "الإثنين", time: "12:15", tripType: "inDrive", createdAt: "2026-11-02T12:15:00.000Z" },
  ];
  assert.equal(repository.replaceCanonicalCarTripIncome("user-a", trips), 2);
  assert.equal(projection.getFinanceOverview("user-a").carTripIncome.length, 2);
  assert.equal(projection.getFinanceOverview("user-b").carTripIncome.length, 0, "car trip income must be user-scoped");
  assert.throws(() => repository.replaceCanonicalCarTripIncome("user-b", [trips[0]]), /another user/);
  assert.equal(projection.getFinanceOverview("user-a").carTripIncome.length, 2, "cross-user ID collision must not replace a trip");
  assert.equal(repository.replaceCanonicalCarTripIncome("user-a", [trips[1]]), 1);
  assert.equal(projection.getFinanceOverview("user-a").carTripIncome.length, 1, "replace operation must remove only this user's omitted trips");
  assert.equal(repository.replaceCanonicalCarTripIncome("user-a", []), 0);
  assert.equal(projection.getFinanceOverview("user-a").carTripIncome.length, 0);

  assert.throws(() => repository.upsertCanonicalMonthlyIncome("user-a", [{ ...income[0], month: "bad-month" }]), /month/);
  assert.throws(() => repository.upsertCanonicalBankCertificates("user-a", [{ ...certificate, amount: -1 }]), /certificate/);
  console.log("PASS: canonical monthly income upsert, source preservation, and user isolation");
  console.log("PASS: canonical certificate upsert, user isolation, and owner-scoped delete");
  console.log("PASS: car trip income replacement, user isolation, and cross-user collision rejection");
  console.log("PASS: invalid income/certificate data rejected");
} finally {
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
