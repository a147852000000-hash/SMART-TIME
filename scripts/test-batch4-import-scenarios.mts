/**
 * Batch 4 — A-4 / A-5 backup import integrity scenarios.
 * Runs the real BackupRepository + StorageAdapter modules (via tsx) against
 * an in-memory localStorage shim that can simulate quota exhaustion.
 * Every scenario asserts either the result flag or exact raw-storage equality.
 */
class QuotaExceededError extends Error {
  name = 'QuotaExceededError';
}

class MemStorage {
  private map = new Map<string, string>();
  limitBytes: number;

  constructor(limitBytes: number = Number.POSITIVE_INFINITY) {
    this.limitBytes = limitBytes;
  }

  private totalSize(incomingKey?: string, incomingValue?: string): number {
    let total = 0;
    for (const [key, value] of this.map) {
      if (key === incomingKey) continue;
      total += key.length + value.length;
    }
    if (incomingKey !== undefined && incomingValue !== undefined) total += incomingKey.length + incomingValue.length;
    return total;
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    if (this.totalSize(key, value) > this.limitBytes) throw new QuotaExceededError(`quota exceeded at "${key}"`);
    this.map.set(key, String(value));
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  get length(): number {
    return this.map.size;
  }

  snapshot(): Map<string, string | null> {
    const out = new Map<string, string | null>();
    for (const [key, value] of this.map) out.set(key, value);
    return out;
  }
}

const storage = new MemStorage();
(globalThis as any).localStorage = storage;

const { BackupRepository } = await import('../src/services/repositories/backupRepository');
const { StorageAdapter } = await import('../src/services/storageAdapter');
const { STORAGE_KEYS } = await import('../src/services/storageKeys');

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
}

function snapshotAllKeys(): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const key of Object.values(STORAGE_KEYS)) out.set(key, StorageAdapter.getRaw(key));
  return out;
}

function assertStorageUnchanged(before: Map<string, string | null>, label: string): void {
  let identical = true;
  for (const [key, raw] of before) {
    if (StorageAdapter.getRaw(key) !== raw) {
      identical = false;
      console.log(`  -> key changed unexpectedly: ${key}`);
    }
  }
  assert(identical, label);
}

const PROFILE = { id: 'u1', name: 'مستخدم الاختبار', email: 'test@example.com' };
const NOTE = { id: 'n1', title: 'ملاحظة', content: 'نص', createdAt: '2026-11-13T00:00:00.000Z' };
const EXPENSE = { id: 'e1', title: 'قهوة', amount: 20, category: 'food', date: '2026-11-13', paymentMethod: 'cash', notes: '' };

function buildBackup(data: Record<string, unknown>): string {
  return JSON.stringify({ exportDate: new Date().toISOString(), version: '6.0.0', data });
}

// ------------------------------------------------------------------
// Scenario 1: a full restore succeeds — including expenses, which made
// every import on main fail before this fix (saveExpenses throws).
// ------------------------------------------------------------------
{
  storage.clear();
  StorageAdapter.setItem(STORAGE_KEYS.USER_PROFILE, { id: 'old', name: 'قديم' });
  const backup = buildBackup({
    profile: PROFILE,
    notes: [NOTE],
    expenses: [EXPENSE],
    budget: { monthlyLimit: 5000 },
    aiChatHistory: [{ id: 'a1', role: 'user', content: 'مرحبا' }],
  });
  const ok = BackupRepository.importFullBackupJSON(backup);
  assert(ok === true, 'scenario1 import returns true (expenses included)');
  assert(
    JSON.stringify(StorageAdapter.getItem<any[]>(STORAGE_KEYS.EXPENSES)) === JSON.stringify([EXPENSE]),
    'scenario1 expenses restored into legacy storage key'
  );
  assert(
    StorageAdapter.getItem<any>(STORAGE_KEYS.USER_PROFILE)?.name === 'مستخدم الاختبار',
    'scenario1 profile restored'
  );
  assert(
    (StorageAdapter.getItem<any[]>(STORAGE_KEYS.AI_CHAT_HISTORY) || []).length === 1,
    'scenario1 aiChatHistory restored'
  );
  assert(BackupRepository.getLastImportError() === '', 'scenario1 no error code after success');
}

// ------------------------------------------------------------------
// Scenario 2: malformed dataset shape -> rejected, storage untouched.
// ------------------------------------------------------------------
{
  storage.clear();
  StorageAdapter.setItem(STORAGE_KEYS.NOTES, JSON.stringify([NOTE]));
  StorageAdapter.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([EXPENSE]));
  const before = snapshotAllKeys();
  const backup = buildBackup({ profile: PROFILE, notes: 'not-an-array', expenses: [EXPENSE] });
  const ok = BackupRepository.importFullBackupJSON(backup);
  assert(ok === false, 'scenario2 malformed notes array rejected');
  assert(BackupRepository.getLastImportError() === 'BAD_SHAPE:notes', 'scenario2 error code BAD_SHAPE:notes');
  assertStorageUnchanged(before, 'scenario2 storage untouched after rejection');
}

// ------------------------------------------------------------------
// Scenario 3: quota exhaustion mid-import -> full rollback of the keys
// written before the failure (this is the A-4 atomicity guarantee).
// ------------------------------------------------------------------
{
  storage.clear();
  // Pre-existing state the user must not lose.
  StorageAdapter.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify({ id: 'old', name: 'البيانات القديمة' }));
  StorageAdapter.setItem(STORAGE_KEYS.NOTES, JSON.stringify([{ id: 'old-note' }]));
  const before = snapshotAllKeys();

  const hugeExpenses = [{ id: 'big', title: 'x'.repeat(20000), amount: 1, category: 'misc', date: '2026-11-13', paymentMethod: 'cash', notes: '' }];
  // Small quota: profile + notes fit, the huge expenses write fails.
  storage.limitBytes = 5000;
  const backup = buildBackup({
    profile: PROFILE,
    notes: [NOTE],
    expenses: hugeExpenses,
  });
  const ok = BackupRepository.importFullBackupJSON(backup);
  assert(ok === false, 'scenario3 import fails when storage quota is exceeded');
  assert(BackupRepository.getLastImportError() === 'STORAGE_WRITE_FAILED', 'scenario3 error code STORAGE_WRITE_FAILED');
  assertStorageUnchanged(before, 'scenario3 storage rolled back to exact previous state');
  storage.limitBytes = Number.POSITIVE_INFINITY;
}

// ------------------------------------------------------------------
// Scenario 4: object dataset delivered as an array -> rejected before
// any write (shape validation covers both directions).
// ------------------------------------------------------------------
{
  storage.clear();
  StorageAdapter.setItem(STORAGE_KEYS.NOTES, JSON.stringify([NOTE]));
  const before = snapshotAllKeys();
  const backup = buildBackup({ profile: PROFILE, budget: [1, 2, 3] });
  const ok = BackupRepository.importFullBackupJSON(backup);
  assert(ok === false, 'scenario4 array-shaped budget rejected');
  assert(BackupRepository.getLastImportError() === 'BAD_SHAPE:budget', 'scenario4 error code BAD_SHAPE:budget');
  assertStorageUnchanged(before, 'scenario4 storage untouched after budget rejection');
}

// ------------------------------------------------------------------
// Scenario 5: restore over an empty storage with keys that did not
// exist before, then fail later in the same import -> the newly created
// keys must be REMOVED again (rollback to null).
// ------------------------------------------------------------------
{
  storage.clear();
  const before = snapshotAllKeys();
  let allNull = true;
  for (const value of before.values()) if (value !== null) allNull = false;
  assert(allNull, 'scenario5 precondition: storage starts empty');

  storage.limitBytes = 150; // profile fits, notes do not
  const backup = buildBackup({ profile: PROFILE, notes: [NOTE, { ...NOTE, id: 'n2' }] });
  const ok = BackupRepository.importFullBackupJSON(backup);
  assert(ok === false, 'scenario5 import fails on quota');
  assertStorageUnchanged(before, 'scenario5 new keys removed after rollback (no partial restore)');
  storage.limitBytes = Number.POSITIVE_INFINITY;
}

// ------------------------------------------------------------------
// Scenario 6: exportFullBackupJSON output can be re-imported (round-trip).
// ------------------------------------------------------------------
{
  storage.clear();
  StorageAdapter.setItem(STORAGE_KEYS.USER_PROFILE, PROFILE);
  StorageAdapter.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([EXPENSE]));
  const exported = BackupRepository.exportFullBackupJSON();
  storage.clear();
  const ok = BackupRepository.importFullBackupJSON(exported);
  assert(ok === true, 'scenario6 export->import round-trip succeeds');
  assert(
    JSON.stringify(StorageAdapter.getItem<any[]>(STORAGE_KEYS.EXPENSES)) === JSON.stringify([EXPENSE]),
    'scenario6 expenses survive round-trip'
  );
}

console.log(failures === 0 ? 'BATCH4 IMPORT SCENARIOS: PASS' : `BATCH4 IMPORT SCENARIOS: FAIL (${failures})`);
if (failures > 0) process.exit(1);
