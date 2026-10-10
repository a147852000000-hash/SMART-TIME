import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "backend", "server.ts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);

function walk(target) {
  if (!fs.existsSync(target)) return [];
  if (fs.statSync(target).isFile()) return [target];
  const out = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) out.push(...walk(child));
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(child);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((item) => walk(path.join(ROOT, item)));
const EXCLUDE_TESTS = process.env.PHASE5_6_EXCLUDE_TESTS !== "0";

function isTestFile(rel) {
  if (!EXCLUDE_TESTS) return false;
  return /(?:^|\/)(?:[^/]+\.(?:test|spec)\.(?:ts|tsx|js|mjs)|[^/]*tests[^/]*\/|e2e\/)/i.test(rel);
}

const violations = [];
const financeSetItem = /(?:localStorage|StorageAdapter)\.setItem\s*\(\s*(?:['"]smart_time_expenses['"]|STORAGE_KEYS\.EXPENSES\b)/i;
const aiWrite = /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:main\.)?(?:ai_transactions|ai_budgets)\b/i;

for (const file of files) {
  const rel = path.relative(ROOT, file).replaceAll(path.sep, "/");
  if (isTestFile(rel)) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (financeSetItem.test(line)) violations.push(`${rel}:${index + 1} direct finance storage write`);
    if (aiWrite.test(line)) violations.push(`${rel}:${index + 1} ai_transactions/ai_budgets write`);
  }
}

const repository = fs.readFileSync(path.join(ROOT, "src/repositories/financeRepository.ts"), "utf8");
if (repository.includes("FinanceRepositoryWriteDeferredError")) violations.push("financeRepository still defers canonical mutations");

const service = fs.readFileSync(path.join(ROOT, "src/services/financeService.ts"), "utf8");
for (const route of ["/api/finance/expenses", "/api/finance/migrate"]) {
  if (!service.includes(route)) violations.push(`financeService missing ${route}`);
}

const result = {
  scan: "phase5.6-no-duplicate-writes",
  filesScanned: files.length,
  violations,
  passed: violations.length === 0,
};

console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exit(1);
console.log("PASS: canonical finance is the only mutation boundary; AI finance tables are read-only.");