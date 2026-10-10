import { STORAGE_KEYS } from '../storageKeys';
import { StorageAdapter } from '../storageAdapter';
import { UserRepository } from './userRepository';
import { NotesRepository } from './notesRepository';
import { ExpensesRepository } from './expensesRepository';
import { VehiclesRepository } from './vehiclesRepository';
import { EducationRepository } from './educationRepository';
import { TripsRepository } from './tripsRepository';
import { VaultRepository } from './vaultRepository';
import { ChatRepository } from './chatRepository';
import { MediaRepository } from './mediaRepository';
import { NotificationsRepository } from './notificationsRepository';
import { ReligiousRepository } from './religiousRepository';

export class BackupRepository {
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
        secureRecords: VaultRepository.getRecords(),
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

  static importFullBackupJSON(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.data) return false;
      const d = parsed.data;

      if (d.profile) UserRepository.saveProfile(d.profile);
      if (d.notes) NotesRepository.saveNotes(d.notes);
      if (d.folders) NotesRepository.saveFolders(d.folders);
      if (d.tags) NotesRepository.saveTags(d.tags);
      if (d.calcHistory) NotesRepository.saveCalculatorHistory(d.calcHistory);
      if (d.expenses) ExpensesRepository.saveExpenses(d.expenses);
      if (d.budget) ExpensesRepository.saveBudget(d.budget);
      if (d.monthlyIncome) ExpensesRepository.saveMonthlyIncome(d.monthlyIncome);
      if (d.bankCertificates) ExpensesRepository.saveBankCertificates(d.bankCertificates);
      if (d.vehicles) VehiclesRepository.saveVehicles(d.vehicles);
      if (d.fuelRecords) VehiclesRepository.saveFuelRecords(d.fuelRecords);
      if (d.maintenanceRecords) VehiclesRepository.saveMaintenanceRecords(d.maintenanceRecords);
      if (d.students) EducationRepository.saveStudents(d.students);
      if (d.lessons) EducationRepository.saveLessons(d.lessons);
      if (d.educationExpenses) EducationRepository.saveEducationExpenses(d.educationExpenses);
      if (d.favoritePlaces) TripsRepository.saveFavoritePlaces(d.favoritePlaces);
      if (d.recentTrips) TripsRepository.saveRecentTrips(d.recentTrips);
      if (d.secureRecords) VaultRepository.saveRecords(d.secureRecords);
      if (d.chatRooms) ChatRepository.saveChatRooms(d.chatRooms);
      if (d.chatMessages) ChatRepository.saveChatMessages(d.chatMessages);
      if (d.mediaFolders) MediaRepository.saveFolders(d.mediaFolders);
      if (d.mediaItems) MediaRepository.saveItems(d.mediaItems);
      if (d.notifications) NotificationsRepository.saveNotifications(d.notifications);
      if (d.athkarItems) ReligiousRepository.saveAthkarItems(d.athkarItems);
      if (d.aiChatHistory) ChatRepository.saveAiChatHistory(d.aiChatHistory);

      return true;
    } catch (e) {
      console.error('[BackupRepository] Failed to import backup data:', e);
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
