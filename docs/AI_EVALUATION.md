# SMART-TIME V3 Next — AI Evaluation Plan

## Existing evaluation foundation

Current repository:
- 60 SFT V2 records
- 22 held-out V1 evaluation records
- 66 grounded V3 records
- evaluation scripts v1/v2/v3

Existing evaluation topics include:
- numerical grounding
- no fabricated records
- confirmation before writes/deletes
- secret protection
- live-data routing
- Egyptian Arabic style

## Next evaluation suite

Create a versioned evaluation set with at least these categories:

1. Egyptian Arabic conversation
2. simple factual app questions
3. expense/task mutations
4. multi-step tool use
5. tool argument validation
6. confirmation/destructive actions
7. attachment understanding
8. PDF/DOCX/XLSX generation
9. structured chart/SVG generation
10. CAD specification generation
11. CAD validation/recovery
12. STT transcript robustness
13. TTS response pipeline
14. context/memory handling
15. refusal of unsupported claims
16. recovery from tool errors

## Required evidence gates

- model health
- /v1/models HTTP 200
- /v1/chat/completions HTTP 200
- streaming parser/unit test
- live GPU streaming endpoint
- structured tool-call validity
- verified DB mutation
- file creation + read-back
- CAD parse-back
- STT real microphone test
- TTS real playback test
- mobile interaction test
- security tests
- CI lint/typecheck/test/build

Never mark a gate PASS without test evidence.

## Training policy

Do not retrain merely because the current UI is weak.

First benchmark the existing Qwen3-4B + LoRA.
Collect failure cases from the agent evaluation.
Then perform targeted QLoRA only if the benchmark shows model-level failures that cannot be solved cleanly by orchestration/tools.

Compare:
- base model
- current adapter
- candidate adapter

Keep the current adapter until the candidate wins the agreed objective metrics.

## Gate 4G — behavioral validation

Gate 4G benchmarks the current Qwen3-4B + LoRA before any new training.

Versioned suite:
- `backend/ai/training/smart-time-eval-v4g.jsonl`
- `infra/smart-ai/training/evaluate_smart_ai_v4g.py`
- `scripts/score-smart-ai-eval-v4g.mjs`

The model must return a strict structured proposal:
`intent + tool + arguments + requiresConfirmation`.

Coverage:
1. Egyptian Arabic conversation
2. SMART-TIME intent recognition
3. structured expense/task/reminder actions
4. confirmation/destructive-action boundaries
5. file-analysis intent
6. web-research intent
7. clarification/context handling
8. secret protection
9. no-fabrication grounding
10. English routing

Gate 4G is PASS only when at least 80% of cases satisfy all required structural checks. A generated proposal is never execution evidence.

Run on the validated GPU environment:

```bash
python infra/smart-ai/training/evaluate_smart_ai_v4g.py
node scripts/score-smart-ai-eval-v4g.mjs
```

Do not retrain from Gate 4G failures alone. Classify failures first; orchestration/tool/runtime fixes take precedence over QLoRA.

## Phase 10 — canonical Voice-First contract

Phase 10 is governed by:
- `docs/VOICE_FIRST_ARCHITECTURE.md`
- `infra/smart-ai/training/phase10-training-manifest.json`
- `scripts/verify-phase10-architecture.mjs`

The canonical runtime order is:

```
Voice Capture
-> STT / ASR
-> Transcript
-> SMART AI Orchestrator
-> Intent / Action Proposal
-> Policy + Schema Validator
-> Central Tool Registry / Agent Router
-> Tool / Service
-> Read-back Verification
-> SMART AI Response
-> TTS / Voice Output
-> User
```

The canonical evaluation order follows the same trust boundaries:

```
model health
-> STT correctness
-> intent preservation
-> structured proposal validity
-> policy/schema validation
-> confirmation
-> execution
-> read-back verification
-> grounded response
-> TTS
-> playback
-> E2E latency/error
-> security/privacy
-> reproducibility
```

Phase 10 does not authorize a new training run. The pre-run manifest intentionally blocks reproducible training until concrete model revision, dataset hashes, and artifact/rollback evidence are recorded.

## Canonical 35-phase execution order

The audited SMART-TIME plan is now the canonical execution order.

1. Requirements + Traceability + Test Matrix
2. Database + Migration Integrity
3. Real Backend API
4. Historical Dataset Provenance
5. Model/Data/Version Registry + Objective Metrics
6. Training Runtime + Reproducibility
7. V1 Training Baseline
8. V1 Artifact Archive + Rollback Record
9. V1 Gate Failure Diagnosis
10. Voice-First Architecture + Execution Order
11. Voice Foundation — Shubra Voice Specification
12. Real STT + ASR Corpus
13. Real TTS / Voice Output Provider
14. Voice Foundation E2E Gate
15. Product Knowledge Dataset + Coverage Matrix
16. Product Knowledge RAG + Source of Truth
17. Product Knowledge Gate
18. Egyptian/Shubra Text + ASR Error Corpus
19. Egyptian/Shubra Language & Behavior Training
20. Egyptian/Shubra Gate
21. Conversation + General Behavior Dataset
22. Conversation + Behavior Training
23. Conversation + Behavior + Memory Gate
24. Final Structured Tool Dataset + Scope/Confirmation Augmentation
25. Final Structured Tool Training
26. Final Structured / Adversarial Gate
27. AI Gateway + Provider Abstraction + Private GPU Inference
28. Mode Router + Smart AI Orchestrator
29. Central Tool Registry + Policy + Schema Validator
30. General Agent Loop + Web + Execute -> Verify -> Feed-back
31. Streaming UI + Attachments/File Ingestion + Artifacts/Storage
32. Memory + Product/User RAG Integration
33. Full Voice + Smart AI + Tools E2E + Security/Performance/Mobile
34. Production Deployment + Beta + Monitoring + Rollback
35. Post-Beta Improvement Loop + V2.x/V3 Dataset Refresh

### Sequential closure rule

A phase may have future dependencies defined in planning documents, but Phase N+1 must not start before Phase N is formally closed.

A phase is formally closed only when its implementation, tests, behavioral/real-output evidence, security checks, reproducibility evidence, and owner sign-off are all PASS.

The canonical phase requirements and traceability record are maintained in:
`docs/PHASE_01_REQUIREMENTS_TRACEABILITY.md`

Do not retrain from an evaluation failure alone. Classify failures first and prefer orchestration/tool/runtime fixes when the failure is not model-level.

CAD/DWG remains out of SMART-TIME scope.
