# SMART TIME — Groq-First Egyptian Voice AI Execution Plan

Status: ACTIVE CANONICAL PLAN
Branch: `feat/v3-next`
Replaces: previous 35-phase execution sequence and the earlier 8-phase Groq draft.

## 0. Product objective

SMART AI is not a generic chatbot. The target is a voice-first Egyptian-Arabic assistant inside SMART TIME that can:

- understand Egyptian colloquial Arabic and Arabic/English code-switching;
- understand the structure, sections, fields and capabilities of SMART TIME;
- answer questions from authorized application data;
- generate grounded reports and summaries;
- fill data-entry forms from voice after the user selects the target section;
- execute only validated and authorized actions;
- speak the resulting answer using an Egyptian-capable TTS path.

The target voice loop is:

`Microphone -> Groq Whisper -> Egyptian Language/Behavior Layer -> SMART TIME Knowledge/RAG -> Groq LLM -> Structured Intent -> Validator/Policy -> Tools/Reports -> Verified Result -> Egyptian TTS -> Playback`

## 1. Critical model decision

The Kaggle-trained Qwen/LoRA model is NOT the free Groq production model.

It remains preserved as:
- research/evaluation asset;
- future self-hosted model;
- future provider candidate;
- benchmark/reference for Egyptian behavior.

The free/low-cost production strategy is:
1. Groq-hosted general LLM for inference;
2. Egyptian behavior layer using system instructions, few-shot examples, terminology/glossary, normalization and evaluation;
3. SMART TIME product knowledge and live application data supplied through RAG/tools;
4. deterministic business logic for calculations and mutations.

This is deliberate: Groq currently documents LoRA inference as an Enterprise-only capability, so the plan must not depend on uploading the Kaggle LoRA to a free/developer Groq account.

## 2. Cost rule

“Free” means using the currently available Groq free/developer quota, not unlimited free compute.

The application must therefore:
- track RPM/RPD/TPM and audio usage;
- bound retries/timeouts;
- avoid unnecessary context;
- cache safe reusable knowledge;
- rate-limit users;
- expose usage/error telemetry without sensitive content;
- keep a provider abstraction so a future paid/local provider can be added without redesign.

## 3. Canonical architecture

Browser/mobile
 -> Railway API
 -> authentication + authorization
 -> AI Provider Gateway
 -> Groq
 -> Egyptian behavior layer
 -> SMART TIME Product Knowledge / RAG / Memory
 -> structured intent
 -> schema + permission + confirmation policy
 -> Tool Registry / deterministic report engine
 -> authoritative read-back
 -> grounded response
 -> Egyptian-capable TTS
 -> playback

No model receives direct database access.
No free-text response is executable.
No mutation occurs before validation and policy checks.

## 4. Phase sequence

### A0 — Goal, Architecture & Asset Freeze — PASS
Lock the product goal, provider boundary and asset policy.

Closure:
- architecture docs agree;
- Qwen/LoRA/datasets are preserved;
- Groq secret is server-side;
- CI baseline is green.

### A1 — Groq Provider & Runtime — PASS
Server-side Groq gateway with health, model discovery, streaming, structured output and tool transport.

Closure:
- provider contract tests;
- Railway runtime evidence;
- error/timeout handling;
- CI green.

### A2 — Real Groq Whisper STT — IN PROGRESS
Target:
`MediaRecorder -> /api/ai/stt -> whisper-large-v3-turbo -> transcript`

Required:
- ar-EG language hint;
- Egyptian colloquial speech;
- code-switching;
- names/numbers/dates;
- authentication;
- MIME/size/duration limits;
- rate limits;
- no raw audio persistence by default;
- real microphone evidence.

Closure:
- all required runtime cases;
- security/privacy evidence;
- CI green.

### A3 — Egyptian Behavior + SMART TIME Product Knowledge — NOT STARTED
This is the key replacement for relying on a custom free fine-tune.

Build:
- Egyptian Arabic normalization;
- colloquial variants and common spelling variants;
- SMART TIME terminology/glossary;
- few-shot demonstrations;
- response-style contract;
- clarification rules;
- unsupported-intent boundaries;
- intent taxonomy;
- product ontology covering every supported SMART TIME section, field and operation;
- evaluation set for Egyptian language + product understanding.

Important:
The model should learn product behavior from controlled context, not from direct database exposure.

Closure:
- Egyptian language evaluation;
- product coverage evaluation;
- ambiguity/clarification tests;
- unsupported-action tests;
- no hallucinated section/field/tool names.

### A4 — Grounded RAG + Reports — NOT STARTED
Build the actual retrieval loop:

user question
 -> intent
 -> authorized retrieval
 -> provenance
 -> deterministic calculation/aggregation
 -> report object/artifact
 -> grounded natural-language/voice summary

Required:
- product knowledge registry;
- application-data retrieval;
- metadata filters;
- per-user isolation;
- provenance;
- empty-result handling;
- context budget;
- deterministic report calculations;
- report validation before success.

### A5 — Groq Reasoning + Structured Intent + Tools — NOT STARTED
Groq must produce a validated structured intent such as:

- ANSWER_QUERY
- SEARCH_DATA
- GENERATE_REPORT
- CREATE_RECORD
- UPDATE_RECORD
- DELETE_RECORD
- CLARIFY
- UNSUPPORTED

For data entry:

voice
 -> transcript
 -> intent
 -> selected section
 -> structured field draft
 -> schema validation
 -> permission
 -> confirmation when required
 -> executor
 -> authoritative read-back
 -> response

The model never writes directly to the database.

Closure:
- Arabic/English reasoning tests;
- malformed JSON/tool-call tests;
- authorization tests;
- confirmation-denial tests;
- mutation/read-back tests;
- CI green.

### A6 — Memory + Conversation Continuity — NOT STARTED
Separate:
- recent conversation;
- persistent memory;
- verified application state;
- verified tool results;
- retrieved knowledge.

Required:
- multi-turn context;
- user isolation;
- retention policy;
- stale/conflicting memory handling;
- no sensitive prompt leakage.

### A7 — Egyptian TTS + Full Voice E2E — NOT STARTED
The TTS requirement is specifically Egyptian Arabic.

Do NOT assume Groq Orpheus Arabic satisfies this: Groq currently documents its hosted Arabic Orpheus model as Saudi Arabic, not Egyptian.

Therefore TTS is a provider-independent slot:
- first choice: free/local Egyptian-capable TTS if quality is acceptable;
- optional paid provider later;
- Groq remains the STT/LLM inference provider.

E2E target:

`Microphone -> Groq STT -> Egyptian behavior -> RAG -> Groq LLM -> tool/report -> verified result -> Egyptian TTS -> playback`

Closure:
- real browser/mobile conversation;
- interruptions;
- duplicate/stale turn protection;
- provider failure;
- tool confirmation by voice;
- Egyptian TTS quality evaluation.

### A8 — Security + Cost + Observability + Regression — NOT STARTED
Required:
- secret isolation;
- auth/authorization;
- rate/payload limits;
- user isolation;
- raw-audio minimization;
- PII/data minimization;
- usage telemetry;
- RPM/RPD/TPM/ASH budget controls;
- timeout/retry limits;
- latency/failure dashboards;
- full regression CI;
- preserved-asset audit.

### A9 — Production Gate — NOT STARTED
Production is allowed only when A0-A8 are PASS.

Required evidence:
- all CI green;
- real voice E2E;
- Egyptian language gate;
- product knowledge gate;
- RAG gate;
- report gate;
- tool/action gate;
- security/privacy gate;
- cost/usage gate;
- no unresolved blocker;
- closure records complete.

## 5. Asset policy

KEEP:
- Qwen3-4B;
- LoRA adapters;
- Kaggle training outputs;
- datasets and provenance;
- evaluation scripts;
- notebooks/runbooks;
- existing Tool Registry/executors;
- canonical SMART TIME data layer;
- existing voice/TTS assets.

Do not use raw customer data as training data.

Do not delete the local model path merely because it is not the current production path.

## 6. Global definition of done

The project is not Production Ready until the assistant can demonstrate, with real evidence:

1. A user speaks Egyptian Arabic.
2. Groq Whisper produces the transcript.
3. SMART AI understands the Egyptian intent.
4. The system retrieves only authorized SMART TIME knowledge/data.
5. Groq produces a validated answer/report/action intent.
6. Tools execute only after policy/permission/confirmation rules.
7. The authoritative result is read back.
8. The answer is spoken through an Egyptian-capable TTS path.
9. The interaction survives interruption/failure cases.
10. CI, security, privacy, cost and regression gates all pass.

