import crypto from "node:crypto";
import { db } from "../../database.js";

export interface CalendarEventRecord {
  id: string;
  userId: string;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  timezone: string;
  location?: string;
  category: string;
  allDay: boolean;
  reminderEnabled: boolean;
  reminderMinutes?: number;
  recurrence?: {
    frequency: "daily" | "weekly" | "monthly";
    interval?: number;
    until?: string;
  };
  createdAt: string;
  updatedAt: string;
}

const EVENT_CATEGORIES = new Set(["work", "personal", "finance", "health", "education", "general"]);
const RECURRENCE_FREQUENCIES = new Set(["daily", "weekly", "monthly"]);

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const valueText = text(value);
  return valueText || null;
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 1 || value === "1" || value === "true";
}

function parseIsoDate(value: unknown, field: string): string {
  const raw = text(value);
  if (!raw) throw new Error(`${field} is required`);
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) throw new Error(`${field} must be a valid ISO date/time`);
  return date.toISOString();
}

function parseReminderMinutes(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 10080) {
    throw new Error("reminderMinutes must be an integer between 0 and 10080");
  }
  return n;
}

function parseRecurrence(value: unknown): CalendarEventRecord["recurrence"] | null {
  if (value === undefined || value === null || value === "") return null;
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  if (!raw || typeof raw !== "object") throw new Error("recurrence must be an object");
  const frequency = text((raw as any).frequency) as "daily" | "weekly" | "monthly";
  if (!RECURRENCE_FREQUENCIES.has(frequency)) throw new Error("recurrence.frequency is invalid");
  const interval = (raw as any).interval === undefined ? 1 : Number((raw as any).interval);
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
    throw new Error("recurrence.interval must be an integer between 1 and 365");
  }
  const until = (raw as any).until ? parseIsoDate((raw as any).until, "recurrence.until") : undefined;
  return { frequency, interval, ...(until ? { until } : {}) };
}

function normalizeRow(row: any): CalendarEventRecord {
  let recurrence: CalendarEventRecord["recurrence"];
  try {
    recurrence = row.recurrence_json ? parseRecurrence(row.recurrence_json) ?? undefined : undefined;
  } catch {
    recurrence = undefined;
  }
  return {
    id: String(row.id),
    userId: String(row.userId),
    title: String(row.title),
    ...(row.description ? { description: String(row.description) } : {}),
    startAt: String(row.startAt),
    ...(row.endAt ? { endAt: String(row.endAt) } : {}),
    timezone: String(row.timezone),
    ...(row.location ? { location: String(row.location) } : {}),
    category: String(row.category),
    allDay: Boolean(row.allDay),
    reminderEnabled: Boolean(row.reminderEnabled),
    ...(row.reminderMinutes === null || row.reminderMinutes === undefined ? {} : { reminderMinutes: Number(row.reminderMinutes) }),
    ...(recurrence ? { recurrence } : {}),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function readEvent(userId: string, eventId: string): CalendarEventRecord | null {
  const row = db.prepare(`
    SELECT id, user_id as userId, title, description,
           start_at as startAt, end_at as endAt, timezone, location,
           category, all_day as allDay,
           reminder_enabled as reminderEnabled,
           reminder_minutes as reminderMinutes,
           recurrence_json,
           created_at as createdAt, updated_at as updatedAt
    FROM ai_events
    WHERE id = ? AND user_id = ?
  `).get(eventId, userId);
  return row ? normalizeRow(row) : null;
}

function validateTemporalRange(startAt: string, endAt?: string): void {
  if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
    throw new Error("endAt must be greater than or equal to startAt");
  }
}

function normalizePayload(payload: Record<string, unknown>, current?: CalendarEventRecord) {
  const title = payload.title === undefined && current ? current.title : text(payload.title);
  if (!title) throw new Error("Event title is required");

  const startAt = payload.startAt === undefined && current
    ? current.startAt
    : parseIsoDate(payload.startAt, "startAt");

  const endAtValue = payload.endAt === undefined && current
    ? current.endAt
    : payload.endAt;
  const endAt = endAtValue ? parseIsoDate(endAtValue, "endAt") : undefined;
  validateTemporalRange(startAt, endAt);

  const timezone = payload.timezone === undefined && current ? current.timezone : text(payload.timezone);
  if (!timezone) throw new Error("timezone is required");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new Error("timezone must be a valid IANA timezone");
  }

  const category = payload.category === undefined && current ? current.category : text(payload.category) || "general";
  if (!EVENT_CATEGORIES.has(category)) throw new Error("category is invalid");

  const reminderEnabled = payload.reminderEnabled === undefined && current
    ? current.reminderEnabled
    : parseBoolean(payload.reminderEnabled, false);

  const reminderMinutes = payload.reminderMinutes === undefined && current
    ? (current.reminderMinutes ?? null)
    : parseReminderMinutes(payload.reminderMinutes);

  if (reminderEnabled && reminderMinutes === null) {
    throw new Error("reminderMinutes is required when reminders are enabled");
  }

  const recurrenceValue = payload.recurrence === undefined && current ? current.recurrence : payload.recurrence;
  const recurrence = parseRecurrence(recurrenceValue);

  return {
    title,
    description: payload.description === undefined && current ? current.description ?? null : nullableText(payload.description),
    startAt,
    endAt,
    timezone,
    location: payload.location === undefined && current ? current.location ?? null : nullableText(payload.location),
    category,
    allDay: payload.allDay === undefined && current ? current.allDay : parseBoolean(payload.allDay, false),
    reminderEnabled,
    reminderMinutes: reminderEnabled ? reminderMinutes : null,
    recurrence,
  };
}

export function createCalendarEvent(userId: string, payload: Record<string, unknown>): CalendarEventRecord {
  const uid = text(userId);
  if (!uid) throw new Error("userId is required");
  const values = normalizePayload(payload);
  const id = `evt_${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();

  db.prepare(`
    INSERT INTO ai_events
      (id,user_id,title,description,start_at,end_at,timezone,location,category,all_day,
       reminder_enabled,reminder_minutes,recurrence_json,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, uid, values.title, values.description, values.startAt, values.endAt ?? null,
    values.timezone, values.location, values.category, values.allDay ? 1 : 0,
    values.reminderEnabled ? 1 : 0, values.reminderMinutes,
    values.recurrence ? JSON.stringify(values.recurrence) : null,
    timestamp, timestamp
  );

  const record = readEvent(uid, id);
  if (!record) throw new Error("Database read-back failed after event creation");
  return record;
}

export function updateCalendarEvent(userId: string, eventId: string, payload: Record<string, unknown>): CalendarEventRecord {
  const uid = text(userId);
  const id = text(eventId);
  if (!id) throw new Error("event id is required");
  const current = readEvent(uid, id);
  if (!current) throw new Error("Event not found for this user");

  const values = normalizePayload(payload, current);
  const timestamp = new Date().toISOString();

  db.prepare(`
    UPDATE ai_events
    SET title=?, description=?, start_at=?, end_at=?, timezone=?, location=?,
        category=?, all_day=?, reminder_enabled=?, reminder_minutes=?,
        recurrence_json=?, updated_at=?
    WHERE id=? AND user_id=?
  `).run(
    values.title, values.description, values.startAt, values.endAt ?? null,
    values.timezone, values.location, values.category, values.allDay ? 1 : 0,
    values.reminderEnabled ? 1 : 0, values.reminderMinutes,
    values.recurrence ? JSON.stringify(values.recurrence) : null,
    timestamp, id, uid
  );

  const record = readEvent(uid, id);
  if (!record) throw new Error("Database read-back failed after event update");
  return record;
}

export function deleteCalendarEvent(userId: string, eventId: string): CalendarEventRecord {
  const uid = text(userId);
  const id = text(eventId);
  const current = readEvent(uid, id);
  if (!current) throw new Error("Event not found for this user");

  db.prepare("DELETE FROM ai_events WHERE id = ? AND user_id = ?").run(id, uid);
  if (readEvent(uid, id)) throw new Error("Database verification failed after event deletion");
  return current;
}

export function listCalendarEvents(
  userId: string,
  options: { from?: string; to?: string } = {},
): CalendarEventRecord[] {
  const uid = text(userId);
  if (!uid) throw new Error("userId is required");
  const from = options.from ? parseIsoDate(options.from, "from") : null;
  const to = options.to ? parseIsoDate(options.to, "to") : null;
  if (from && to && new Date(to).getTime() < new Date(from).getTime()) {
    throw new Error("to must be greater than or equal to from");
  }

  const rows = db.prepare(`
    SELECT id, user_id as userId, title, description,
           start_at as startAt, end_at as endAt, timezone, location,
           category, all_day as allDay,
           reminder_enabled as reminderEnabled,
           reminder_minutes as reminderMinutes,
           recurrence_json,
           created_at as createdAt, updated_at as updatedAt
    FROM ai_events
    WHERE user_id = ?
      AND (? IS NULL OR start_at >= ?)
      AND (? IS NULL OR start_at <= ?)
    ORDER BY start_at ASC, created_at ASC
  `).all(uid, from, from, to, to) as any[];

  return rows.map(normalizeRow);
}
