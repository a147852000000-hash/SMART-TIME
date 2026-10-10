# SMART TIME — Phase 5.3 Repository/API Unification

**Status:** CLOSED — unified repository boundary created

## Unified API surface
`src/repositories/financeRepository.ts` exposes `getTransactions(type?)`, `addTransaction`, `updateTransaction`, `deleteTransaction`, `getBudgets`, `getCategories`, `getReports`, plus `getSnapshot`.

## Three-domain read model
1. Specialized Finance: `finance_*` SQLite projection via `/api/finance/overview` — highest precedence.
2. SMART AI: `ai_transactions` / `ai_budgets` via `/api/ai/state`.
3. Legacy UI: finance keys through `StorageAdapter` — migration input only.

Records are mapped into the Phase 5.2 `Transaction / Category / Budget / Income / FinanceReports` contract and merged by canonical ID/source precedence. No source data is mutated.

## Eight expense types
- house
- medical
- personal
- student
- vehicle_fuel
- vehicle_maint
- vehicle_oil
- work

Fuel maps to `vehicle_fuel`; maintenance maps to `vehicle_maint`, with oil mapped to `vehicle_oil`; education maps to `student`; unmatched general expenses default to `personal`; work/medical/house categories are recognized deterministically.

## Write boundary
Phase 5.3 does **not** change the SQLite schema or create a new mutation endpoint. Existing write paths remain untouched. The repository exposes the canonical mutation method surface but rejects mutation with `FinanceRepositoryWriteDeferredError` until Phase 5.4 activates the canonical finance write API and migration.

Target path for 5.4:

`UI / AI → FinanceRepository → canonical finance API → finance_* SQLite`

This guard prevents an accidental second write source while preserving every existing implementation.

## Deferred to Phase 5.4
- canonical finance mutation API
- legacy-to-`finance_*` migration
- reconciliation/no-data-loss verification
- UI mutation migration
- duplicate write-path deactivation

## Explicitly untouched
- `src/services/storageAdapter.ts`
- existing Expense/Vehicles/Education repositories
- existing Expense UI
- SQLite schema
- existing finance overview API
