# SMART TIME — Plan 35 Replacement: Groq-First AI Architecture

Status: SUPERSEDED — HISTORICAL REFERENCE

The active execution plan is `docs/AI_EXECUTION_PLAN_GROQ.md`. The old 35.x sequence is retained only for traceability and asset disposition; its phase numbering is no longer authoritative.
Branch: `feat/v3-next`
Decision: Replace the old Plan 35 execution architecture with a Groq-first production path while preserving all historical training/model/dataset assets.

## 1. Non-negotiable decisions

1. Groq API is the primary production AI provider for the new path.
2. The application must use a provider abstraction; Groq must not be hard-coded throughout UI/business logic.
3. The existing Qwen3-4B + LoRA work is preserved as a historical/experimental asset and future fallback/research option. It is not the production model for the new path unless a later release gate explicitly promotes it.
4. Existing training datasets, provenance records, evaluation sets, model artifacts, adapters, notebooks, and training runbooks remain preserved.
5. No raw customer/user data is added to training.
6. No phase is considered closed until implementation, automated verification, runtime verification where applicable, security/reproducibility evidence, and CI pass.
7. Phase N+1 cannot start until Phase N is explicitly closed.

## 2. Current-state gap analysis

| Area | Current repository state | New Plan 35 state | Action |
|---|---|---|---|
| Primary LLM | Local Qwen/vLLM path via SMART_AI_LOCAL_URL | Groq API | Replace production routing |
| Local trained model | Qwen3-4B + LoRA artifacts exist | Historical/experimental asset | Preserve, registry + archive only |
| Training datasets | Multiple JSONL datasets + provenance | Preserved research/evaluation assets | Keep immutable |
| STT | Browser Web Speech API in voice search | Groq Whisper STT server-side | Rework production STT |
| AI Gateway | Local inference assumptions in API routes | Provider-neutral gateway with Groq adapter | Re-architect |
| RAG | Chroma path/config exists but not a complete production retrieval loop | First-class retrieval layer | Implement + verify |
| Tools | Typed tool registry/executors already exist | Keep and connect to Groq tool calling | Integrate, do not rewrite blindly |
| Memory | Context/memory modules exist | Retrieval-aware context layer | Harden and connect to provider |
| TTS | Egyptian built-in/VoiceTuT + Voice DNA work exists | Provider abstraction after response | Preserve and integrate |
| Voice E2E | Real STT/voice work exists but Phase 12 has remaining closure evidence | STT -> Groq -> RAG/Tools -> TTS | Re-test end-to-end |
| CI | Many phase-specific workflows | One coherent Groq architecture gate + regression gates | Add/adjust verification |
| Secrets | .env pattern exists | GROQ_API_KEY server-side only | Add secret contract; never expose client-side |

## 3. Replacement phase sequence

### Phase 35.0 — Architecture Freeze & Asset Preservation
Goal: freeze the new architecture and prove nothing valuable is lost.

Gates:
- Groq-first topology documented.
- Provider interface defined.
- Historical Qwen/LoRA assets and dataset provenance inventoried.
- No training artifacts deleted.
- No raw user audio committed.
- CI baseline green.

Output:
- `docs/PLAN_35_GROQ_REBASE.md`
- asset registry/update record
- architecture decision record

### Phase 35.1 — Provider/Gateway Foundation
Goal: introduce a single server-side AI provider boundary.

Required:
- `AIProvider` interface for chat, streaming, structured output, health, and model metadata.
- Groq provider implementation.
- server-only `GROQ_API_KEY`.
- bounded timeout/retry/error taxonomy.
- no provider key in browser bundle.
- explicit degraded mode only when intentionally configured.

Gate:
- unit tests for success, timeout, auth failure, rate limit, malformed response.
- secret scan.
- build/lint/CI pass.

### Phase 35.2 — Groq Model + Structured Output Contract
Goal: make Groq the production reasoning model path.

Required:
- select a currently supported Groq model through configuration, not hard-coded UI logic.
- structured JSON/tool-call validation remains application-owned.
- preserve SMART TIME schemas and confirmation boundaries.
- provider response metadata recorded without leaking secrets.
- no free-text action execution.

Gate:
- structured-output tests.
- invalid JSON recovery.
- tool argument validation.
- confirmation boundary tests.
- provider health test.

### Phase 35.3 — Real STT with Groq
Goal: replace production dependence on browser Web Speech recognition.

Required:
- microphone capture remains client-side.
- audio sent to authenticated server endpoint.
- server calls Groq Whisper STT.
- primary locale `ar-EG`.
- support Egyptian Arabic, code-switching, numbers/dates.
- no fabricated transcript.
- raw audio is not persisted by application unless an explicit future policy authorizes it.
- browser STT may remain only as an explicitly labeled fallback, not the primary architecture.

Gate:
- real microphone test.
- the five user recordings remain external evidence only.
- transcript/audio pairing and privacy evidence.
- provider failure and permission denial behavior.
- CI/static contract.

### Phase 35.4 — Context + RAG / Knowledge Layer
Goal: establish retrieval as a first-class step before reasoning.

Pipeline:
STT/text -> normalize -> retrieve relevant knowledge/app context -> provider.

Required:
- source registry and provenance.
- chunking/indexing strategy.
- Chroma or replacement vector store behind an interface.
- metadata filters.
- retrieval limits.
- citation/source identifiers where applicable.
- no retrieval result is treated as a fact without source evidence.

Gate:
- deterministic retrieval tests.
- empty/no-match tests.
- stale/conflicting source handling.
- privacy boundary tests.

### Phase 35.5 — Tools & Actions Integration
Goal: connect Groq tool calling to existing verified SMART TIME tools.

Pipeline:
understand -> plan/tool call -> validate -> permission -> confirmation -> execute -> verify -> respond.

Required:
- reuse existing Tool Registry/Executor.
- strict schemas.
- read vs mutation separation.
- confirmation for mutations.
- idempotency where applicable.
- backend verification before success response.

Gate:
- finance/calendar/task representative cases.
- invalid arguments.
- unauthorized action.
- confirmation denial.
- execution failure.
- persistence verification.

### Phase 35.6 — Memory + Conversation Continuity
Goal: make memory retrieval provider-independent.

Required:
- recent conversation context.
- persistent memory.
- application state.
- tool results.
- retrieval budget.
- memory write/update policy.
- no sensitive data leakage into prompts.

Gate:
- multi-turn tests.
- stale memory test.
- conflicting memory test.
- per-user isolation.

### Phase 35.7 — TTS + Voice E2E
Goal: complete the production voice loop.

Target:
Microphone -> Groq STT -> RAG/Knowledge -> Groq reasoning/tool calls -> verified action/result -> Egyptian TTS -> playback.

Required:
- retain current Egyptian TTS/VoiceTuT assets and provider contracts.
- Voice DNA remains optional personalization.
- turn-taking/interruption guards.
- no duplicate microphone reopening.
- playback completion before next turn where required.

Gate:
- real browser/mobile voice conversation.
- interruption test.
- STT failure.
- Groq failure.
- TTS failure.
- tool confirmation in voice.
- end-to-end evidence.

### Phase 35.8 — Security, Privacy & Cost Controls
Goal: production safety around a third-party inference API.

Required:
- API key server-only.
- request-size limits.
- rate limiting.
- abuse/error handling.
- PII/data-minimization policy.
- no raw audio persistence by default.
- provider usage/cost telemetry without sensitive content.
- free-tier assumptions documented as limits, not guarantees.

Gate:
- secret scan.
- auth tests.
- rate-limit tests.
- payload abuse tests.
- privacy audit.
- provider outage behavior.

### Phase 35.9 — Regression + Performance + Observability
Goal: prove the new path did not break completed application work.

Required:
- all prior phase verification workflows remain green unless intentionally superseded.
- AI latency/error telemetry.
- provider/model metadata.
- bounded retries.
- health/readiness checks.
- regression suite across existing SMART TIME features.

Gate:
- full CI.
- representative E2E.
- failure injection.
- performance baseline.

### Phase 35.10 — Release Candidate / Production Gate
Goal: final release decision for Groq-first architecture.

Required:
- all Plan 35 replacement phases closed.
- no unresolved blocker.
- Qwen/LoRA and datasets preserved and registry-consistent.
- Groq production path verified.
- STT -> RAG -> Tools -> TTS E2E verified.
- owner sign-off recorded.

Only then:
- authorize production activation.
- keep historical training path disabled by default.

## 4. Asset disposition

### KEEP — never delete
- `backend/ai/training/**`
- `infra/smart-ai/training/**`
- `infra/smart-ai/training/output/**`
- `artifacts/training/**`
- Qwen/LoRA adapter metadata and evaluation artifacts
- existing tool ontology and structured-output schemas
- existing TTS/VoiceTuT assets
- user-provided audio evidence metadata (not raw audio)

### REUSE
- Tool Registry and executors
- application context
- memory/context modules
- canonical data layer
- TTS provider contracts
- existing CI/regression checks
- corpus verification infrastructure

### REFACTOR / REPLACE IN PRODUCTION PATH
- `backend/ai/inference/localInference.ts`
- local-Qwen-first routing in `app/api/ai/infer/route.ts`
- browser Web Speech as the primary STT path
- architecture docs that state LocalQwen is the current production provider

### DO NOT DELETE
Local Qwen code may remain as an isolated experimental/provider implementation until a later explicit cleanup decision. It must not silently remain the production default.

## 5. Provider policy

Groq is the selected primary provider for this replacement architecture. Groq currently exposes OpenAI-compatible APIs, chat completions, Responses API/function calling, and Whisper-based speech-to-text. The project must still treat availability/free-tier capacity as a bounded external dependency rather than an unlimited production guarantee.

## 6. Definition of done

Plan 35 replacement is closed only when:
- every phase 35.0 through 35.10 is PASS;
- all relevant CI workflows are green on the final commit;
- no unresolved security/privacy/reproducibility blocker exists;
- real voice E2E evidence exists;
- historical model and datasets remain intact;
- owner sign-off is recorded;
- production routing is Groq-first;
- Phase 13 or any successor phase is not authorized prematurely.

## 7. Immediate next step

Do not continue the old Plan 35 sequence.

First implement and verify Phase 35.0 (Architecture Freeze & Asset Preservation), then proceed sequentially. Phase 35.1 cannot start until 35.0 is closed.
