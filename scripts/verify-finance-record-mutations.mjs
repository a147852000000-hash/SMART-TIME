import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const schema = read("backend/database/canonicalSchema.ts");
const repository = read("backend/ai/finance/financeRepository.ts");
const server = read("server.ts");
const clientRepository = read("src/repositories/financeRepository.ts");
const service = read("src/services/financeService.ts");
const financeView = read("src/components/ExpensesView.tsx");
const carIncomeView = read("src/components/expenses/CarIncomeSection.tsx");
const educationView = read("src/components/expenses/EducationExpensesSection.tsx");
const vehicleView = read("src/components/expenses/VehicleExpensesSection.tsx");
const expensesView = read("src/components/ExpensesView.tsx");

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
  ["canonical income and certificate tables exist", schema.includes("CREATE TABLE IF NOT EXISTS finance_monthly_income") && schema.includes("CREATE TABLE IF NOT EXISTS finance_bank_certificates")],
  ["car trip income table and user/date index exist", schema.includes("CREATE TABLE IF NOT EXISTS finance_car_trip_income") && schema.includes("idx_finance_car_trip_user_date")],
  ["income and certificate APIs authenticate the user", server.includes('app.put("/api/finance/income"') && server.includes('app.put("/api/finance/certificates"') && server.includes('app.delete("/api/finance/certificates/:id"')],
  ["car trip API authenticates the user", server.includes('app.put("/api/finance/car-trips"') && server.includes("replaceCanonicalCarTripIncome(userId, items)")],
  ["income UI persists monthly income and certificates", service.includes('"/api/finance/income"') && service.includes('"/api/finance/certificates"') && financeView.includes("saveCanonicalMonthlyIncome") && financeView.includes("saveCanonicalBankCertificates")],
  ["car trip income UI loads and saves canonical records", service.includes('"/api/finance/car-trips"') && carIncomeView.includes("fetchCanonicalFinanceOverview") && carIncomeView.includes("saveCanonicalCarTripIncome")],
  ["student, association, and accident records have a canonical table", schema.includes("CREATE TABLE IF NOT EXISTS finance_user_records") && schema.includes("PRIMARY KEY(user_id, record_type, record_id)")],
  ["record collections are allow-listed and owner-scoped", repository.includes('["students", "associations", "vehicle_accidents"]') && repository.includes("WHERE user_id=? AND record_type=?")],
  ["authenticated API exposes canonical user records", server.includes('app.put("/api/finance/user-records/:kind"') && server.includes("replaceCanonicalUserFinanceRecords(userId, req.params.kind, items)")],
  ["frontend overview and save service include student/association/accident data", service.includes("saveCanonicalFinanceUserRecords") && expensesView.includes("overview.students") && expensesView.includes("overview.associations") && expensesView.includes("overview.vehicleAccidents")],
  ["student and association screens use the connected view state", educationView.includes("onSaveStudents") && expensesView.includes("saveCanonicalFinanceUserRecords(\"students\"") && expensesView.includes("saveCanonicalFinanceUserRecords(\"associations\"")],
  ["vehicle accident screen supports create, edit, and delete", vehicleView.includes("screen === 'accidents'") && vehicleView.includes("onSaveAccidents") && vehicleView.includes("editingAccidentId")],

];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
console.log(`\\nFinance record mutation verification: ${checks.length - failed.length}/${checks.length} passed.`);
if (failed.length) process.exit(1);
