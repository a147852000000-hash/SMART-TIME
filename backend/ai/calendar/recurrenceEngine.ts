import { db } from "../../database.js";

export interface CalendarOccurrence {
  eventId: string;
  userId: string;
  title: string;
  occurrenceStart: string;
  occurrenceEnd?: string;
  timezone: string;
  reminderEnabled: boolean;
  reminderMinutes?: number;
}

type Recurrence = { frequency: "daily" | "weekly" | "monthly"; interval: number; until?: string };

function parseRecurrence(value: unknown): Recurrence | null {
  if (!value) return null;
  try {
    const r = typeof value === "string" ? JSON.parse(value) : value;
    if (!r || !["daily", "weekly", "monthly"].includes(String(r.frequency))) return null;
    const interval = Number(r.interval ?? 1);
    if (!Number.isInteger(interval) || interval < 1) return null;
    return { frequency: r.frequency, interval, ...(r.until ? { until: new Date(r.until).toISOString() } : {}) };
  } catch {
    return null;
  }
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function timezoneOffsetMs(date: Date, timezone: string): number {
  const p = zonedParts(date, timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

function fromZonedParts(parts: ReturnType<typeof zonedParts>, timezone: string): Date {
  let guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  for (let i = 0; i < 4; i++) {
    guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - timezoneOffsetMs(guess, timezone));
  }
  return guess;
}

function addOccurrence(date: Date, recurrence: Recurrence, timezone: string): Date {
  const local = zonedParts(date, timezone);
  if (recurrence.frequency === "daily") {
    local.day += recurrence.interval;
  } else if (recurrence.frequency === "weekly") {
    local.day += recurrence.interval * 7;
  } else {
    const targetMonthIndex = local.month - 1 + recurrence.interval;
    const targetYear = local.year + Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    local.year = targetYear;
    local.month = targetMonth + 1;
    local.day = Math.min(local.day, lastDay);
  }

  const normalized = new Date(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second));
  return fromZonedParts(zonedParts(normalized, "UTC"), timezone);
}
function durationMs(start: string, end?: string): number | null {
  if (!end) return null;
  const value = new Date(end).getTime() - new Date(start).getTime();
  return value >= 0 ? value : null;
}

export function expandRecurringEvents(
  userId: string,
  from: Date,
  to: Date,
  maxOccurrences = 500,
): CalendarOccurrence[] {
  if (!userId) throw new Error("userId is required");
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to < from) {
    throw new Error("Invalid occurrence range");
  }

  const rows = db.prepare(`
    SELECT id, user_id as userId, title, start_at as startAt, end_at as endAt,
           timezone, reminder_enabled as reminderEnabled,
           reminder_minutes as reminderMinutes, recurrence_json as recurrenceJson
    FROM ai_events
    WHERE user_id = ?
      AND recurrence_json IS NOT NULL
      AND start_at <= ?
  `).all(userId, to.toISOString()) as any[];

  const occurrences: CalendarOccurrence[] = [];
  for (const row of rows) {
    const recurrence = parseRecurrence(row.recurrenceJson);
    if (!recurrence) continue;
    const originalStart = new Date(String(row.startAt));
    if (!Number.isFinite(originalStart.getTime())) continue;
    const duration = durationMs(String(row.startAt), row.endAt ? String(row.endAt) : undefined);

    let cursor = new Date(originalStart);
    let guard = 0;
    while (cursor < from && guard++ < 10000) cursor = addOccurrence(cursor, recurrence, String(row.timezone));
    while (cursor <= to && occurrences.length < maxOccurrences) {
      if (!recurrence.until || cursor <= new Date(recurrence.until)) {
        occurrences.push({
          eventId: String(row.id),
          userId: String(row.userId),
          title: String(row.title),
          occurrenceStart: cursor.toISOString(),
          ...(duration !== null ? { occurrenceEnd: new Date(cursor.getTime() + duration).toISOString() } : {}),
          timezone: String(row.timezone),
          reminderEnabled: Boolean(row.reminderEnabled),
          ...(row.reminderMinutes === null || row.reminderMinutes === undefined ? {} : { reminderMinutes: Number(row.reminderMinutes) }),
        });
      }
      cursor = addOccurrence(cursor, recurrence, String(row.timezone));
      guard++;
      if (guard > 10000) break;
    }
  }
  return occurrences.sort((a, b) => a.occurrenceStart.localeCompare(b.occurrenceStart));
}
