import fs from "node:fs";
import crypto from "node:crypto";

const manifest = JSON.parse(fs.readFileSync("artifacts/training/dataset-provenance.json", "utf8"));

function blobSha(content) {
  const body = Buffer.from(content, "utf8");
  return crypto.createHash("sha1")
    .update(Buffer.from("blob " + body.length + "\0", "utf8"))
    .update(body)
    .digest("hex");
}

function lines(content) {
  return content.split(/\r?\n/).filter((line) => line.trim()).length;
}

function fail(message) {
  console.error("PHASE4 PROVENANCE FAIL: " + message);
  process.exit(1);
}

if (manifest.phase !== 4) fail("manifest phase must be 4");
if (!Array.isArray(manifest.datasets) || manifest.datasets.length !== 12) fail("manifest must contain 12 datasets");

for (const entry of manifest.datasets) {
  if (!fs.existsSync(entry.path)) fail("missing dataset: " + entry.path);
  const content = fs.readFileSync(entry.path, "utf8");
  if (lines(content) !== entry.line_count) fail(entry.path + ": line count mismatch");
  if (blobSha(content) !== entry.blob_sha) fail(entry.path + ": Git blob SHA mismatch");
  if (Buffer.byteLength(content) !== entry.size_bytes) fail(entry.path + ": byte size mismatch");
}

const v2 = manifest.datasets.find((x) => x.path.endsWith("smart-time-tool-v2.jsonl"));
if (!v2) fail("V2 structured dataset missing");

const rows = fs.readFileSync(v2.path, "utf8")
  .split(/\r?\n/)
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line));

const categories = {};
const inputs = new Set();

for (const row of rows) {
  categories[row.category] = (categories[row.category] ?? 0) + 1;
  if (inputs.has(row.input)) fail("duplicate V2 input: " + row.input);
  inputs.add(row.input);
}

const expected = {
  finance: 300,
  reminder: 150,
  calendar: 150,
  query: 100,
  unsupported: 32,
  clarification: 14
};

if (rows.length !== 746) fail("V2 row count is not 746");
if (inputs.size !== 746) fail("V2 unique input count is not 746");

for (const [category, count] of Object.entries(expected)) {
  if (categories[category] !== count) fail("V2 category mismatch: " + category);
}

console.log("PHASE4 PROVENANCE PASS");
console.log(JSON.stringify({ datasets: manifest.datasets.length, v2_rows: rows.length, v2_unique_inputs: inputs.size, categories }, null, 2));
