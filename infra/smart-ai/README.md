# SMART AI local inference

This directory is the GPU-side runtime for SMART AI. It is intentionally separate from the Railway application.

## Architecture

```
SMART TIME (Railway)
      |
      | HTTPS + Bearer token
      v
SMART AI local inference host
      |
      +-- OpenAI-compatible /v1/chat/completions
      +-- local model weights
      +-- NVIDIA GPU
```

## Configuration

Copy the example values into the inference host environment:

```bash
HF_TOKEN=
SMART_AI_MODEL=your-approved-model-id
SMART_AI_LOCAL_MODEL=smart-time-local
SMART_AI_MAX_MODEL_LEN=4096
SMART_AI_TOOL_CALL_PARSER=hermes
```

The model identifier is intentionally left as a deployment choice. Pick a model whose license, Arabic quality, VRAM requirements, and tool-calling behavior have been checked before production use.

Start the server:

```bash
docker compose -f docker-compose.yml up -d
```

The endpoint should expose:

```
http://<host>:8000/v1/chat/completions
```

## Connect SMART TIME

On the Railway SMART TIME service set:

```text
SMART_AI_LOCAL_URL=https://<your-inference-domain>
SMART_AI_LOCAL_MODEL=smart-time-local
SMART_AI_LOCAL_TOKEN=<same-long-random-secret>
```

The application only calls local inference for open-ended requests that the deterministic SMART AI core cannot resolve.

## Security

Do not expose port 8000 publicly without TLS and an access-control layer. Keep the shared token only in the Railway environment and the inference host environment.

## Model policy

Customer records are runtime context, not training data. Fine-tuning should use de-identified SMART TIME behavior examples rather than customer exports.
