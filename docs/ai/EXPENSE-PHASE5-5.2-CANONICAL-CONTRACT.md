# SMART TIME — PHASE 5.2
## Canonical Finance Contract — 8 Expense Types

**Status:** CLOSED — Contract defined  
**Branch:** `feat/v3-next`  
**Protected branch:** `main` — not touched  
**Phase:** 5 — Expense Modules Unification  
**Step:** 5.2 — Canonical Finance Contract  
**Contract file:** `src/types/finance.ts`  
**Dependency:** Phase 5.1 Inventory — commit `106fa04`

> Phase 5.2 is contract-only. No Expense API implementation, repository implementation, database migration, StorageAdapter change, UI migration, or Expense implementation deletion is included.

---

## 1. Purpose

Phase 5.2 fixes the shared Finance vocabulary before Phase 5.3 Repository/API Unification.

The canonical contract is:

- `ExpenseType`
- `Transaction`
- `Category`
- `Budget`
- `Income`
- `FinanceReports`
- `FinanceContract` as the aggregate type-level surface

The contract is persistence-neutral. SQLite rows and legacy localStorage records are translated into these shapes at the repository/API boundary.

---

## 2. The eight canonical expense types

| Type | Meaning | Current legacy source |
|---|---|---|
| `house` | House expenses | `smart_time_house_expenses` |
| `medical` | Medical expenses | `smart_time_medical_expenses` |
| `personal` | Personal expenses | `smart_time_personal_expenses` |
| `student` | Student/education expenses | `smart_time_student_expenses` |
| `vehicle_fuel` | Vehicle fuel | `smart_time_vehicle_fuel` |
| `vehicle_maint` | Vehicle maintenance | `smart_time_vehicle_maint` |
| `vehicle_oil` | Vehicle oil/filter | `smart_time_vehicle_oil_filters` |
| `work` | Work expenses | `smart_time_work_expenses` |

These are domain types, not replacement values for the existing legacy storage keys.

---

## 3. Canonical source-of-truth direction

Phase 5 target direction:

```
Legacy StorageAdapter data
        │
        ▼
migration / normalization
        │
        ▼
Canonical Finance contract
(Transaction / Category / Budget /
 Income / FinanceReports)
        │
        ▼
canonical SQLite Finance persistence
        │
        ▼
shared Repository / Finance API
        │
        ├── UI
        └── SMART AI
```

The specialized `finance_*` SQLite family is the intended canonical Finance persistence family.

Legacy localStorage becomes migration/input data, not a second long-term Finance source.

The contract itself is not a database schema and does not write data.

---

## 4. Specialized `finance_*` SQLite mapping

Phase 5.1 identified:

- `finance_expenses`
- `finance_monthly_income`
- `finance_bank_certificates`
- `finance_fuel_records`
- `finance_maintenance_records`
- `finance_education_expenses`

| SQLite source | Contract domain | Type mapping |
|---|---|---|
| `finance_expenses` | `Transaction` | `house`, `medical`, `personal`, `work` |
| `finance_education_expenses` | `Transaction` | `student` |
| `finance_fuel_records` | `Transaction` | `vehicle_fuel` |
| `finance_maintenance_records` | `Transaction` | `vehicle_maint` |
| `finance_maintenance_records` | `Transaction` | `vehicle_oil` when the record represents oil/filter service |
| `finance_monthly_income` | `Income` / income aggregation | income |
| `finance_bank_certificates` | supporting Finance domain | not one of the eight expense types |

The current specialized transaction tables do not all carry a first-class `ExpenseType` column. Therefore the mapping above is a **contract mapping**, not a claim that the database already enforces it.

Phase 5.3 must implement deterministic normalization rules and preserve domain-specific fields needed by the UI.

---

## 5. `ai_transactions` → same Transaction contract

Phase 5.1 found that SMART AI writes `ai_transactions` through `backend/ai/toolExecutor.ts`.

Conceptual mapping:

| `ai_transactions` | `Transaction` |
|---|---|
| `id` | `id` |
| `amount` | `amount` |
| `date` | `date` |
| `category` | normalization input for `categoryId` / `type` |
| `notes` | `note` |
| `created_at` | `createdAt` |
| AI runtime source | `source = smart_ai` |
| normalized type | `type` |
| canonical category | `categoryId` |
| canonical update timestamp | `updatedAt` |

`ai_transactions` is therefore a persistence representation that must normalize to the same `Transaction` contract; it is not a second public Finance model.

No `ai_transactions` schema or writer is changed in 5.2.

---

## 6. `ai_budgets` → same Budget contract

Current AI budget storage contains:

- `user_id`
- `monthly_limit`
- `currency`
- `updated_at`

Canonical `Budget` requires:

- `id`
- `type`
- `month`
- `limit`
- `spent`

Therefore `ai_budgets` is another persistence representation that must normalize into the same `Budget` contract.

The exact type/month/spent and identity semantics are intentionally deferred to Phase 5.3, where the Repository/API layer will make the source-of-truth decision concrete.

No `ai_budgets` schema or writer is changed in 5.2.

---

## 7. Legacy StorageAdapter → same contract

Phase 4 guarantees that direct `localStorage.setItem` calls are centralized in `StorageAdapter`. Phase 5.2 does not modify that adapter.

The migration boundary is:

`StorageAdapter`
→ legacy reader/repository
→ normalization
→ `Transaction | Category | Budget | Income`
→ canonical Finance Repository/API
→ canonical SQLite

Eight expense keys map to the eight types:

| Legacy key | Canonical type |
|---|---|
| `smart_time_house_expenses` | `house` |
| `smart_time_medical_expenses` | `medical` |
| `smart_time_personal_expenses` | `personal` |
| `smart_time_student_expenses` | `student` |
| `smart_time_vehicle_fuel` | `vehicle_fuel` |
| `smart_time_vehicle_maint` | `vehicle_maint` |
| `smart_time_vehicle_oil_filters` | `vehicle_oil` |
| `smart_time_work_expenses` | `work` |

Legacy IDs should be preserved where safe. Migration must detect collisions/duplicates and remain auditable until the later migration gate is green.

The generic `smart_time_expenses` source does not contain enough information to justify silently assigning one of the eight types in every case. Phase 5.3 must use an explicit deterministic rule or mark ambiguous records for review.

---

## 8. Category contract

`Category.type` is the domain type associated with the category.

For a canonical transaction:

`Transaction.categoryId` → `Category.id`

and:

`Category.type === Transaction.type`

Legacy category labels will be normalized to stable category IDs in Phase 5.3.

---

## 9. Budget contract

`Budget` is scoped by:

- expense type
- month

and exposes:

- limit
- spent

This removes the ambiguity between a generic monthly budget and type-specific Finance budgets.

Existing `smart_time_budget` and `ai_budgets` data are mapped later; no budget data is migrated in 5.2.

---

## 10. Income contract

`Income` is separate from `Transaction`.

This preserves the Phase 5.1 distinction that monthly income, bank certificates, and car-trip income are Finance domains but are not among the eight expense types.

Detailed income/certificate normalization remains an implementation concern for Phase 5.3+.

---

## 11. Reports contract

`FinanceReports` provides one stable report shape:

- `byType`
- `byMonth`
- `totals`

`byType` and `byMonth` include both total amount and record count.

The report implementation is deferred to the Repository/API phase.

---

## 12. Source-of-truth rules

1. Finance consumers use the contract in `src/types/finance.ts`.
2. Specialized `finance_*` SQLite is the target Finance persistence family.
3. AI and UI consume the same canonical contract.
4. `ai_transactions` / `ai_budgets` are normalized representations, not a second public Finance model.
5. Legacy localStorage is migration input, not the final Finance source.
6. `StorageAdapter` remains unchanged.
7. Existing implementations remain until migration and verification are complete.
8. All eight expense types are first-class contract values.
9. No migration is considered complete until identity, duplicate, and no-data-loss checks pass.

---

## 13. Explicit Phase 5.2 non-goals

Not included:

- Expense API implementation
- Repository implementation
- UI migration
- database schema migration
- data migration execution
- StorageAdapter modification
- deletion of Expense implementations
- SMART AI tool-executor rewrite

These begin only after this contract boundary, in Phase 5.3+.

---

## 14. Phase 5.2 gate

| Gate | Result |
|---|---|
| Canonical Finance contract exists | 🟢 |
| Exactly 8 expense types | 🟢 |
| Transaction | 🟢 |
| Category | 🟢 |
| Budget | 🟢 |
| Income | 🟢 |
| FinanceReports | 🟢 |
| FinanceContract aggregate surface | 🟢 |
| `finance_*` mapping documented | 🟢 |
| `ai_transactions` mapping documented | 🟢 |
| `ai_budgets` mapping documented | 🟢 |
| Legacy StorageAdapter mapping documented | 🟢 |
| Repository/API implementation | 🔴 Deferred to 5.3 |
| StorageAdapter modified | 🔴 No |
| Expense implementation deleted | 🔴 No |

**Phase 5.2 conclusion:** canonical Finance vocabulary is fixed. Phase 5.3 is the first implementation step for Repository/API Unification.
