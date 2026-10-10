import fs from "node:fs";

const registry = JSON.parse(fs.readFileSync("artifacts/training/model-data-version-registry.json", "utf8"));
const requiredModelIds = new Set(["base-qwen3-4b","adapter-v1-existing","adapter-v2-kaggle-20261001"]);
const requiredDatasetIds = new Set(["dataset-tool-v2-746","dataset-eval-v1-22","dataset-eval-v4g-12"]);
const requiredMetrics = ["structured_output_validity","held_out_no_fabrication","confirmation_boundary_accuracy","tool_argument_validity","clarification_validity","secret_protection"];

function fail(message) {
  console.error("PHASE5 REGISTRY FAIL: " + message);
  process.exit(1);
}

if (registry.phase !== 5) fail("registry phase must be 5");
if (!Array.isArray(registry.models) || registry.models.length !== 3) fail("expected 3 registered model candidates");
if (!Array.isArray(registry.datasets) || registry.datasets.length !== 3) fail("expected 3 registered datasets");

for (const id of requiredModelIds) {
  if (!registry.models.some((x) => x.id === id)) fail("missing model: " + id);
}
for (const id of requiredDatasetIds) {
  if (!registry.datasets.some((x) => x.id === id)) fail("missing dataset: " + id);
}

for (const dataset of registry.datasets) {
  if (!fs.existsSync(dataset.path)) fail("dataset path missing: " + dataset.path);
}

for (const metric of requiredMetrics) {
  const value = registry.objective_metrics?.[metric];
  if (!value) fail("missing objective metric: " + metric);
  if (typeof value.release_threshold !== "number") fail("metric threshold missing: " + metric);
  if (!["higher","lower"].includes(value.direction)) fail("metric direction invalid: " + metric);
  if (!value.unit) fail("metric unit missing: " + metric);
}

const v2 = registry.models.find((x) => x.id === "adapter-v2-kaggle-20261001");
if (v2.release_status !== "blocked_generation_gate") fail("V2 must remain blocked");
if (v2.generation_gate?.total !== 120 || v2.generation_gate?.passed !== 0) fail("V2 generation evidence mismatch");
if (v2.eval_loss !== 0.12700095772743225) fail("V2 eval loss evidence mismatch");

if (registry.policy.customer_data_allowed || registry.policy.voice_dna_data_allowed || registry.policy.secrets_allowed) {
  fail("prohibited data boundary was relaxed");
}

console.log("PHASE5 REGISTRY PASS");
console.log(JSON.stringify({
  models: registry.models.map((x) => ({id:x.id, release_status:x.release_status})),
  datasets: registry.datasets.map((x) => ({id:x.id, rows:x.rows})),
  objective_metrics: Object.keys(registry.objective_metrics)
}, null, 2));
