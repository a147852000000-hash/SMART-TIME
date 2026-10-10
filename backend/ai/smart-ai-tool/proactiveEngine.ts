export interface ProactiveSuggestion {
  id: string;
  title: string;
  reason: string;
}

export function getProactiveSuggestions(
  _context: Record<string, unknown> = {},
): ProactiveSuggestion[] {
  return [];
}
