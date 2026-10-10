# SMART TIME — Storage Reconciliation — Phase 1

**Branch:** `feat/v3-next`  
**Phase:** 1 — Storage Inventory  
**Status:** 🔒 **PHASE 1 — CLOSED**  
**Discovery source:** `docs/ai/STORAGE-DISCOVERED-V2.json`  
**Canonical registry compared:** `src/services/storageKeys.ts`

## 1. Scope and evidence

The discovery scan was executed by GitHub Actions after the ESM compatibility fix to `scripts/scan-hidden-storage.js`.

Scanner evidence:

- Source root: `src`
- Extensions scanned: `.ts`, `.tsx`, `.js`, `.jsx`
- Files scanned: **110**
- Direct APIs scanned: `localStorage`, `sessionStorage`
- Adapter patterns scanned: `StorageAdapter`, `storageAdapter`
- Literal pattern scanned: `smart_time_*`
- Discovered unique keys: **64**
- Keys present in the canonical registry: **28**
- Discovered keys outside the canonical registry: **36**

> **Important registry-count correction:** the actual `src/services/storageKeys.ts` on `feat/v3-next` contains **28** registered keys, not 29. This reconciliation uses the repository contents as the source of truth and does not modify `storageKeys.ts`.

## 2. Reconciliation summary

| Classification | Count | Meaning |
|---|---:|---|
| Known / canonical registry | **28** | Present in `src/services/storageKeys.ts` |
| Hidden direct writers | **5** | Hidden keys with direct `localStorage.setItem` / `sessionStorage.setItem` evidence |
| Adapter writers | **0** | No hidden key had a detected `StorageAdapter` / `storageAdapter` write |
| String-only references | **29** | Hidden keys with literal references but no detected storage call |
| Unknown sources | **0** | Every discovered hidden key has at least one source file in the scan evidence |
| Direct readers (non-writers) | **2** | Hidden keys with direct `getItem` evidence; tracked separately so they are not falsely classified as writers |
| **Total discovered keys** | **64** | 28 + 5 + 0 + 29 + 2 |

The two direct-reader-only keys are:

- `smart_time_trip_home` — `src/components/TripsView.tsx`
- `smart_time_trip_work` — `src/components/TripsView.tsx`

They are **not** counted as hidden writers.

## 3. Known — canonical registry (28)

These keys are already represented in `src/services/storageKeys.ts`:

| # | Key |
|---:|---|
| 1 | `smart_time_accident_records` |
| 2 | `smart_time_ai_chat_history` |
| 3 | `smart_time_athkar_items` |
| 4 | `smart_time_bank_certificates` |
| 5 | `smart_time_budget` |
| 6 | `smart_time_calc_history` |
| 7 | `smart_time_chat_messages` |
| 8 | `smart_time_chat_rooms` |
| 9 | `smart_time_daily_tasks` |
| 10 | `smart_time_edu_expenses` |
| 11 | `smart_time_expenses` |
| 12 | `smart_time_favorite_places` |
| 13 | `smart_time_fuel_records` |
| 14 | `smart_time_lessons` |
| 15 | `smart_time_maint_records` |
| 16 | `smart_time_media_folders` |
| 17 | `smart_time_media_items` |
| 18 | `smart_time_monthly_income` |
| 19 | `smart_time_note_folders` |
| 20 | `smart_time_note_tags` |
| 21 | `smart_time_notes` |
| 22 | `smart_time_notification_sound` |
| 23 | `smart_time_notifications` |
| 24 | `smart_time_recent_trips` |
| 25 | `smart_time_secure_records` |
| 26 | `smart_time_students` |
| 27 | `smart_time_user_profile` |
| 28 | `smart_time_vehicles` |

## 4. Hidden direct writers — 5

These are the hidden keys for which the discovery evidence contains a direct `setItem` call.

| Key | Source | Access |
|---|---|---|
| `smart_time_dashboard_layout` | `src/components/DashboardView.tsx` | `getItem`, `setItem` |
| `smart_time_dashboard_sections_v2` | `src/components/DashboardView.tsx` | `getItem`, `setItem` |
| `smart_time_workout_logs` | `src/components/SportsView.tsx` | `setItem` |
| `smart_time_sports_cards_order` | `src/components/SportsView.tsx` | `setItem` |
| `smart_time_expenses_sections_order` | `src/components/expenses/SectionsMenuScreen.tsx` | `getItem`, `setItem` |

**Count: 5 hidden writer keys.**

## 5. Adapter writers — 0

No hidden key in `STORAGE-DISCOVERED-V2.json` contains detected evidence matching:

- `StorageAdapter`
- `storageAdapter`

Therefore:

**Adapter writers = 0**

This means the discovery scan found no additional hidden writer that can be attributed to those adapter call patterns.

## 6. String-only references — 29

These keys appear as `smart_time_*` literals but have no detected direct storage call in the discovery evidence.

| # | Key | Source |
|---:|---|---|
| 1 | `smart_time_adhan_alert` | `src/services/repositories/religiousRepository.ts` |
| 2 | `smart_time_auth_session` | `src/services/authService.ts` |
| 3 | `smart_time_call_logs_changed` | `src/components/PhonePermissionsManager.tsx`; `src/services/permissionService.ts` |
| 4 | `smart_time_call_logs_v1` | `src/services/permissionService.ts` |
| 5 | `smart_time_car_income_trips` | `src/components/expenses/CarIncomeSection.tsx` |
| 6 | `smart_time_card_preferences_v1` | `src/utils/cardDesignHelper.ts` |
| 7 | `smart_time_christian_prayers` | `src/services/repositories/religiousRepository.ts` |
| 8 | `smart_time_christian_reading` | `src/services/repositories/religiousRepository.ts` |
| 9 | `smart_time_contacts_` | `src/services/permissionService.ts` |
| 10 | `smart_time_contacts_changed` | `src/components/PhonePermissionsManager.tsx`; `src/services/permissionService.ts` |
| 11 | `smart_time_dashboard_layout_settings_v1` | `src/services/repositories/dashboardLayoutRepository.ts` |
| 12 | `smart_time_device_id` | `src/services/authService.ts` |
| 13 | `smart_time_expenses_sections_order` | **also has direct storage evidence; therefore counted under hidden direct writers, not here** |
| 14 | `smart_time_house_expenses` | `src/components/ExpensesView.tsx` |
| 15 | `smart_time_medical_expenses` | `src/components/ExpensesView.tsx` |
| 16 | `smart_time_permission_audit_logs_v1` | `src/services/permissionService.ts` |
| 17 | `smart_time_permissions_changed` | `src/components/AndroidStatusBar.tsx`; `src/components/PhonePermissionsManager.tsx`; `src/services/permissionService.ts` |
| 18 | `smart_time_permissions_v1` | `src/services/permissionService.ts` |
| 19 | `smart_time_personal_associations` | `src/components/ExpensesView.tsx` |
| 20 | `smart_time_personal_expenses` | `src/components/ExpensesView.tsx` |
| 21 | `smart_time_phone_contacts_v1` | `src/services/permissionService.ts` |
| 22 | `smart_time_quran_bookmarks` | `src/services/quranService.ts` |
| 23 | `smart_time_quran_last_stop` | `src/services/quranService.ts`; `src/services/repositories/religiousRepository.ts` |
| 24 | `smart_time_quran_wird` | `src/services/repositories/religiousRepository.ts` |
| 25 | `smart_time_student_expenses` | `src/components/ExpensesView.tsx` |
| 26 | `smart_time_surah_cache_` | `src/services/quranService.ts` |
| 27 | `smart_time_trip_home` | **also has direct `getItem` evidence; tracked as direct reader, not string-only** |
| 28 | `smart_time_trip_work` | **also has direct `getItem` evidence; tracked as direct reader, not string-only** |
| 29 | `smart_time_vehicle_fuel` | `src/components/ExpensesView.tsx` |
| 30 | `smart_time_vehicle_maint` | `src/components/ExpensesView.tsx` |
| 31 | `smart_time_vehicle_oil_filters` | `src/components/ExpensesView.tsx` |
| 32 | `smart_time_work_expenses` | `src/components/ExpensesView.tsx` |

### Normalized string-only count

The raw hidden-key list contains 36 keys. After removing the 5 direct-writer keys and the 2 direct-reader-only keys, the actual string-only classification is:

**29 keys.**

The table above intentionally shows the raw discovery references that need review; the two direct readers and the direct-writer key are excluded from the numerical string-only total.

## 7. Unknown sources — 0

Every one of the 36 hidden discovered keys is associated with one or more concrete source files in the scan output.

Therefore:

**Unknown sources = 0**

This does **not** mean that every literal represents a persistent storage owner. It means the scanner has source-file evidence for every discovered key.

## 8. Important reconciliation findings

### A. Registry count is 28, not 29

The discovery JSON reports:

`known_registry.key_count = 28`

and the actual `src/services/storageKeys.ts` contains 28 entries.

No change was made to the canonical registry.

### B. Hidden storage surface is materially larger than the registry

The scan found:

**36 hidden keys outside the canonical registry.**

These include finance-related names, dashboard state, permissions, phone/contact state, religious state, trip state, sports state, authentication/device state, and UI preferences.

### C. Hidden keys are not automatically migration candidates

The discovery map is evidence only. A literal reference is not proof that the key represents persistent domain data, and a key with direct storage access is not automatically a candidate for backend canonicalization.

Domain/schema decisions remain a later phase.

### D. Direct readers are kept separate

`smart_time_trip_home` and `smart_time_trip_work` are direct `getItem` references but not writers in the scan evidence. They are therefore tracked as **direct readers**, rather than incorrectly calling them writers or string-only references.

## 9. Phase 1 closure criteria

| Gate | Result |
|---|---|
| Repository scan completed | ✅ |
| 110 source files scanned | ✅ |
| Canonical registry compared | ✅ |
| Hidden keys enumerated | ✅ |
| Direct writers identified | ✅ |
| Adapter writers checked | ✅ — none found |
| String-only references identified | ✅ |
| Unknown source keys | ✅ — zero |
| `storageKeys.ts` modified | ❌ **No** |
| Central Schema started | ❌ **No** |
| Expense API started | ❌ **No** |
| Migration started | ❌ **No** |
| Scheduler started | ❌ **No** |
| Reconciliation documented | ✅ |

# 🔒 PHASE 1 — CLOSED

Phase 1 is formally closed based on the completed discovery output and reconciliation above.

**Next phase is not executed by this document.**

The repository is now ready for the separately gated **Phase 2 — Central Schema / DDL Source of Truth**, subject to the project's explicit phase-by-phase approval rule.
