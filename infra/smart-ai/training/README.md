# SMART AI training

This directory contains the first reproducible fine-tuning scaffold for SMART TIME.

## Data contract

Training data lives in `backend/ai/training/smart-time-v2.jsonl`. It is synthetic, repository-owned behavior data. It must not contain customer records, chat history, credentials, private application exports, or Voice DNA recordings.

The held-out behavior set is `backend/ai/training/smart-time-eval-v1.jsonl`. It is kept separate from the training file. The current training script uses a small seeded split from V2 for Trainer loss evaluation; the held-out set is reserved for generation-based behavior review.

Hugging Face Datasets supports loading local JSONL files with `load_dataset("json", data_files=...)`, and TRL's current SFTTrainer supports prompt/completion datasets with completion-only loss. citeturn503320search1turn312828search0

## Training

Install the isolated training dependencies:

```bash
python -m venv .venv
# activate the venv using your OS-specific command
pip install -r infra/smart-ai/training/requirements.txt
```

Choose a causal/instruction model that is compatible with the GPU and whose license permits your intended use. Then run:

```bash
BASE_MODEL=/path/or/hf-model USE_LORA=1 python infra/smart-ai/training/train_smart_ai.py
```

Useful environment variables:

```text
BASE_MODEL                       required
OUTPUT_DIR                       default: infra/smart-ai/training/output
USE_LORA=1                       parameter-efficient fine-tuning by default
LORA_R=16                        LoRA rank
EPOCHS=3                         training epochs
BATCH_SIZE=2                     per-device batch size
GRADIENT_ACCUMULATION_STEPS=8   effective batch control
LEARNING_RATE=2e-4               learning rate
MAX_LENGTH=1024                  token limit
```

The training scaffold uses Hugging Face Trainer/TRL and PEFT LoRA. The PEFT documentation describes `target_modules="all-linear"` as a way to target linear layers across architectures, which avoids hard-coding model-specific projection names. citeturn608896search0

## Evaluation

After training, generate predictions against the held-out set:

```bash
MODEL=/path/to/trained-model python infra/smart-ai/training/evaluate_smart_ai.py
```

Review `infra/smart-ai/training/eval-predictions.jsonl` for:
- numerical grounding in supplied SMART TIME context
- no fabricated records
- confirmation before writes/deletes
- secret protection
- correct routing of live-data questions
- Arabic Egyptian style
- clarification when intent or time range is missing

This evaluation file is intentionally small in V1. It should grow before a production fine-tune is treated as validated.

## Runtime hand-off

A trained artifact is not automatically activated by SMART TIME. The runtime remains deterministic-first. Only after the behavior evaluation is reviewed should the resulting model/adaptor be deployed behind the existing OpenAI-compatible local inference adapter using `SMART_AI_LOCAL_URL` and `SMART_AI_LOCAL_MODEL`.

Do not commit model weights or training caches to GitHub.
