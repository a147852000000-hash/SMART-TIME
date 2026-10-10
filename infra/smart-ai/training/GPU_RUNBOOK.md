# SMART AI GPU runbook

1. Validate the repository datasets:
   `npm run validate:smart-ai`

2. On a CUDA host, create the training environment or use the provided Docker Compose service.

3. Run the preflight:
   `python infra/smart-ai/training/preflight.py`

4. Start the experiment:
   `BASE_MODEL=Qwen/Qwen3-4B python infra/smart-ai/training/train_smart_ai.py`

5. Generate held-out predictions:
   `MODEL=/path/to/output BASE_MODEL=Qwen/Qwen3-4B python infra/smart-ai/training/evaluate_smart_ai.py`

The provided Docker Compose file persists the Hugging Face model cache in a named
volume so repeated experiments do not have to download the base model again.

For a cheaper pipeline smoke test, use `BASE_MODEL=Qwen/Qwen3-1.7B` and a separate
output directory. The production experiment is configured around Qwen3-4B.
