import fs from "node:fs";

const source = fs.readFileSync("src/services/storageKeys.ts", "utf8");

const registryBlock = source.match(/export const STORAGE_KEYS = \{([\s\S]*?)\n\} as const;/)?.[1] ?? "";
const registryEntries = registryBlock.match(/^\s{2}[A-Z][A-Z0-9_]*:\s*['"][^'"]+['"],?$/gm) ?? [];

const expected = {
  DASHBOARD_LAYOUT: "smart_time_dashboard_layout",
  DASHBOARD_SECTIONS_V2: "smart_time_dashboard_sections_v2",
  WORKOUT_LOGS: "smart_time_workout_logs",
  SPORTS_CARDS_ORDER: "smart_time_sports_cards_order",
  EXPENSES_SECTIONS_ORDER: "smart_time_expenses_sections_order",
};

if (registryEntries.length !== 33) {
  throw new Error(`Phase 3 expected 33 registry entries, found ${registryEntries.length}`);
}

for (const [name, key] of Object.entries(expected)) {
  const line = `${name}: '${key}',`;
  if (!registryBlock.includes(line)) {
    throw new Error(`Missing registry entry: ${line}`);
  }
}

const migrationBlock = source.match(/export const STORAGE_KEY_MIGRATIONS = \{([\s\S]*?)\n\} as const;/)?.[1] ?? "";
const migrationEntries = migrationBlock.match(/^\s{2}smart_time_[a-z0-9_]+:\s*STORAGE_KEYS\.[A-Z0-9_]+,?$/gm) ?? [];

if (migrationEntries.length !== 5) {
  throw new Error(`Phase 3 expected 5 migration entries, found ${migrationEntries.length}`);
}

for (const key of Object.values(expected)) {
  if (!migrationBlock.includes(`${key}: STORAGE_KEYS.`)) {
    throw new Error(`Missing migration map entry for ${key}`);
  }
}

console.log("PHASE 3 STORAGEKEYS GATE: PASS — 33 registry entries + 5 hidden-key migrations");
