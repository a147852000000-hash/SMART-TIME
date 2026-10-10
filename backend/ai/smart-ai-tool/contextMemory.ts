import { randomUUID } from "node:crypto";
import { db } from "../../database.js";

export type SmartMemoryType =
  | "preference"
  | "fact"
  | "goal"
  | "instruction"
  | "relationship"
  | "project"
  | "summary";

export interface SmartMemoryRecord {
  id: string;
  userId: string;
  type: SmartMemoryType;
  content: string;
  source: string;
  createdAt: string;
  expiresAt?: string | null;
  sensitivity?: "normal" | "sensitive";
  relevance?: number;
}

export interface SmartContextEvent {
  id: string;
  title: string;
  startAt: string;
  endAt?: string;
  timezone: string;
  category: string;
  location?: string;
  reminderEnabled: boolean;
}

export interface SmartContextMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  createdAt?: string;
}

export interface SmartContextInput {
  userId: string;
  conversationId?: string;
  currentDate: string;
  timezone: string;
  activeTaskId?: string;
  activeFileIds?: string[];
  maxMessages?: number;
  maxMemories?: number;
}

export interface SmartContextBundle {
  runtime: {
    userId: string;
    currentDate: string;
    timezone: string;
    conversationId?: string;
    activeTaskId?: string;
    activeFileIds: string[];
  };
  messages: SmartContextMessage[];
  memories: SmartMemoryRecord[];
  upcomingEvents: SmartContextEvent[];
}

db.exec(`
CREATE TABLE IF NOT EXISTS ai_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  sensitivity TEXT NOT NULL DEFAULT 'normal',
  relevance REAL NOT NULL DEFAULT 0.5
);
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_created
  ON ai_memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_type
  ON ai_memories(user_id, type);
CREATE TABLE IF NOT EXISTS ai_context_summaries (
  conversation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

function normalizeLimit(value: number | undefined, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

export function remember(input: Omit<SmartMemoryRecord, "id" | "createdAt">): SmartMemoryRecord {
  if (!input.userId) throw new Error("userId is required");
  if (!input.content.trim()) throw new Error("memory content is required");

  const record: SmartMemoryRecord = {
    ...input,
    id: randomUUID(),
    content: input.content.trim(),
    createdAt: new Date().toISOString(),
    relevance: input.relevance ?? 0.5,
    sensitivity: input.sensitivity ?? "normal",
    expiresAt: input.expiresAt ?? null,
  };

  db.prepare(`
    INSERT INTO ai_memories
      (id,user_id,type,content,source,created_at,expires_at,sensitivity,relevance)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    record.id,
    record.userId,
    record.type,
    record.content,
    record.source,
    record.createdAt,
    record.expiresAt ?? null,
    record.sensitivity,
    record.relevance ?? 0.5,
  );

  return record;
}

export function listRelevantMemories(
  userId: string,
  limit = 12,
): SmartMemoryRecord[] {
  const rows = db.prepare(`
    SELECT id,user_id,type,content,source,created_at,expires_at,sensitivity,relevance
    FROM ai_memories
    WHERE user_id=?
      AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY relevance DESC, created_at DESC
    LIMIT ?
  `).all(userId, new Date().toISOString(), normalizeLimit(limit, 12, 50)) as Array<Record<string, unknown>>;

  return rows.map(toMemoryRecord);
}

export function saveConversationSummary(
  userId: string,
  conversationId: string,
  summary: string,
): void {
  if (!conversationId || !summary.trim()) return;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ai_context_summaries(conversation_id,user_id,summary,updated_at)
    VALUES(?,?,?,?)
    ON CONFLICT(conversation_id) DO UPDATE SET
      summary=excluded.summary,
      updated_at=excluded.updated_at
  `).run(conversationId, userId, summary.trim(), now);
}

export function getConversationSummary(
  userId: string,
  conversationId?: string,
): string | undefined {
  if (!conversationId) return undefined;
  const row = db.prepare(`
    SELECT summary
    FROM ai_context_summaries
    WHERE conversation_id=? AND user_id=?
  `).get(conversationId, userId) as { summary?: string } | undefined;
  return row?.summary;
}

export function conversationMessagesForModel(
  bundle: SmartContextBundle,
  limit = 8,
): Array<{ sender: "user" | "model"; text: string }> {
  const messages = bundle.messages.filter((m) => m.role === "user" || m.role === "assistant");
  return messages.slice(-normalizeLimit(limit, 8, 20)).map((m) => ({
    sender: m.role === "user" ? "user" : "model",
    text: m.content,
  }));
}

export function memoryContextForModel(
  memories: SmartMemoryRecord[],
  limit = 12,
): string {
  return memories
    .slice(0, normalizeLimit(limit, 12, 20))
    .map((m) => `[${m.type}] ${m.content}`)
    .join("\n");
}

export function calendarContextForModel(
  events: SmartContextEvent[],
  limit = 12,
): string {
  return events.slice(0, normalizeLimit(limit, 12, 20))
    .map((event) => {
      const location = event.location ? ` @ ${event.location}` : "";
      const end = event.endAt ? ` -> ${event.endAt}` : "";
      return `[${event.category}] ${event.title}: ${event.startAt}${end} (${event.timezone})${location}`;
    })
    .join("\n");
}

export function buildSmartContext(input: SmartContextInput): SmartContextBundle {
  const maxMessages = normalizeLimit(input.maxMessages, 20, 100);
  const maxMemories = normalizeLimit(input.maxMemories, 12, 50);

  const messages = input.conversationId
    ? (db.prepare(`
        SELECT
          CASE WHEN sender_id=? THEN 'user' ELSE 'assistant' END AS role,
          body AS content,
          created_at AS createdAt
        FROM messages
        WHERE conversation_id=? AND is_deleted=0
        ORDER BY created_at DESC
        LIMIT ?
      `).all(input.userId, input.conversationId, maxMessages) as unknown as SmartContextMessage[]).reverse()
    : [];

  const memories = listRelevantMemories(input.userId, maxMemories);
  const upcomingEvents = (db.prepare(`
    SELECT id, title, start_at as startAt, end_at as endAt, timezone,
           category, location, reminder_enabled as reminderEnabled
    FROM ai_events
    WHERE user_id=? AND start_at>=?
    ORDER BY start_at ASC
    LIMIT 30
  `).all(input.userId, new Date().toISOString()) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    startAt: String(row.startAt),
    ...(row.endAt ? { endAt: String(row.endAt) } : {}),
    timezone: String(row.timezone),
    category: String(row.category),
    ...(row.location ? { location: String(row.location) } : {}),
    reminderEnabled: Boolean(row.reminderEnabled),
  }));

  const summary = input.conversationId
    ? getConversationSummary(input.userId, input.conversationId)
    : undefined;

  if (summary) {
    messages.unshift({
      role: "system",
      content: `Conversation summary: ${summary}`,
    });
  }

  return {
    runtime: {
      userId: input.userId,
      currentDate: input.currentDate,
      timezone: input.timezone,
      conversationId: input.conversationId,
      activeTaskId: input.activeTaskId,
      activeFileIds: input.activeFileIds ?? [],
    },
    messages,
    memories,
    upcomingEvents,
  };
}

function toMemoryRecord(row: Record<string, unknown>): SmartMemoryRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: String(row.type) as SmartMemoryType,
    content: String(row.content),
    source: String(row.source),
    createdAt: String(row.created_at),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    sensitivity: String(row.sensitivity) === "sensitive" ? "sensitive" : "normal",
    relevance: Number(row.relevance ?? 0.5),
  };
}
