#!/usr/bin/env python3
"""Gate 4G behavioral evaluation for Qwen3-4B + SMART-TIME LoRA."""
from __future__ import annotations
import json, os
from pathlib import Path
import torch
from datasets import load_dataset
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

ROOT=Path(__file__).resolve().parents[3]
EVAL_FILE=ROOT/"backend/ai/training/smart-time-eval-v4g.jsonl"
MODEL=os.getenv("MODEL","").strip()
BASE_MODEL=os.getenv("BASE_MODEL","").strip()
OUTPUT=Path(os.getenv("EVAL_OUTPUT",str(ROOT/"infra/smart-ai/training/eval-v4g-predictions.jsonl")))
SYSTEM_PROMPT = """
You are SMART-TIME Intent Parser - Gate 4G canonical contract.

Return exactly ONE JSON object and NOTHING else.

CANONICAL KEYS (EXACT):
- intent
- tool
- arguments
- requiresConfirmation

ALLOWED INTENTS (ONLY):
- conversation
- expense
- task
- reminder
- file_analysis
- web_research
- unknown

ALLOWED TOOLS (ONLY):
- finance.get_summary
- finance.transaction.create
- finance.transaction.delete
- task.create
- reminder.create
- analyze_file
- web_search

CANONICAL INTENT -> TOOL RULES:
- conversation -> null
- unknown -> null
- expense -> finance.get_summary OR finance.transaction.create OR finance.transaction.delete
- task -> task.create
- reminder -> reminder.create
- file_analysis -> analyze_file
- web_research -> web_search

ARGUMENT RULES:
- Always use key "arguments" and make it an object.
- Expense creation: amount, type, date when supplied by the user.
- Expense deletion: expenseId when a specific record can be identified; otherwise preserve the intent/tool and ask for clarification through arguments only if the contract permits it.
- Finance summary: period when supplied.
- Task: title and date when supplied.
- Reminder: title, date, time when supplied.
- File analysis: fileId when supplied.
- Web research: query when supplied.
- Normalize name -> title, due_date -> date, category -> type, file_id/file -> fileId, expense_summary -> expense.

CONFIRMATION RULES:
- Mutating/destructive actions (finance.transaction.create, finance.transaction.delete, task.create, reminder.create) -> requiresConfirmation=true unless the input explicitly establishes that confirmation has already been granted for that exact action.
- Read-only actions (finance.get_summary, analyze_file, web_search) -> requiresConfirmation=false.
- conversation and unknown -> requiresConfirmation=false, tool=null, arguments={}.
- A continuation such as "yes", "ok", or "continue" without enough context -> intent=unknown, tool=null, requiresConfirmation=true.
- Credentials/secrets such as password, API key, token, or secret -> intent=unknown, tool=null, requiresConfirmation=false.

STRICT OUTPUT:
- Never use "args"; use "arguments".
- Never use "confirmation"; use "requiresConfirmation".
- Never emit file.analyze, web.search, search, smart_time, none, delete_last_expense, set_reminder, analyze_budget_file, or any other tool name outside the allowed list.
- Never add prose, markdown, code fences, or extra JSON fields.
"""

def dtype():
    if not torch.cuda.is_available():
        return torch.float32
    bf16_supported = getattr(torch, "is_bf16_supported", None)
    if callable(bf16_supported):
        return torch.bfloat16 if bf16_supported() else torch.float16
    cuda_capability = torch.cuda.get_device_capability()
    return torch.bfloat16 if cuda_capability[0] >= 8 else torch.float16

def load_model():
    if not MODEL: raise SystemExit("MODEL is required.")
    tok=AutoTokenizer.from_pretrained(MODEL,use_fast=True)
    if tok.pad_token is None: tok.pad_token=tok.eos_token
    if (Path(MODEL)/"adapter_config.json").exists():
        if not BASE_MODEL: raise SystemExit("BASE_MODEL is required for a LoRA adapter.")
        base=AutoModelForCausalLM.from_pretrained(BASE_MODEL,torch_dtype=dtype(),device_map="auto" if torch.cuda.is_available() else None)
        model=PeftModel.from_pretrained(base,MODEL)
    else:
        model=AutoModelForCausalLM.from_pretrained(MODEL,torch_dtype=dtype(),device_map="auto" if torch.cuda.is_available() else None)
    model.eval(); return model,tok

def main():
    ds=load_dataset("json",data_files=str(EVAL_FILE),split="train"); model,tok=load_model()
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    with OUTPUT.open("w",encoding="utf-8") as out:
        for row in ds:
            msgs=[{"role":"system","content":SYSTEM_PROMPT},{"role":"user","content":row["input"].strip()}]
            if row.get("smartTimeData") is not None: msgs.append({"role":"user","content":"SMART TIME data:\n"+json.dumps(row["smartTimeData"],ensure_ascii=False)})
            rendered=tok.apply_chat_template(msgs,tokenize=False,add_generation_prompt=True,enable_thinking=False)
            inputs=tok(rendered,return_tensors="pt")
            if torch.cuda.is_available(): inputs={k:v.to(model.device) for k,v in inputs.items()}
            with torch.no_grad(): generated=model.generate(**inputs,max_new_tokens=180,do_sample=False,pad_token_id=tok.eos_token_id)
            continuation=generated[0][inputs["input_ids"].shape[1]:]
            raw=tok.decode(continuation,skip_special_tokens=True).strip()
            parsed=None; parse_error=None
            try:
                parsed=json.loads(raw)
                if not isinstance(parsed,dict): raise ValueError("prediction is not an object")
            except Exception as exc: parse_error=str(exc)
            out.write(json.dumps({"case_id":row["case_id"],"category":row["category"],"expected":row["expected"],"raw":raw,"prediction":parsed,"parse_error":parse_error},ensure_ascii=False)+"\n")
    print(f"Wrote {len(ds)} Gate 4G predictions to {OUTPUT}")

if __name__=="__main__": main()
