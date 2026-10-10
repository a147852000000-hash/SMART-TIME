#!/usr/bin/env python3
"""Train SMART TIME V2 as a structured JSON intent/tool parser.

This script is intentionally separate from the existing conversational training
pipeline. It trains only on synthetic tool-contract examples and never loads
customer data, secrets, chat history, or Voice DNA.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

import torch
from datasets import load_dataset
from peft import LoraConfig, TaskType
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import SFTConfig, SFTTrainer

ROOT = Path(__file__).resolve().parents[3]
DATASET_FILE = ROOT / "backend/ai/training/smart-time-tool-v2.jsonl"
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", str(ROOT / "infra/smart-ai/training/output-v2")))
BASE_MODEL = os.getenv("BASE_MODEL", "Qwen/Qwen3-4B").strip()
EPOCHS = float(os.getenv("EPOCHS", "2"))
LR = float(os.getenv("LEARNING_RATE", "1e-4"))
BATCH = int(os.getenv("BATCH_SIZE", "1"))
GRAD_ACCUM = int(os.getenv("GRADIENT_ACCUMULATION_STEPS", "16"))
MAX_LENGTH = int(os.getenv("MAX_LENGTH", "512"))
LORA_R = int(os.getenv("LORA_R", "64"))
LORA_ALPHA = int(os.getenv("LORA_ALPHA", "128"))
LORA_DROPOUT = float(os.getenv("LORA_DROPOUT", "0.05"))

SYSTEM_AR = (
    "أنت محلل نوايا وأدوات داخل SMART TIME. "
    "أخرج JSON واحد فقط مطابق للعقد. "
    "ممنوع الشرح أو النصائح أو النص الحر أو <think>. "
    "ممنوع اختراع أداة أو حقل. "
    "لو الطلب ناقص استخدم clarification، ولو خارج الأدوات استخدم unsupported."
)

def format_example(example: dict) -> dict:
    prompt = [
        {"role": "system", "content": SYSTEM_AR},
        {"role": "user", "content": example["input"].strip()},
    ]
    return {
        "prompt": prompt,
        "completion": [{"role": "assistant", "content": example["output"].strip()}],
    }

def dtype() -> torch.dtype:
    if not torch.cuda.is_available():
        return torch.float32
    return torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16

def main() -> None:
    if not DATASET_FILE.exists():
        raise SystemExit(f"Missing V2 dataset: {DATASET_FILE}")

    ds = load_dataset("json", data_files=str(DATASET_FILE), split="train")
    required = {"instruction", "input", "output", "category"}
    missing = required - set(ds.column_names)
    if missing:
        raise SystemExit(f"V2 dataset missing columns: {sorted(missing)}")
    if len(ds) != 746:
        raise SystemExit(f"V2 dataset must contain exactly 746 examples; found {len(ds)}")

    ds = ds.map(format_example)
    ds = ds.remove_columns([c for c in ds.column_names if c not in {"prompt", "completion"}])
    split = ds.train_test_split(test_size=0.20, seed=42)

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=dtype())

    peft = LoraConfig(
        r=LORA_R,
        lora_alpha=LORA_ALPHA,
        lora_dropout=LORA_DROPOUT,
        target_modules="all-linear",
        task_type=TaskType.CAUSAL_LM,
        bias="none",
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    args = SFTConfig(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=EPOCHS,
        learning_rate=LR,
        per_device_train_batch_size=BATCH,
        per_device_eval_batch_size=BATCH,
        gradient_accumulation_steps=GRAD_ACCUM,
        logging_steps=5,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        max_length=MAX_LENGTH,
        report_to="none",
        bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
        fp16=torch.cuda.is_available() and not torch.cuda.is_bf16_supported(),
        completion_only_loss=True,
        packing=False,
    )

    trainer = SFTTrainer(
        model=model,
        args=args,
        train_dataset=split["train"],
        eval_dataset=split["test"],
        processing_class=tokenizer,
        peft_config=peft,
    )
    trainer.train()
    metrics = trainer.evaluate()
    if "eval_loss" in metrics:
        metrics["perplexity"] = math.exp(float(metrics["eval_loss"]))
    trainer.save_model(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    print(json.dumps({
        "dataset": str(DATASET_FILE),
        "train_examples": len(split["train"]),
        "eval_examples": len(split["test"]),
        "output": str(OUTPUT_DIR),
        **{k: v for k, v in metrics.items() if isinstance(v, (int, float))}
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
