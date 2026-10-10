# SMART TIME — Local Storage Inventory V1

Branch: `feat/v3-next`
Generated from the repository's current storage key registry and repository implementations.

## Purpose

This inventory identifies the current client-side persistence boundary before any further source-of-truth cutover. It does **not** migrate, delete, or rewrite data.

## Current storage registry

Source: `src/services/storageKeys.ts`

| Key | Storage key | Current repository/service owner | Current persistence | Initial classification |
|---|---|---|---|---|
| USER_PROFILE | smart_time_user_profile | UserRepository | localStorage | review: user/profile backend |
| NOTES | smart_time_notes | NotesRepository | localStorage | review: notes canonical backend |
| NOTE_FOLDERS | smart_time_note_folders | NotesRepository | localStorage | review with notes |
| NOTE_TAGS | smart_time_note_tags | NotesRepository | localStorage | review with notes |
| CALCULATOR_HISTORY | smart_time_calc_history | NotesRepository | localStorage | local-only candidate |
| DAILY_TASKS | smart_time_daily_tasks | NotesRepository; AI task runtime | localStorage + SQLite canonical task state | canonicalization in progress; SQLite target |
| EXPENSES | smart_time_expenses | ExpensesRepository | localStorage | finance migration/cutover in progress |
| BUDGET | smart_time_budget | ExpensesRepository | localStorage | finance canonicalization required |
| MONTHLY_INCOME | smart_time_monthly_income | ExpensesRepository | localStorage | finance canonicalization required |
| BANK_CERTIFICATES | smart_time_bank_certificates | ExpensesRepository | localStorage | finance canonicalization required |
| VEHICLES | smart_time_vehicles | VehiclesRepository | localStorage | vehicle backend decision required |
| FUEL_RECORDS | smart_time_fuel_records | VehiclesRepository | localStorage | finance/vehicle canonicalization required |
| MAINTENANCE_RECORDS | smart_time_maint_records | VehiclesRepository | localStorage | vehicle backend decision required |
| ACCIDENT_RECORDS | smart_time_accident_records | VehiclesRepository | localStorage | vehicle backend decision required |
| STUDENTS | smart_time_students | EducationRepository | localStorage | education backend decision required |
| LESSONS | smart_time_lessons | EducationRepository | localStorage | education backend decision required |
| EDUCATION_EXPENSES | smart_time_edu_expenses | EducationRepository | localStorage | finance/education canonicalization required |
| FAVORITE_PLACES | smart_time_favorite_places | TripsRepository | localStorage | trips backend decision required |
| RECENT_TRIPS | smart_time_recent_trips | TripsRepository | localStorage | trips backend decision required |
| SECURE_RECORDS | smart_time_secure_records | VaultRepository | localStorage | security-sensitive; dedicated backend decision required |
| CHAT_ROOMS | smart_time_chat_rooms | ChatRepository | localStorage | chat backend migration required |
| CHAT_MESSAGES | smart_time_chat_messages | ChatRepository | localStorage | chat backend migration required |
| MEDIA_FOLDERS | smart_time_media_folders | MediaRepository | localStorage | media/files architecture required |
| MEDIA_ITEMS | smart_time_media_items | MediaRepository | localStorage | media/files architecture required |
| NOTIFICATIONS | smart_time_notifications | NotificationsRepository | localStorage | notification architecture review |
| ATHKAR_ITEMS | smart_time_athkar_items | ReligiousRepository | localStorage | local-only candidate unless sync required |
| AI_CHAT_HISTORY | smart_time_ai_chat_history | ChatRepository / AI services | localStorage | AI conversation/memory backend migration required |
| NOTIFICATION_SOUND | smart_time_notification_sound | notification sound service/settings | localStorage | local preference candidate |

## Repository ownership discovered

### User
`UserRepository`
- Reads/writes USER_PROFILE.
- Profile is merged with defaults and nested preference defaults.
- No backend canonical profile mapping was established by this inventory.

### Notes
`NotesRepository`
- NOTES
- NOTE_FOLDERS
- NOTE_TAGS
- DAILY_TASKS
- CALCULATOR_HISTORY

Daily tasks are the exception: the AI/task architecture already defines SQLite as canonical. The remaining NotesRepository task writes must therefore be cut over carefully.

### Finance
`ExpensesRepository`
- EXPENSES
- BUDGET
- MONTHLY_INCOME
- BANK_CERTIFICATES

Specialized finance SQLite schema/projection already exists for the finance domains. Expense migration infrastructure exists; the expense import route still needs live Express registration before runtime migration.

### Vehicles
`VehiclesRepository`
- VEHICLES
- FUEL_RECORDS
- MAINTENANCE_RECORDS
- ACCIDENT_RECORDS

No migration should be started until the vehicle domain schema/ownership boundary is explicitly defined.

### Education
`EducationRepository`
- STUDENTS
- LESSONS
- EDUCATION_EXPENSES

Education expenses already have a specialized finance schema target; students/lessons need their own backend decision.

### Trips
`TripsRepository`
- FAVORITE_PLACES
- RECENT_TRIPS

These are not automatically finance data. Keep them separate until a trips canonical schema is designed.

### Chat
`ChatRepository`
- CHAT_ROOMS
- CHAT_MESSAGES
- AI_CHAT_HISTORY

This domain needs a dedicated conversation/message/memory architecture rather than simply moving keys into generic SQLite blobs.

### Media
`MediaRepository`
- MEDIA_FOLDERS
- MEDIA_ITEMS

This should eventually align with the SMART-TIME files/artifacts architecture. Do not treat browser localStorage as the durable source for uploaded file contents.

### Notifications
`NotificationsRepository`
- NOTIFICATIONS

Calendar reminders now have a separate durable backend reminder queue. App notifications remain a separate domain until their backend ownership is defined.

### Security/Vault
`VaultRepository`
- SECURE_RECORDS

Do not migrate this as ordinary application data. It requires a separate security review.

### Religious
`ReligiousRepository`
- ATHKAR_ITEMS

Potentially local-only unless cross-device synchronization becomes a product requirement.

## Canonicalization policy

1. Never delete legacy localStorage data before a verified migration.
2. Never silently merge specialized domains into generic `ai_transactions`.
3. Canonical backend records must be authenticated and user-scoped.
4. Every migration must have deterministic ID handling and duplicate/conflict detection.
5. After import, read back canonical records and compare against the migration result.
6. Only after verification may UI writes be switched from localStorage to the canonical API.
7. Legacy localStorage should remain read-only during the transition.
8. Remove legacy writes only after repository-wide audit and successful cutover.

## Immediate next gates

1. Register the existing expense import route in `server.ts` through an approved safe edit path.
2. Run the expense migration integration test.
3. Complete expense CRUD/cutover.
4. Define the remaining finance migration adapters one domain at a time.
5. Define vehicle, education, trips, notes, chat, media, notification, profile, and vault backend ownership before changing their repositories.
6. Perform a second pass for direct `localStorage`/StorageAdapter usage outside the known repositories before declaring this inventory complete.

## Important limitation

This document is a first-pass inventory from the explicit storage-key registry and known repository ownership. It is **not** yet proof that there are zero direct storage accesses elsewhere in the codebase. A repository-wide direct-access scan is still required before final cutover.
