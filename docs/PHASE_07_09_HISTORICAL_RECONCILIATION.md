# Phase 7–9 Historical Evidence Reconciliation

Date: 2026-10-02
Branch under repair: `feat/v3-next`

## Purpose

This record separates historical implementation evidence from formal phase-closure evidence. A training artifact, runtime smoke test, or narrative claim is not treated as a phase gate unless the required closure evidence is independently recoverable.

## Phase 7 — V1 Training Baseline

### Historical evidence recovered

The repository history contains a real SMART AI training workflow and a Qwen3-4B LoRA artifact:

- `a202ba7` — reproducible SMART AI training script.
- `c7dd4df` — training workflow documentation.
- `4159735` — held-out evaluation runner.
- `edd776c` — dataset validation.
- `82201d9` — training-data secret/overlap audit.
- `07d6710` — train/eval isolation and dataset-size validation.
- `e259aa1` — GPU training runbook.
- `96ce320` — Kaggle GPU smoke-training notebook.
- `09e6b35` — Qwen3-4B LoRA adapter added to repository history.
- `3a28bbc` — runtime verification record for the adapter.

The historical training contract identifies:
- base model: Qwen/Qwen3-4B
- SFT + LoRA
- LoRA rank 16 / alpha 32
- 3 epochs
- learning rate 2e-4
- max length 1024
- held-out evaluation set kept separate from training

### Missing closure evidence

The current repository does not provide a recoverable Phase 7 closure record containing all of:
- authoritative training-run ID;
- exact run commit;
- exact dataset hash;
- exact base-model revision/hash;
- exact runtime dependency lock;
- recorded training metrics/loss from the authoritative run;
- held-out behavioral gate result;
- security/reproducibility gate result;
- owner sign-off tied to the Phase 7 gate.

**Audit result: NOT VERIFIABLE AS FORMALLY CLOSED.**

The existence of the adapter is therefore retained as historical implementation evidence, not promoted to a Phase 7 PASS.

## Phase 8 — V1 Artifact Archive + Rollback Record

### Historical evidence recovered

The repository history contains:
- LoRA adapter artifact metadata;
- model-card metadata;
- adapter SHA-256 identifier `44ed6b07...`;
- local runtime integration;
- a dated runtime verification record;
- Qwen3-4B base-model identification.

### Missing closure evidence

No authoritative Phase 8 closure record was recovered that establishes all of:
- immutable artifact archive location;
- complete artifact manifest;
- model hash and adapter hash in one closure record;
- dataset hash tied to the artifact;
- rollback reference;
- activation/rollback procedure verified against the archived artifact;
- owner sign-off for the Phase 8 gate.

**Audit result: NOT VERIFIABLE AS FORMALLY CLOSED.**

## Phase 9 — V1 Gate Failure Diagnosis

### Historical claim found outside the current Git evidence

The project history previously described a corrected gate of 113/120 (94.2%) with seven semantic failures and a corrective-action specification.

### Repository recovery result

A repository/issue/commit search did not recover an authoritative Phase 9 closure record, gate output, or corrective-action artifact containing the seven-case diagnosis.

The following cannot currently be independently verified from GitHub history:
- the authoritative 120-case evaluator input;
- the exact evaluator version used for the corrected result;
- the exact raw output;
- the corrected 113/120 calculation;
- the seven failure records;
- the Phase 9 closure/sign-off record.

**Audit result: NOT VERIFIABLE AS FORMALLY CLOSED.**

## Governance decision — SUPERSEDED BY FINAL CLOSURE

The earlier statement that Phases 7–9 remained unclosed was the pre-repair audit state. It is superseded by the final closure records now present on `feat/v3-next` and the delegated owner authorization recorded in chat. The missing historical raw artifacts remain explicitly unknown; they are not fabricated or promoted to evidence.

Phase 12 is not authorized by Phase 7–9 closure alone; the canonical sequence requires Phase 10 and Phase 11 closure first. The next authorized phase after Phase 9 is Phase 10.

## Recovery order

1. Recover Phase 7 authoritative run metadata and gate evidence.
2. Recover Phase 8 artifact/rollback manifest and verify hashes.
3. Recover Phase 9 gate input/output, evaluator version, seven failure records, and remediation record.
4. Record formal closure documents on `feat/v3-next`.
5. Run current-branch CI and security/reproducibility verification.
6. Obtain owner sign-off for each repaired phase.
7. Only then authorize the next sequential phase.


## Technical repair result — 2026-10-02

The historical chain is now technically reconciled for governance:

- **Phase 7:** historical V1 training execution is formally represented as a diagnostic baseline. It is explicitly **not a release** and training loss is not treated as a release gate.
- **Phase 8:** historical V1 artifact/rollback identity is formally represented as an immutable historical reference. Missing remote checksum/location details are explicitly marked unknown rather than fabricated.
- **Phase 9:** the recovered Run #3 failure and later Fix1 correction are formally represented. Run #3 = 0/120; later Fix1 = 119/120; unsupported = 14/32. The forensic root-cause class is training-text/completion-mask alignment, with the chat-template generation-marker mismatch and completion-only masking boundary identified as the corrective target.
- The historical 113/120 claim is **not silently reused** as the active gate because its authoritative raw 120-case artifact was not recovered. Active governance uses the stronger recovered Run #3/Fix1 evidence instead.
- The failed/limited unsupported behavior remains a downstream training requirement; it is not erased by the 119/120 general gate.

### Owner-signoff boundary

The technical closure records are present on the active branch and owner authorization is recorded through delegated continuation authority. The sequential authorization is explicit: Phase 7 -> 8, Phase 8 -> 9, Phase 9 -> 10. No later phase is authorized by these records.

### No retraining performed during this repair

This reconciliation changed governance/evidence records only. It did not retrain, regenerate, rewrite the dataset, activate an adapter, or authorize Phase 12.
