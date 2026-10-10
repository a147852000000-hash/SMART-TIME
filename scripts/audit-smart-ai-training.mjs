#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const trainingFiles = [
  "backend/ai/training/smart-time-v2.jsonl",
  "backend/ai/training/smart-time-grounded-v1.jsonl",
];
const evalFile = "backend/ai/training/smart-time-eval-v1.jsonl";

const errors = [];
const warnings = [];
const trainingInputs = new Set();

const suspiciousPatterns = [
  /sk-[A-Za-z0-9]{20,}/i,
  /AIza[0-9A-Za-z_-]{20,}/,
  /Bearer\\s+[A-Za-z0-9._-]{20,}/i,
  /-----BEGIN (?:RSA|OPENSSH|PRIVATE) KEY-----/,
  /password\\s*[:=]\\s*[^\\s]+/i,
  /api[_ -]?key\\s*[:=]\\s*[^\\s]+/i,
  /token\\s*[:=]\\s*[^\\s]+/i,
];

const forbiddenDataTerms = [
  "customer recording",
  "customer voice",
  "voice embedding",
  "raw audio file",
  "/mnt/data/",
  "data:image/",
];

function readJsonl(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    errors.push(relative + ": missing");
    return [];
  }
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try { return { row: JSON.parse(line), line: index + 1 }; }
      catch { errors.push(relative + ': invalid JSON at line ' + (index + 1)); return null; }
    })
    .filter(Boolean);
}

function scanValue(value, location) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(text)) errors.push(location + ': possible secret pattern ' + pattern);
  }
  for (const term of forbiddenDataTerms) {
    if (text.toLowerCase().includes(term.toLowerCase())) warnings.push(location + ': contains restricted training-data term ' + term);
  }
}

for (const relative of trainingFiles) {
  for (const item of readJsonl(relative)) {
    const row = item.row;
    if (!row.category || !row.instruction || !row.input || !row.output) errors.push(relative + ':' + item.line + ': incomplete training row');
    if (row.input) {
      const key = row.input.trim();
      if (trainingInputs.has(key)) errors.push(relative + ':' + item.line + ': duplicate input across training files');
      trainingInputs.add(key);
    }
    scanValue(row, relative + ':' + item.line);
  }
}

for (const item of readJsonl(evalFile)) {
  const row = item.row;
  if (!row.category || !row.input || !row.expected_behavior) errors.push(evalFile + ':' + item.line + ': incomplete evaluation row');
  if (row.input && trainingInputs.has(row.input.trim())) errors.push(evalFile + ':' + item.line + ': evaluation input overlaps training input');
  scanValue(row, evalFile + ':' + item.line);
}

const configPath = path.join(root, 'infra/smart-ai/training/experiment.json');
if (fs.existsSync(configPath)) scanValue(JSON.parse(fs.readFileSync(configPath, 'utf8')), 'infra/smart-ai/training/experiment.json');

if (errors.length) {
  console.error(errors.join('\n'));
  if (warnings.length) console.error(warnings.join('\n'));
  process.exit(1);
}

console.log("SMART AI training-data audit passed.");
console.log(JSON.stringify({ training_unique_inputs: trainingInputs.size, eval_examples: readJsonl(evalFile).length, warnings }, null, 2));