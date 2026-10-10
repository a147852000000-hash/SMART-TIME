# SMART TIME — SMART AI Training Matrix

Target: Qwen3-4B + LoRA
Branch: feat/v3-next

## Training domains
1. General conversation and reasoning
2. Egyptian Arabic and natural conversational commands
3. SMART TIME intent/entity/action extraction
4. Tool selection, arguments, results, retries, and verification
5. Persistent memory extraction, retrieval, update, and contradiction handling
6. PDF/DOCX/XLSX/CSV understanding and cross-file reasoning
7. Artifact planning for XLSX/DOCX/PDF
8. CAD/DWG understanding, semantic extraction, planning, generation, modification, and validation
9. Error recovery and refusal to invent execution results

## Required sample pattern
Prefer multi-turn records:
conversation -> context -> user request -> structured plan/action -> tool result -> final response.
Do not reduce the corpus to question -> answer pairs.

## CAD-specific corpus
CAD examples must include:
- natural-language requirements -> structured architectural specification
- DWG semantic content -> natural-language understanding
- drawing entities -> semantic roles
- dimensions/layers/blocks/text -> structured extraction
- modification requests -> typed CAD operations
- CAD validation findings -> corrective operations
- multi-turn CAD editing
- DWG + PDF/DOCX/XLSX cross-document reasoning

## SMART TIME action examples
Natural Egyptian Arabic such as:
«أنا مونت بنزين 92 حوالي 20 لتر»
must train the model to identify fuel type and quantity, detect missing amount, request the missing value, and then produce a typed action.

## Evaluation dimensions
- language correctness
- intent correctness
- argument correctness
- tool selection
- memory relevance
- no-invention behavior
- verification-aware response
- artifact specification correctness
- CAD semantic correctness
- CAD operation correctness
- cross-file consistency

Training is not complete when loss decreases. Evaluation must measure actual task behavior and tool/structured-output correctness.