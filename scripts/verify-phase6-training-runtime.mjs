#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptPath = resolve(root, "infra/smart-ai/training/train_smart_ai.py");
const reqPath = resolve(root, "infra/smart-ai/training/requirements-phase6.txt");
const docPath = resolve(root, "infra/smart-ai/training/REPRODUCIBILITY.md");
const packagePath = resolve(root, "package.json");
function fail(message) { console.error("PHASE6 FAIL:", message); process.exit(1); }
function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function mustContain(text, needle, label) { if (!text.includes(needle)) fail(label + " missing: " + needle); }
if (![scriptPath, reqPath, docPath, packagePath].every(existsSync)) fail("required Phase 6 file missing");
const script = readFileSync(scriptPath, "utf8");
const reqText = readFileSync(reqPath, "utf8");
const docText = readFileSync(docPath, "utf8");
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
for (const needle of ["SEED","MODEL_REVISION","EXPECTED_PYTHON_VERSION","DETERMINISTIC_TRAINING","torch.manual_seed","torch.cuda.manual_seed_all","torch.use_deterministic_algorithms","dataset_manifest","run-metadata.json","run_fingerprint","git_commit","training_script_sha256","requirements_sha256","hardware","selected_dtype","revision=MODEL_REVISION","revision=MODEL_REVISION",]) mustContain(script, needle, "training runtime contract");
for (const line of ["torch==2.10.0","transformers==5.18.0","datasets==5.0.1","peft==0.21.1","bitsandbytes==0.50.2","accelerate==1.15.0","trl==1.14.1"]) mustContain(reqText, line, "pinned requirement");
for (const needle of ["Python: 3.12.13","Default seed: 42","Deterministic algorithms: enabled by default","run-metadata.json","rerun"]) mustContain(docText, needle, "reproducibility documentation");
mustContain(pkg.scripts?.["verify:phase6-training-runtime"] ?? "", "scripts/verify-phase6-training-runtime.mjs", "package script");
try {
  const pythonVersion = execFileSync("python3", ["--version"], { encoding: "utf8" }).trim();
  if (!pythonVersion.includes("3.12.13")) fail("Python runtime must be exactly 3.12.13; found " + pythonVersion);
  execFileSync("python3", ["-m", "py_compile", scriptPath], { stdio: "inherit" });
} catch (error) {
  if (String(error?.message ?? "").includes("Python runtime must be exactly")) throw error;
  fail("Python syntax/runtime check failed");
}
const gitCommit = (() => { try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch { return "unavailable"; } })();
const datasetFiles = ["backend/ai/training/smart-time-sft.jsonl","backend/ai/training/smart-time-grounded-v4-batch-a.jsonl","backend/ai/training/smart-time-grounded-v4-batch-b-train.jsonl"];
for (const rel of datasetFiles) if (!existsSync(resolve(root, rel))) fail("training dataset missing: " + rel);
console.log("PHASE6 PASS");
console.log(JSON.stringify({git_commit:gitCommit,training_script_sha256:sha256(scriptPath),requirements_sha256:sha256(reqPath),dataset_sha256:Object.fromEntries(datasetFiles.map(rel=>[rel,sha256(resolve(root,rel))])),checks:["pinned environment","seed and deterministic runtime","dataset hashing","run fingerprint and metadata","hardware/dtype capture","rerun documentation","python syntax"]},null,2));
