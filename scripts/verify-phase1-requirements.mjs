import fs from "node:fs";
import process from "node:process";

const reqPath = "docs/PHASE_01_REQUIREMENTS_TRACEABILITY.md";

function fail(message) {
  console.error(`PHASE 1 REQUIREMENTS GATE: FAIL — ${message}`);
  process.exit(1);
}

if (!fs.existsSync(reqPath)) {
  fail(`${reqPath} is missing`);
}

const text = fs.readFileSync(reqPath, "utf8");

const requiredTokens = [
  "# SMART-TIME Phase 1",
  "## 1. Purpose",
  "## 2. Canonical target architecture",
  "## 3. Scope boundaries",
  "## 4. Frozen requirements",
  "## 5. Requirement traceability to canonical repository sources",
  "## 6. Canonical phase execution order",
  "## 7. Phase 1 closure gates",
  "## 9. Sign-off record",
  "docs/AI_ARCHITECTURE.md",
  "docs/AI_EVALUATION.md",
  "docs/AI_DEPLOYMENT.md",
  "docs/CURRENT_STATE.md",
  "backend/ai/localInference.ts",
  "backend/ai/openMindBrain.ts",
  "backend/ai/toolExecutor.ts",
  "backend/ai/smart-ai-tool/contextMemory.ts",
  "src/components/AiCenterView.tsx",
  "src/components/VoiceSearchModal.tsx",
  "package.json"
];

for (const token of requiredTokens) {
  if (!text.includes(token)) fail(`missing required token: ${token}`);
}

for (let i = 1; i <= 8; i += 1) {
  const id = `TM-${String(i).padStart(2, "0")}`;
  if (!text.includes(`| ${id} |`)) fail(`missing test matrix entry ${id}`);
}

for (let i = 1; i <= 19; i += 1) {
  const id = `R-${String(i).padStart(2, "0")}`;
  if (!text.includes(`| ${id} |`)) fail(`missing requirement ${id}`);
}

if (!/Professional CAD\/DWG generation.*out of scope|out of SMART-TIME scope/i.test(text)) {
  fail("explicit CAD/DWG scope boundary is missing");
}

const phases = [...text.matchAll(/\b(\d+) -> \d+/g)].map(m => Number(m[1]));
if (phases.length < 3 || phases[0] !== 1) {
  fail("canonical phase order is not present");
}

if (!text.includes("a phase may have future dependencies defined in this document, but it does not start before the immediately preceding phase is formally closed")) {
  fail("strict no-skip phase rule is missing");
}

console.log("PHASE 1 REQUIREMENTS GATE: PASS");
console.log("Requirements: 19");
console.log("Traceability: present");
console.log("Scope boundaries: present");
console.log("Canonical phase order: present");
console.log("Strict sequential closure rule: present");
