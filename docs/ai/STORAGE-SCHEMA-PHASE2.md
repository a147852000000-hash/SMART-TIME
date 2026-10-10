# SMART TIME — Phase 2 Central Schema Definition

## Roadmap scope

Phase 2 is the Central Schema Definition stage from the 29-phase roadmap.

Goal:
- Define one typed schema for the 28 known storage keys discovered in Phase 1.
- Add the 5 hidden direct-writer keys identified by Phase 1 as actual storage-call writers.
- Provide runtime validators without changing the Expense API.
- Do not expand `src/services/storageKeys.ts`; that is Phase 3.

## Implemented

Primary file:
- `src/services/storageSchema.ts`

The schema contains:
- 28 keys from `src/services/storageKeys.ts`.
- 5 hidden direct-writer keys:
  - `smart_time_dashboard_layout`
  - `smart_time_dashboard_sections_v2`
  - `smart_time_workout_logs`
  - `smart_time_sports_cards_order`
  - `smart_time_expenses_sections_order`

Total Phase 2 schema entries: **33**.

## Typed value map

The schema maps known application storage to existing domain types where they are available, including:
- UserProfile
- Note / NoteFolder / NoteTag
- DailyTask
- Expense / BudgetSummary / MonthlyIncome / BankCertificate
- Vehicle / FuelRecord / MaintenanceRecord / VehicleAccidentRecord
- Student / LessonItem / EducationExpense
- FavoritePlace / RecentTrip / SecureRecord
- ChatRoom / ChatMessage
- MediaFolder / MediaItem
- AppNotification / AthkarItem / AiMessage

The five hidden direct-writer records have explicit local schema types:
- DashboardLayoutMode
- DashboardSectionPreference[]
- WorkoutLogRecord[]
- string[] for sports card order
- ExpenseSectionKey[] for expense section order

## Runtime validation

The schema exposes:
- `isStorageSchemaKey()`
- `validateStorageValue()`
- `parseStorageValue()`

Validation rejects malformed JSON and values that do not satisfy the registered shape.

## Phase boundary

This phase does **not**:
- modify `src/services/storageKeys.ts`
- migrate data
- replace direct localStorage writers
- change Expense API behavior

Those belong to later roadmap phases.

## Gate evidence

Phase 1 evidence reports:
- 28 known canonical keys
- 5 hidden direct writers

Phase 2 implementation currently registers:
- 28 known + 5 hidden = **33 typed schema entries**

## Official Closure

**STATUS: CLOSED**

Closure validation completed on 2026-09-28 via GitHub Actions workflow **Phase 2 - Verify Central Schema**, run **#18** (`36443832208`), with the following required checks passing:
- Phase 2 schema gate: **PASS** — 28 known + 5 hidden = 33 entries.
- Production build: **PASS**.

The repository-wide TypeScript lint remains a separate existing gate; its unrelated pre-existing errors are not used as a Phase 2 closure criterion.

No Expense API changes were made for Phase 2.

Next gate:
- Phase 3 — StorageKeys Registry Expansion


## Closure Gate
The dedicated Phase 2 workflow executes the Phase 2 schema gate and production build only. Repository-wide TypeScript lint remains a separate existing gate and is not used to declare Phase 2 closed.
