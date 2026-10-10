# SMART-TIME AI CORE V1

## Scope
SMART-TIME is a productivity-first AI application. CAD/DWG/BIM and engineering-domain execution are explicitly out of scope for SMART-TIME and belong to the separate SMART ENGINEERING AI product.

## Supported AI domains
- Egyptian Arabic and English conversation
- Multi-turn context
- User and task memory
- Tasks, events and reminders
- PDF, DOCX, XLSX and CSV files
- Data analysis and report generation
- Web research where enabled
- Tool calling and agent planning
- Artifact generation
- Runtime validation and verification
- Voice integration

## Non-goals
- CAD/DWG authoring or engineering design
- BIM/MEP/structural engineering engines
- Engineering rule compliance claims
- Treating generated text as proof that an action executed

## Runtime authority
The model proposes intent, plans and tool calls. Runtime code is authoritative for:
1. permissions
2. temporal normalization
3. tool argument validation
4. execution
5. verification
6. artifact existence and validity

The model must never be treated as evidence that an operation succeeded.

## AI flow

User message
-> Context assembly
-> Local model
-> Structured intent/tool proposal
-> Runtime validation
-> Tool execution
-> Verification
-> Context/memory update
-> Final response

## Tool contract
Every production tool must expose:
- stable name
- description
- argument schema
- permission requirement
- confirmation policy
- executor
- validator
- verifier

Tools that do not yet have a real executor must not be advertised as executable by the production agent.

## Context contract
Context is explicit and bounded. It may include:
- conversation messages
- active task/event
- relevant memories
- selected files/artifacts
- recent tool results
- current date/time/timezone

Temporal values must be normalized by runtime using authoritative application context.

## Memory contract
Memory is not the raw conversation transcript. Memory entries must have:
- id
- type
- content
- source
- createdAt
- relevance metadata
- optional expiration
- sensitivity classification

Only approved memory types may be persisted.

## Artifact contract
An artifact is only reported as created after the runtime confirms its file exists and passes the relevant validation.

## Evaluation gates
Core gates:
- language/context
- intent
- structured output
- tool selection
- arguments
- temporal grounding
- permission/confirmation
- execution contract
- verification
- artifact validity
- regression

## Engineering separation
SMART ENGINEERING AI is a separate product. Shared infrastructure may later be extracted into reusable packages, but SMART-TIME must not acquire CAD/DWG/engineering runtime dependencies.
