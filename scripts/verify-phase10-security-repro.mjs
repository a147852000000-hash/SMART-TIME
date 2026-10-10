#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (p) => fs.readFileSync(path.join(root,p),"utf8");
const arch = read("docs/VOICE_FIRST_ARCHITECTURE.md");
const manifest = JSON.parse(read("infra/smart-ai/training/phase10-training-manifest.json"));

if (!arch.includes("The model is not a database client and does not receive secrets.")) {
  errors.push("model secret boundary is not explicitly documented");
}
if (!arch.includes("The model never receives direct database credentials.")) {
  errors.push("tool/data credential boundary is not explicitly documented");
}
if (!arch.includes("invalid proposals never reach execution")) {
  errors.push("validator execution boundary is not explicitly documented");
}
if (!arch.includes("destructive actions require a final scope/confirmation boundary")) {
  errors.push("destructive confirmation boundary is not explicit");
}

const requiredManifestPaths = [
  ["base_model.name", manifest.base_model?.name],
  ["adapter.method", manifest.adapter?.method],
  ["runtime.seed_required", manifest.runtime?.seed_required],
  ["artifact_policy.model_hash_required", manifest.artifact_policy?.model_hash_required],
  ["artifact_policy.adapter_hash_required", manifest.artifact_policy?.adapter_hash_required],
  ["artifact_policy.dataset_hash_required", manifest.artifact_policy?.dataset_hash_required],
  ["artifact_policy.rollback_reference_required", manifest.artifact_policy?.rollback_reference_required],
  ["artifact_policy.artifact_location_required", manifest.artifact_policy?.artifact_location_required],
  ["activation_policy", manifest.activation_policy],
  ["evaluation_suite.version", manifest.evaluation_suite?.version],
  ["runtime.library_versions.node", manifest.runtime?.library_versions?.node],
  ["runtime.library_versions.python", manifest.runtime?.library_versions?.python]
];
for (const [name,value] of requiredManifestPaths) {
  if (value === undefined || value === null || value === "") errors.push("reproducibility field missing: " + name);
}
if (manifest.runtime?.seed_required !== true) errors.push("seed must be required");
if (manifest.base_model?.revision !== null) errors.push("Phase 10 pre-run model revision must remain unset");
if (Object.keys(manifest.training_data?.sha256 || {}).length !== 0) errors.push("Phase 10 pre-run dataset hashes must remain unset");
if (Object.keys(manifest.held_out_evaluation?.sha256 || {}).length !== 0) errors.push("Phase 10 pre-run eval hashes must remain unset");
if (manifest.training_authorized_by_phase !== false) errors.push("Phase 10 must not authorize training");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("PHASE 10 SECURITY + REPRODUCIBILITY CONTRACT: PASS");
console.log(JSON.stringify({
  phase: 10,
  security_boundaries: "documented_and_consistent",
  reproducibility_contract: "complete_pre_run_blocking_manifest",
  training_authorized: false
}, null, 2));
