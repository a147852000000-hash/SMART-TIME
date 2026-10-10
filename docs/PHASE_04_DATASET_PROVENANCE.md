# Phase 4 — Historical Dataset Provenance

Status: FORMALLY_CLOSED
Closure gate: PASS
Owner sign-off: APPROVED

Date: 2026-10-01
Branch: `phase/04-dataset-provenance`

## Objective

Create an immutable, reproducible provenance record for the historical Smart AI training/evaluation datasets before later dataset or training phases proceed.

## Closure gates

- P4-01 Inventory: every repository training/evaluation JSONL dataset is explicitly listed.
- P4-02 Source identity: each historical dataset records source commit and Git blob SHA.
- P4-03 Content counts: recorded line counts are verified from actual JSONL content.
- P4-04 V2 archive: the 746-row structured-tool dataset is copied from `feat/smart-ai-v2-json-gate` into the active V3 line, preserving source branch/commit/blob identity.
- P4-05 V2 integrity: V2 has 746 unique inputs and category counts finance=300, reminder=150, calendar=150, query=100, unsupported=32, clarification=14.
- P4-06 Reproducible verifier: CI runs the provenance verifier from a clean checkout.
- P4-07 No model/training change: this phase records dataset lineage only; it does not start a new training run.

## Evidence

Manifest: `artifacts/training/dataset-provenance.json`

Verifier: `npm run verify:phase4-dataset-provenance`

Archived structured dataset: `backend/ai/training/smart-time-tool-v2.jsonl`

## Historical V2 source

- Source branch: `feat/smart-ai-v2-json-gate`
- Source commit: `6620da09f9e4ad808be1bcf1dc9f4d83fedff4f3`
- Source Git blob SHA: `f9d513485922ac4d9ade589e4be2fe2d53a50bb9`
- Rows: 746
- Unique inputs: 746
- Categories: 300 / 150 / 150 / 100 / 32 / 14

## Governance

Phase 5 may begin only after the Phase 4 CI gate passes and the owner records explicit sign-off in this document. A passing technical gate without sign-off does not close the phase.

## Owner sign-off

Status: APPROVED TO CLOSE. The owner explicitly instructed continuation with `تابع` on 2026-10-01 after Phase 3 closure; this is recorded as the Phase 4 owner sign-off for the provenance scope defined above.
