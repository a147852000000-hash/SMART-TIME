import os, json, time
from pathlib import Path
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
import uvicorn

BASE_MODEL = os.getenv("SMART_AI_BASE_MODEL", "Qwen/Qwen3-4B")
ADAPTER_DIR = Path(os.getenv("SMART_AI_ADAPTER_DIR", "/kaggle/input/smart-ai-v2/adapter"))
API_KEY = os.getenv("SMART_AI_LOCAL_TOKEN", "").strip()
MODEL_NAME = "smart-ai-v2-super"

if not torch.cuda.is_available():
    raise RuntimeError("SMART AI GPU bridge requires a CUDA GPU.")

config_path = ADAPTER_DIR / "adapter_config.json"
weights_path = ADAPTER_DIR / "adapter_model.safetensors"
if not config_path.exists() or not weights_path.exists():
    raise FileNotFoundError(f"Missing real LoRA adapter under {ADAPTER_DIR}")

adapter_cfg = json.loads(config_path.read_text(encoding="utf-8"))
if adapter_cfg.get("base_model_name_or_path") != BASE_MODEL:
    raise RuntimeError(f"Adapter base mismatch: {adapter_cfg.get('base_model_name_or_path')} != {BASE_MODEL}")
if adapter_cfg.get("peft_type") != "LORA":
    raise RuntimeError("Expected a PEFT LoRA adapter")
if int(adapter_cfg.get("r", 0)) > 64:
    raise RuntimeError("LoRA rank exceeds provider safety limit")

tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
base = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.float16,
    device_map="auto",
    trust_remote_code=True,
)
model = PeftModel.from_pretrained(base, str(ADAPTER_DIR), is_trainable=False)
model.eval()

app = FastAPI(title="SMART AI V2 GPU Bridge")

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str = MODEL_NAME
    messages: list[Message]
    temperature: float = 0.2
    max_tokens: int = 700
    stream: bool = False

@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME, "base_model": BASE_MODEL, "cuda": torch.cuda.get_device_name(0)}

@app.post("/v1/chat/completions")
def chat(req: ChatRequest, authorization: str | None = Header(default=None)):
    if API_KEY:
        expected = "Bearer " + API_KEY
        if authorization != expected:
            raise HTTPException(status_code=401, detail="Unauthorized")
    if req.stream:
        raise HTTPException(status_code=400, detail="Streaming is not enabled on the Kaggle bridge")
    if req.model not in (MODEL_NAME, BASE_MODEL):
        raise HTTPException(status_code=400, detail="Unknown model")
    prompt = tokenizer.apply_chat_template(
        [{"role": m.role, "content": m.content} for m in req.messages],
        tokenize=False,
        add_generation_prompt=True,
        enable_thinking=False,
    )
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.inference_mode():
        output = model.generate(
            **inputs,
            max_new_tokens=max(1, min(req.max_tokens, 1200)),
            do_sample=req.temperature > 0,
            temperature=max(req.temperature, 0.01),
            pad_token_id=tokenizer.eos_token_id,
        )
    text = tokenizer.decode(output[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
    return {
        "id": f"smart-ai-{int(time.time()*1000)}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": MODEL_NAME,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
