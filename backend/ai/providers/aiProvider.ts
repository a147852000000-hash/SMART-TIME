export type AIMessageRole = "system" | "user" | "assistant" | "tool";

export interface AIMessage {
  role: AIMessageRole;
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: AIToolCall[];
}

export interface AIToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface AIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface AIChatRequest {
  model?: string;
  messages: AIMessage[];
  temperature?: number;
  maxCompletionTokens?: number;
  tools?: AIToolDefinition[];
  toolChoice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
}

export interface AIChatResult {
  provider: string;
  model: string;
  content: string;
  toolCalls: AIToolCall[];
  finishReason: string | null;
  requestId?: string;
}

export interface AIStructuredRequest {
  model?: string;
  messages: AIMessage[];
  schemaName: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}

export interface AIProvider {
  readonly id: string;
  chat(request: AIChatRequest): Promise<AIChatResult>;
  streamChat(request: AIChatRequest): AsyncGenerator<string, void, void>;
  generateStructured(request: AIStructuredRequest): Promise<{ provider: string; model: string; content: string; requestId?: string }>;
  health(): Promise<GroqProviderHealth>;
  models(): Promise<GroqModelSummary[]>;
}

export interface GroqModelSummary {
  id: string;
  active?: boolean;
  ownedBy?: string;
}

export interface GroqProviderHealth {
  configured: boolean;
  reachable: boolean;
  models: GroqModelSummary[];
}
