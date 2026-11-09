import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const schema = read("backend/database/canonicalSchema.ts");
const repository = read("backend/ai/finance/financeRepository.ts");
const server = read("server.ts");
const clientRepository = read("src/repositories/financeRepository.ts");
const service = read("src/services/financeService.ts");

const checks = [
  ["canonical fuel table has liters and unit price", /CREATE TABLE IF NOT EXISTS finance_fuel_records[\\s\\S]*?liters REAL NOT NULL[\\s\\S]*?price_per_liter REAL NOT NULL[\\s\\S]*?total_cost REAL NOT NULL/.test(schema)],
  ["canonical maintenance table has system_type and cost", /CREATE TABLE IF NOT EXISTS finance_maintenance_records[\\s\\S]*?system_type TEXT NOT NULL[\\s\\S]*?cost REAL NOT NULL/.test(schema)],
  ["canonical education table has student_id and amount", /CREATE TABLE IF NOT EXISTS finance_education_expenses[\\s\\S]*?student_id TEXT NOT NULL[\\s\\S]*?amount REAL NOT NULL/.test(schema)],
  ["specialized record kinds are allow-listed", /type CanonicalFinanceRecordKind = "fuel" \\| "maintenance" \\| "education"/.test(repository)],
  ["specialized reads are scoped by user", /SELECT \\* FROM \\u0024\\{config\\.table\\} WHERE id=\\? AND user_id=\\?/.test(repository)],
  ["specialized updates are scoped by user", /UPDATE \\u0024\\{config\\.table\\} SET \\u0024\\{assignments\\.join/.test(repository) && /WHERE id=\\? AND user_id=\\?/.test(repository)],
  ["specialized deletes are scoped by user", /DELETE FROM \\u0024\\{config\\.table\\} WHERE id=\\? AND user_id=\\?/.test(repository)],
  ["fuel amount updates recalculate unit price", /amount \\/ liters/.test(repository) && /price_per_liter=\\?/.test(repository)],
  ["specialized API routes require authenticated user", /app\\.patch\\("\\/api\\/finance\\/records\\/:kind\\/:id"[\\s\\S]*?financeUser\\(req, res\\)/.test(server) && /app\\.delete\\("\\/api\\/finance\\/records\\/:kind\\/:id"[\\s\\S]*?financeUser\\(req, res\\)/.test(server)],
  ["frontend dispatches specialized IDs by source prefix", /\\^\\(fuel\\|maintenance\\|education\\):/.test(clientRepository)],
  ["frontend service exposes specialized mutation endpoints", /\\/api\\/finance\\/records\\/\\$\\{kind\\}/.test(service)],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
console.log(`\\nFinance record mutation verification: ${checks.length - failed.length}/${checks.length} passed.`);
if (failed.length) process.exit(1);
