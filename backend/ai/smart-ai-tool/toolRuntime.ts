import { checkPermission, type Permission } from "./permissions.js";
import { v3ToolRegistry } from "./toolRegistry.js";
import type { V3ToolContext, V3ToolName } from "./types.js";

export interface V3RuntimeExecution {
  toolName: V3ToolName;
  status: "validated" | "executed" | "verified" | "failed";
  executed: boolean;
  verified: boolean;
  result?: unknown;
  error?: string;
}

export async function executeV3Tool(
  context: V3ToolContext,
  toolName: V3ToolName,
  args: Record<string, unknown>,
): Promise<V3RuntimeExecution> {
  const definition = v3ToolRegistry[toolName];

  const validationError = definition.validate?.(args) ?? null;
  if (validationError) {
    return { toolName, status: "failed", executed: false, verified: false, error: validationError };
  }

  if (definition.permission) {
    const allowed = await checkPermission(context.userId, definition.permission as Permission);
    if (!allowed) {
      return {
        toolName,
        status: "failed",
        executed: false,
        verified: false,
        error: `permission_required:${definition.permission}`,
      };
    }
  }

  if (!definition.execute) {
    return {
      toolName,
      status: "validated",
      executed: false,
      verified: false,
      error: "tool_executor_not_implemented",
    };
  }

  try {
    const result = await definition.execute(context, args);
    const verified = definition.verify ? await definition.verify(result) : true;
    return {
      toolName,
      status: verified ? "verified" : "executed",
      executed: true,
      verified,
      result,
      ...(verified ? {} : { error: "verification_failed" }),
    };
  } catch (error) {
    return {
      toolName,
      status: "failed",
      executed: false,
      verified: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
