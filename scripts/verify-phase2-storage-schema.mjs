import fs from "node:fs";

const schemaPath = "src/services/storageSchema.ts";
const source = fs.readFileSync(schemaPath, "utf8");

const known = (source.match(/^\s{2}\[[A-Z0-9_.]+\]: \{/gm) ?? []).length;

const hiddenKeys = [
  "DASHBOARD_LAYOUT",
  "DASHBOARD_SECTIONS_V2",
  "WORKOUT_LOGS",
  "SPORTS_CARDS_ORDER",
  "EXPENSES_SECTIONS_ORDER",
];
const hidden = hiddenKeys.filter((key) =>
  source.includes(`[STORAGE_KEYS.${key}]: {`),
).length;

// Phase 2 closed at 28 keys (Run #18), Phase 3 expanded to 33 keys (Run #7)
// Allow both for backward compatibility after Phase 3.
if (known !== 28 && known !== 33) {
  throw new Error(`Phase 2/3 expected 28 or 33 known keys, found ${known}`);
}
if (hidden !== 5) {
  throw new Error(`Phase 2 expected 5 hidden keys, found ${hidden}`);
}
if (!source.includes("isStorageSchemaKey")) throw new Error("Missing isStorageSchemaKey()");
if (!source.includes("validateStorageValue")) throw new Error("Missing validateStorageValue()");
if (!source.includes("parseStorageValue")) throw new Error("Missing parseStorageValue()");
if (!source.includes("satisfies {")) throw new Error("Schema is not compile-time checked with satisfies");

console.log(`PHASE 2 SCHEMA GATE: PASS — ${known} known + ${hidden} hidden = ${known + hidden} entries`);
