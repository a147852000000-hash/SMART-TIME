{
  "title": "SMART TIME — Groq Architecture Execution Plan",
  "authority": "New architecture baseline; supersedes fixed-count Plan 35.",
  "production_path": [
    "Real audio capture",
    "Groq Whisper STT",
    "Groq LLM",
    "RAG/Knowledge",
    "Structured output",
    "Typed Tools/Actions",
    "Groq/approved TTS",
    "E2E verification"
  ],
  "phases": [
    {
      "id": "A1",
      "name": "Provider Gateway + Groq Runtime",
      "status": "CLOSED",
      "disposition": "KEEP/MODIFY",
      "gate": "Groq key server-side, provider contract, healthcheck, CI"
    },
    {
      "id": "A2",
      "name": "Real STT + Voice Capture",
      "status": "IMPLEMENTED_STATIC_CI_PASS_RUNTIME_OPEN",
      "disposition": "REIMPLEMENT",
      "gate": "Groq Whisper transport, authenticated STT endpoint, MediaRecorder, quota/size/privacy, CI; real microphone E2E still required"
    },
    {
      "id": "A3",
      "name": "Groq LLM + Structured Output",
      "status": "NEXT",
      "disposition": "REIMPLEMENT",
      "gate": "production inference routed through provider abstraction; schema validation; no local-Qwen production dependency"
    },
    {
      "id": "A4",
      "name": "RAG / Knowledge Retrieval",
      "status": "PLANNED",
      "disposition": "MODIFY/NEW",
      "gate": "retrieval contract, grounding, citations/provenance, deterministic empty-result behavior"
    },
    {
      "id": "A5",
      "name": "Tools + Actions",
      "status": "PLANNED",
      "disposition": "KEEP/MODIFY",
      "gate": "existing typed registry connected to Groq tool calls; validation/confirmation/idempotency"
    },
    {
      "id": "A6",
      "name": "Memory + Context Continuity",
      "status": "PLANNED",
      "disposition": "MODIFY",
      "gate": "scoped context, retrieval policy, privacy boundaries"
    },
    {
      "id": "A7",
      "name": "TTS + Full Voice E2E",
      "status": "PLANNED",
      "disposition": "KEEP/MODIFY",
      "gate": "STT→LLM→tools→TTS→playback, interruption, error recovery"
    },
    {
      "id": "A8",
      "name": "Security / Cost / Observability / Release",
      "status": "PLANNED",
      "disposition": "NEW/MODIFY",
      "gate": "secret isolation, quotas, timeouts, telemetry without raw audio, regression, production release gate"
    }
  ],
  "asset_policy": {
    "trained_qwen_model": "KEEP — experimental/historical/fallback asset; not production provider.",
    "training_datasets": "KEEP — provenance/evaluation assets; no automatic training authorization.",
    "existing_tool_registry": "KEEP — integrate with Groq tool calling.",
    "existing_memory_context": "KEEP/MODIFY — connect to new orchestrator.",
    "existing_tts_assets": "KEEP/MODIFY — integrate into E2E.",
    "old_local_qwen_routing": "MODIFY — remove as production default; preserve code/assets where useful."
  },
  "closure_rule": "No phase advances until implementation + automated verification + runtime verification where applicable + security/reproducibility + CI are green."
}
