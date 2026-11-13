/**
 * Batch 5 module scenarios (tsx) — B-14 seed neutrality + B-10 Quran integrity.
 * Runs against an offline in-memory localStorage shim: no network at all,
 * so the Quran fetch path is forced to fail exactly like the offline case.
 */

class MemStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null { return this.map.get(key) ?? null; }
  setItem(key: string, value: string): void { this.map.set(key, String(value)); }
  removeItem(key: string): void { this.map.delete(key); }
  clear(): void { this.map.clear(); }
  key(index: number): string | null { return Array.from(this.map.keys())[index] ?? null; }
  get length(): number { return this.map.size; }
}
(globalThis as any).localStorage = new MemStorage();
// Force the offline branch: any fetch attempt rejects immediately.
(globalThis as any).fetch = async () => { throw new Error('offline-by-test'); };

const { BackupRepository } = await import('../src/services/repositories/backupRepository');
const seed = await import('../src/services/seedData');
const { QuranService, EMBEDDED_SURAH_VERSES, ALL_SURAHS } = await import('../src/services/quranService');
const { STORAGE_KEYS } = await import('../src/services/storageKeys');

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (condition) console.log(`PASS ${label}`);
  else { failures += 1; console.log(`FAIL ${label}`); }
}

// ---------------------------------------------------------------------------
// B-14: no fabricated personal data anywhere
// ---------------------------------------------------------------------------
assert(seed.DEFAULT_USER.name === '', 'B-14 default profile has no fake name');
assert(!String(seed.DEFAULT_USER.avatarUrl || '').includes('unsplash'), 'B-14 default profile has no stock photo');
assert(seed.DEFAULT_USER.email === '' && seed.DEFAULT_USER.phone === '', 'B-14 default profile has no fake contact info');
assert(seed.DEFAULT_USER.isOnboarded === false, 'B-14 default profile not marked onboarded');
assert(seed.DEFAULT_EXPENSES.length === 0, 'B-14 no fake expenses');
assert(seed.DEFAULT_BUDGET.totalBudget === 0 && seed.DEFAULT_BUDGET.totalExpenses === 0, 'B-14 budget starts at honest zeros');
assert(seed.DEFAULT_VEHICLES.length === 0 && seed.DEFAULT_FUEL_RECORDS.length === 0, 'B-14 no fake vehicles/fuel');
assert(seed.DEFAULT_NOTES.length === 0 && seed.DEFAULT_DAILY_TASKS.length === 0, 'B-14 no fake notes/tasks');
assert(seed.DEFAULT_STUDENTS.length === 0 && seed.DEFAULT_LESSONS.length === 0, 'B-14 no fake students/lessons');
assert(seed.DEFAULT_CHAT_ROOMS.length === 0 && seed.DEFAULT_CHAT_MESSAGES.length === 0, 'B-14 no fake chats');
assert(seed.DEFAULT_MEDIA_FOLDERS.length === 0 && seed.DEFAULT_MEDIA_ITEMS.length === 0, 'B-14 no fake media');
assert(seed.DEFAULT_NOTIFICATIONS.length === 0, 'B-14 no fake notifications');
assert(seed.DEFAULT_RECENT_TRIPS.length === 0 && seed.DEFAULT_FAVORITE_PLACES.length === 0, 'B-14 no fake trips/places');
assert(seed.DEFAULT_QURAN_WIRD_PROGRESS.streakDays === 0 && seed.DEFAULT_QURAN_WIRD_PROGRESS.currentPage === 1, 'B-14 wird progress starts neutral');
// Authentic reference content is kept.
assert(seed.DEFAULT_ATHKAR.length > 0, 'B-14 authentic athkar kept');
assert(seed.DEFAULT_QURAN_AYAH_TOPICS.length > 0, 'B-14 authentic Quran ayah topics kept');
assert(seed.DEFAULT_CHRISTIAN_PRAYERS.length > 0, 'B-14 authentic Christian prayers kept');
// Fresh profile round-trip through the repos stays neutral.
assert(BackupRepository.exportFullBackupJSON().includes('"expenses": []'), 'B-14 fresh export shows empty expenses');

// ---------------------------------------------------------------------------
// B-10: no fabricated Quran text or stop marks
// ---------------------------------------------------------------------------
const embeddedEntries = Object.entries(EMBEDDED_SURAH_VERSES);
assert(embeddedEntries.length === 5, 'B-10 only the 5 COMPLETE surahs remain embedded');
assert(
  embeddedEntries.every(([num, verses]) => verses.every((v: any) => v.stopMark === undefined)),
  'B-10 no fabricated stop marks in embedded verses'
);
assert(
  (EMBEDDED_SURAH_VERSES[1] || []).length === 7 &&
  (EMBEDDED_SURAH_VERSES[114] || []).length === 6 &&
  (EMBEDDED_SURAH_VERSES[112] || []).length === 4,
  'B-10 embedded surahs are complete verse counts (7/6/4)'
);
assert(!EMBEDDED_SURAH_VERSES[2] && !EMBEDDED_SURAH_VERSES[55], 'B-10 partial "highlights" surahs removed');

const empty = await QuranService.getSurahVerses(55);
assert(Array.isArray(empty) && empty.length === 0, 'B-10 offline + no cache returns [] (no fabricated verses)');

const kawthar = await QuranService.getSurahVerses(108);
assert(Array.isArray(kawthar) && kawthar.length === 3, 'B-10 embedded complete surah loads offline');

// Source-level assertion: the fabricated generator text is gone from the module.
const fs = await import('node:fs');
const path = await import('node:path');
const quranSource = fs.readFileSync(path.resolve('src/services/quranService.ts'), 'utf8');
assert(!quranSource.includes('آية كريمة من سورة'), 'B-10 synthetic verse generator removed from source');
assert(!quranSource.includes('idx % 3') && !quranSource.includes("idx % 5"), 'B-10 modulo stop-mark fabrication removed from source');
assert(quranSource.includes(' Surahs Index') === false || !quranSource.includes('// Complete 114 Surahs Index'), 'B-10 misleading "complete 114" comment fixed');

console.log(failures === 0 ? 'BATCH5 MODULE SCENARIOS: PASS' : `BATCH5 MODULE SCENARIOS: FAIL (${failures})`);
if (failures > 0) process.exit(1);
