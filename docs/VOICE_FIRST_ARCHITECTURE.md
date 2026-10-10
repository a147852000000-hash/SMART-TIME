# SMART-TIME V3 Next — Voice-First Architecture Contract

Status: ACTIVE CANONICAL DESIGN
Branch: feat/v3-next
Supersedes the earlier browser-Web-Speech-first implementation as the production target.

## Canonical runtime order

```
User Voice
  ↓
Voice Capture / Microphone
  ↓
Server-side STT / Groq Whisper
  ↓
Transcript + STT metadata
  ↓
RAG / Knowledge / Memory context
  ↓
Groq AI Orchestrator
  ↓
Structured Output / Tool Proposal
  ↓
Policy + Schema Validator
  ↓
Central Tool Registry / Agent Router
  ↓
Tool / Service Execution
  ↓
Read-back Verification
  ↓
Grounded SMART AI Response
  ↓
Egyptian TTS / Voice Output
  ↓
User
```

## Trust boundaries

- Voice capture owns microphone lifecycle only.
- STT converts audio to text and metadata; it cannot mutate application data.
- Groq receives only permitted request/context data.
- RAG/context provides bounded, provenance-aware context.
- The model proposes; the validator authorizes.
- Tools execute server-side under authenticated user identity.
- Every mutation requires the configured confirmation policy and authoritative read-back.
- TTS receives grounded response text, not raw database access.

## Production STT contract

- Primary locale: ar-EG.
- Egyptian Arabic is first-class.
- Code-switching and numbers/dates must be tested.
- No fabricated transcript.
- Provider/network failure must produce an explicit error state.
- Permission denial must produce an explicit error state.
- Raw microphone audio is not persisted by the application by default.
- Browser Web Speech may exist only as a labeled fallback and must not be mistaken for the production STT path.

## Evaluation order

1. microphone capture
2. STT transcript correctness
3. retrieval/context correctness
4. structured proposal validity
5. policy/schema validation
6. confirmation boundary
7. tool execution
8. authoritative read-back
9. grounded response
10. TTS synthesis
11. playback
12. end-to-end latency/error evidence
13. security/privacy
14. reproducibility/artifact evidence

A model proposal is never execution evidence.

## Training policy

No training run is authorized by this architecture. Existing Qwen/LoRA and dataset assets remain preserved. Any future training must have a versioned dataset/model manifest, held-out evaluation, checksums, runtime versions, seed and rollback reference.

## Current truth

Implemented/available:
- server-side Groq health adapter
- provider preparation on Railway staging
- deterministic/typed tool and verification components
- existing context/memory components
- existing TTS/Voice DNA boundaries
- browser Web Speech implementation as legacy/fallback work

Not yet closed:
- full Groq provider gateway
- production Groq STT endpoint
- verified production RAG loop
- Groq structured tool-call loop
- complete voice E2E
- final security/cost/regression release gate
