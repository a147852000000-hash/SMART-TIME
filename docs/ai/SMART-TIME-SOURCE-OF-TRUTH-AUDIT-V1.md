# SMART TIME — Source of Truth Audit V1

## Canonical backend domains

| Domain | Canonical store | AI/runtime path | Frontend status |
|---|---|---|---|
| Tasks | SQLite `ai_tasks` | verified task executor + `/api/ai/tasks` | canonical CRUD wired |
| Calendar events | SQLite `ai_events` | verified event executor + `/api/ai/events` | API ready; no dedicated CalendarView found on `feat/v3-next` |
| Event reminders | SQLite `ai_event_reminders` | durable scheduler + reminder API | delivery/OS notification layer pending |
| AI transactions | SQLite `ai_transactions` | verified expense executor + `/api/ai/state` reader | state hydration exists |
| AI budget | SQLite `ai_budgets` | verified budget executor + `/api/ai/state` reader | state hydration exists |

## Domains that are still frontend/local-storage owned

The existing product contains broader finance and personal-data domains that are not equivalent to the generic AI transaction ledger. Examples include specialized home/work/personal/vehicle/education expense records, monthly income, bank certificates, vehicles, education records, notes, notifications, trips, and other repositories.

These must **not** be silently mapped into `ai_transactions` because their schemas and semantics differ.

## Migration rule

1. Do not create a second write path for an already-canonical domain.
2. Keep legacy localStorage data as migration/import input only once a backend schema exists.
3. Do not delete legacy storage until import/read-back verification is implemented.
4. For specialized domains, define their canonical backend schema first instead of flattening them into the generic AI ledger.
5. AI mutations must execute server-side and verify the persisted result before reporting success.

## Current remaining gates

- dedicated Calendar UI/state integration;
- browser/device notification delivery;
- recurring reminder UX and lifecycle management;
- canonical backend model for the broader specialized finance domain;
- migration/import strategy for existing specialized localStorage records;
- repository-wide audit of every remaining localStorage mutation;
- WebSocket conversation authorization review;
- trial-user isolation review.

## Explicit scope boundary

SMART TIME remains a productivity/personal-business assistant. CAD/DWG/BIM and engineering-domain execution are not part of this canonicalization pass.
