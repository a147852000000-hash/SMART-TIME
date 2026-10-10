import { classifyIntent, planRequest } from "./openMindBrain.js";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

assert(classifyIntent("ابحث عن أسعار الذهب اليوم") === "web_research", "web intent");
assert(classifyIntent("اعمل لي تقرير PDF عن المصاريف") === "report_generation", "report intent");
assert(classifyIntent("حلل ملف DXF ده") === "cad_analysis", "cad intent");
assert(classifyIntent("احسب سرعة العربية في الفيديو") === "speed_estimation", "cv intent");
assert(classifyIntent("احسب الطريق بين القاهرة والإسكندرية") === "maps", "maps intent");

const destructive = planRequest({ message: "امسح المصروف ده", language: "ar", appContext: {} });
assert(destructive.requiresConfirmation === true, "mutations require confirmation");

const research = planRequest({ message: "ابحث عن أحدث أسعار الفائدة", language: "ar", appContext: {} });
assert(research.intent === "web_research", "research plan");
assert(research.steps.includes("retrieve external sources"), "research has source step");

console.log("OPEN MIND brain tests passed");
