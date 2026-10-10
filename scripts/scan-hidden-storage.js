import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("./src");
const KNOWN_KEYS_FILE = path.resolve("./src/services/storageKeys.ts");
const OUTPUT = path.resolve("./docs/ai/STORAGE-DISCOVERED-V2.json");
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const DIRECT = /(?:localStorage|sessionStorage)\s*\.\s*(getItem|setItem|removeItem|clear)\s*\(\s*['"]([^'"]+)['"]/g;
const ADAPTER = /(?:StorageAdapter|storageAdapter)\s*\.\s*(get|set|remove|delete|clear)\s*\(\s*['"]([^'"]+)['"]/g;
const LITERAL = /smart_time_[a-z0-9_]+/gi;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

const knownContent = fs.readFileSync(KNOWN_KEYS_FILE, "utf8");
const knownKeys = [...knownContent.matchAll(/['"]smart_time_[^'"]+['"]/g)].map(m => m[0].slice(1, -1));
const knownSet = new Set(knownKeys);
const files = walk(ROOT);
const findings = [];

function add(key, file, access, evidence) {
  if (!key.startsWith("smart_time_")) return;
  findings.push({ key, file: path.relative(process.cwd(), file), access, evidence });
}

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const re of [DIRECT, ADAPTER]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) add(m[2], file, m[1], "storage-call");
  }
  LITERAL.lastIndex = 0;
  let m;
  while ((m = LITERAL.exec(text))) add(m[0], file, "string-reference", "smart_time-literal");
}

const unique = new Map(findings.map(x => [JSON.stringify(x), x]));
const all = [...unique.values()];
const hiddenKeys = [...new Set(all.filter(x => !knownSet.has(x.key)).map(x => x.key))].sort();
const grouped = {};
for (const x of all) (grouped[x.key] ??= []).push({ file: x.file, access: x.access, evidence: x.evidence });

const result = {
  schema_version: "2.0",
  scanned_at: new Date().toISOString(),
  scope: {
    root: "src",
    extensions: [...EXTENSIONS],
    direct_storage_apis: ["localStorage", "sessionStorage"],
    adapter_patterns: ["StorageAdapter", "storageAdapter"],
    literal_pattern: "smart_time_*"
  },
  known_registry: {
    file: "src/services/storageKeys.ts",
    key_count: knownKeys.length,
    keys: [...knownKeys].sort()
  },
  scan: {
    files_scanned: files.length,
    total_discovered_keys: Object.keys(grouped).length,
    hidden_discovered_keys: hiddenKeys.length,
    hidden_keys: hiddenKeys,
    findings: grouped
  },
  phase_1_note: "Discovery evidence only. Not the canonical storage registry."
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + "\n");

console.log("Files scanned:", files.length);
console.log("Known registry keys:", knownKeys.length);
console.log("Total discovered keys:", Object.keys(grouped).length);
console.log("Hidden discovered keys:", hiddenKeys.length);
hiddenKeys.forEach(k => console.log("HIDDEN:", k));
console.log("Output:", OUTPUT);
