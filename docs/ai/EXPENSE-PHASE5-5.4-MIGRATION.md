# SMART TIME — PHASE 5.4
## Canonical Finance Mutation API + No-Data-Loss Migration

**Status:** IMPLEMENTED  
**Branch:** `feat/v3-next`  
**Protected branch:** `main` — not touched  
**Scope:** canonical Finance mutations + reconciliation only.

### 1. Canonical mutation path

The canonical write target is `finance_expenses`.

The backend repository now provides authenticated-user-scoped:
- create
- update
- delete
- read-back verification

Every mutation validates the canonical eight-type `ExpenseType` contract and writes directly to `finance_expenses`.

The existing `StorageAdapter` was not modified.

### 2. Schema compatibility

Existing `finance_expenses` databases are upgraded at runtime with a single additive column:

`expense_type TEXT NOT NULL DEFAULT 'personal'`

and an index over `user_id, expense_type, date`.

This is additive only; existing rows and fields are preserved.

### 3. Legacy reconciliation

Legacy Expense records can be sent through the existing import boundary. They are inserted into `finance_expenses` only when their ID/content does not already exist.

The migration path is deliberately non-destructive:
- source records are never deleted;
- same-ID identical records are skipped;
- content-equivalent records are skipped;
- same-ID conflicting records are reported as conflicts;
- inserted records are read back before the migration is considered verified.

### 4. AI reconciliation

`ai_transactions` are reconciled into `finance_expenses`.

Rules:
- preserve the original AI transaction ID through target ID `ai_<sourceId>` when a new target row is required;
- never delete the `ai_transactions` source;
- identical canonical rows are skipped;
- conflicting same-ID rows are surfaced rather than overwritten;
- type is deterministically inferred from the AI category, with unmatched categories mapped to `personal` to preserve a valid contract type;
- every inserted row is read back.

### 5. Verification

The repository includes `scripts/verify-phase5-finance-migration.mjs`.

The verification gate checks:
- canonical repository exists;
- all eight contract types are represented;
- INSERT/UPDATE/DELETE target `finance_expenses`;
- AI reconciliation exists;
- migration is non-destructive;
- canonical routes are mounted;
- `StorageAdapter` was not modified.

A runtime migration response additionally reports:
`inserted`, `skipped`, `conflicts`, `verified`, and `verificationPassed`.

### 6. Important limitation

The frontend cannot directly read browser localStorage from the backend. Therefore the legacy browser migration remains an explicit import request through the existing `/api/finance/expenses/import` boundary. Phase 5.4 does not silently delete or rewrite browser data.

### 7. Exit condition

Phase 5.4 is considered green only after:
1. TypeScript/build passes.
2. `verify:phase5-finance-migration` passes.
3. The canonical routes are exercised successfully in an authenticated environment.
4. GitHub Actions is green.

No Expense implementation was deleted, and `main` / `StorageAdapter` were not touched.
