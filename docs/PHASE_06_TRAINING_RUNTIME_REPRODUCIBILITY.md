# Phase 6 — Training Runtime + Reproducibility

Status: FORMALLY_CLOSED
Closure gate: PASS
Owner sign-off: APPROVED

Date: 2026-10-01
Branch: `phase/06-training-runtime-reproducibility`

## Objective

Make the SMART TIME training runtime deterministic, version-pinned, hash-addressed, and auditable from a clean checkout. This phase does not launch a new expensive training run and does not diagnose the historical V2 generation gate.

## Gates

- P6-01 Runtime versions are explicitly pinned.
- P6-02 Seed and deterministic runtime settings are explicit.
- P6-03 Training datasets are SHA-256 addressed before a run.
- P6-04 Base model revision, hardware, compute capability, and selected dtype are captured.
- P6-05 Training script and dependency-contract hashes are captured.
- P6-06 Stable run fingerprint and `run-metadata.json` are produced.
- P6-07 A clean-checkout verifier validates the contract and Python syntax.
- P6-08 CI runs the Phase 6 verifier, TypeScript lint, and production build.
- P6-09 No customer data, Voice DNA, or secrets are loaded by the training runtime.
- P6-10 Rerun instructions are documented without treating reproducibility as model-quality evidence.

## Reference runtime

Python 3.12.13; PyTorch 2.10.0+cu128; Transformers 5.18.0; Datasets 5.0.1; PEFT 0.21.1; bitsandbytes 0.50.2; Accelerate 1.15.0; TRL 1.14.1. The historical reference hardware is NVIDIA Tesla T4 (compute capability 7.5), using FP16.

## Evidence policy

A reproducible run proves that its inputs and runtime contract are identified consistently. It does not prove structured-output quality, safety-gate performance, or release readiness. Those remain later phase gates.

## Owner sign-off

Status: APPROVED TO CLOSE. The owner explicitly instructed continuation with `تابع` on 2026-10-01 after Phases 1–5 were formally closed. Phase 6 CI run `36850052330` passed the verifier, lint, and build. This sign-off applies to the runtime/reproducibility scope defined above; it does not approve any model artifact for production.
