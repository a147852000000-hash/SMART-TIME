# SMART TIME — Phase 5.5 AI Canonical Finance

## Status
CLOSED — Phase 5.5

## Before
- /api/ai/state read ai_transactions directly.
- financeRepository fetched /api/ai/state and merged AI transactions with canonical and legacy storage records.
- This created multiple read sources for the same financial concept.

## After
- AI-facing transaction state is projected from finance_* canonical tables through backend/ai/finance/aiCanonicalProjection.ts.
- finance_expenses is the canonical transaction source for the general expense ledger.
- Fuel, maintenance, and education transaction projections are derived from their canonical finance_* tables.
- ai_transactions is retained as a compatibility projection during the migration period; Phase 5.5 does not delete or rewrite its mutation path.
- ai_budgets remains a compatibility read because the Phase 5 schema has no finance_budgets table. Its final source consolidation belongs to the later duplicate-write/source-consolidation work.

## UI / AI read boundary
src/repositories/financeRepository.ts reads the canonical finance overview and no longer fetches /api/ai/state for transaction data.
The AI state endpoint uses the same canonical finance projection layer.

## Projection
Canonical AI transactions = finance_expenses + finance_fuel_records + finance_maintenance_records + finance_education_expenses.
The legacy ai_transactions table remains available for compatibility and verification; it is not the canonical read source.

## Safety boundaries
- src/services/storageAdapter.ts unchanged.
- No DB schema change.
- No ai_transactions table deletion.
- No expense implementation deletion.
- Phase 5.6 duplicate-write removal is not part of this commit.

## Verification
- Canonical AI adapter present and anchored to finance_*.
- /api/ai/state no longer directly SELECTs ai_transactions.
- financeRepository no longer merges ai_transactions into canonical transaction truth.
- Phase 2/3/4 and 5.4 files remain intact.

## Gate evidence
- Phase 5.5 verification workflow #1: SUCCESS on commit f2140d930b8ec704ec9c10e3ab66087a0930afcf.
- Phase 5.4 workflow #11: SUCCESS on the same commit.
- Phase 2 workflow #76: SUCCESS on the same commit.
- Phase 3 workflow #50: SUCCESS on the same commit.
- Phase 4 workflow #35: SUCCESS on the same commit.
