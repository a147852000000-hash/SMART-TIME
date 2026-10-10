export type V3ToolName =
  | "web_search"
  | "solve_emotional_problem"
  | "solve_social_problem"
  | "solve_economic_problem"
  | "generate_excel_report"
  | "generate_word_report"
  | "generate_pdf_report"
  | "generate_chart"
  | "draw_plan"
  | "request_permissions";

export interface V3ToolContext {
  userId: string;
  language: "ar" | "en";
  currentDate: string;
  timezone: string;
  conversationId?: string;
  activeTaskId?: string;
  activeFileIds?: string[];
  canonicalData: Record<string, unknown>;
}
