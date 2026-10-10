export interface AutonomousAgentRequest {
  goal: string;
  context?: Record<string, unknown>;
}

export interface AutonomousAgentResult {
  ok: boolean;
  status: "stub";
  message: string;
}

export async function runAutonomousAgent(
  request: AutonomousAgentRequest,
): Promise<AutonomousAgentResult> {
  if (!String(request.goal || "").trim()) {
    return { ok: false, status: "stub", message: "A goal is required." };
  }
  return {
    ok: false,
    status: "stub",
    message: "Autonomous execution is not enabled in this local V3 surface.",
  };
}
