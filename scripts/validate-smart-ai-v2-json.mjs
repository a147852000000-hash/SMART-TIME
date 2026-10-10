import fs from "node:fs";
import path from "node:path";

const file = path.resolve("backend/ai/training/smart-time-tool-v2.jsonl");
const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
const expected = { finance: 300, reminder: 150, calendar: 150, query: 100, unsupported: 32, clarification: 14 };
const counts = Object.fromEntries(Object.keys(expected).map(k => [k, 0]));
const inputs = new Set();

for (let i = 0; i < lines.length; i++) {
  let row;
  try { row = JSON.parse(lines[i]); } catch (e) { throw new Error(`Line ${i + 1}: invalid JSONL`); }
  for (const key of ["instruction","input","output","category"]) {
    if (typeof row[key] !== "string" || !row[key].trim()) throw new Error(`Line ${i + 1}: missing ${key}`);
  }
  if (!(row.category in expected)) throw new Error(`Line ${i + 1}: unknown category ${row.category}`);
  counts[row.category]++;
  if (inputs.has(row.input)) throw new Error(`Line ${i + 1}: duplicate input`);
  inputs.add(row.input);

  let output;
  try { output = JSON.parse(row.output); } catch { throw new Error(`Line ${i + 1}: output is not JSON`); }
  if (!output || typeof output !== "object" || typeof output.tool !== "string") {
    throw new Error(`Line ${i + 1}: output has no tool`);
  }
  if (output.tool === "unsupported" && typeof output.reason !== "string") {
    throw new Error(`Line ${i + 1}: unsupported output needs reason`);
  }
  if (output.tool === "clarification" && (typeof output.ask !== "string" || typeof output.reason !== "string")) {
    throw new Error(`Line ${i + 1}: clarification output needs ask/reason`);
  }
}
for (const [key, value] of Object.entries(expected)) {
  if (counts[key] !== value) throw new Error(`Category ${key}: expected ${value}, got ${counts[key]}`);
}
if (lines.length !== 746) throw new Error(`Expected 746 examples, got ${lines.length}`);
console.log(JSON.stringify({ok:true,total:lines.length,counts}, null, 2));
