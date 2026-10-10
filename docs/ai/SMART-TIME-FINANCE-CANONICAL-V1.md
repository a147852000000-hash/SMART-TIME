# SMART TIME — Finance Canonicalization V1

## Scope

SMART TIME finance is a productivity/personal-finance domain. It is separate from the generic SMART AI transaction ledger and must not flatten specialized application finance data into `ai_transactions`.

## Current ownership

- `ai_transactions`: canonical only for the SMART AI transaction ledger already supported by verified backend executors.
- `ai_budgets`: canonical only for the SMART AI budget record already supported by verified backend executors.
- Existing specialized finance repositories/localStorage remain application-owned until an explicit backend schema and migration path exist.
- localStorage is migration/import material, not a second write target after a domain has been migrated.

## Domains that need dedicated canonical schemas

1. Expenses
   - expense id
   - title
   - amount
   - currency
   - category
   - payment method
   - date/time
   - notes
   - receipt/document reference
   - created/updated timestamps
   - user ownership

2. Income
   - source
   - amount
   - currency
   - date
   - type
   - notes
   - created/updated timestamps
   - user ownership

3. Monthly income
   - month
   - salary
   - bonuses
   - other income
   - source breakdown
   - notes
   - user ownership

4. Vehicle-linked finance
   - fuel records
   - maintenance costs
   - vehicle ownership
   - mileage and date
   - provider/station/service center
   - notes

5. Education finance
   - student ownership
   - lessons/tuition/books/supplies/transport
   - amount/currency/date
   - payment state where applicable

6. Certificates / investment records
   - bank/institution
   - principal
   - rate/return metadata
   - issue/maturity/profit dates
   - payout frequency
   - profit amount
   - notes
   - ownership

## Migration rules

1. Read the existing repository/storage shape first.
2. Design a dedicated backend schema without changing user-visible semantics.
3. Add authenticated read APIs.
4. Add a one-time import/migration path with deterministic IDs and duplicate detection.
5. Verify imported records against source data before switching UI writes.
6. Switch UI writes to the backend canonical API.
7. Keep localStorage read-only as a recovery/import source during a transition window.
8. Remove legacy writes only after a repository-wide audit confirms there are no remaining write paths.
9. Never silently merge specialized finance domains into `ai_transactions`.

## AI integration

SMART AI should consume a normalized finance context assembled by the backend. The model must not be the source of truth for balances, totals, budgets, dates, or record existence.

For mutations:

`intent → structured action → permission/confirmation → backend transaction → read-back verification → UI refresh`

For calculations:

`canonical records → deterministic server calculation → model explanation`

The model may explain or summarize finance data, but canonical totals and persisted records remain runtime-owned.

## Safety and boundary

- Do not introduce a second finance write path in the browser.
- Do not infer missing financial records from conversation text.
- Do not expose another user's finance records through shared/trial context.
- Do not couple SMART TIME finance to SMART ENGINEERING AI.
- Engineering/CAD/BIM/MEP finance remains outside this domain unless it is ordinary user-entered expense data.

## Next implementation gates

1. Inventory all specialized finance localStorage read/write paths.
2. Define dedicated SQLite schemas and repository interfaces.
3. Add authenticated read-only projection first.
4. Build deterministic migration/import verification.
5. Switch one finance domain at a time to canonical writes.
6. Add AI context adapters only after canonical reads are stable.
