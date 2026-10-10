# SMART-TIME V3 Next — AI Deployment

## Web/API

Deploy the SMART-TIME application on Railway.

Required environment values for local inference:
- SMART_AI_LOCAL_URL
- SMART_AI_LOCAL_MODEL
- optional SMART_AI_LOCAL_TOKEN

No proprietary LLM API key is required.

## GPU inference

Deploy Qwen3-4B + LoRA behind vLLM on a GPU-capable service.

Minimum validated historical target:
- NVIDIA Tesla T4 was previously used successfully for Qwen3-4B + LoRA + vLLM smoke testing.

The repository does not contain a complete production GPU deployment configuration yet.

## Connectivity

Preferred:
Railway -> authenticated/private GPU endpoint.

Do not expose an unauthenticated inference endpoint.

The GPU provider must implement:
- GET /v1/models
- POST /v1/chat/completions
- streaming responses
- model/adapter health

## Artifact storage

Generated files should move from in-memory base64 prototypes to a validated artifact storage contract with:
- owner user id
- MIME type
- filename
- size
- checksum
- expiry/retention policy
- authorized download

## Voice

Basic AI voice:
- real browser microphone capture
- STT service
- local TTS service or browser TTS fallback

Personalized Voice DNA:
- optional separate GPU provider
- explicit consent
- authenticated server-to-provider requests

## Preview strategy

feat/v3-next should have its own Railway preview environment.

Do not connect the preview to main after the branch is created.

Deployment progression:
feat/v3-next -> preview -> tests -> PR -> main -> production

## No local source-of-truth

GitHub remains the canonical source.
Local copies are not required for normal feature development.
