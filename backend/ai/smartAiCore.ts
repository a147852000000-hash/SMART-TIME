import { runOpenMindBrain } from "./openMindBrain.js";
import type { SmartAiRequest, SmartAiResponse } from "./types.js";

export async function askSmartAiCore(request: SmartAiRequest): Promise<SmartAiResponse> {
  try { return await runOpenMindBrain(request); }
  catch { return { reply: "تعذر تشغيل SMART AI حاليًا.", action: null, provider: "smart-ai", model: "smart-ai-core", engine: "rules", needsClarification: true, requiresConfirmation: false }; }
}
