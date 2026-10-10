import type {
  AiMessage,
  AppNotification,
  AthkarItem,
  BankCertificate,
  BudgetSummary,
  ChatMessage,
  ChatRoom,
  DailyTask,
  EducationExpense,
  Expense,
  FavoritePlace,
  FuelRecord,
  LessonItem,
  MediaFolder,
  MediaItem,
  MonthlyIncome,
  Note,
  NoteFolder,
  NoteTag,
  RecentTrip,
  SecureRecord,
  Student,
  UserProfile,
  Vehicle,
  VehicleAccidentRecord,
  MaintenanceRecord,
} from '../types';
import { STORAGE_KEYS } from './storageKeys';

export type HiddenSchemaStorageKey =
  | typeof STORAGE_KEYS.DASHBOARD_LAYOUT
  | typeof STORAGE_KEYS.DASHBOARD_SECTIONS_V2
  | typeof STORAGE_KEYS.WORKOUT_LOGS
  | typeof STORAGE_KEYS.SPORTS_CARDS_ORDER
  | typeof STORAGE_KEYS.EXPENSES_SECTIONS_ORDER;

export type StorageSchemaKey =
  | (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
  | HiddenSchemaStorageKey;

export interface DashboardSectionPreference {
  id: string;
  isFavorite?: boolean;
}

export interface WorkoutLogRecord {
  id: string;
  title: string;
  category: string;
  duration: number;
  calories: number;
  date: string;
}

export type DashboardLayoutMode = 'organic' | 'grid' | 'detailed';

export type ExpenseSectionKey =
  | 'vehicle'
  | 'income_certs'
  | 'education'
  | 'house'
  | 'personal'
  | 'reports';

export type StorageSchemaValueMap = {
  [STORAGE_KEYS.USER_PROFILE]: UserProfile;
  [STORAGE_KEYS.NOTES]: Note[];
  [STORAGE_KEYS.NOTE_FOLDERS]: NoteFolder[];
  [STORAGE_KEYS.NOTE_TAGS]: NoteTag[];
  [STORAGE_KEYS.CALCULATOR_HISTORY]: unknown[];
  [STORAGE_KEYS.DAILY_TASKS]: DailyTask[];
  [STORAGE_KEYS.EXPENSES]: Expense[];
  [STORAGE_KEYS.BUDGET]: BudgetSummary;
  [STORAGE_KEYS.MONTHLY_INCOME]: MonthlyIncome[];
  [STORAGE_KEYS.BANK_CERTIFICATES]: BankCertificate[];
  [STORAGE_KEYS.VEHICLES]: Vehicle[];
  [STORAGE_KEYS.FUEL_RECORDS]: FuelRecord[];
  [STORAGE_KEYS.MAINTENANCE_RECORDS]: MaintenanceRecord[];
  [STORAGE_KEYS.ACCIDENT_RECORDS]: VehicleAccidentRecord[];
  [STORAGE_KEYS.STUDENTS]: Student[];
  [STORAGE_KEYS.LESSONS]: LessonItem[];
  [STORAGE_KEYS.EDUCATION_EXPENSES]: EducationExpense[];
  [STORAGE_KEYS.FAVORITE_PLACES]: FavoritePlace[];
  [STORAGE_KEYS.RECENT_TRIPS]: RecentTrip[];
  [STORAGE_KEYS.SECURE_RECORDS]: SecureRecord[];
  [STORAGE_KEYS.CHAT_ROOMS]: ChatRoom[];
  [STORAGE_KEYS.CHAT_MESSAGES]: ChatMessage[];
  [STORAGE_KEYS.MEDIA_FOLDERS]: MediaFolder[];
  [STORAGE_KEYS.MEDIA_ITEMS]: MediaItem[];
  [STORAGE_KEYS.NOTIFICATIONS]: AppNotification[];
  [STORAGE_KEYS.ATHKAR_ITEMS]: AthkarItem[];
  [STORAGE_KEYS.AI_CHAT_HISTORY]: AiMessage[];
  [STORAGE_KEYS.NOTIFICATION_SOUND]: boolean;
  [STORAGE_KEYS.DASHBOARD_LAYOUT]: DashboardLayoutMode;
  [STORAGE_KEYS.DASHBOARD_SECTIONS_V2]: DashboardSectionPreference[];
  [STORAGE_KEYS.WORKOUT_LOGS]: WorkoutLogRecord[];
  [STORAGE_KEYS.SPORTS_CARDS_ORDER]: string[];
  [STORAGE_KEYS.EXPENSES_SECTIONS_ORDER]: ExpenseSectionKey[];
};

export type StorageSchemaEntry<K extends StorageSchemaKey = StorageSchemaKey> = {
  key: K;
  description: string;
  validate: (value: unknown) => boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isArrayOf = <T>(predicate: (value: unknown) => value is T) =>
  (value: unknown): value is T[] => Array.isArray(value) && value.every(predicate);

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const isObjectArray = (value: unknown): value is Record<string, unknown>[] =>
  isArrayOf(isRecord)(value);

const hasStringId = (value: unknown): value is { id: string } =>
  isRecord(value) && isString(value.id);

const isStringArray = isArrayOf(isString);

const isDashboardLayout = (value: unknown): value is DashboardLayoutMode =>
  value === 'organic' || value === 'grid' || value === 'detailed';

const isDashboardSectionPreference = (
  value: unknown,
): value is DashboardSectionPreference =>
  isRecord(value) && isString(value.id) &&
  (value.isFavorite === undefined || isBoolean(value.isFavorite));

const isWorkoutLog = (value: unknown): value is WorkoutLogRecord =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.title) &&
  isString(value.category) &&
  isNumber(value.duration) &&
  isNumber(value.calories) &&
  isString(value.date);

const isExpenseSectionKey = (value: unknown): value is ExpenseSectionKey =>
  value === 'vehicle' ||
  value === 'income_certs' ||
  value === 'education' ||
  value === 'house' ||
  value === 'personal' ||
  value === 'reports';

const isDashboardSectionArray = isArrayOf(isDashboardSectionPreference);
const isWorkoutLogArray = isArrayOf(isWorkoutLog);
const isExpenseSectionArray = isArrayOf(isExpenseSectionKey);

const schema = {
  [STORAGE_KEYS.USER_PROFILE]: {
    key: STORAGE_KEYS.USER_PROFILE,
    description: 'Current SMART TIME user profile.',
    validate: isRecord,
  },
  [STORAGE_KEYS.NOTES]: {
    key: STORAGE_KEYS.NOTES,
    description: 'Notes collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.NOTE_FOLDERS]: {
    key: STORAGE_KEYS.NOTE_FOLDERS,
    description: 'Note folders collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.NOTE_TAGS]: {
    key: STORAGE_KEYS.NOTE_TAGS,
    description: 'Note tags collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.CALCULATOR_HISTORY]: {
    key: STORAGE_KEYS.CALCULATOR_HISTORY,
    description: 'Calculator history collection.',
    validate: Array.isArray,
  },
  [STORAGE_KEYS.DAILY_TASKS]: {
    key: STORAGE_KEYS.DAILY_TASKS,
    description: 'Daily task collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.EXPENSES]: {
    key: STORAGE_KEYS.EXPENSES,
    description: 'Canonical local expense collection for the legacy storage layer.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.BUDGET]: {
    key: STORAGE_KEYS.BUDGET,
    description: 'Budget summary object.',
    validate: isRecord,
  },
  [STORAGE_KEYS.MONTHLY_INCOME]: {
    key: STORAGE_KEYS.MONTHLY_INCOME,
    description: 'Monthly income collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.BANK_CERTIFICATES]: {
    key: STORAGE_KEYS.BANK_CERTIFICATES,
    description: 'Bank certificate collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.VEHICLES]: {
    key: STORAGE_KEYS.VEHICLES,
    description: 'Vehicle collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.FUEL_RECORDS]: {
    key: STORAGE_KEYS.FUEL_RECORDS,
    description: 'Vehicle fuel record collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.MAINTENANCE_RECORDS]: {
    key: STORAGE_KEYS.MAINTENANCE_RECORDS,
    description: 'Vehicle maintenance record collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.ACCIDENT_RECORDS]: {
    key: STORAGE_KEYS.ACCIDENT_RECORDS,
    description: 'Vehicle accident record collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.STUDENTS]: {
    key: STORAGE_KEYS.STUDENTS,
    description: 'Student collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.LESSONS]: {
    key: STORAGE_KEYS.LESSONS,
    description: 'Lesson collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.EDUCATION_EXPENSES]: {
    key: STORAGE_KEYS.EDUCATION_EXPENSES,
    description: 'Education expense collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.FAVORITE_PLACES]: {
    key: STORAGE_KEYS.FAVORITE_PLACES,
    description: 'Favorite places collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.RECENT_TRIPS]: {
    key: STORAGE_KEYS.RECENT_TRIPS,
    description: 'Recent trips collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.SECURE_RECORDS]: {
    key: STORAGE_KEYS.SECURE_RECORDS,
    description: 'Secure vault records collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.CHAT_ROOMS]: {
    key: STORAGE_KEYS.CHAT_ROOMS,
    description: 'Chat rooms collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.CHAT_MESSAGES]: {
    key: STORAGE_KEYS.CHAT_MESSAGES,
    description: 'Chat messages collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.MEDIA_FOLDERS]: {
    key: STORAGE_KEYS.MEDIA_FOLDERS,
    description: 'Media folder collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.MEDIA_ITEMS]: {
    key: STORAGE_KEYS.MEDIA_ITEMS,
    description: 'Media item collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.NOTIFICATIONS]: {
    key: STORAGE_KEYS.NOTIFICATIONS,
    description: 'Application notification collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.ATHKAR_ITEMS]: {
    key: STORAGE_KEYS.ATHKAR_ITEMS,
    description: 'Athkar item collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.AI_CHAT_HISTORY]: {
    key: STORAGE_KEYS.AI_CHAT_HISTORY,
    description: 'AI chat history collection.',
    validate: isObjectArray,
  },
  [STORAGE_KEYS.NOTIFICATION_SOUND]: {
    key: STORAGE_KEYS.NOTIFICATION_SOUND,
    description: 'Notification sound enabled/disabled flag.',
    validate: isBoolean,
  },
  [STORAGE_KEYS.DASHBOARD_LAYOUT]: {
    key: STORAGE_KEYS.DASHBOARD_LAYOUT,
    description: 'Dashboard layout mode persisted by DashboardView.',
    validate: isDashboardLayout,
  },
  [STORAGE_KEYS.DASHBOARD_SECTIONS_V2]: {
    key: STORAGE_KEYS.DASHBOARD_SECTIONS_V2,
    description: 'Dashboard section ordering/favorite preferences.',
    validate: isDashboardSectionArray,
  },
  [STORAGE_KEYS.WORKOUT_LOGS]: {
    key: STORAGE_KEYS.WORKOUT_LOGS,
    description: 'Workout log collection persisted by SportsView.',
    validate: isWorkoutLogArray,
  },
  [STORAGE_KEYS.SPORTS_CARDS_ORDER]: {
    key: STORAGE_KEYS.SPORTS_CARDS_ORDER,
    description: 'Sports home card ordering.',
    validate: isStringArray,
  },
  [STORAGE_KEYS.EXPENSES_SECTIONS_ORDER]: {
    key: STORAGE_KEYS.EXPENSES_SECTIONS_ORDER,
    description: 'Expenses section ordering.',
    validate: isExpenseSectionArray,
  },
} satisfies {
  [K in StorageSchemaKey]: StorageSchemaEntry<K>;
};

export const STORAGE_SCHEMA = schema;

export function isStorageSchemaKey(key: string): key is StorageSchemaKey {
  return Object.prototype.hasOwnProperty.call(STORAGE_SCHEMA, key);
}

export function validateStorageValue<K extends StorageSchemaKey>(
  key: K,
  value: unknown,
): value is StorageSchemaValueMap[K] {
  const entry = STORAGE_SCHEMA[key] as unknown as StorageSchemaEntry<K>;
  return entry.validate(value);
}

export function parseStorageValue<K extends StorageSchemaKey>(
  key: K,
  raw: string | null,
): StorageSchemaValueMap[K] | null {
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return validateStorageValue(key, parsed) ? parsed : null;
  } catch {
    return null;
  }
}
