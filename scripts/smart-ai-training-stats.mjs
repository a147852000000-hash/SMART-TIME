#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  "backend/ai/training/smart-time-v2.jsonl",
  "backend/ai/training/smart-time-grounded-v1.jsonl",
];

const counts = {};
let total = 0;
let arabic = 0;
let grounded = 0;

for (const relative of files) {
  const rows = fs.readFileSync(path.join(root, relative), 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  for (const row of rows) {
    total++;
    counts[row.category] = (counts[row.category] || 0) + 1;
    if (/[\u0600-\u06ff]/.test(row.input)) arabic++;
    if (Object.prototype.hasOwnProperty.call(row, 'smartTimeData')) grounded++;
  }
}

console.log(JSON.stringify({
  total_training_examples: total,
  arabic_input_examples: arabic,
  arabic_input_share: Number((arabic / total).toFixed(3)),
  grounded_examples: grounded,
  grounded_share: Number((grounded / total).toFixed(3)),
  categories: counts
}, null, 2));