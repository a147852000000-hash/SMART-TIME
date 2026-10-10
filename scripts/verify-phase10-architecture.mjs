#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const architecturePath = path.join(root, "docs/VOICE_FIRST_ARCHITECTURE.md");
const evaluationPath = path.join(root, "docs/AI_EVALUATION.md");
const manifestPath = path.join(root, "infra/smart-ai/training/phase10-training-manifest.json");

const errors = [];

function read(file) {
  if (!fs.existsSync(file)) {
    errors.push("missing: " + path.relative(root, file));
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

const architecture = read(architecturePath);
const evaluation = read(evaluationPath);
let manifest = null;

try {
  manifest = JSON.parse(read(manifestPath));
} catch (error) {
  errors.push("invalid JSON: infra/smart-ai/training/phase10-training-manifest.json");
}

const requiredArchitectureTerms = [
  "Voice-First Architecture",
  "Canonical runtime order",
  "Policy + Schema Validator",
  "Central Tool Registry / Agent Router",
  "Read-back Verification",
  "Canonical evaluation order",
  "Training gate"
];

for (const term of requiredArchitectureTerms) {
  if (!architecture.includes(term)) errors.push("architecture missing: " + term);
}

if (!evaluation.includes("10. Voice-First Architecture + Execution Order")) {
  errors.push("evaluation plan does not list Phase 10 in canonical order");
}

if (!evaluation.includes("Never mark a gate PASS without test evidence.")) {
  errors.push("evaluation evidence rule missing");
}

const expectedOrder = [
  "model_health",
  "stt_transcript_correctness",
  "intent_preservation",
  "structured_proposal_validity",
  "policy_schema_validation",
  "confirmation_boundary",
  "tool_execution",
  "read_back_verification",
  "response_grounding",
  "tts_synthesis",
  "audio_playback",
  "voice_e2e_latency_and_error",
  "security_privacy",
  "reproducibility_artifacts"
];

if (manifest) {
  if (manifest.phase !== 10) errors.push("manifest phase must be 10");
  if (manifest.training_authorized_by_phase !== false) errors.push("Phase 10 must not authorize training");
  if (JSON.stringify(manifest.evaluation_order) !== JSON.stringify(expectedOrder)) {
    errors.push("manifest evaluation order does not match the canonical architecture");
  }
  if (!manifest.evaluation_suite?.version) errors.push("evaluation suite version missing");
  if (!Array.isArray(manifest.expected_gates) || manifest.expected_gates.length !== expectedOrder.length) errors.push("expected gates must cover the canonical evaluation order");
  if (!manifest.runtime?.library_versions?.node || !manifest.runtime?.library_versions?.python) errors.push("runtime/library version contract missing");
  if (manifest.activation_policy !== "evaluation_then_manual_runtime_enable") {
    errors.push("unexpected activation policy");
  }
  if (manifest.base_model?.revision !== null) errors.push("pre-run manifest revision must remain unset until verified");
  if (Object.keys(manifest.training_data?.sha256 || {}).length !== 0) errors.push("pre-run dataset hashes must remain unset until verified");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("PHASE 10 ARCHITECTURE CONTRACT: PASS");
console.log(JSON.stringify({
  phase: 10,
  architecture: "canonical",
  evaluation_order: "canonical",
  training_manifest: "present_pre_run",
  training_authorized: false
}, null, 2));
