import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const required = ["src/repositories/financeRepository.ts","src/types/finance.ts","backend/ai/finance/financeProjection.ts","backend/ai/finance/aiCanonicalProjection.ts","docs/ai/EXPENSE-PHASE5-5.5-AI-CANONICAL.md"];
const missing = required.filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length) { console.error("PHASE 5.5 FAIL — missing required files:"); missing.forEach((f) => console.error(" - " + f)); process.exit(1); }
const repository = fs.readFileSync(path.join(root, "src/repositories/financeRepository.ts"), "utf8");
const server = fs.readFileSync(path.join(root, "server.ts"), "utf8");
const adapter = fs.readFileSync(path.join(root, "backend/ai/finance/aiCanonicalProjection.ts"), "utf8");
const storage = fs.readFileSync(path.join(root, "src/services/storageAdapter.ts"), "utf8");
if (repository.includes("/api/ai/state") || repository.includes("ai_transactions")) { console.error("PHASE 5.5 FAIL — financeRepository still reads the AI transaction source directly."); process.exit(1); }
if (!server.includes("getAiCanonicalState") || server.includes("FROM ai_transactions")) { console.error("PHASE 5.5 FAIL — server AI state is not routed through the canonical AI finance adapter."); process.exit(1); }
if (!adapter.includes("getFinanceOverview") || !adapter.includes("finance_expenses")) { console.error("PHASE 5.5 FAIL — canonical AI adapter is not anchored to finance_* source data."); process.exit(1); }
for (const marker of ["finance_expenses","finance_fuel_records","finance_maintenance_records","finance_education_expenses"]) if (!adapter.includes(marker)) { console.error("PHASE 5.5 FAIL — missing canonical projection marker: " + marker); process.exit(1); }
if (storage.includes("PHASE_5_5")) { console.error("PHASE 5.5 FAIL — StorageAdapter core contains Phase 5.5 modifications."); process.exit(1); }
console.log("PHASE 5.5 PASS — AI transaction reads are routed through canonical finance_* projection; legacy ai_transactions retained for compatibility.");
