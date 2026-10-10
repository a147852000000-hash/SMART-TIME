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
const categoryCounts = new Map();
const allTrainingInputs = new Map();

function readJsonl(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    errors.push(relative + ": file not found");
    return [];
  }

  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  return lines.map((line, index) => {
    try {
      return { row: JSON.parse(line), line: index + 1 };
    } catch {
      errors.push(relative + ": invalid JSON on line " + (index + 1));
      return null;
    }
  }).filter(Boolean);
}

for (const relative of trainingFiles) {
  const rows = readJsonl(relative);
  const seen = new Set();

  for (const item of rows) {
    const row = item.row;
    for (const key of ["category", "instruction", "input", "output"]) {
      if (typeof row[key] !== "string" || !row[key].trim()) {
        errors.push(relative + ": line " + item.line + " missing non-empty " + key);
      }
    }

    const input = String(row.input || "").trim();
    if (input) {
      if (seen.has(input)) {
        errors.push(relative + ": duplicate input on line " + item.line);
      }
      seen.add(input);

      if (allTrainingInputs.has(input)) {
        const previous = allTrainingInputs.get(input);
        errors.push(
          "training input overlaps " + previous.file + ":" + previous.line +
          " and " + relative + ":" + item.line
        );
      } else {
        allTrainingInputs.set(input, { file: relative, line: item.line });
      }
    }

    if (row.category) {
      categoryCounts.set(
        row.category,
        (categoryCounts.get(row.category) || 0) + 1
      );
    }
  }

  const minimum = relative.includes("grounded") ? 20 : 40;
  if (rows.length < minimum) {
    errors.push(
      relative + ": expected at least " + minimum +
      " examples, found " + rows.length
    );
  }
}

const evalRows = readJsonl(evalFile);
const evalInputs = new Set();

for (const item of evalRows) {
  const row = item.row;
  for (const key of ["category", "input", "expected_behavior"]) {
    if (typeof row[key] !== "string" || !row[key].trim()) {
      errors.push(evalFile + ": line " + item.line + " missing non-empty " + key);
    }
  }

  const input = String(row.input || "").trim();
  if (input) {
    if (evalInputs.has(input)) {
      errors.push(evalFile + ": duplicate input on line " + item.line);
    }
    evalInputs.add(input);

    if (allTrainingInputs.has(input)) {
      const previous = allTrainingInputs.get(input);
      errors.push(
        "evaluation input overlaps training " +
        previous.file + ":" + previous.line +
        " and " + evalFile + ":" + item.line
      );
    }
  }

  if (row.category) {
    categoryCounts.set(
      row.category,
      (categoryCounts.get(row.category) || 0) + 1
    );
  }
}

if (evalRows.length < 15) {
  errors.push(
    evalFile + ": expected at least 15 held-out examples, found " +
    evalRows.length
  );
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("SMART AI datasets valid.");
console.log(JSON.stringify(Object.fromEntries(categoryCounts), null, 2));
