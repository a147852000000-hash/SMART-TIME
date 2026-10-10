# SMART TIME — PHASE 5.1
## Expense / Finance Inventory & Source-of-Truth Audit

**Status:** CLOSED — 5.1 Inventory Complete  
**Branch:** `feat/v3-next`  
**Protected branch:** `main` — not touched  
**Phase:** 5 — Expense Modules Unification  
**Roadmap goal:** توحيد 8 أنواع مصاريف في API واحد  
**Roadmap deliverable:** `house, medical, personal, student, vehicle_fuel/maint/oil, work expenses`  
**Roadmap gate:** Expense API واحد يخدم الكل  
**Phase dependency:** Phase 4  
**Baseline scanned:** `39db61d0d7bd67d623f3ce037c72c927420e9338`

> Phase 5.1 is an inventory/audit only. No Expense API implementation was changed, no Expense implementation was deleted, and `src/services/storageAdapter.ts` was not modified.

---

## 1. Inventory Scope

The audit covered:

- `src/components/expenses/**/*`
- `src/components/ExpensesView.tsx`
- finance-related services:
  - `src/services/financeService.ts`
  - `src/services/walletService.ts`
  - `src/services/financeMigrationAudit.ts`
  - `src/services/expenseMigration.ts`
  - `src/services/expenseImportService.ts`
  - `src/services/financeCalculations.ts`
- finance repositories:
  - `src/services/repositories/expensesRepository.ts`
  - `src/services/repositories/vehiclesRepository.ts`
  - `src/services/repositories/educationRepository.ts`
- finance-related storage keys and StorageAdapter access
- canonical SQLite finance schema/projection
- SMART AI finance mutation/read paths:
  - `backend/ai/toolExecutor.ts`
  - `backend/ai/canonicalData.ts`
  - `backend/ai/finance/financeProjection.ts`
  - `backend/ai/finance/expenseMigration.ts`
  - `backend/ai/finance/expenseImportRoute.ts`
  - `server.ts`
  - `src/services/aiService.ts`
- available `src/context` / store-style state layers.

### State/store finding

No Zustand store was found in the `src/` tree.

The only React Context found is:

- `src/context/CardSettingsContext.tsx`

It persists card UI preferences and does not read/write finance data.

The current Expense state is therefore primarily component-local React state plus repository/StorageAdapter persistence, not a centralized Zustand/Context finance store.

---

## 2. Expense Modules — Current Persistence Map

| Module | File | Type | Reads From | Writes To | localStorage Key | Status |
|---|---|---|---|---|---|---|
| Universal Expense entry | `src/components/expenses/AddExpenseModal.tsx` | UI | Parent callbacks | Parent callbacks | None | UI-only; dispatches into section-specific state |
| House expenses | `src/components/ExpensesView.tsx` + `HouseExpensesSection.tsx` | UI/state | StorageAdapter | StorageAdapter | `smart_time_house_expenses` | Legacy local source |
| Medical expenses | `src/components/ExpensesView.tsx` | UI/state | StorageAdapter | StorageAdapter | `smart_time_medical_expenses` | Legacy local source |
| Work expenses | `src/components/ExpensesView.tsx` + `WorkExpensesSection.tsx` | UI/state | StorageAdapter | StorageAdapter | `smart_time_work_expenses` | Legacy local source |
| Personal expenses | `src/components/ExpensesView.tsx` + `PersonalExpensesSection.tsx` | UI/state | StorageAdapter | StorageAdapter | `smart_time_personal_expenses` | Legacy local source |
| Personal associations | `src/components/ExpensesView.tsx` + `PersonalExpensesSection.tsx` | UI/state | StorageAdapter | StorageAdapter | `smart_time_personal_associations` | Finance-adjacent; separate domain |
| Vehicle fuel | `src/components/ExpensesView.tsx` + `VehicleExpensesSection.tsx` | UI/state | StorageAdapter | StorageAdapter | `smart_time_vehicle_fuel` | Legacy local source |
| Vehicle maintenance | `src/components/ExpensesView.tsx` + `VehicleExpensesSection.tsx` | UI/state | StorageAdapter | StorageAdapter | `smart_time_vehicle_maint` | Legacy local source |
| Vehicle oil/filter | `src/components/ExpensesView.tsx` + `VehicleExpensesSection.tsx` | UI/state | StorageAdapter | StorageAdapter | `smart_time_vehicle_oil_filters` | Legacy local source |
| Student expenses | `src/components/ExpensesView.tsx` + `EducationExpensesSection.tsx` | UI/state | StorageAdapter | StorageAdapter | `smart_time_student_expenses` | Legacy local source |
| Students | `src/components/ExpensesView.tsx` | UI/state | StorageAdapter | StorageAdapter | `smart_time_students` | Supporting education domain |
| Vehicle accidents | `src/components/ExpensesView.tsx` + `VehiclesRepository` | UI/state/repository | StorageAdapter | StorageAdapter | `smart_time_accident_records` | Supporting vehicle domain |
| Income | `src/components/ExpensesView.tsx` + `IncomeAndCertificatesSection.tsx` | UI/state/repository | ExpensesRepository | ExpensesRepository → StorageAdapter | `smart_time_monthly_income` | Finance domain; not one of the 8 Phase-5 expense types |
| Bank certificates | `src/components/ExpensesView.tsx` + `IncomeAndCertificatesSection.tsx` | UI/state/repository | ExpensesRepository | ExpensesRepository → StorageAdapter | `smart_time_bank_certificates` | Finance domain; not one of the 8 Phase-5 expense types |
| Generic legacy expenses | `src/services/repositories/expensesRepository.ts` | Repository | StorageAdapter | StorageAdapter | `smart_time_expenses` | Separate legacy expense source |
| Generic legacy budget | `src/services/repositories/expensesRepository.ts` | Repository | StorageAdapter | StorageAdapter | `smart_time_budget` | Separate legacy budget source |
| Car trip income | `src/components/expenses/CarIncomeSection.tsx` | UI/state | StorageAdapter | StorageAdapter | `smart_time_car_income_trips` | Separate income source |
| Expense section order | `src/components/expenses/SectionsMenuScreen.tsx` | UI state | raw `localStorage.getItem` | StorageAdapter | `smart_time_expenses_sections_order` | UI state; not transaction data |

---

## 3. Storage Registry Findings

### Registered finance-related keys

The current `STORAGE_KEYS` registry contains:

- `EXPENSES` → `smart_time_expenses`
- `BUDGET` → `smart_time_budget`
- `MONTHLY_INCOME` → `smart_time_monthly_income`
- `BANK_CERTIFICATES` → `smart_time_bank_certificates`
- `VEHICLES` → `smart_time_vehicles`
- `FUEL_RECORDS` → `smart_time_fuel_records`
- `MAINTENANCE_RECORDS` → `smart_time_maint_records`
- `ACCIDENT_RECORDS` → `smart_time_accident_records`
- `STUDENTS` → `smart_time_students`
- `LESSONS` → `smart_time_lessons`
- `EDUCATION_EXPENSES` → `smart_time_edu_expenses`
- `EXPENSES_SECTIONS_ORDER` → `smart_time_expenses_sections_order`

### Unregistered legacy finance keys still in use

The following keys are used by Expense UI but are not represented as dedicated `STORAGE_KEYS` entries:

- `smart_time_house_expenses`
- `smart_time_medical_expenses`
- `smart_time_work_expenses`
- `smart_time_personal_expenses`
- `smart_time_personal_associations`
- `smart_time_vehicle_fuel`
- `smart_time_vehicle_maint`
- `smart_time_vehicle_oil_filters`
- `smart_time_student_expenses`
- `smart_time_car_income_trips`

This is an important Phase 5 migration finding: the eight Expense categories are not currently represented by one canonical client-side finance key or one repository.

### Direct raw localStorage read

`src/components/expenses/SectionsMenuScreen.tsx` still reads:

`localStorage.getItem(STORAGE_KEYS.EXPENSES_SECTIONS_ORDER)`

Its write already goes through `StorageAdapter.setItem`.

This is UI ordering state, not an Expense transaction writer.

---

## 4. Repository Layer

### `ExpensesRepository`

Current responsibilities:

- `getExpenses()`
- `saveExpenses()`
- `addExpense()`
- `updateExpense()`
- `deleteExpense()`
- `getBudget()`
- `saveBudget()`
- `getMonthlyIncome()`
- `saveMonthlyIncome()`
- `getBankCertificates()`
- `saveBankCertificates()`

Persistence target:

`StorageAdapter → localStorage`

It does **not** currently own the specialized House / Medical / Work / Personal / Student / Vehicle-fuel / Vehicle-maintenance / Vehicle-oil data.

### `VehiclesRepository`

Owns:

- vehicles
- fuel records
- maintenance records
- accident records

All are currently persisted through `StorageAdapter`.

### `EducationRepository`

Owns:

- students
- lessons
- education expenses

All are currently persisted through `StorageAdapter`.

---

## 5. Canonical Finance SQLite Layer

The canonical schema is defined in:

`backend/database/canonicalSchema.ts`

It explicitly defines two different finance families:

### SMART AI generic finance

- `ai_transactions`
- `ai_budgets`

### Specialized Finance

- `finance_expenses`
- `finance_monthly_income`
- `finance_bank_certificates`
- `finance_fuel_records`
- `finance_maintenance_records`
- `finance_education_expenses`

The schema comment explicitly states that the specialized finance tables remain separate from `ai_transactions`.

This is the central source-of-truth conflict identified by this inventory.

---

## 6. Canonical Specialized Finance Readers / Writers

### Reader

`backend/ai/finance/financeProjection.ts`

`getFinanceOverview(userId)` reads:

- `finance_expenses`
- `finance_monthly_income`
- `finance_bank_certificates`
- `finance_fuel_records`
- `finance_maintenance_records`
- `finance_education_expenses`

It exposes them through:

`GET /api/finance/overview`

implemented in `server.ts`.

### Writer currently found

`backend/ai/finance/expenseMigration.ts`

`importExpensesForUser()` writes into:

`finance_expenses`

with:

- ID conflict detection
- content fingerprint comparison
- duplicate-content detection
- transaction/rollback
- post-import verification through the overview projection.

The corresponding route is:

`backend/ai/finance/expenseImportRoute.ts`

### Writer status for the other specialized tables

In the scanned Phase 5.1 branch:

- `finance_monthly_income`: no canonical writer found
- `finance_bank_certificates`: no canonical writer found
- `finance_fuel_records`: no canonical writer found
- `finance_maintenance_records`: no canonical writer found
- `finance_education_expenses`: no canonical writer found

They currently have canonical schema + projection/read support, but the active UI still persists corresponding legacy localStorage data.

---

## 7. SMART AI Generic Finance Paths

### `ai_transactions`

Writer:

`backend/ai/toolExecutor.ts → addTransaction()`

Also supports:

- `updateTransaction()`
- `deleteTransaction()`

All operations are user-scoped and use database read-back verification.

AI action mapping currently includes:

`add_expense → addTransaction()`

### `ai_budgets`

Writer:

`backend/ai/toolExecutor.ts → updateBudget()`

Reader:

- `backend/ai/toolExecutor.ts → readBudget()`
- `server.ts → GET /api/ai/state`

### SMART AI state endpoint

`GET /api/ai/state` currently returns:

- `transactions` from `ai_transactions`
- `budget` from `ai_budgets`
- tasks
- calendar events

Therefore the AI state path is **not the same data source** as `GET /api/finance/overview`.

---

## 8. AI ↔ Finance Source-of-Truth Conflict

Current architecture contains at least three finance persistence paths:

### Path A — Legacy UI localStorage

`ExpensesView / Expense sections → StorageAdapter → localStorage`

Examples:

- `smart_time_house_expenses`
- `smart_time_work_expenses`
- `smart_time_personal_expenses`
- `smart_time_medical_expenses`
- `smart_time_student_expenses`
- `smart_time_vehicle_fuel`
- `smart_time_vehicle_maint`
- `smart_time_vehicle_oil_filters`

### Path B — Specialized canonical SQLite

`finance_* tables`

Currently read by `financeProjection.ts`, with an explicit Expense import writer for `finance_expenses`.

### Path C — SMART AI generic SQLite

`ai_transactions / ai_budgets`

Currently written by `toolExecutor.ts` and read by `/api/ai/state`.

**Result:** UI, specialized Finance projection, and SMART AI generic finance are not yet a single source of truth.

---

## 9. Duplicate Write Paths Identified

| Duplicate path | Current writers | Conflict |
|---|---|---|
| Generic expense | `ExpensesRepository.saveExpenses()` → `smart_time_expenses` | Separate from `ai_transactions` and `finance_expenses` |
| House | `ExpensesView.handleSaveHouse()` | LocalStorage-only |
| Work | `ExpensesView.handleSaveWork()` | LocalStorage-only |
| Personal | `ExpensesView.handleSavePersonal()` | LocalStorage-only |
| Medical | `ExpensesView.handleSaveMedical()` | LocalStorage-only |
| Student | `ExpensesView.handleSaveStudentExpenses()` | LocalStorage-only |
| Vehicle fuel | `ExpensesView.handleSaveFuel()` | LocalStorage-only; separate from canonical `finance_fuel_records` |
| Vehicle maintenance | `ExpensesView.handleSaveMaint()` | LocalStorage-only; separate from canonical `finance_maintenance_records` |
| Vehicle oil/filter | `ExpensesView.handleSaveOilFilter()` | LocalStorage-only; no corresponding canonical projection table found |
| AI expense | `toolExecutor.addTransaction()` | Writes `ai_transactions`, separate from UI expense data |
| AI budget | `toolExecutor.updateBudget()` | Writes `ai_budgets`, separate from legacy `smart_time_budget` |
| Expense import | `importExpensesForUser()` | Writes `finance_expenses`, separate from both UI and `ai_transactions` |

### Important distinction

These are not yet three implementations of the same API. They are **three persistence domains with overlapping business meaning**.

Phase 5 therefore needs a canonical contract/API and an explicit migration strategy rather than simply redirecting one component at a time.

---

## 10. Migration Audit Already Present

`src/services/financeMigrationAudit.ts` already compares:

- local Storage/repository data
- canonical `GET /api/finance/overview`

across:

- expenses
- monthlyIncome
- bankCertificates
- fuelRecords
- maintenanceRecords
- educationExpenses

It reports:

- local count
- canonical count
- local-only IDs
- canonical-only IDs
- shared IDs
- duplicate local IDs
- `empty`
- `needs_import`
- `in_sync`
- `review`

This is reusable evidence for the later Phase 5 migration gates.

---

## 11. Phase 5.1 Findings

### Confirmed

1. There is no single Expense repository for the eight Phase-5 expense types.
2. There is no single Expense API serving the eight types.
3. Legacy UI state is split across multiple localStorage keys.
4. Some finance domains already have canonical SQLite schema/projection but lack complete canonical writers.
5. SMART AI generic finance uses `ai_transactions` / `ai_budgets`, separate from specialized Finance SQLite.
6. The existing migration audit can detect local-vs-canonical divergence for the six currently projected finance domains.
7. No Zustand finance store was found.
8. `StorageAdapter` remains the only direct `localStorage.setItem` implementation after Phase 4.
9. `StorageAdapter` was not modified during Phase 5.1.

### Not changed in 5.1

- No Expense API changes
- No database schema changes
- No StorageAdapter changes
- No Expense implementation deletion
- No data migration
- No UI behavior migration

---

## 12. Phase 5.1 Gate

| Gate | Result |
|---|---|
| Complete Expense component inventory | 🟢 |
| Finance service/repository inventory | 🟢 |
| Store/Context inventory | 🟢 |
| Finance localStorage key inventory | 🟢 |
| Readers/writers inventory | 🟢 |
| `ai_transactions` / `ai_budgets` inventory | 🟢 |
| Duplicate write-path identification | 🟢 |
| Expense API unchanged | 🟢 |
| StorageAdapter unchanged | 🟢 |
| 5.2 started | 🔴 Not started — intentionally |

---

## 13. Next Phase Boundary

Phase 5.2 will define the canonical Finance contract before implementation migration.

Required conceptual domains:

- `Transaction`
- `Category`
- `Budget`
- `Income`
- `Reports`

The contract must account for the eight Phase-5 expense types without deleting the existing implementations before migration/verification.

**Phase 5.1 conclusion:** inventory complete; repository is ready for the canonical contract step.
