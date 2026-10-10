import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = path.join(root, "backend", "database", "canonicalSchema.ts");
const scanRoots = [path.join(root, "backend")];

const canonicalTables = [
  "ai_transactions",
  "ai_budgets",
  "ai_tasks",
  "ai_events",
  "ai_event_reminders",
  "finance_expenses",
  "finance_monthly_income",
  "finance_bank_certificates",
  "finance_fuel_records",
  "finance_maintenance_records",
  "finance_education_expenses",
];

const schema = fs.readFileSync(schemaPath, "utf8");
const missing = canonicalTables.filter((table) => !schema.includes(`CREATE TABLE IF NOT EXISTS ${table} (`));
if (missing.length) {
  throw new Error(`Canonical schema is missing tables: ${missing.join(", ")}`);
}

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
  }
}
for (const rootDir of scanRoots) walk(rootDir);

const violations = [];
for (const file of files) {
  if (path.resolve(file) === path.resolve(schemaPath)) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const table of canonicalTables) {
    const pattern = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\s*\\(`, "i");
    if (pattern.test(content)) {
      violations.push(path.relative(root, file) + ` -> ${table}`);
    }
  }
}

if (violations.length) {
  throw new Error("Canonical DDL found outside backend/database/canonicalSchema.ts:\n" + violations.join("\n"));
}

console.log(`OK: ${canonicalTables.length} canonical tables are defined centrally and have no duplicate CREATE TABLE DDL in backend.`);
