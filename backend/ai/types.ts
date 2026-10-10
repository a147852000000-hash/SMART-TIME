export type SmartAiAction =
  | { type: "add_expense"; payload: Record<string, unknown> }
  | { type: "update_budget"; payload: Record<string, unknown> }
  | { type: "add_education_expense"; payload: Record<string, unknown> }
  | { type: "add_fuel_record"; payload: Record<string, unknown> }
  | { type: "add_daily_task"; payload: Record<string, unknown> }
  | { type: "update_daily_task"; payload: Record<string, unknown> }
  | null;

export interface SmartAiRequest {
  message: string;
  language: "ar" | "en";
  conversationHistory?: Array<{ sender: "user" | "model"; text: string }>;
  appContext: Record<string, unknown>;
  userId?: string;
  conversationId?: string;
  timezone?: string;
  activeTaskId?: string;
  activeFileIds?: string[];
  confirmed?: boolean;
}

export interface SmartAiResponse {
  reply: string;
  action: SmartAiAction;
  actionSummary?: string;
  requiresConfirmation?: boolean;
  needsClarification?: boolean;
  provider: "smart-ai";
  model: string;
  engine: "rules" | "gemini" | "local";
}

export interface SmartAiProviderRequest {
  system: string;
  user: string;
  model: string;
}
