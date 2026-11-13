/**
 * StorageAdapter wraps localStorage for the whole app.
 *
 * A failed write is NEVER silent anymore: it is logged with the key name,
 * recorded for open transactions (beginTransaction / failedSince) and the
 * caller still receives `false` for backwards compatibility.
 */
let writeFailures = 0;
let lastErrorMessage = '';

function recordWriteFailure(key: string, error: unknown): void {
  writeFailures += 1;
  lastErrorMessage = error instanceof Error ? error.message : String(error);
  console.error(
    `[StorageAdapter] Write to "${key}" failed (storage full, blocked or unavailable): ${lastErrorMessage}`
  );
}

export const StorageAdapter = {
  setItem<T>(key: string, value: T): boolean {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      recordWriteFailure(key, error);
      return false;
    }
  },

  getItem<T>(key: string, fallback: T | null = null): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as T;
      }
    } catch {
      return fallback;
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {}
  },

  /** Raw (unparsed) read used by the backup import transaction. */
  getRaw(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  /** Raw write used by the backup import rollback path. */
  setRaw(key: string, raw: string): boolean {
    try {
      localStorage.setItem(key, raw);
      return true;
    } catch (error) {
      recordWriteFailure(key, error);
      return false;
    }
  },

  /**
   * Returns the current write-failure counter. Compare it later with
   * failedSince() to detect whether any write failed during the window —
   * this is how the backup import guarantees atomicity.
   */
  beginTransaction(): number {
    return writeFailures;
  },

  failedSince(marker: number): boolean {
    return writeFailures !== marker;
  },

  /** Last storage error message, for user-facing diagnostics. */
  getLastErrorMessage(): string {
    return lastErrorMessage;
  },
};
