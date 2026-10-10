# SMART TIME — Context & Memory Core V1

## Purpose

This layer gives SMART AI a persistent, structured context without treating the raw chat transcript as long-term memory.

## Runtime sources

1. SQLite conversation messages (`messages`) for recent conversation context.
2. SQLite `ai_memories` for explicit structured memories.
3. SQLite `ai_context_summaries` for compact conversation summaries.
4. Runtime date/time/timezone supplied by the request.
5. Active task/file identifiers supplied by the request.

## Memory contract

A memory contains: `id`, `userId`, `type`, `content`, `source`, `createdAt`, optional `expiresAt`, `sensitivity`, and `relevance`.

Memory is not inferred from arbitrary transcript text in this phase. Later memory extraction must be explicit, validated, and auditable.

## Model context

The local model receives recent conversation turns (bounded), relevant memories (bounded), SMART TIME canonical app data, and runtime date/time context. Secrets and sensitive vault data are excluded.

The model is not authoritative for execution, permissions, dates, or database state.

## Current implementation

- `backend/ai/smart-ai-tool/contextMemory.ts`
- `backend/ai/openMindBrain.ts`
- `backend/ai/localInference.ts`
- `backend/ai/types.ts`

## Current canonicalization status

- Tasks are canonical in SQLite `ai_tasks`, with verified backend CRUD and one-time import support.
- Expenses/budget have verified SQLite executors; HTTP exposure remains a separate integration step.
- Calendar events are modeled separately in SQLite `ai_events`; events must not be conflated with tasks.
- Reminder behavior is represented as explicit event/task fields and must be enforced by runtime scheduling rather than by model text.

## Next gates

1. Expose verified calendar event CRUD through authenticated backend routes.
2. Add canonical frontend event hydration and migration without reintroducing a competing localStorage source of truth.
3. Add reminder scheduling/runtime delivery with timezone-aware temporal validation.
4. Finish the expense/budget HTTP integration and then run a repository-wide source-of-truth audit.


## Canonical Calendar Runtime Status

The calendar foundation is now backed by the authenticated SQLite `ai_events` store.

Implemented in `feat/v3-next`:
- verified event create/update/delete/list executor with per-user ownership checks;
- ISO timestamp validation and IANA timezone validation;
- event category, reminder, and recurrence payload validation;
- authenticated REST endpoints under `/api/ai/events`;
- canonical event state included in `/api/ai/state`;
- client API helpers for canonical event CRUD;
- durable one-time reminder queue in `ai_event_reminders`;
- authenticated pending-reminder and acknowledgement endpoints;
- a backend reminder poller running every 15 seconds.

Reminder scheduler boundary:
- the durable scheduler currently materializes **non-recurring** event reminders;
- recurring-event occurrence expansion is intentionally a separate gate so recurrence semantics are not guessed or executed by model text;
- client notification delivery/OS notification integration remains a frontend gate.

Next context/memory gates:
1. connect an actual calendar UI/state layer to the canonical event API;
2. finish recurring reminder occurrence generation with timezone-aware rules;
3. wire browser/device notification delivery and acknowledgement;
4. complete expense/budget canonical HTTP mutation paths;
5. run repository-wide source-of-truth audit.
