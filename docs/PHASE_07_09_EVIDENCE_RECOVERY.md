# Phase 7–9 Evidence Recovery Update

Date: 2026-10-02

## Newly recovered authoritative evidence

### Training artifact

The historical model/data registry records a Kaggle diagnostic artifact:

- artifact ID: `adapter-v2-kaggle-20261001`
- base model: Qwen/Qwen3-4B
- method: SFT + LoRA
- dataset: `dataset-tool-v2-746`
- split: 596 train / 150 eval
- hardware: NVIDIA Tesla T4, FP16
- epochs: 2
- train loss: 0.2327
- eval loss: 0.12700095772743225
- artifact path: `/kaggle/working/smart-ai-v2-super.zip`

### Gate result

The same registry explicitly records:

`generation_gate.total = 120`
`generation_gate.passed = 0`
`generation_gate.rate = 0`

and:

`release_status = blocked_generation_gate`

Therefore this artifact is **not a release candidate and does not establish a Phase 7 PASS**.

### Dataset provenance

The 746-row structured dataset is independently recorded with:

- 746 unique inputs
- 596 training examples
- 150 evaluation examples
- blob SHA `f9d513485922ac4d9ade589e4be2fe2d53a50bb9`
- source commit `6620da09f9e4ad808be1bcf1dc9f4d83fedff4f3`

### Recovery snapshot

A pre-training recovery manifest dated 2026-09-30 records exact SHA-256 values for the then-current training datasets and training script, tied to commit `76a7a02994b0a97f3f4baa053ea3a7a8ee5b648c`.

## Consequence for Phase 7

Phase 7 cannot be closed merely by pointing to the adapter. The recovered evidence proves a real training run and a real failed generation gate.

**Historical recovery status:** HISTORICALLY EXECUTED / DIAGNOSTIC BASELINE; the final governance closure is recorded separately in `docs/phase7_closure_record.json`. The historical generation gate remains failed and the adapter remains unreleased.

## Consequence for Phase 8

Because the diagnostic artifact is explicitly marked blocked by the generation gate, it cannot be promoted as the archived releasable V1 artifact.

The artifact and its metadata should remain preserved as diagnostic evidence.

**Historical recovery status:** HISTORIC ARTIFACT PRESERVED / NOT RELEASED; the final governance closure is recorded separately in `docs/phase8_closure_record.json`, without fabricating the missing remote archive details.

## Consequence for Phase 9

The recovered registry explains the failed 120-case generation gate at a high level (0/120), but it does not contain the later corrected 113/120 evaluator output or the seven-case diagnosis.

The previously known 113/120 claim therefore remains a separate historical claim that is not independently recovered from the current Git evidence.

**Historical recovery status:** DIAGNOSIS CLAIM KNOWN / raw authoritative 113/120 export still unrecovered; the final diagnostic closure uses the recovered Run #3/Fix1 evidence and is recorded in `docs/phase9_closure_record.json`.

## Next recovery target

Recover the actual 120-case raw generation output and evaluator implementation/version used for the diagnostic run. Then determine whether the 113/120 correction can be reproduced from those raw outputs. Do not retrain before this recovery attempt is exhausted.

## Further forensic recovery — 2026-10-02

Additional Library evidence was inspected without training or generation:

1. The Run #3 diagnostic record is confirmed as the 0/120 generation gate run. Its metadata contains generated failures for indices 0–49, while the available pasted artifact is not a complete 120-row raw-output export. Therefore the complete raw 120 outputs are still not recovered.
2. A later Fix1 run is separately evidenced at the notebook level. The project records 119/120 (99.2%) on the general gate, with the remaining scope weakness documented as 14/32 on the unsupported subset and the example `delete_account` hallucination. This is a later corrective run, not the Run #3 Phase 9 gate.
3. The forensic notebook reconstructs the Run #3 → Fix1 patch and identifies the technical bug class as **training-text / completion-mask alignment**: the original path used different `add_generation_prompt` behavior for prompt-only versus with-answer construction; Fix1 normalizes the generation marker before target concatenation.
4. The same forensic decision explicitly keeps training/generation blocked and requires freezing script hash, dataset SHA-256, model revision, and runtime before any corrective training.

### Audit conclusion after this recovery

The historical chain is now materially better established:

`Run #3 (0/120) -> forensic root-cause analysis -> Fix1 -> later 119/120 baseline`

However, this still does **not** independently recover the claimed Phase 9 corrected `113/120` result or all seven diagnosed failures from an authoritative raw 120-case artifact. Phase 9 is **FORMALLY CLOSED DIAGNOSTICALLY** under the final closure record; the missing raw 113/120 export remains explicitly unknown and is not treated as active evidence.

No retraining was performed during this recovery. Any future training must pass the next phase's explicit training gate.
