import {
  UserProfile,
  Note,
  NoteFolder,
  NoteTag,
  CalculatorHistoryItem,
  Expense,
  BudgetSummary,
  Vehicle,
  FuelRecord,
  MaintenanceRecord,
  Student,
  LessonItem,
  EducationExpense,
  FavoritePlace,
  RecentTrip,
  SecureRecord,
  ChatRoom,
  ChatMessage,
  MediaFolder,
  MediaItem,
  AppNotification,
  AthkarItem,
  AiMessage,
} from '../types';
import {
  UserRepository,
  NotesRepository,
  ExpensesRepository,
  VehiclesRepository,
  EducationRepository,
  ReligiousRepository,
  VaultRepository,
  TripsRepository,
  ChatRepository,
  MediaRepository,
  NotificationsRepository,
  BackupRepository,
} from './repositories';

/**
 * StorageService serves as a backwards-compatible facade around the modular Repositories.
 * New code should prefer importing specific repositories directly from 'src/services'.
 */
export class StorageService {
  // Profile
  static getUserProfile(): UserProfile {
    return UserRepository.getProfile();
  }
  static saveUserProfile(profile: UserProfile): void {
    UserRepository.saveProfile(profile);
  }

  // Notes
  static getNotes(): Note[] {
    return NotesRepository.getNotes();
  }
  static saveNotes(notes: Note[]): void {
    NotesRepository.saveNotes(notes);
  }
  static getNoteFolders(): NoteFolder[] {
    return NotesRepository.getFolders();
  }
  static saveNoteFolders(folders: NoteFolder[]): void {
    NotesRepository.saveFolders(folders);
  }
  static getNoteTags(): NoteTag[] {
    return NotesRepository.getTags();
  }
  static saveNoteTags(tags: NoteTag[]): void {
    NotesRepository.saveTags(tags);
  }

  // Calculator History
  static getCalculatorHistory(): CalculatorHistoryItem[] {
    return NotesRepository.getCalculatorHistory();
  }
  static saveCalculatorHistory(history: CalculatorHistoryItem[]): void {
    NotesRepository.saveCalculatorHistory(history);
  }
  static addCalculatorHistory(item: Omit<CalculatorHistoryItem, 'id' | 'timestamp'>): void {
    NotesRepository.addCalculatorHistory(item);
  }
  static clearCalculatorHistory(): void {
    NotesRepository.clearCalculatorHistory();
  }

  // Expenses & Budget
  static getExpenses(): Expense[] {
    return ExpensesRepository.getExpenses();
  }
  static saveExpenses(expenses: Expense[]): void {
    ExpensesRepository.saveExpenses(expenses);
  }
  static getBudget(): BudgetSummary {
    return ExpensesRepository.getBudget();
  }
  static saveBudget(budget: BudgetSummary): void {
    ExpensesRepository.saveBudget(budget);
  }

  // Vehicles & Fuel & Maintenance
  static getVehicles(): Vehicle[] {
    return VehiclesRepository.getVehicles();
  }
  static saveVehicles(vehicles: Vehicle[]): void {
    VehiclesRepository.saveVehicles(vehicles);
  }
  static getFuelRecords(): FuelRecord[] {
    return VehiclesRepository.getFuelRecords();
  }
  static saveFuelRecords(records: FuelRecord[]): void {
    VehiclesRepository.saveFuelRecords(records);
  }
  static getMaintenanceRecords(): MaintenanceRecord[] {
    return VehiclesRepository.getMaintenanceRecords();
  }
  static saveMaintenanceRecords(records: MaintenanceRecord[]): void {
    VehiclesRepository.saveMaintenanceRecords(records);
  }

  // Education
  static getStudents(): Student[] {
    return EducationRepository.getStudents();
  }
  static saveStudents(students: Student[]): void {
    EducationRepository.saveStudents(students);
  }
  static getLessons(): LessonItem[] {
    return EducationRepository.getLessons();
  }
  static saveLessons(lessons: LessonItem[]): void {
    EducationRepository.saveLessons(lessons);
  }
  static getEducationExpenses(): EducationExpense[] {
    return EducationRepository.getEducationExpenses();
  }
  static saveEducationExpenses(expenses: EducationExpense[]): void {
    EducationRepository.saveEducationExpenses(expenses);
  }

  // Trips & Places
  static getFavoritePlaces(): FavoritePlace[] {
    return TripsRepository.getFavoritePlaces();
  }
  static saveFavoritePlaces(places: FavoritePlace[]): void {
    TripsRepository.saveFavoritePlaces(places);
  }
  static getRecentTrips(): RecentTrip[] {
    return TripsRepository.getRecentTrips();
  }
  static saveRecentTrips(trips: RecentTrip[]): void {
    TripsRepository.saveRecentTrips(trips);
  }

  // Secure Vault
  static getSecureRecords(): SecureRecord[] {
    return VaultRepository.getRecords();
  }
  static saveSecureRecords(records: SecureRecord[]): void {
    VaultRepository.saveRecords(records);
  }

  // Chat
  static getChatRooms(): ChatRoom[] {
    return ChatRepository.getChatRooms();
  }
  static saveChatRooms(rooms: ChatRoom[]): void {
    ChatRepository.saveChatRooms(rooms);
  }
  static getChatMessages(): ChatMessage[] {
    return ChatRepository.getChatMessages();
  }
  static saveChatMessages(messages: ChatMessage[]): void {
    ChatRepository.saveChatMessages(messages);
  }

  // Media
  static getMediaFolders(): MediaFolder[] {
    return MediaRepository.getFolders();
  }
  static getMediaItems(): MediaItem[] {
    return MediaRepository.getItems();
  }
  static saveMediaItems(items: MediaItem[]): void {
    MediaRepository.saveItems(items);
  }

  // Notifications
  static getNotifications(): AppNotification[] {
    return NotificationsRepository.getNotifications();
  }
  static saveNotifications(notifications: AppNotification[]): void {
    NotificationsRepository.saveNotifications(notifications);
  }

  // Athkar
  static getAthkarItems(): AthkarItem[] {
    return ReligiousRepository.getAthkarItems();
  }
  static saveAthkarItems(items: AthkarItem[]): void {
    ReligiousRepository.saveAthkarItems(items);
  }

  // AI Chat History
  static getAiChatHistory(): AiMessage[] {
    return ChatRepository.getAiChatHistory();
  }
  static saveAiChatHistory(messages: AiMessage[]): void {
    ChatRepository.saveAiChatHistory(messages);
  }

  // Full Export / Import JSON & Reset
  static exportFullBackupJSON(): string {
    return BackupRepository.exportFullBackupJSON();
  }

  static importFullBackupJSON(jsonStr: string): boolean {
    return BackupRepository.importFullBackupJSON(jsonStr);
  }

  static resetToDefaults(): void {
    BackupRepository.resetToDefaults();
  }

  static clearAllData(): void {
    BackupRepository.clearAllData();
  }
}
