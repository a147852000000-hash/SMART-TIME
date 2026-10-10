import fs from "node:fs";
import path from "node:path";

const DEFAULT_MODEL_PATH = "backend/ai/models/smart-ai-v2-super";

export interface RunLocalInferenceInput { input: string; modelPath?: string; retryHint?: string; }
export interface RunLocalInferenceResult {
  raw: string; model: string; modelPath: string;
  runtime: { quantization: "4bit-NF4-double-quant"; computeDtype: "bf16" | "fp16"; capability: number | null; enableThinking: false; adapterPath: string; };
}
function extractText(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((p: any) => typeof p?.text === "string" ? p.text : "").join("").trim();
  return "";
}
function computeDtype(): "bf16" | "fp16" {
  const capability = Number(process.env.SMART_AI_GPU_CAPABILITY || "");
  return Number.isFinite(capability) && capability >= 8 ? "bf16" : "fp16";
}
function assertAdapterPresent(modelPath: string) {
  const absolutePath = path.resolve(process.cwd(), modelPath);
  if (!fs.existsSync(absolutePath)) throw new Error(`SMART AI V2 adapter directory is missing: ${modelPath}`);
  const config = path.join(absolutePath, "adapter_config.json");
  const weights = ["adapter_model.safetensors", "adapter_model.bin"].find((name) => fs.existsSync(path.join(absolutePath, name)));
  if (!fs.existsSync(config) || !weights) throw new Error(`SMART AI V2 adapter is incomplete at ${modelPath}. Expected adapter_config.json and adapter weights. The real smart-ai-v2-super adapter must be installed here; placeholder files are not accepted.`);
}
export async function runLocalInference(input: RunLocalInferenceInput): Promise<RunLocalInferenceResult> {
  const url = String(process.env.SMART_AI_LOCAL_URL || "").trim().replace(/\/$/, "");
  if (!url) throw new Error("SMART_AI_LOCAL_URL is not configured.");
  const modelPath = input.modelPath || process.env.SMART_AI_V2_MODEL_PATH || DEFAULT_MODEL_PATH;
  const remoteAdapterRuntime = Boolean(url);
  if (!remoteAdapterRuntime) assertAdapterPresent(modelPath);
  const model = String(process.env.SMART_AI_V2_MODEL || process.env.SMART_AI_LOCAL_MODEL || "smart-ai-v2-super");
  const token = String(process.env.SMART_AI_LOCAL_TOKEN || "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  const retryInstruction = input.retryHint ? `\nRETRY INSTRUCTION: ${input.retryHint}` : "";
  const systemPrompt = `You are SMART TIME. Return exactly one JSON object and nothing else. Never emit <think>, </think>, markdown fences, or free text. Use the SMART TIME V2 structured-output contract.${retryInstruction}`;
  try {
    const response = await fetch(url + "/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: JSON.stringify({ model, stream: false, temperature: 0.2, max_tokens: 700, chat_template_kwargs: { enable_thinking: false }, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: input.input }] }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error("Local SMART AI HTTP " + response.status);
    const raw = extractText(await response.json());
    if (!raw) throw new Error("Local SMART AI returned empty output.");
    return { raw, model, modelPath, runtime: { quantization: "4bit-NF4-double-quant", computeDtype: computeDtype(), capability: Number.isFinite(Number(process.env.SMART_AI_GPU_CAPABILITY)) ? Number(process.env.SMART_AI_GPU_CAPABILITY) : null, enableThinking: false, adapterPath: remoteAdapterRuntime ? "remote-gpu-provider" : path.resolve(process.cwd(), modelPath) } };
  } finally { clearTimeout(timeout); }
}
