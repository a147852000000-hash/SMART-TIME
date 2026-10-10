# SMART-TIME V3 Next — AI Architecture

## Product target

SMART AI is a voice-first Egyptian-Arabic assistant inside SMART TIME.

It must:
- understand Egyptian colloquial Arabic and code-switching;
- understand SMART TIME sections, fields and capabilities;
- answer from authorized application data;
- generate grounded reports;
- fill selected data-entry sections from voice;
- execute only validated/authorized actions;
- return a spoken Egyptian-capable response.

## Canonical production path

Microphone
  -> Railway API
  -> Groq Whisper STT
  -> Egyptian Language / Behavior Layer
  -> SMART TIME Product Knowledge / RAG / Memory
  -> Groq LLM
  -> Structured Intent
  -> Schema + Permission + Confirmation Policy
  -> Tool Registry / Deterministic Report Engine
  -> Authoritative Read-back
  -> Grounded Response
  -> Egyptian-capable TTS
  -> Playback

## Model strategy

Groq is the primary production inference provider.

The Kaggle-trained Qwen3-4B + LoRA and all datasets/training assets remain preserved, but are not assumed to be deployable on free Groq. Groq currently documents LoRA inference as an Enterprise capability.

The free/developer strategy is therefore:
- Groq-hosted general LLM;
- Egyptian behavior via system policy, few-shot examples, normalization, glossary and evaluation;
- product understanding through a controlled SMART TIME knowledge registry and RAG;
- deterministic application logic for calculations and mutations.

The provider boundary remains replaceable so the preserved Qwen/LoRA path can be evaluated or self-hosted later.

## Egyptian behavior layer

The language layer is provider-independent and owns:
- colloquial normalization;
- Egyptian terminology;
- spelling/phonetic variants;
- product vocabulary;
- few-shot examples;
- intent taxonomy;
- clarification policy;
- unsupported-intent policy;
- Egyptian response style;
- language evaluation.

It must not contain direct database access.

## Product knowledge

Maintain a structured SMART TIME product ontology covering:
- sections;
- entities;
- fields;
- relationships;
- read operations;
- report operations;
- create/update/delete operations;
- permissions;
- aliases and colloquial names.

RAG retrieves only relevant authorized context.

The model never receives the entire database.

## Agent loop

1. Receive text or verified STT transcript.
2. Normalize Egyptian language.
3. Classify/structure intent.
4. Retrieve authorized product/data context.
5. Ask Groq for grounded response or structured action.
6. Validate schema/tool/arguments.
7. Apply permission and confirmation policy.
8. Execute approved tool or deterministic report.
9. Read back authoritative state.
10. Produce grounded response.
11. Synthesize Egyptian-capable TTS for voice interactions.
12. Persist only required memory/conversation state.

No free-text model response is executable.

## Voice data policy

- API key is server-side only.
- Raw audio is not persisted by default.
- Audio requests have auth, type, size, duration and rate limits.
- Customer data is not used for model training.
- Voice evidence is kept as evaluation metadata/artifacts, not embedded in production prompts.

## TTS strategy

The TTS slot is provider-independent.

Groq's currently documented Arabic Orpheus model is Saudi Arabic, so it must not be represented as Egyptian TTS.

Use a free/local Egyptian-capable TTS when its quality gate passes; otherwise keep a separately replaceable paid TTS option.

## Tools and data entry

Voice data entry follows:

user voice
 -> transcript
 -> intent
 -> selected SMART TIME section
 -> structured field draft
 -> schema validation
 -> authorization
 -> confirmation where required
 -> executor
 -> authoritative read-back
 -> spoken confirmation

The model never writes directly to application storage.

## Security

- provider secrets server-side only;
- per-user authorization;
- strict tool allowlist;
- confirmation for destructive/sensitive mutations;
- request size/rate/duration limits;
- user isolation;
- no arbitrary code execution;
- no raw audio persistence by default;
- data minimization;
- usage telemetry without sensitive prompt content.

## Infrastructure

Railway:
- API;
- authentication;
- application data/integrations;
- provider gateway;
- STT handling;
- deterministic report/tool execution.

Groq:
- production LLM inference;
- production STT.

Preserved local stack:
- Qwen/LoRA/vLLM and training assets for research/evaluation/future self-hosted deployment.
