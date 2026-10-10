# OPEN MIND AI

SMART TIME is evolving into an open-source general-purpose assistant foundation. The target architecture is **understand -> plan -> tool -> confirm -> execute -> verify -> remember -> respond**.

## Non-negotiable truth policy
- Never fabricate numbers, measurements, search results, routes, file contents, execution status, or tool outputs.
- Every external result must carry its source or provider metadata.
- Mutating actions require explicit confirmation unless an existing trusted policy explicitly permits them.
- After execution, read back the actual result before claiming success.
- Physical measurements require calibration and must report assumptions/uncertainty.

## Capabilities
- Social/emotional conversation and structured problem analysis.
- Economic analysis and budget/expense reasoning from verified application data.
- Web research through a configured search provider.
- PDF, XLSX, and DOCX generation under `/outputs`.
- DXF analysis with `ezdxf`; DWG must first be converted by an installed DWG-capable converter.
- Vehicle tracking/speed estimation with YOLO + OpenCV when calibration is supplied.
- Google Maps routes through `GOOGLE_MAPS_API_KEY`.
- Long-term memory through ChromaDB with explicit remember/recall/forget operations.

## Tool boundaries
The model may propose a tool call, but tool execution remains deterministic code. The model never gets to invent a successful result.

## Environment
Required keys are provider-specific:
- `BRAVE_SEARCH_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `OPEN_MIND_CHROMA_PATH` (optional; defaults to `./data/chroma`)
- `OPEN_MIND_OUTPUTS` (optional; defaults to `/outputs`)

Python tools are in `tools/`. Install with `pip install -r tools/requirements-open-mind.txt`.
