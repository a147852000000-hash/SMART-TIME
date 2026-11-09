import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const schema = read("backend/database/canonicalSchema.ts");
const repository = read("backend/ai/finance/financeRepository.ts");
const server = read("server.ts");
const clientRepository = read("src/repositories/financeRepository.ts");
const service = read("src/services/financeService.ts");

const checks = [
  ["fuel schema has liters, unit price, and total cost", ["CREATE TABLE IF NOT EXISTS finance_fuel_records", "liters REAL NOT NULL", "price_per_liter REAL NOT NULL", "total_cost REAL NOT NULL"].every((value) => schema.includes(value))],
  ["maintenance schema has system type and cost", ["CREATE TABLE IF NOT EXISTS finance_maintenance_records", "system_type TEXT NOT NULL", "cost REAL NOT NULL"].every((value) => schema.includes(value))],
  ["education schema has student and amount", ["CREATE TABLE IF NOT EXISTS finance_education_expenses", "student_id TEXT NOT NULL", "amount REAL NOT NULL"].every((value) => schema.includes(value))],
  ["specialized record kinds are allow-listed", repository.includes('type CanonicalFinanceRecordKind = "fuel" | "maintenance" | "education"')],
  ["specialized reads, updates, and deletes are user-scoped", ["SELECT * FROM ${config.table} WHERE id=? AND user_id=?", "UPDATE ${config.table} SET ${assignments.join", "DELETE FROM ${config.table} WHERE id=? AND user_id=?"].every((value) => repository.includes(value))],
  ["fuel amount updates recalculate unit price", repository.includes("price_per_liter=?") && repository.includes("values.push(amount, amount / liters)")],
  ["specialized API routes authenticate the user", server.includes('app.patch("/api/finance/records/:kind/:id"') && server.includes('app.delete("/api/finance/records/:kind/:id"') && server.includes("financeUser(req, res)")],
  ["frontend dispatches prefixed specialized IDs", clientRepository.includes("/^(fuel|maintenance|education):(.*)$/")],
  ["frontend service calls specialized mutation endpoints", service.includes("/api/finance/records/${kind}/")],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
console.log(`\\nFinance record mutation verification: ${checks.length - failed.length}/${checks.length} passed.`);
if (failed.length) process.exit(1);
