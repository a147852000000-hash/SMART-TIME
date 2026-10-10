# SMART AI V2 GPU inference provider

This runtime keeps the trained SMART AI V2 LoRA on a CUDA GPU and exposes an OpenAI-compatible endpoint to the Railway/Node application.

## Verified training artifact

The committed `infra/smart-ai/training/output/adapter_config.json` verifies:
- base model: `Qwen/Qwen3-4B`
- PEFT type: `LORA`
- LoRA rank: `16`
- model name exposed to the app: `smart-ai-v2-super`

The actual `adapter_model.safetensors` is Git LFS-backed. The runtime must receive the real binary artifact, never the LFS pointer text.

## Two supported GPU runtimes

### 1. Container GPU provider
`Dockerfile` + `bootstrap.sh` use vLLM and download the adapter at startup.

Required:
- `SMART_AI_ADAPTER_CONFIG_URL`
- `SMART_AI_ADAPTER_WEIGHTS_URL`
- `SMART_AI_BASE_MODEL=Qwen/Qwen3-4B`
- `SMART_AI_GPU_MEMORY_UTILIZATION` (optional, default 0.90)
- `SMART_AI_MAX_MODEL_LEN` (optional, default 4096)

### 2. Kaggle GPU bridge
`kaggle_gpu_bridge.py` loads the same Qwen3-4B + LoRA adapter directly inside a Kaggle CUDA session using Transformers/PEFT.

Set:
- `SMART_AI_BASE_MODEL=Qwen/Qwen3-4B`
- `SMART_AI_ADAPTER_DIR` to the Kaggle dataset/output directory containing the real `adapter_config.json` and `adapter_model.safetensors`
- `SMART_AI_LOCAL_TOKEN` to a private bearer token

Then expose the Kaggle port through a secure, authenticated tunnel and set the Railway application's `SMART_AI_LOCAL_URL` to that endpoint. The Node app does not load the adapter locally; it forwards inference requests to the GPU runtime.

**Important:** a Kaggle notebook/session is not a permanent production server. When the Kaggle session stops, the application must receive a clear AI-unavailable state. For permanent production uptime, move the same container/bridge to a persistent GPU host.

## API contract

`POST /v1/chat/completions`
with model `smart-ai-v2-super`.

`GET /health` reports CUDA and the loaded base model.

The application sends the final user prompt to this endpoint. The GPU runtime performs the actual model inference with the trained LoRA adapter; the Railway service remains the CPU/API layer.


## RunPod production layout

Create a dedicated **On-Demand GPU Pod** and attach a persistent/network volume mounted at `/workspace`. The container uses `/workspace/smart-ai` for the Hugging Face cache and the downloaded LoRA adapter, so recreating the Pod does not require retraining or re-uploading the model when the volume is retained.

Required Pod environment:
- `SMART_AI_BASE_MODEL=Qwen/Qwen3-4B`
- `SMART_AI_GPU_API_KEY=<long-random-secret>`
- `SMART_AI_ADAPTER_CONFIG_URL=<URL resolving to real adapter_config.json>`
- `SMART_AI_ADAPTER_WEIGHTS_URL=<URL resolving to real adapter_model.safetensors>`
- `SMART_AI_PERSIST_ROOT=/workspace/smart-ai`
- `HF_HOME=/workspace/smart-ai/huggingface`

Expose container port `8000` through HTTPS. The application uses the same API key as `SMART_AI_LOCAL_TOKEN`.

RunPod's current documentation supports GPU Pods and persistent/network storage; use On-Demand for the production runtime rather than an interruptible workload. citeturn0search0
