# SMART TIME — StorageKeys Registry Expansion (Phase 3)

## Scope

Phase 3 expands `src/services/storageKeys.ts` from the Phase 2 baseline of 28 canonical keys to the full 33-key registry.

The five keys discovered as hidden direct writers in Phase 1 are now first-class registry constants:

| Registry constant | Storage key |
|---|---|
| `DASHBOARD_LAYOUT` | `smart_time_dashboard_layout` |
| `DASHBOARD_SECTIONS_V2` | `smart_time_dashboard_sections_v2` |
| `WORKOUT_LOGS` | `smart_time_workout_logs` |
| `SPORTS_CARDS_ORDER` | `smart_time_sports_cards_order` |
| `EXPENSES_SECTIONS_ORDER` | `smart_time_expenses_sections_order` |

## Migration Map

`STORAGE_KEY_MIGRATIONS` maps each legacy literal key to its canonical registry constant. The values are intentionally unchanged; Phase 3 is registry expansion, not data migration.

## Boundary

Phase 3 does **not** remove direct `localStorage` access. That is the explicit objective of Phase 4 (Storage Adapter Hardening).

Phase 3 also does not modify the Expense API.

## Exit Gate

- 28 existing registry keys remain intact.
- 5 hidden direct-writer keys are registered.
- Registry total = 33.
- Migration map contains all 5 hidden keys.
- TypeScript production build passes.
- No production/main branch changes are required; work remains on `feat/v3-next`.
