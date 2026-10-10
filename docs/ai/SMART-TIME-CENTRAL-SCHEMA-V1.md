# SMART TIME — Phase 2: Central Schema / DDL Source of Truth V1

**Branch:** `feat/v3-next`  
**Status:** 🟡 **PHASE 2 — IN PROGRESS**  
**Previous phase:** 🔒 Phase 1 — CLOSED

## Objective

Establish one backend-owned DDL source of truth for the canonical SMART AI and specialized finance runtime tables.

This phase does **not** start expense CRUD, migration/import, scheduler redesign, or AI model integration.

## Canonical schema owner

**Source of truth:**

`backend/database/canonicalSchema.ts`

Exports:

- `SMART_AI_CANONICAL_SCHEMA_VERSION = "v1"`
- `SMART_AI_CANONICAL_SCHEMA_SQL`

The application database bootstrap executes this SQL once during database initialization.

## Tables covered by this V1 schema

### SMART AI runtime

1. `ai_transactions`
2. `ai_budgets`
3. `ai_tasks`
4. `ai_events`
5. `ai_event_reminders`

### Specialized finance

6. `finance_expenses`
7. `finance_monthly_income`
8. `finance_bank_certificates`
9. `finance_fuel_records`
10. `finance_maintenance_records`
11. `finance_education_expenses`

Specialized finance remains separate from `ai_transactions`.

## Runtime ownership change

Before Phase 2:

- `backend/database.ts` owned part of the canonical DDL.
- `backend/ai/toolExecutor.ts` created `ai_transactions`, `ai_budgets`, and `ai_tasks` locally.
- `backend/ai/calendar/reminderScheduler.ts` created `ai_event_reminders` locally.

After the Phase 2 changes:

- `backend/database/canonicalSchema.ts` owns all 11 canonical table definitions.
- `backend/database.ts` bootstraps the canonical schema.
- Feature modules consume the shared `db` connection and no longer create these canonical tables themselves.

## Verification gate

A repository gate was added:

`npm run verify:canonical-schema`

It verifies:

1. All 11 canonical tables are present in the central schema.
2. No duplicate `CREATE TABLE IF NOT EXISTS` definition for those tables exists elsewhere under `backend/`.

## Intentionally out of scope

This phase does **not**:

- migrate localStorage data;
- delete localStorage;
- switch finance UI writes;
- add expense CRUD APIs;
- add migration ledgers;
- redesign the reminder scheduler;
- modify `storageKeys.ts`;
- canonicalize vehicles, education profiles, trips, notes, chat, media, notifications, profile, or vault;
- couple SMART TIME to SMART ENGINEERING AI.

## Remaining Phase 2 closure gates

Phase 2 remains open until all of the following are verified:

- [ ] Central DDL file reviewed against existing runtime schema.
- [ ] Existing database bootstrap still initializes every canonical table.
- [ ] No feature-local canonical DDL remains.
- [ ] `npm run verify:canonical-schema` passes.
- [ ] TypeScript/build validation passes.
- [ ] Existing AI/calendar/finance read paths remain compatible.
- [ ] No unintended data migration or deletion occurred.
- [ ] Phase 2 reconciliation/closure document is committed.

# 🔒 Phase 2 is NOT CLOSED yet.

The next phase must not start until this phase is explicitly closed.
