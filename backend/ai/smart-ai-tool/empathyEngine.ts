export type ProblemType = "emotional" | "social" | "economic" | "technical" | "general";

export function detectProblemType(text: string): ProblemType {
  const m = String(text || "").toLowerCase();
  if (/مخنوق|زعلان|حزين|متضايق|مكسور|قلق|توتر|اكتئاب|مش قادر|مخنوقة/.test(m)) return "emotional";
  if (/متخانق|خناقة|خلاف|علاقة|مراتي|جوزي|صاحبي|أهلي|شغل|مديري/.test(m)) return "social";
  if (/فلوس|مرتب|مصاريف|ديون|دين|ميزانية|دخل|اقتصاد|توفير/.test(m)) return "economic";
  if (/بايظ|خطأ|مشكلة تقنية|كود|برنامج|سيرفر|كمبيوتر|موبايل/.test(m)) return "technical";
  return "general";
}

export function empathicResponse(type: ProblemType, text: string) {
  const empathy: Record<ProblemType, string> = {
    emotional: "فاهم إن الموضوع ضاغط عليك، خلينا نفكّه واحدة واحدة من غير حكم عليك.",
    social: "واضح إن الموقف معقد ومضايقك، خلينا نفصل اللي حصل عن اللي ممكن نعمله دلوقتي.",
    economic: "خلينا نبص للموضوع بالأرقام بهدوء ونطلع بخطوات عملية تقدر تنفذها.",
    technical: "خلينا نمسك المشكلة من السبب ونمشي خطوة خطوة بدل ما نجرب عشوائي.",
    general: "أنا معاك، احكيلي الجزء اللي مضايقك ونرتبه سوا."
  };
  const questions = type === "economic"
    ? ["إيه أكبر بند مصاريف ضاغط عليك؟", "الدخل الشهري التقريبي كام؟"]
    : ["إيه اللي حصل بالضبط؟", "إيه النتيجة اللي نفسك توصل لها؟"];
  return { empathy: empathy[type], questions, sourceText: String(text || "").slice(0, 500) };
}
