import { db } from "../../database.js";
import { expandRecurringEvents } from "./recurrenceEngine.js";

export interface PendingEventReminder {
undefinedid: string;
undefinedeventId: string;
  userId: string;
  title: string;
  startAt: string;
  timezone: string;
  reminderMinutes: number;
  scheduledFor: string;
  queuedAt: string;
}



function nowIso() {
  return new Date().toISOString();
}

export function queueDueEventReminders(now = new Date()): number {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Invalid scheduler time");

  const rows = db.prepare(`
    SELECT id, user_id as userId, title, start_at as startAt,
           timezone, reminder_minutes as reminderMinutes
    FROM ai_events
    WHERE reminder_enabled = 1
      AND reminder_minutes IS NOT NULL
      AND recurrence_json IS NULL
  `).all() as any[];

  const recurringByUser = new Map<string, ReturnType<typeof expandRecurringEvents>>();
  const recurringUsers = db.prepare(`
    SELECT DISTINCT user_id as userId
    FROM ai_events
    WHERE reminder_enabled = 1 AND reminder_minutes IS NOT NULL AND recurrence_json IS NOT NULL
  `).all() as Array<{ userId: string }>;
  for (const { userId } of recurringUsers) {
    recurringByUser.set(userId, expandRecurringEvents(
      userId,
      new Date(nowMs - 24 * 60 * 60 * 1000),
      new Date(nowMs + 90 * 24 * 60 * 60 * 1000),
      1000,
    ));
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO ai_event_reminders
      (id,event_id,user_id,scheduled_for,queued_at)
    VALUES (?,?,?,?,?)
  `);

  let queued = 0;
  const queuedAt = nowIso();
  db.exec("BEGIN");
  try {
    for (const row of rows) {
      const startMs = new Date(String(row.startAt)).getTime();
      const minutes = Number(row.reminderMinutes);
      if (!Number.isFinite(startMs) || !Number.isInteger(minutes) || minutes < 0) continue;

      const scheduledMs = startMs - minutes * 60_000;
      if (scheduledMs > nowMs) continue;

      const scheduledFor = new Date(scheduledMs).toISOString();
      const reminderId = `rem_${row.id}_${scheduledMs}`;
      const result = insert.run(reminderId, row.id, row.userId, scheduledFor, queuedAt);
      queued += Number(result.changes);
    }

    for (const occurrences of recurringByUser.values()) {
      for (const occurrence of occurrences) {
        const startMs = new Date(occurrence.occurrenceStart).getTime();
        const minutes = Number(occurrence.reminderMinutes);
        if (!Number.isFinite(startMs) || !Number.isInteger(minutes) || minutes < 0) continue;
        const scheduledMs = startMs - minutes * 60_000;
        if (scheduledMs > nowMs) continue;

        const scheduledFor = new Date(scheduledMs).toISOString();
        const reminderId = `rem_${occurrence.eventId}_${scheduledMs}`;
        const result = insert.run(reminderId, occurrence.eventId, occurrence.userId, scheduledFor, queuedAt);
        queued += Number(result.changes);
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* preserve original error */ }
    throw error;
  }
  return queued;
}

export function listPendingEventReminders(userId: string, limit = 50): PendingEventReminder[] {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return db.prepare(`
    SELECT r.id, r.event_id as eventId, r.user_id as userId,
           e.title, e.start_at as startAt, e.timezone,
           e.reminder_minutes as reminderMinutes,
           r.scheduled_for as scheduledFor,
           r.queued_at as queuedAt
    FROM ai_event_reminders r
    JOIN ai_events e ON e.id = r.event_id AND e.user_id = r.user_id
    WHERE r.user_id = ? AND r.delivered_at IS NULL
    ORDER BY r.scheduled_for ASC
    LIMIT ?
  `).all(userId, safeLimit) as unknown as PendingEventReminder[];
}

export function acknowledgeEventReminder(userId: string, reminderId: string): boolean {
  const result = db.prepare(`
    UPDATE ai_event_reminders
    SET delivered_at = ?
    WHERE id = ? AND user_id = ? AND delivered_at IS NULL
  `).run(nowIso(), reminderId, userId);
  return result.changes === 1;
}
