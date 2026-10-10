# SMART TIME — Training Runtime Reproducibility Contract

## Scope

Phase 6 standardizes the training runtime without launching a new model-training cycle. It makes future training runs auditable and repeatable from a clean checkout.

## Runtime contract

- Python: 3.12.13
- PyTorch: 2.10.0+cu128
- Transformers: 5.18.0
- Datasets: 5.0.1
- PEFT: 0.21.1
- bitsandbytes: 0.50.2
- Accelerate: 1.15.0
- TRL: 1.14.1
- Known Phase 6 reference GPU: NVIDIA Tesla T4, compute capability 7.5
- T4 training dtype: FP16
- Base model: Qwen/Qwen3-4B
- Default seed: 42
- Deterministic algorithms: enabled by default
- Customer data, secrets, and Voice DNA are outside the training boundary.

## Run identity

Every run records:
1. git commit identity;
2. training-script SHA-256;
3. requirements SHA-256;
4. every training-dataset SHA-256;
5. base-model identifier and revision;
6. hardware and selected dtype;
7. seed and deterministic-runtime settings;
8. complete effective training configuration;
9. a stable run fingerprint derived from the above inputs.

The fingerprint is independent of wall-clock time, so the same source/config/data/runtime contract produces the same run identity.

## Artifact metadata

`train_smart_ai.py` writes `run-metadata.json` beside the adapter/checkpoints. The metadata is evidence for the exact command and inputs used for a run; it is not a model-quality score.

## Rerun recipe

From a clean checkout:
1. Create Python 3.12.13.
2. Install `infra/smart-ai/training/requirements-phase6.txt`.
3. Ensure the same base-model revision is available.
4. Ensure the repository datasets are unchanged.
5. Run: `python infra/smart-ai/training/train_smart_ai.py`

Optional environment variables remain supported by the training script. For a controlled rerun, explicitly set `SEED=42`, `DETERMINISTIC_TRAINING=1`, `BASE_MODEL=Qwen/Qwen3-4B`, and the desired training hyperparameters.

Do not treat a successful reproducibility check as evidence that a model passes behavioral gates. Behavioral evaluation remains governed by the later structured-output gates.
