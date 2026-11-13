import { STORAGE_KEYS } from '../storageKeys';
import { StorageAdapter } from '../storageAdapter';
import { UserRepository } from './userRepository';
import { NotesRepository } from './notesRepository';
import { ExpensesRepository } from './expensesRepository';
import { VehiclesRepository } from './vehiclesRepository';
import { EducationRepository } from './educationRepository';
import { TripsRepository } from './tripsRepository';
import { ChatRepository } from './chatRepository';
import { MediaRepository } from './mediaRepository';
import { NotificationsRepository } from './notificationsRepository';
import { ReligiousRepository } from './religiousRepository';

/**
 * Datasets whose backup shape must be an array, and datasets whose shape
 * must be a single object. Every dataset in the backup file is validated
 * BEFORE any storage write happens, so a malformed file can never leave a
 * half-restored state behind.
 */
const ARRAY_DATASETS = [
  'notes',
  'folders',
  'tags',
  'calcHistory',
  'expenses',
  'monthlyIncome',
  'bankCertificates',
  'vehicles',
  'fuelRecords',
  'maintenanceRecords',
  'students',
  'lessons',
  'educationExpenses',
  'favoritePlaces',
  'recentTrips',
  'chatRooms',
  'chatMessages',
  'mediaFolders',
  'mediaItems',
  'notifications',
  'athkarItems',
  'aiChatHistory',
] as const;

const OBJECT_DATASETS = ['profile', 'budget'] as const;

let lastImportError = '';

export class BackupRepository {
  /** Machine-readable reason of the last failed import (for UI messages). */
  static getLastImportError(): string {
    return lastImportError;
  }

  static exportFullBackupJSON(): string {
    const fullBackup = {
      exportDate: new Date().toISOString(),
      app: 'SMART TIME — وقتك من ذهب',
      version: '6.0.0',
      data: {
        profile: UserRepository.getProfile(),
        notes: NotesRepository.getNotes(),
        folders: NotesRepository.getFolders(),
        tags: NotesRepository.getTags(),
        calcHistory: NotesRepository.getCalculatorHistory(),
        expenses: ExpensesRepository.getExpenses(),
        budget: ExpensesRepository.getBudget(),
        monthlyIncome: ExpensesRepository.getMonthlyIncome(),
        bankCertificates: ExpensesRepository.getBankCertificates(),
        vehicles: VehiclesRepository.getVehicles(),
        fuelRecords: VehiclesRepository.getFuelRecords(),
        maintenanceRecords: VehiclesRepository.getMaintenanceRecords(),
        students: EducationRepository.getStudents(),
        lessons: EducationRepository.getLessons(),
        educationExpenses: EducationRepository.getEducationExpenses(),
        favoritePlaces: TripsRepository.getFavoritePlaces(),
        recentTrips: TripsRepository.getRecentTrips(),
        chatRooms: ChatRepository.getChatRooms(),
        chatMessages: ChatRepository.getChatMessages(),
        mediaFolders: MediaRepository.getFolders(),
        mediaItems: MediaRepository.getItems(),
        notifications: NotificationsRepository.getNotifications(),
        athkarItems: ReligiousRepository.getAthkarItems(),
        aiChatHistory: ChatRepository.getAiChatHistory(),
      },
    };
    return JSON.stringify(fullBackup, null, 2);
  }

  /**
   * Transactional restore:
   *  1. validate the whole file (JSON + dataset shapes + serializability),
   *  2. snapshot the raw value of every storage key,
   *  3. write all datasets while tracking storage failures,
   *  4. on ANY failure roll the entire storage back to the snapshot.
   *
   * Expenses are restored into the legacy storage key that the migration
   * preview (expenseMigration) reads — ExpenseRepository.saveExpenses is
   * intentionally disabled in favour of the canonical Finance API, so the
   * import must not call it.
   */
  static importFullBackupJSON(jsonStr: string): boolean {
    lastImportError = '';

    let parsed: { data?: Record<string, unknown> };
    try {
      parsed = JSON.parse(jsonStr);
    } catch (error) {
      lastImportError = 'INVALID_JSON';
      console.error('[BackupRepository] Backup file is not valid JSON:', error);
      return false;
    }

    const d = parsed?.data;
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      lastImportError = 'MISSING_DATA';
      console.error('[BackupRepository] Backup file has no "data" object.');
      return false;
    }

    // ---- Phase 1: validate shapes before touching storage -----------------
    for (const key of ARRAY_DATASETS) {
      if (d[key] !== undefined && !Array.isArray(d[key])) {
        lastImportError = `BAD_SHAPE:${key}`;
        console.error(`[BackupRepository] Dataset "${key}" must be an array.`);
        return false;
      }
    }
    for (const key of OBJECT_DATASETS) {
      const value = d[key];
      if (value !== undefined && (typeof value !== 'object' || value === null || Array.isArray(value))) {
        lastImportError = `BAD_SHAPE:${key}`;
        console.error(`[BackupRepository] Dataset "${key}" must be an object.`);
        return false;
      }
    }

    // Serialization dry-run: catches circular references before any write.
    try {
      for (const key of [...ARRAY_DATASETS, ...OBJECT_DATASETS]) {
        if (d[key] !== undefined) JSON.stringify(d[key]);
      }
    } catch (error) {
      lastImportError = 'NOT_SERIALIZABLE';
      console.error('[BackupRepository] Backup contains non-serializable data:', error);
      return false;
    }

    // ---- Phase 2: snapshot raw storage for rollback ------------------------
    const allKeys = Object.values(STORAGE_KEYS);
    const snapshot = new Map<string, string | null>();
    for (const key of allKeys) snapshot.set(key, StorageAdapter.getRaw(key));

    const rollback = (): void => {
      for (const [key, raw] of snapshot) {
        if (raw === null) StorageAdapter.removeItem(key);
        else StorageAdapter.setRaw(key, raw);
      }
    };

    // ---- Phase 3: write everything, tracking failures ----------------------
    const marker = StorageAdapter.beginTransaction();
    try {
      if (d.profile) UserRepository.saveProfile(d.profile as never);
      if (d.notes) NotesRepository.saveNotes(d.notes as never);
      if (d.folders) NotesRepository.saveFolders(d.folders as never);
      if (d.tags) NotesRepository.saveTags(d.tags as never);
      if (d.calcHistory) NotesRepository.saveCalculatorHistory(d.calcHistory as never);
      // Legacy expense writes throw by design (canonical Finance API is the
      // only writer). Restore into the same storage key the reader and the
      // migration preview consume instead.
      if (d.expenses) StorageAdapter.setItem(STORAGE_KEYS.EXPENSES, d.expenses);
      if (d.budget) ExpensesRepository.saveBudget(d.budget as never);
      if (d.monthlyIncome) ExpensesRepository.saveMonthlyIncome(d.monthlyIncome as never);
      if (d.bankCertificates) ExpensesRepository.saveBankCertificates(d.bankCertificates as never);
      if (d.vehicles) VehiclesRepository.saveVehicles(d.vehicles as never);
      if (d.fuelRecords) VehiclesRepository.saveFuelRecords(d.fuelRecords as never);
      if (d.maintenanceRecords) VehiclesRepository.saveMaintenanceRecords(d.maintenanceRecords as never);
      if (d.students) EducationRepository.saveStudents(d.students as never);
      if (d.lessons) EducationRepository.saveLessons(d.lessons as never);
      if (d.educationExpenses) EducationRepository.saveEducationExpenses(d.educationExpenses as never);
      if (d.favoritePlaces) TripsRepository.saveFavoritePlaces(d.favoritePlaces as never);
      if (d.recentTrips) TripsRepository.saveRecentTrips(d.recentTrips as never);
      if (d.chatRooms) ChatRepository.saveChatRooms(d.chatRooms as never);
      if (d.chatMessages) ChatRepository.saveChatMessages(d.chatMessages as never);
      if (d.mediaFolders) MediaRepository.saveFolders(d.mediaFolders as never);
      if (d.mediaItems) MediaRepository.saveItems(d.mediaItems as never);
      if (d.notifications) NotificationsRepository.saveNotifications(d.notifications as never);
      if (d.athkarItems) ReligiousRepository.saveAthkarItems(d.athkarItems as never);
      if (d.aiChatHistory) ChatRepository.saveAiChatHistory(d.aiChatHistory as never);

      if (StorageAdapter.failedSince(marker)) {
        throw new Error('storage write failed during import');
      }
      return true;
    } catch (error) {
      // ---- Phase 4: atomic rollback ---------------------------------------
      lastImportError = String((error as Error)?.message || '').includes('storage write failed')
        ? 'STORAGE_WRITE_FAILED'
        : 'WRITE_ERROR';
      console.error('[BackupRepository] Import failed, rolling back to previous data:', error);
      const rollbackMarker = StorageAdapter.beginTransaction();
      rollback();
      if (StorageAdapter.failedSince(rollbackMarker)) {
        console.error('[BackupRepository] CRITICAL: rollback itself hit storage errors; verify storage availability.');
      }
      return false;
    }
  }

  static resetToDefaults(): void {
    this.clearAllData();
  }

  static clearAllData(): void {
    for (const key of Object.values(STORAGE_KEYS)) StorageAdapter.removeItem(key);
  }
}
