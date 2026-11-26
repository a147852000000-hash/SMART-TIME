// Hermetic test: brain engine-chain fallback without any API keys.
// env is sanitised BEFORE the dynamic imports so the Groq/local singletons
// are constructed unconfigured (mirrors production with no GROQ_API_KEY yet).
process.env.GROQ_API_KEY = "";
process.env.GROQ_MODEL = "";
delete process.env.SMART_AI_LOCAL_URL;

const { runOpenMindBrain, classifyIntent } = await import("./openMindBrain.js");

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

// 1) Data question with period -> deterministic rules answer grounded in data.
const comparison = await runOpenMindBrain({
  message: "قارن مصاريف الشهر ده بالشهر اللي فات",
  language: "ar",
  appContext: {
    profile: { name: "مستخدم", currency: "EGP", language: "ar" },
    expenses: [
      { id: "e1", title: "أكل", amount: 250, category: "food", date: new Date().toISOString().slice(0, 10) },
      { id: "e2", title: "مواصلات", amount: 80, category: "transport", date: new Date().toISOString().slice(0, 10) },
    ],
  },
  userId: "fallback_test_user",
});
assert(comparison.engine === "rules", `fallback engine must be rules (got ${comparison.engine})`);
assert(comparison.reply.includes("EGP") || comparison.reply.includes("جنيه"), "rules reply must mention money");
assert(!!comparison.plan, "plan must stay attached in fallback replies");

// 2) Free conversation -> rules generic help reply, never the old raw stub.
const chat = await runOpenMindBrain({
  message: "مرحبا يا ذكاء",
  language: "ar",
  appContext: { profile: { currency: "EGP", language: "ar" } },
});
assert(chat.engine === "rules", "generic chat must fall back to rules when no engine is configured");
assert(!chat.reply.includes("لن أخترع"), "the old blocking stub must be gone");

// 3) Action path still intact (confirmation gate before any write).
const action = await runOpenMindBrain({
  message: "صرفت 150 جنيه كهربا",
  language: "ar",
  appContext: {},
  userId: "fallback_test_user",
  confirmed: false,
});
assert(action.requiresConfirmation === true && action.action?.type === "add_expense", "confirmation gate must stay");

assert(classifyIntent("حلل ملف DXF ده") === "cad_analysis", "cad intent preserved for the next phase");

console.log("BRAIN FALLBACK chain tests passed");
