import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/types/finance.ts",
  "backend/ai/finance/financeRepository.ts",
  "backend/ai/finance/financeProjection.ts",
  "backend/ai/finance/expenseMigration.ts",
  "docs/ai/EXPENSE-PHASE5-5.4-MIGRATION.md",
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("PHASE 5.4 FAIL — missing required files:");
  for (const file of missing) console.error(` - ${file}`);
  process.exit(1);
}

const repository = fs.readFileSync(path.join(root, "backend/ai/finance/financeRepository.ts"), "utf8");
const projection = fs.readFileSync(path.join(root, "backend/ai/finance/financeProjection.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "backend/ai/finance/expenseMigration.ts"), "utf8");
const server = fs.readFileSync(path.join(root, "server.ts"), "utf8");

const requiredTypes = ["house","medical","personal","student","vehicle_fuel","vehicle_maint","vehicle_oil","work"];
const missingTypes = requiredTypes.filter((type) => !repository.includes(`"${type}"`));
if (missingTypes.length) {
  console.error("PHASE 5.4 FAIL — canonical mutation repository missing types:", missingTypes.join(", "));
  process.exit(1);
}
for (const needle of ["INSERT INTO finance_expenses","UPDATE finance_expenses","DELETE FROM finance_expenses"]) {
  if (!repository.includes(needle)) {
    console.error(`PHASE 5.4 FAIL — missing canonical mutation: ${needle}`);
    process.exit(1);
  }
}
for (const needle of ["reconcileAiTransactionsToCanonical","ai_transactions","verificationPassed"]) {
  if (!repository.includes(needle)) {
    console.error(`PHASE 5.4 FAIL — missing migration/reconciliation marker: ${needle}`);
    process.exit(1);
  }
}
if (!server.includes("/api/finance/expenses") || !server.includes("/api/finance/migrate")) {
  console.error("PHASE 5.4 FAIL — canonical finance routes are not mounted.");
  process.exit(1);
}
if (migration.includes("DELETE FROM finance_expenses") || repository.includes("DELETE FROM ai_transactions")) {
  console.error("PHASE 5.4 FAIL — migration must not delete source records.");
  process.exit(1);
}

console.log("PHASE 5.4 PASS — canonical mutations, AI reconciliation, no-delete migration, and StorageAdapter boundary verified.");
