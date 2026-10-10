# SMART TIME — SMART AI Master Architecture Contract

Status: APPROVED / ACTIVE
Target branch: feat/v3-next
Baseline protection: main and production are not modified by this work.

## Mission
SMART AI is the intelligent operating layer of SMART TIME, not a narrow chatbot.

The target system combines:
- Qwen3-4B + LoRA as the language/reasoning/tool-use model.
- Persistent memory and context retrieval.
- A planner/orchestrator and typed Tool Registry.
- Verified SMART TIME application actions.
- File understanding for PDF, DOCX/Word, XLSX/Excel, CSV, and DWG.
- Real artifact generation and validation.
- A first-class CAD/DWG subsystem for reading, understanding, creating, modifying, and validating professional drawings.
- Streaming conversational UX.

## Capability contract
### Conversation and reasoning
The system must support general conversation, Egyptian Arabic, multi-turn reasoning, problem solving, planning, and analysis within appropriate safety boundaries.

### Persistent memory
Memory is not chat history. It must support conversation memory, user facts, preferences, project memory, task memory, episodic events, semantic memories, and important decisions/prior solutions.
Pipeline: STORE -> INDEX -> RETRIEVE -> VALIDATE -> USE -> UPDATE

### SMART TIME actions
Natural language must map to typed, validated actions. Example: «أنا مونت بنزين 92 حوالي 20 لتر» must become a structured expense request, identify missing amount if necessary, then execute only after required confirmation.
Execution contract: UNDERSTAND -> PLAN -> VALIDATE -> CONFIRM WHEN REQUIRED -> EXECUTE -> READ BACK -> VERIFY -> RESPOND
The AI must never claim an operation succeeded without verified evidence.

### File intelligence
First-class inputs: DWG, PDF, DOCX/Word, XLSX/Excel, CSV.
Required flow: READ -> PARSE -> EXTRACT -> UNDERSTAND -> REASON -> CROSS-REFERENCE -> MODIFY/CREATE -> VALIDATE

### CAD / DWG
DWG is a first-class product requirement. The target is real DWG, not an image or a description.
Required progression: READ DWG -> PARSE ENTITIES -> SEMANTIC UNDERSTANDING -> QUERY/ANALYZE -> CREATE -> MODIFY -> VALIDATE -> EXPORT REAL DWG
Structured CAD representation should account for supported layers, lines, polylines, arcs, circles, splines, blocks/block references, attributes, text/MText, dimensions, leaders, hatches, layouts/viewports, xrefs, symbols, architectural elements, and supported 3D entities.
The CAD engine is an executable subsystem. The model plans and reasons over structured CAD representations; it does not pretend generated text is a CAD file.

### Cross-file reasoning
Support tasks using multiple sources: DWG + PDF + DOCX + XLSX -> unified context -> cross-file reasoning -> findings/actions/artifact.

### Artifacts
Supported artifact targets: XLSX, DOCX, PDF, DWG.
Every generated artifact must be validated by its actual engine/parser before the assistant reports success.

## Model/runtime boundary
The LoRA should teach dialogue behavior, Egyptian Arabic, reasoning patterns, structured output, tool selection and arguments, memory behavior, SMART TIME action patterns, document/CAD workflow planning, error recovery, and verification-aware behavior.
Runtime systems provide current application data, persistent memory, file bytes/parsers, Excel/Word/PDF engines, CAD/DWG engine, tool execution, validation, authorization, and confirmation.
Do not encode mutable application state into the LoRA.

## Runtime topology
SMART TIME Web/API -> AI Gateway -> Orchestrator / Context / Memory -> Qwen3-4B + LoRA inference service -> Tool Registry / Router -> SMART TIME data + Files + Artifacts + CAD
GPU inference remains separable from Railway application services.

## Development gates
Gate 0 — Inference: validate Python/CUDA/PyTorch/Transformers/vLLM/Qwen/LoRA, then models, chat completions, streaming, structured output, Arabic, and stability.
Gate 1 — AI Core: conversation, Egyptian Arabic, reasoning, structured outputs, tool calling.
Gate 2 — Context + Memory: persistent memory, retrieval, project continuity, context management.
Gate 3 — SMART TIME Tools: read/write application data, natural-language form filling, confirmation, verification.
Gate 4 — File Intelligence: PDF/DOCX/XLSX/CSV parsing, semantic context, artifact generation.
Gate 5 — CAD/DWG: DWG parsing, semantic representation, reading/analysis, creation, modification, validation, real DWG output.
Gate 6 — Integrated Agent: multi-step planning, cross-file reasoning, memory + tools + artifacts + CAD, streaming UX.
A gate is complete only when implementation, tests, and real-output verification pass.

## Current implementation rule
Do not replace working inference/model work without evidence.
Do not modify main.
Do not introduce external commercial AI API keys.
Prefer GitHub as the source of truth and branch-based development on feat/v3-next.
The immediate priority is completing SMART AI, not unrelated product work.