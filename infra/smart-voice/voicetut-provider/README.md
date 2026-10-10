# SMART TIME VoiceTuT local GPU provider

This directory is an isolated local inference service for SMART VOICE DNA.

It is designed for an NVIDIA GPU host rather than the SMART TIME Railway app. The app sends synthesis requests only when `SMART_VOICE_DNA_PROVIDER_URL` is configured.

## Upstream engine

VoiceTuT-TTS documents Egyptian-Arabic-first synthesis, zero-shot voice cloning from reference audio, Arabic/English code-switching, and local installation. Its public repository currently documents an Apache-2.0 project license; verify the exact model/package terms before production or commercial deployment. citeturn644845view0

## Service contract

`POST /synthesize`

The request contains:
- text
- language / locale
- profile id
- base64 reference audio
- reference MIME type
- optional reference text
- speaking style metadata

The provider returns WAV audio. Reference audio is decoded and written to a temporary file only for the active request, then the temporary directory is removed.

## Security

Set `SMART_VOICE_DNA_PROVIDER_TOKEN`. The service requires a matching bearer token and disables Uvicorn access logging so request bodies are not logged by the default server.

Put the service behind TLS/private networking in production.

## Run

Create a long random provider token, then run the isolated GPU service:

```bash
export SMART_VOICE_DNA_PROVIDER_TOKEN="replace-with-a-long-random-secret"
docker compose up --build -d
```

The service listens on `127.0.0.1:8000` through the published Docker port. The Compose setup uses the NVIDIA GPU, drops Linux capabilities, enables `no-new-privileges`, mounts a temporary writable `/tmp`, and runs the container read-only. The Hugging Face model cache is persisted in a dedicated Docker volume so the model can be downloaded once without making the application filesystem writable.

For a one-off run without Compose:

```bash
docker build -t smart-time-voicetut ./infra/smart-voice/voicetut-provider
docker run --rm --gpus all -p 8000:8000 \
  -e SMART_VOICE_DNA_PROVIDER_TOKEN="replace-with-a-long-random-secret" \
  smart-time-voicetut
```

Optional: `SMART_VOICE_DNA_CONCURRENCY` (default `1`) serializes GPU synthesis requests on a provider instance.
