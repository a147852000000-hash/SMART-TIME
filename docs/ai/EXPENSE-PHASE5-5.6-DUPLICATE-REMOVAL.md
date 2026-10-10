# SMART TIME — Phase 5.6 Duplicate Write Removal

## Status
IMPLEMENTED — single canonical finance mutation boundary

## Scope
Branch: `feat/v3-next`
Protected branch: `main` — untouched
StorageAdapter: unchanged
Expense implementations: retained

## Canonical mutation boundary
All expense mutations converge on the existing canonical Finance boundary:
- `POST /api/finance/expenses`
- `PATCH /api/finance/expenses/:id`
- `DELETE /api/finance/expenses/:id`
- `POST /api/finance/migrate`
- `src/repositories/financeRepository.ts` `addTransaction()`, `updateTransaction()`, `deleteTransaction()`

The repository now delegates to the canonical Finance service instead of maintaining a second persistence path.

## AI tables
`ai_transactions` and `ai_budgets` are read-only compatibility/projection tables.
- AI expense create/update/delete now targets `finance_expenses` through the canonical Finance repository.
- `ai_transactions` is never INSERT/UPDATE/DELETE'd by the AI executor.
- `ai_budgets` is never INSERT/UPDATE/DELETE'd; budget mutation is explicitly rejected until a canonical budget mutation boundary exists.
- Migration may read `ai_transactions` and write the canonical `finance_expenses` table without mutating the AI source.

## Verification
`scripts/verify-phase5-no-duplicate-writes.mjs` scans `src/`, `backend/`, and `server.ts` for finance storage writes and SQL mutations against `ai_transactions`/`ai_budgets`, and verifies the canonical repository/service boundary.

## Safety
- No `src/services/storageAdapter.ts` changes.
- No Expense implementation deleted.
- No legacy source data deleted by this phase.
- `main` untouched.