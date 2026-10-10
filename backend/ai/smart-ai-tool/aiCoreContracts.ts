export type SmartAiLanguage = "ar" | "en";

export type SmartAiIntent =
  | "conversation"
  | "task"
  | "event"
  | "reminder"
  | "file_analysis"
  | "data_analysis"
  | "report_generation"
  | "web_research"
  | "memory"
  | "unknown";

export type SmartAiExecutionStatus =
  | "not_requested"
  | "proposed"
  | "validated"
  | "executed"
  | "verified"
  | "failed"
  | "needs_clarification";

export interface SmartAiRuntimeContext {
  userId: string;
  language: SmartAiLanguage;
  currentDate: string;
  timezone: string;
  conversationId?: string;
  activeTaskId?: string;
  activeFileIds?: string[];
}

export interface SmartAiToolProposal<TArguments = Record<string, unknown>> {
  tool: string;
  arguments: TArguments;
  needsClarification: boolean;
  clarificationQuestion?: string;
}

export interface SmartAiExecutionContract {
  status: SmartAiExecutionStatus;
  executed: boolean;
  verified: boolean;
  errors: string[];
}

export interface SmartAiArtifactRef {
  id: string;
  kind: "docx" | "xlsx" | "pdf" | "csv" | "txt" | "image" | "other";
  name: string;
  path?: string;
  verified: boolean;
}

export interface SmartAiToolResult<T = unknown> {
  tool: string;
  result: T;
  execution: SmartAiExecutionContract;
  artifacts?: SmartAiArtifactRef[];
}

export interface SmartAiContextEnvelope {
  runtime: SmartAiRuntimeContext;
  messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>;
  memories?: Array<{ id: string; type: string; content: string; source: string }>;
  toolResults?: SmartAiToolResult[];
}
