# SMART-TIME Phase 1 — Requirements, Traceability & Test Matrix

Status: FORMALLY_CLOSED
Closure gate: PASS
Owner sign-off: APPROVED
Branch: `phase/01-requirements-traceability`
Baseline: `feat/v3-next@731d7b25ecda61aae2f012545ceb51025a6cba85`
Date: 2026-10-01

## 1. Purpose

Phase 1 freezes the product/AI requirements before implementation continues.

A requirement is considered frozen only when:
1. its expected behavior is explicit;
2. its scope boundary is explicit;
3. its acceptance evidence is defined;
4. it is mapped to one or more execution phases;
5. the authoritative repository source is identified.

Phase 1 does not claim that future capabilities are already implemented. It makes their target behavior and closure evidence unambiguous.

## 2. Canonical target architecture

The repository's target path is:

Mobile/Web UI
-> Railway SMART-TIME API
-> AI Orchestrator
-> authenticated private GPU inference
-> Qwen3-4B + LoRA + vLLM
-> structured tool calls
-> Tool Registry / Executor
-> validated artifacts / application data
-> streamed response to UI

The AI provider boundary must support:
- chat
- streamChat
- generateStructured
- health
- models

Reference:
https://github.com/msm147852/SMART-TIME-/blob/feat/v3-next/docs/AI_ARCHITECTURE.md

## 3. Scope boundaries

### In scope
- Egyptian-Arabic AI interaction with ar-EG voice support.
- Structured tool proposals and strict validation before execution.
- Per-user authorization and confirmation for destructive actions.
- Real STT -> AI -> TTS voice path.
- Product Knowledge as a source-of-truth retrieval layer.
- Conversation/context/memory separation.
- File ingestion and validated artifacts.
- Private/authenticated GPU inference.
- Streaming response delivery.
- Objective evaluation, regression testing, deployment evidence and rollback.

### Explicitly out of scope for SMART-TIME
Professional CAD/DWG generation is not a Phase 1 product requirement. The current evaluation document explicitly keeps CAD/DWG out of SMART-TIME scope.

Reference:
https://github.com/msm147852/SMART-TIME-/blob/feat/v3-next/docs/AI_EVALUATION.md

## 4. Frozen requirements

| ID | Requirement | Acceptance behavior | Planned phase(s) | Primary evidence |
|---|---|---|---|---|
| R-01 | Unified AI entry path | UI requests enter the SMART-TIME API and are routed through the AI layer without bypassing authorization. | 3,27,28 | API/orchestrator E2E |
| R-02 | Provider abstraction | Application code depends on AIProvider capabilities: chat, streamChat, generateStructured, health, models. | 27 | contract tests |
| R-03 | Structured proposal contract | Model output is machine-validated before any tool execution; unknown/invalid schema is rejected. | 24-26,29 | strict schema/adversarial gate |
| R-04 | Tool execution isolation | The model proposes actions; application executors perform DB/integration changes. The model never writes directly to DB. | 28-30,33 | architecture + E2E |
| R-05 | Confirmation and authorization | Destructive/privileged mutations require policy checks and confirmation before execution. | 24,29,30,33 | adversarial + E2E |
| R-06 | Verified data mutation | Successful finance/task mutations require application-side verification/read-back evidence. | 2,3,29,30,33 | DB read-back tests |
| R-07 | Memory separation | Recent conversation, summaries, preferences, app state and tool results remain separate from model weights. | 21-23,32 | memory/regression tests |
| R-08 | Product Knowledge source of truth | Product answers use a versioned, traceable knowledge source with stale/freshness handling. | 15-17,32 | retrieval/quiz gate |
| R-09 | Real STT | Voice input uses a real microphone -> STT path, not simulated/hard-coded transcript behavior. | 11-14,18-20,33 | real microphone test |
| R-10 | TTS response path | AI responses can reach a real TTS provider or documented browser fallback with health/latency evidence. | 11-14,33 | playback test |
| R-11 | Egyptian Arabic robustness | Text and voice inputs remain stable under Egyptian-Arabic wording and ASR error conditions. | 18-20,33 | held-out dialect + ASR gate |
| R-12 | Conversation behavior | Multi-turn correction, ambiguity, contradiction, memory cues and unsupported requests are evaluated explicitly. | 21-23 | behavior gate |
| R-13 | File/attachment safety | Uploaded files are type/size validated, processed in isolation, and cannot trigger arbitrary code execution. | 31,33 | security + ingestion tests |
| R-14 | Artifact contract | Generated artifacts have deterministic generation, validation, storage metadata and authorized download. | 31,33 | create/read-back + storage tests |
| R-15 | Streaming UX | The application exposes real streamed AI output to the UI; server-side SSE parsing alone is insufficient. | 27,31,33 | UI streaming E2E |
| R-16 | Private GPU runtime | GPU inference is externally hosted, private/authenticated, model-addressable and supports /v1/models, chat/completions and streaming. | 6,27,33,34 | runtime health + HTTP evidence |
| R-17 | Objective evaluation | Every releasable model/runtime candidate has versioned held-out evaluation, explicit thresholds and regression evidence. | 5,24-26,33-35 | eval reports |
| R-18 | Reproducibility and rollback | Model/data/adapter/runtime artifacts have version/hash/checksum/location metadata sufficient to reproduce or roll back a release. | 5,6,34,35 | manifest + checksum + rollback record |
| R-19 | Release governance | No phase N+1 begins until phase N has passed implementation, tests, behavioral/real-output, security, reproducibility and sign-off gates. | 1-35 | phase gate record |

## 5. Requirement traceability to canonical repository sources

| Source | Role in requirements |
|---|---|
| docs/AI_ARCHITECTURE.md | canonical architecture, provider boundary, agent loop, artifacts, voice, memory, security |
| docs/AI_EVALUATION.md | evaluation policy, Gate 4G, training policy, required evidence |
| docs/AI_DEPLOYMENT.md | Railway/GPU/provider/API/security/deployment progression |\n\nhttps://github.com/msm147852/SMART-TIME-/blob/feat/v3-next/docs/AI_DEPLOYMENT.md
| docs/CURRENT_STATE.md | implementation baseline and known gaps |
| backend/ai/localInference.ts | current local inference/provider boundary and SSE implementation |
| backend/ai/openMindBrain.ts | current deterministic planning/runtime baseline |
| backend/ai/toolExecutor.ts | current typed execution/verification baseline |
| backend/ai/smart-ai-tool/contextMemory.ts | current memory/context baseline |
| src/components/AiCenterView.tsx | current AI UI behavior |
| src/components/VoiceSearchModal.tsx | current simulated voice-recognition gap |
| package.json | current lint/test/build entry points |

## 6. Canonical phase execution order

The 35-phase plan is the execution order. The previous documentation contained a different "next execution order"; that ambiguity is removed by making the following sequence canonical:

1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10
-> 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20
-> 21 -> 22 -> 23 -> 24 -> 25 -> 26 -> 27 -> 28 -> 29 -> 30
-> 31 -> 32 -> 33 -> 34 -> 35

Rule: a phase may have future dependencies defined in this document, but it does not start before the immediately preceding phase is formally closed.

## 7. Phase 1 closure gates

Phase 1 passes only when all are true:

- Requirements are frozen in this document.
- Every frozen requirement has a phase mapping and acceptance evidence.
- Scope boundaries are explicit.
- The canonical execution order is unambiguous across planning/evaluation documentation.
- The automated Phase 1 document check passes.
- Repository CI for the Phase 1 branch passes: lint, current Open Mind tests, build.
- No critical Phase 1 requirement is marked TBD/TODO.
- Owner sign-off is recorded.

## 8. Non-goals of Phase 1

Phase 1 does not close any implementation-heavy future phase.
In particular, it does not claim:
- real STT is connected;
- production TTS is connected;
- Product Knowledge RAG is implemented;
- the final structured gate passed;
- private GPU deployment is production-ready;
- the full agent loop exists;
- attachments/artifacts are production-ready.

## 8. Phase 1 test matrix

| Test ID | Check | Command/evidence | Pass condition | Gate role |
|---|---|---|---|---|
| TM-01 | Requirements document integrity | `node scripts/verify-phase1-requirements.mjs` | Phase 1 requirements, traceability, scope and sequential rule all detected; no TBD/TODO markers. | Required |
| TM-02 | Type safety | `npm run lint` | TypeScript exits 0. | Required |
| TM-03 | Existing AI behavior regression | `npm run test:open-mind` | Existing Open Mind unit/E2E tests exit 0. | Required |
| TM-04 | Application build | `npm run build` | Vite + server build exits 0. | Required |
| TM-05 | CI reproducibility | GitHub Actions on Phase 1 branch | Same gate commands pass on clean Ubuntu/Node 22 runner. | Required |
| TM-06 | Requirements-to-plan traceability | This document + audited 35-phase plan | Every frozen requirement maps to explicit phase(s) and evidence. | Required |
| TM-07 | Architecture-order consistency | `docs/AI_EVALUATION.md` vs this document | Canonical order is identical and no competing next-order remains. | Required |
| TM-08 | Owner sign-off | Section 9 sign-off record | Owner explicitly records PASS and date. | Required |

A green build or test suite does not close the phase by itself. Phase 1 closes only when TM-01 through TM-08 are all PASS.

## 9. Sign-off record

Owner: user (explicit continuation approval in conversation)
Decision: PASS — Phase 1 closure authorized by the user's explicit "كمل" instruction after all automated Phase 1 checks passed.
Date: 2026-10-01
Evidence:
- Requirements gate: PASS
- TypeScript lint: PASS
- Open Mind unit/E2E tests: PASS
- Production build: PASS
- CI workflow: PASS
Notes: Phase 2 may start; no later phase is authorized by this sign-off.
