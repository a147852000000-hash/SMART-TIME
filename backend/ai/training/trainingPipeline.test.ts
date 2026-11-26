import { runTrainingRound, getTrainingHistory, DEDICATED_MODEL_TAG } from "./trainingPipeline.js";
import { readFileSync, existsSync } from "node:fs";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const inRange = (value: number, message: string) => {
  assert(Number.isFinite(value) && value >= 0 && value <= 1, message);
};

// Round 1: execute a real recorded training round.
const roundA = runTrainingRound({ notes: "harness round A" });
assert(roundA.round >= 1, "round number recorded");
assert(roundA.modelTag === DEDICATED_MODEL_TAG, "dedicated model tag recorded");
inRange(roundA.metrics.factualGrounding, "factual grounding metric in range");
inRange(roundA.metrics.noFabrication, "no-fabrication metric in range");
inRange(roundA.metrics.confirmationBoundary, "confirmation boundary metric in range");
inRange(roundA.metrics.toolSelectionValidity, "tool selection metric in range");
assert(roundA.metrics.noFabrication === 1.0, "no fabrication is perfect on held-out eval");
assert(roundA.metrics.confirmationBoundary === 1.0, "confirmation boundary is perfect");
assert(roundA.metrics.toolSelectionValidity >= 0.95, "tool selection validity above release threshold");
assert(roundA.evalCount === 22, "eval v1 held-out set fully evaluated");
assert(roundA.corpusRows > 20, "SFT corpus actually built");
assert(roundA.knowledgeVersion.length > 0, "knowledge version recorded");
assert(typeof roundA.passed === "boolean", "round pass verdict recorded");

// Round 2: training repeats and the ledger increments (multi-round training).
const roundB = runTrainingRound({ notes: "harness round B" });
assert(roundB.round === roundA.round + 1, "second round increments the ledger");
assert(roundB.metrics.factualGrounding === roundA.metrics.factualGrounding, "deterministic metrics reproducible");

// History endpoint backing store returns both rounds, newest first.
const history = getTrainingHistory(5);
assert(history.length >= 2, "history returns recorded rounds");
assert(history[0].round === roundB.round, "history newest first");

// The corpus file written by the latest round is real and parseable JSONL.
if (roundB.corpusPath) {
  assert(existsSync(roundB.corpusPath), "corpus file exists on disk");
  const lines = readFileSync(roundB.corpusPath, "utf8").split("\n").filter(l => l.trim());
  assert(lines.length === roundB.corpusRows, "corpus file row count matches the ledger");
  const first = JSON.parse(lines[0]) as { messages: Array<{ role: string; content: string }> };
  assert(Array.isArray(first.messages) && first.messages[0].role === "system", "corpus rows are SFT message triples");
} else {
  throw new Error("corpus path not recorded");
}

console.log("TRAINING PIPELINE tests passed");
