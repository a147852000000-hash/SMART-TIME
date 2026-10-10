# SMART-TIME V3 Next — Phase 0 Audit

Date: 2026-09-26
Baseline: main @ 019025e20678dd5ca5c9c3f6b0b904fc41fe8c76
Working branch: feat/v3-next
Scope: audit only; no application code changes in Phase 0.

## 1. Frontend
Status: PARTIAL / NOT READY

Evidence:
- src/components/AiCenterView.tsx contains a real chat screen and quick prompts.
- Chat submission is a normal request/response call; there is no token streaming UI.
- The composer has microphone + text send, but no attachment/file button.
- Voice playback is browser speech synthesis by default.
- The application wraps the mobile UI in a fixed smartphone shell (max width ~430px), which is not yet a full ChatGPT-like responsive AI workspace.

## 2. AI backend
Status: PARTIAL

Present:
- /api/ai/chat
- /api/ai/status
- deterministic Open Mind planning
- verified DB tool executor for selected expense/budget/task mutations
- optional local inference adapter

Current limitation:
- local model is still consulted only after deterministic planning and only for non-action requests.
- the model cannot currently emit/execute a general structured tool-call loop.
- unsupported requests can still end in the no-verified-tool path instead of autonomous tool planning.

## 3. Local model
Status: IMPLEMENTED ADAPTER / RUNTIME NOT VERIFIED

Present:
- backend/ai/localInference.ts
- OpenAI-compatible POST /v1/chat/completions contract
- SMART_AI_LOCAL_URL
- SMART_AI_LOCAL_MODEL
- optional SMART_AI_LOCAL_TOKEN
- apiKeyRequired=false in /api/ai/status

Current limitation:
- localInference now supports both non-streaming and OpenAI-compatible SSE streaming via streamLocalSmartAi().
- streaming parser has a focused unit test, but GPU/runtime execution remains unverified.
- runtime GPU endpoint configuration is not stored in repository and must be verified in the deployment environment.

## 4. Qwen + LoRA
Status: ARTIFACT PRESENT / DEPLOYMENT GAP

Evidence:
- base model: Qwen/Qwen3-4B
- adapter_config.json declares LoRA r=16, alpha=32 and Qwen3-4B base.
- adapter_model.safetensors is a Git LFS pointer to a 132,187,888-byte artifact, not the full weight payload in normal Git contents.
- training README states that the trained artifact is not automatically activated and should be deployed behind the local inference adapter.

Conclusion:
- the repository records the trained adapter, but production/preview GPU inference still needs a verified serving deployment.

## 5. Existing training/evaluation
Status: GOOD FOUNDATION / NEEDS NEXT-GEN EVAL

Current repository datasets:
- smart-time-v2.jsonl: 60 records
- smart-time-eval-v1.jsonl: 22 records
- smart-time-grounded-v3.jsonl: 66 records

Existing training stack:
- SFT + LoRA
- Qwen/Qwen3-4B
- evaluation scripts v1/v2/v3
- activation policy is evaluation-then-manual-runtime-enable

No new training should start before the agent/tool evaluation is measured.

## 6. Tools
Status: PARTIAL

Existing:
- web search without a proprietary LLM API
- expense/budget/task DB execution
- permissions
- report generators for XLSX/DOCX/PDF
- chart SVG generator
- simple SVG drawing
- CAD analyzer for existing DXF/DWG metadata

Important limitation:
- report generation is primitive and returns base64 artifacts.
- draw_plan currently generates a simple SVG placeholder, not professional CAD.
- CAD analyzer is analysis-only; there is no validated DXF generation pipeline.
- the V3 tool registry is not yet the central execution protocol for the local model.

## 7. Voice
Status: PARTIAL / STT MISSING

Present:
- browser Web Speech synthesis for output
- optional local Voice DNA TTS provider
- Egyptian Arabic locale ar-EG
- VoiceTuT provider scaffold under infra/smart-voice

Critical gap:
- VoiceSearchModal explicitly uses a simulated voice-recognition stream with timers and hard-coded transcript.
- no real STT -> AI -> TTS conversational pipeline is connected to SMART AI.

## 8. Attachments
Status: MISSING FROM AI CHAT

The AI composer currently has no file attachment control or general file upload/parse pipeline.
No verified PDF/DOCX/XLSX/image ingestion path is connected to the AI conversation.

## 9. CAD
Status: PARTIAL

Present:
- tools/cad_analyzer.py supports DXF analysis and explicitly requires an external converter for DWG.
- V3 classifier recognizes CAD language.

Missing:
- natural-language CAD specification schema
- deterministic DXF generator
- geometry validator
- rendering/preview pipeline
- professional 2D CAD artifact workflow
- STEP/3D extension

## 10. Railway / deployment
Status: ARCHITECTURE READY, GPU SERVICE NOT VERIFIED

The repository supports a configurable external local inference URL.
The application server can remain the CPU/web layer.

Required next deployment:
Railway app/API -> private authenticated GPU inference service -> Qwen3-4B + LoRA + vLLM.

Do not run the GPU model inside the current Railway CPU service.

## 11. Main blockers
1. GPU inference service and secure connectivity.
2. Real streaming inference.
3. General structured tool-calling loop.
4. Attachment ingestion.
5. Real STT.
6. Real TTS integration as a first-class AI response pipeline.
7. Professional CAD generation + validation.
8. Artifact storage/download contract.
9. ChatGPT-like responsive AI workspace.
10. Next-generation evaluation suite.

## 12. Phase 0 conclusion
The project has a strong deterministic/local-AI foundation, but it is not yet a ChatGPT-like agent.
The correct next implementation order is:
Local inference + streaming -> Agent/tool loop -> Files/artifacts -> Voice -> CAD -> UI polish -> targeted retraining only after evaluation.

No main changes were made.
