import { runAutonomousAgent } from "./autonomousAgent.js";
import { setPermission } from "./permissions.js";
import type { V3ToolContext } from "./types.js";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

const userId = "agent-test-user";
await setPermission(userId, "reports", true);
await setPermission(userId, "cad", true);

const context: V3ToolContext = {
  userId,
  language: "ar",
  currentDate: new Date().toISOString().slice(0, 10),
  timezone: "Africa/Cairo",
  canonicalData: {
    expenses: [
      { title: "بنزين", amount: 300 },
      { title: "كهرباء", amount: 180 },
    ],
  },
};

// 1) Empty goal refused honestly
const noGoal = await runAutonomousAgent({ goal: "", context });
assert(noGoal.ok === false && noGoal.status === "failed", "empty goal refused");

// 2) CAD goal: confirmation gate BEFORE execution (no artifact yet)
const cadGoal = "اعملي رسم CAD لمخطط غرفة 4 في 5 متر";
const gated = await runAutonomousAgent({ goal: cadGoal, context });
assert(gated.status === "needs_confirmation", "CAD goal requires confirmation (per-operation policy)");
assert(gated.artifacts.length === 0, "no artifact created before confirmation");
assert(gated.steps.length === 1 && gated.steps[0].tool === "generate_dxf", "planner selected generate_dxf");

// 3) Same goal WITH confirmation -> real verified DXF artifact
const executed = await runAutonomousAgent({ goal: cadGoal, context, confirmed: true });
assert(executed.status === "completed", "confirmed CAD goal executed");
assert(executed.artifacts.length === 1 && executed.artifacts[0].type === "dxf", "one dxf artifact returned");
const dxfText = Buffer.from(executed.artifacts[0].data, "base64").toString("utf8");
assert(dxfText.includes("AC1009") && dxfText.includes("ENTITIES"), "artifact is a valid DXF R12 file");
assert(executed.steps[0].status === "verified", "tool verification passed");
assert(!executed.steps[0].args.message.includes("5 متر") === false, "goal text preserved as dxf input");

// 4) Excel report goal with real data -> verified xlsx artifact
const excel = await runAutonomousAgent({ goal: "حطل التقرير ده في ملف اكسل", context, confirmed: true });
assert(excel.status === "completed", "excel goal executed");
assert(excel.artifacts.length === 1 && excel.artifacts[0].filename.endsWith(".xlsx"), "xlsx artifact produced");
assert(excel.artifacts[0].data.length > 100, "xlsx artifact non-empty base64");

// 5) Explicit approved tool calls bypass planning but NOT the gate policy
//    (explicit calls are treated as already-approved by the caller only
//    when confirmed=true is also sent).
const explicit = await runAutonomousAgent({
  goal: "رسم دائرة نصف قطرها 30",
  context,
  confirmed: true,
  approvedToolCalls: [{ tool: "generate_dxf", args: { message: "دائرة نصف قطرها 30" } }],
});
assert(explicit.status === "completed" && explicit.planner === "explicit", "explicit plan executed");
assert(Buffer.from(explicit.artifacts[0].data, "base64").toString("utf8").includes("CIRCLE"), "explicit dxf valid");

// 6) Unrecognized goal -> honest failure without inventing a tool
const unknown = await runAutonomousAgent({ goal: "معلش عايز شاي بالنعناع", context });
assert(unknown.status === "failed" && unknown.steps.length === 0, "unknown goal honestly refused");
assert(unknown.message.includes("حدد نوع المطلوب") || unknown.message.includes("أداة"), "refusal asks for clarification");

// 7) Permission enforcement: revoke cad -> tool fails with permission error
await setPermission(userId, "cad", false);
const denied = await runAutonomousAgent({ goal: cadGoal, context, confirmed: true });
assert(denied.status === "failed" && denied.steps[0].error?.includes("permission_required:cad"), "cad permission enforced");
await setPermission(userId, "cad", true);

console.log("AUTONOMOUS AGENT tests passed");
