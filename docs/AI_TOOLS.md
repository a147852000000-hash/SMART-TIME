# SMART-TIME V3 Next — Tool Inventory

## Existing tools

| Tool | Current state | Notes |
|---|---|---|
| web_search | PARTIAL | Implemented without proprietary LLM API; parser is lightweight |
| add_transaction | WORKING FOUNDATION | DB write + read-back verification |
| update_budget | WORKING FOUNDATION | DB write + read-back verification |
| add_task | WORKING FOUNDATION | DB write + read-back verification |
| update_task | WORKING FOUNDATION | DB write + read-back verification |
| permissions | WORKING FOUNDATION | SQLite-backed |
| generate_excel_report | PARTIAL | Basic XLSX generation |
| generate_word_report | PARTIAL | Basic DOCX generation |
| generate_pdf_report | PARTIAL | Basic PDF generation |
| generate_chart | PARTIAL | Basic SVG chart |
| draw_plan | NOT PROFESSIONAL | Simple SVG placeholder |
| CAD analyzer | PARTIAL | DXF metadata/entity analysis |
| Voice DNA TTS | PARTIAL | Optional local provider |
| STT | MISSING | Current voice search UI is simulated |

## Target registry

The central registry should expose schemas, permissions, confirmation policy, executor and validator for:
- expenses
- budgets
- tasks
- calendar
- notes
- files
- search
- calculator
- PDF
- DOCX
- XLSX
- charts
- SVG
- CAD
- voice
- memory
- application navigation

## Tool result contract

Every executor must return:
- ok
- operation
- structured result
- verification
- user-safe error when failed

The model must never be told that an artifact/action succeeded until verification succeeds.

## CAD target

generate_cad should accept a deterministic specification, for example:
- drawing type
- units
- dimensions
- walls
- doors
- windows
- annotations
- layers

Output:
- DXF
- SVG preview
- optional PDF preview

Validation:
- finite coordinates
- valid entity types
- dimensions consistent with geometry
- no malformed/duplicate critical geometry
- parse-back with a DXF reader before release

## File target

inspect_file
extract_text
extract_table
analyze_image
create_pdf
create_docx
create_xlsx
export_artifact

All file tools require MIME/type/size validation and per-user authorization.
