#!/usr/bin/env python3
"""SMART TIME V2 - Qwen3-4B QLoRA training for Kaggle T4/T4x2."""
import json, re, subprocess, zipfile
from pathlib import Path
from collections import Counter

import torch
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig, Trainer, TrainingArguments
from peft import LoraConfig, prepare_model_for_kbit_training, get_peft_model

REPO = Path('/kaggle/working/SMART-TIME')
DATASET = REPO / 'backend/ai/training/smart-time-tool-v2.jsonl'
OUT = Path('/kaggle/working/smart-ai-v2-output')
ZIP = Path('/kaggle/working/smart-ai-v2-super.zip')
REPO_URL = 'https://github.com/msm147852/SMART-TIME-.git'
BRANCH = 'feat/smart-ai-v2-json-gate'
BASE = 'Qwen/Qwen3-4B'
SYSTEM = 'انت SMART TIME. رجع JSON فقط حسب schema. ممنوع شرح وممنوع <think>.'
SEED, MAX_LEN = 42, 512
EXPECTED = {'finance':300,'reminder':150,'calendar':150,'query':100,'unsupported':32,'clarification':14}
TOOLS = {'add_expense','add_daily_task','calendar.event.create','finance.summary','finance.compare','finance.income.summary','finance.fuel.summary','unsupported','clarification'}

def sh(cmd):
    print('>>>', cmd); subprocess.run(cmd, shell=True, check=True)

def parse_target(v):
    obj = json.loads(v) if isinstance(v, str) else v
    if not isinstance(obj, dict) or obj.get('tool') not in TOOLS or not isinstance(obj.get('arguments'), dict):
        raise ValueError('invalid target schema')
    if '<think>' in json.dumps(obj, ensure_ascii=False).lower(): raise ValueError('think in target')
    return obj

def load_rows():
    if not DATASET.exists():
        sh(f'git clone -b {BRANCH} {REPO_URL} {REPO}')
    rows=[]
    with DATASET.open(encoding='utf-8') as f:
        rows=[json.loads(x) for x in f if x.strip()]
    counts=Counter(r.get('category') for r in rows)
    print('TOTAL:', len(rows)); print('CATEGORIES:', dict(counts))
    if len(rows)!=746 or dict(counts)!=EXPECTED: raise ValueError('Dataset contract mismatch')
    seen=set()
    for i,r in enumerate(rows):
        if r.get('input') in seen: raise ValueError(f'duplicate input {i}')
        seen.add(r.get('input'))
        for k in ('instruction','input','output'):
            if k not in r: raise ValueError(f'missing {k} at row {i}')
        parse_target(r['output'])
    print('DATASET/SCHEMA GATE: PASS')
    return rows

def chat_text(tokenizer, row, with_answer):
    msgs=[{'role':'system','content':SYSTEM},{'role':'user','content':str(row['input'])}]
    try:
        prompt=tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=not with_answer, enable_thinking=False)
    except TypeError:
        prompt=tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=not with_answer)
    if not with_answer: return prompt
    target=json.dumps(parse_target(row['output']), ensure_ascii=False, separators=(',',':'))
    return prompt + target + tokenizer.eos_token

def encode_item(tokenizer,row):
    prompt=chat_text(tokenizer,row,False)
    full=chat_text(tokenizer,row,True)
    p=tokenizer(prompt, add_special_tokens=False, truncation=True, max_length=MAX_LEN)['input_ids']
    ids=tokenizer(full, add_special_tokens=False, truncation=True, max_length=MAX_LEN)['input_ids']
    n=min(len(p),len(ids))
    labels=[-100]*n + ids[n:]
    if all(x==-100 for x in labels): raise ValueError('no completion tokens after truncation')
    return {'input_ids':ids,'attention_mask':[1]*len(ids),'labels':labels}

class Collator:
    def __init__(self,tok): self.tok=tok
    def __call__(self,features):
        m=max(len(x['input_ids']) for x in features); pid=self.tok.pad_token_id
        return {
            'input_ids':torch.tensor([x['input_ids']+[pid]*(m-len(x['input_ids'])) for x in features]),
            'attention_mask':torch.tensor([x['attention_mask']+[0]*(m-len(x['attention_mask'])) for x in features]),
            'labels':torch.tensor([x['labels']+[-100]*(m-len(x['labels'])) for x in features])
        }

def generation_gate(model,tokenizer,rows):
    model.eval(); total=min(120,len(rows)); passed=0; failures=[]
    device=next(model.parameters()).device
    for i in range(total):
        r=rows[i]; gen=''
        try:
            prompt=chat_text(tokenizer,r,False)
            enc=tokenizer(prompt,return_tensors='pt',truncation=True,max_length=MAX_LEN)
            enc={k:v.to(device) for k,v in enc.items()}
            with torch.no_grad():
                out=model.generate(**enc,max_new_tokens=128,do_sample=False,eos_token_id=tokenizer.eos_token_id,pad_token_id=tokenizer.pad_token_id)
            gen=tokenizer.decode(out[0,enc['input_ids'].shape[1]:],skip_special_tokens=False).strip()
            if '<think>' in gen.lower() or '</think>' in gen.lower() or '```' in gen: raise ValueError('think/free-text marker')
            m=re.search(r'\{.*\}',gen,re.S); obj=json.loads(m.group(0) if m else gen)
            if not isinstance(obj,dict) or obj.get('tool') not in TOOLS or not isinstance(obj.get('arguments'),dict): raise ValueError('schema/tool failure')
            passed+=1
        except Exception as e: failures.append({'index':i,'error':str(e)[:250],'generated':gen[:300]})
    rate=passed/total if total else 0.0
    report={'total':total,'passed':passed,'rate':rate,'failures':failures[:50]}
    print(f'GENERATION GATE: {passed}/{total} = {rate:.1%}')
    return report

def main():
    if not torch.cuda.is_available(): raise RuntimeError('CUDA GPU required')
    print('='*72); print('SMART TIME V2 - Qwen3-4B Kaggle Training'); print('='*72)
    gpu_name=torch.cuda.get_device_name(0)
    major,minor=torch.cuda.get_device_capability(0)
    bf16=(major >= 8)
    print('GPU:',gpu_name)
    print('Compute capability:',f'{major}.{minor}')
    print('BF16 hardware mode:',bf16)
    rows=load_rows()
    tok=AutoTokenizer.from_pretrained(BASE,trust_remote_code=True)
    if tok.pad_token is None: tok.pad_token=tok.eos_token
    split=Dataset.from_list(rows).train_test_split(test_size=0.20,seed=SEED,shuffle=True)
    train_rows,test_rows=split['train'].to_list(),split['test'].to_list()
    train=Dataset.from_list([encode_item(tok,r) for r in train_rows])
    test=Dataset.from_list([encode_item(tok,r) for r in test_rows])
    print('TRAIN:',len(train),'EVAL:',len(test))
    # Use hardware capability, not torch.cuda.is_bf16_supported(), because
    # that API defaults to including emulation and can report True on T4.
    dtype=torch.bfloat16 if bf16 else torch.float16
    bnb=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_use_double_quant=True,bnb_4bit_compute_dtype=dtype)
    model=AutoModelForCausalLM.from_pretrained(BASE,quantization_config=bnb,torch_dtype=dtype,device_map='auto',trust_remote_code=True)
    model.config.use_cache=False
    model=prepare_model_for_kbit_training(model)
    if hasattr(model,'enable_input_require_grads'): model.enable_input_require_grads()
    lora=LoraConfig(r=64,lora_alpha=128,lora_dropout=0.05,bias='none',task_type='CAUSAL_LM',target_modules=['q_proj','k_proj','v_proj','o_proj','gate_proj','up_proj','down_proj'])
    model=get_peft_model(model,lora); model.print_trainable_parameters()
    OUT.mkdir(parents=True,exist_ok=True)
    args=TrainingArguments(output_dir=str(OUT),num_train_epochs=2,learning_rate=1e-4,lr_scheduler_type='cosine',warmup_ratio=0.10,per_device_train_batch_size=1,per_device_eval_batch_size=1,gradient_accumulation_steps=16,gradient_checkpointing=True,logging_steps=10,eval_strategy='epoch',save_strategy='epoch',save_total_limit=2,load_best_model_at_end=True,metric_for_best_model='eval_loss',greater_is_better=False,fp16=not bf16,bf16=bf16,optim='paged_adamw_8bit',report_to='none',seed=SEED)
    trainer=Trainer(model=model,args=args,train_dataset=train,eval_dataset=test,data_collator=Collator(tok))
    print('START TRAINING'); trainer.train()
    metrics=trainer.evaluate(); print('EVAL:',metrics)
    final=OUT/'adapter'; final.mkdir(parents=True,exist_ok=True)
    trainer.save_model(str(final)); tok.save_pretrained(str(final))
    gate=generation_gate(model,tok,test_rows)
    meta={'base_model':BASE,'dataset_size':746,'split':'80/20','lora_r':64,'lora_alpha':128,'lora_dropout':0.05,'quantization':'4-bit NF4 double quant','compute_dtype':'bf16' if bf16 else 'fp16','max_length':MAX_LEN,'epochs':2,'learning_rate':1e-4,'warmup_ratio':0.10,'batch_size':1,'gradient_accumulation':16,'completion_only_loss':True,'system_prompt':SYSTEM,'eval_metrics':metrics,'generation_gate':gate}
    (final/'training_metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    if ZIP.exists(): ZIP.unlink()
    with zipfile.ZipFile(ZIP,'w',zipfile.ZIP_DEFLATED) as z:
        for p in final.rglob('*'):
            if p.is_file(): z.write(p,Path('smart-ai-v2-final')/p.relative_to(final))
    print('='*72); print('DONE:',ZIP); print('='*72)

if __name__=='__main__': main()