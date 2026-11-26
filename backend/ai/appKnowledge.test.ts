// Hermetic test: the app-knowledge base that powers the production brain.
import { buildAppKnowledge, SMART_TIME_APP_KNOWLEDGE_VERSION } from "./appKnowledge.js";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

const userKnowledge = buildAppKnowledge();
const ownerKnowledge = buildAppKnowledge({ ownerView: true });

assert(userKnowledge.includes("SMART TIME"), "knowledge must identify the app");
assert(userKnowledge.includes("لوحة التحكم") && userKnowledge.includes("الرحلات"), "user layer must cover main modules");
assert(userKnowledge.includes("قواعد السلوك الصارمة"), "behavior rules must be present");
assert(!userKnowledge.includes("الطبقة التقنية"), "technical layer must NOT leak to normal users");

assert(ownerKnowledge.includes("الطبقة التقنية"), "owner view must include technical layer");
assert(ownerKnowledge.includes("Groq") && ownerKnowledge.includes("SQLite"), "owner layer must describe the AI chain and storage");

assert(ownerKnowledge.length < 14000, `knowledge must stay compact for the prompt budget (got ${ownerKnowledge.length} chars)`);
assert(userKnowledge.length < ownerKnowledge.length, "owner view must be a superset of the user view");

assert(typeof SMART_TIME_APP_KNOWLEDGE_VERSION === "string", "version exported");

console.log("APP KNOWLEDGE tests passed");
