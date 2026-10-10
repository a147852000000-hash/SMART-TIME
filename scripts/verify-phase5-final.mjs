import { spawnSync } from "node:child_process";

const steps = [
  ["verify:phase5-finance-migration", ["scripts/verify-phase5-finance-migration.mjs"]],
  ["verify:phase5-ai-canonical", ["scripts/verify-phase5-ai-canonical.mjs"]],
  ["verify:phase5-no-duplicate-writes", ["scripts/verify-phase5-no-duplicate-writes.mjs"]],
  ["build", ["-c", "npm run build"]],
];

function run(label, command, args) {
  console.log(`\\n===== PHASE 5.7 :: ${label} =====`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) {
    console.error(`\\nPHASE 5.7 FAIL — ${label} exited with code ${result.status ?? "unknown"}`);
    process.exit(result.status || 1);
  }
  console.log(`PHASE 5.7 PASS — ${label}`);
}

for (const [label, args] of steps) {
  if (label === "build") run(label, "npm", args);
  else run(label, "node", args);
}

console.log("\\n============================================================");
console.log("PHASE 5.7 PASS — ALL FINANCE VERIFIERS + BUILD GREEN");
console.log("============================================================");
