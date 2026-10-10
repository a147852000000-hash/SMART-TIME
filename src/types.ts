export type Language = 'ar' | 'en' | 'fr';
export type ThemeMode = 'light' | 'dark';
export type ColorTheme = 'ocean' | 'facebook' | 'whatsapp' | 'telegram' | 'instagram' | 'youtube' | 'gold';
export type IconStyle = 'classic' | 'soft' | 'bold' | 'glow';
export type ReligiousPreference = 'islam' | 'christianity' | 'muslim' | 'christian' | 'skip';
export type CurrencyType = 'EGP' | 'SAR' | 'AED' | 'USD' | 'EUR' | string;

export type AppView =
  | 'dashboard'
  | 'notes'
  | 'calendar'
  | 'calculator'
  | 'expenses'
  | 'trips'
  | 'vehicles'
  | 'education'
  | 'religious'
  | 'vault'
  | 'ai'
  | 'chat'
  | 'media'
  | 'sports'
  | 'wallet'
  | 'admin-wallet'
  | 'settings'
  | 'food';

export interface TickerPreferences {
  showTimeAndDate: boolean;
  showGold: boolean;
  showSilver: boolean;
  showZodiac: boolean;
  showEgyptianLeague: boolean;
  showCrypto: boolean;
  showCurrencies: boolean;
  showWeather: boolean;
  showCustomMessage: boolean;
  showDailyTasks?: boolean; // تذكيرات ومهام قسم ذكرني في شريط الأخبار
  showZakkirni?: boolean;
  customMessage?: string;
  favoriteEgyptianTeam?: string;
  favoriteTeam?: string; // Global & Local favorite team (ريال مدريد, برشلونة, مان سيتي, ليفربول, الأهلي, إلخ)
  silverUnit?: '999' | '925' | '900' | '800' | 'ounce' | 'all' | string;
  goldUnit?:
    | '24'
    | '22'
    | '21'
    | '18'
    | '14'
    | '12'
    | '9'
    | 'pound'
    | 'half_pound'
    | 'quarter_pound'
    | 'ounce'
    | 'bar10g'
    | 'all'
    | string;
  selectedCryptos?: string[]; // e.g. ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'TON']
  customCryptos?: {
    id: string;
    name: string;
    nameAr?: string;
    nameEn?: string;
    symbol: string;
    priceUsd: number;
    change24h: number;
    iconColor?: string;
    iconSymbol?: string;
  }[];
  speed?: 'very_slow' | 'slow' | 'medium' | 'fast';
}

export interface VehiclePreferences {
  primaryVehicleName?: string;
  vehicleType?: string;
  vehicleShape?: string;
  fuelType?: 'gasoline92' | 'gasoline95' | 'gas' | 'diesel' | 'electric';
  serviceIntervalKm?: number;
}

export interface BudgetPreferences {
  monthlyBudgetLimit?: number;
  alertThresholdPercent?: number;
  defaultPaymentMethod?: 'cash' | 'instapay' | 'vodafoneCash' | 'card';
}

export interface ReligiousDetails {
  reciter?: string;
  prayerCalculationMethod?: string;
  athkarReminderEnabled?: boolean;
}

export interface EducationPreferences {
  defaultGradeLevel?: string;
  homeworkAlerts?: boolean;
}

export interface UserProfile {
  foodPreferences?: any;
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl: string;
  country: string;
  city: string;
  gender?: 'male' | 'female';
  occupation?: string;
  currency: CurrencyType;
  language: Language;
  theme: ThemeMode;
  colorTheme?: ColorTheme;
  iconStyle?: IconStyle;
  religiousPreference: ReligiousPreference;
  isOnboarded: boolean;
  authPhoneVerified?: boolean;
  pin?: string;
  pinCode?: string;
  biometricEnabled?: boolean;
  birthDate?: string;
  zodiacSign?: string;
  tickerPreferences?: TickerPreferences;
  vehiclePreferences?: VehiclePreferences;
  budgetPreferences?: BudgetPreferences;
  religiousDetails?: ReligiousDetails;
  educationPreferences?: EducationPreferences;
}

// ---------------------------
// 1. NOTES & ACCOUNTING
// ---------------------------
export interface NoteFolder {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface NoteTag {
  id: string;
  name: string;
  color: string;
}

export interface Note {
  id: string;
  title: string;
  content: string; // Rich text HTML / Markdown
  folderId?: string;
  tags: string[];
  color: string;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  date?: string;
  images?: string[];
}

export type CalculatorMode = 'basic' | 'scientific' | 'engineering';

export interface CalculatorHistoryItem {
  id: string;
  expression: string;
  result: string;
  mode: CalculatorMode;
  timestamp: string;
}

// ---------------------------
// DAILY REMINDERS & TASKS (ذكرني - المهمات اليومية)
// ---------------------------
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskCategory = 'work' | 'personal' | 'finance' | 'health' | 'education' | 'general';

export type EventCategory = 'work' | 'personal' | 'finance' | 'health' | 'education' | 'general';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  timezone: string;
  location?: string;
  category: EventCategory;
  allDay: boolean;
  reminderEnabled: boolean;
  reminderMinutes?: number;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval?: number;
    until?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DailyTask {
  id: string;
  title: string;
  completed: boolean;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate?: string;
  dueTime?: string;
  noteId?: string;
  reminderEnabled?: boolean;
  createdAt: string;
  completedAt?: string;
}

// ---------------------------
// 2. EXPENSES & BUDGET
// ---------------------------
export type ExpenseCategoryType =
  | 'transport'
  | 'vehicle'
  | 'education'
  | 'bills'
  | 'shopping'
  | 'health'
  | 'entertainment'
  | 'other';

export type ExpenseCategory = ExpenseCategoryType;

export type PaymentMethod = 'cash' | 'card' | 'wallet';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategoryType;
  date: string;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  notes?: string;
  createdAt: string;
}

export type ExpenseItem = Expense;

export interface BudgetSummary {
  totalBudget: number;
  totalExpenses: number;
  remaining: number;
  percentUsed: number;
}

export interface IncomeSourceItem {
  id: string;
  source: string;
  amount: number;
  date: string;
  type: string;
  notes?: string;
  createdAt: string;
}

export interface CarTripIncomeRecord {
  id: string;
  tripNumber: string | number;
  amount: number;
  date: string; // YYYY-MM-DD
  dayName?: string; // e.g. "الثلاثاء"
  time?: string; // e.g. "14:30"
  notes?: string;
  tripType?: string; // e.g. "أوبر", "ديدي", "إندرايف", "مشوار خاص", "كاش"
  paymentMethod?: string; // "cash" | "wallet" | "card" | "app"
  createdAt: string;
}

export interface MonthlyIncome {
  id: string;
  month: string; // YYYY-MM
  salary: number;
  bonuses: number;
  otherIncome: number;
  otherIncomeNote?: string;
  sources?: IncomeSourceItem[];
  createdAt: string;
  updatedAt?: string;
}

export type CertificateProfitFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'maturity';

export interface BankCertificate {
  id: string;
  bankName: string;
  certificateNumber?: string;
  duration: string;
  amount: number;
  annualRate?: number;
  annualProfit?: number;
  periodicProfit?: number;
  monthlyEquivalentProfit?: number;
  returnType?: 'simple' | 'compound' | 'variable';
  issueDate: string;
  maturityDate: string;
  profitDate: string;
  profitAmount: number;
  profitFrequency: CertificateProfitFrequency;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ---------------------------
// 3. VEHICLES & FUEL
// ---------------------------
export interface Vehicle {
  id: string;
  name: string;
  model: string;
  year: number;
  plateNumber: string;
  fuelType: '92' | '95' | '80' | 'Diesel' | 'diesel' | 'Electric' | 'electric' | 'gas' | string;
  currentMileage: number;
  color?: string;
}

export interface FuelRecord {
  id: string;
  vehicleId: string;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  mileage: number;
  date: string;
  stationName?: string;
  notes?: string;
}

export type MaintenanceSystemType =
  | 'oil'
  | 'transmission'
  | 'tires'
  | 'brakes'
  | 'battery'
  | 'air_filter'
  | 'ac_filter'
  | 'spark_plugs'
  | 'coolant'
  | 'inspection'
  | 'electrical'
  | 'exhaust'
  | 'bodywork'
  | 'periodic'
  | 'other';

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  systemType: MaintenanceSystemType;
  title: string;
  cost: number;
  currentMileage: number;
  nextMileageDue: number;
  date: string;
  serviceCenter?: string;
  notes?: string;
}

export interface VehicleAccidentRecord {
  id: string;
  vehicleId?: string;
  title: string;
  photoUrl: string;
  date: string;
  time: string;
  location?: string;
  estimatedDamage?: number;
  notes?: string;
  savedToVault?: boolean;
  vaultRecordId?: string;
  createdAt: string;
}

// ---------------------------
// 4. EDUCATION (التعليم)
// ---------------------------
export interface Student {
  id: string;
  name: string;
  grade: string;
  schoolName: string;
  avatar: string;
}

export interface LessonItem {
  id: string;
  studentId: string;
  subject: string;
  title: string;
  dayOfWeek: string;
  time: string;
  tutorName?: string;
  monthlyFee: number;
  isPaid: boolean;
}

export interface EducationExpense {
  id: string;
  studentId: string;
  title: string;
  amount: number;
  category: 'tuition' | 'lessons' | 'books' | 'supplies' | 'transport' | 'private_tutor' | 'activities';
  date: string;
  notes?: string;
}

// ---------------------------
// 6. TRIPS & SMART TRANSPORT
// ---------------------------
export interface GeoPoint {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export type TripPoint = GeoPoint;

export type RideType = 'Economy' | 'Comfort' | 'Scooter' | 'Taxi' | 'Normal' | string;

export interface TransportProviderOption {
  providerId: string;
  providerName: string;
  logoUrl: string;
  vehicleType: string;
  estimatedFareMin: number;
  estimatedFareMax: number;
  currency: string;
  etaMinutes: number;
  driverRating: number;
  deepLink: string;
}

export interface TransportComparisonResult {
  distanceKm: number;
  estimatedDurationMins: number;
  bestValueId: string;
  cheapestId: string;
  fastestId: string;
  options: TransportProviderOption[];
}

export interface RecentTrip {
  id: string;
  from: TripPoint;
  to: TripPoint;
  date: string;
  provider: string;
  rideType: string;
  fare: number;
  distanceKm?: number;
}

export interface FavoritePlace {
  id: string;
  title: string;
  type: 'home' | 'work' | 'family' | 'other';
  point: TripPoint;
}

// ---------------------------
// 7. SECURE VAULT
// ---------------------------
export type SecureCategory = 'password' | 'code' | 'phone' | 'document' | 'note' | 'photo' | 'video' | 'file' | 'bank_card';

export interface SecureRecord {
  id: string;
  title: string;
  category: SecureCategory;
  value: string;
  username?: string;
  notes?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------
// 8. RELIGIOUS SECTION
// ---------------------------
export interface QuranSurah {
  number: number;
  name: string;
  englishName: string;
  versesCount: number;
  revelationType: 'Meccan' | 'Medinan';
}

export type QuranAyahTopicColor = 'green' | 'blue' | 'yellow' | 'purple' | 'red';

export interface QuranAyah {
  numberInSurah: number;
  surahNumber: number;
  surahName: string;
  text: string;
  tafsir?: string;
  juzNumber: number;
  topicColor: QuranAyahTopicColor;
  topicLabelAr: string;
  translationEn?: string;
}

export interface QuranReadingPosition {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  pageNumber: number;
  juzNumber: number;
  timestamp: string;
}

export interface QuranBookmark {
  id: string;
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  pageNumber: number;
  note?: string;
  createdAt: string;
}

export type AdhanType = 'full' | 'takbeer_only';

export interface MuadhinOption {
  id: string;
  nameAr: string;
  nameEn: string;
  location: string;
  audioSampleUrl?: string;
}

export interface QuranWirdProgress {
  currentPage: number;
  totalPages: number;
  dailyGoalPages: number;
  currentSurahName: string;
  reminderTime: string;
  reminderEnabled: boolean;
  streakDays: number;
  lastReadDate: string;
  lastPosition?: QuranReadingPosition;
}

export interface ChristianPrayer {
  id: string;
  title: string;
  hourName: string;
  text: string;
  description: string;
}

export interface ChristianDailyReading {
  date: string;
  saintOfDay: string;
  gospelText: string;
  gospelReference: string;
  epistleText: string;
  epistleReference: string;
  thoughtOfDay: string;
}

export interface AthkarCategory {
  id: string;
  title: string;
  icon: string;
  count: number;
}

export interface AthkarItem {
  id: string;
  categoryId: string;
  text: string;
  repeatCount: number;
  currentCount: number;
  virtue?: string;
}

export interface PrayerTimesData {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  currentPrayer: string;
  nextPrayer: string;
  timeRemaining: string;
}

export type SmartAiVoiceId = 'male' | 'female' | 'youth' | 'child';
export type SmartVoiceDnaRelationship = 'self' | 'father' | 'mother' | 'spouse' | 'son' | 'daughter' | 'family';
export type SmartVoiceDnaConsentMode = 'self' | 'guardian';
export type SmartVoiceDnaDialect = 'ar-EG' | 'en-US';
export type SmartVoiceDnaSpeakingStyle = 'natural' | 'calm' | 'warm' | 'formal' | 'alert';

// ---------------------------
// 9. AI CENTER
// ---------------------------
export type AiModelType = 'smart-time-core' | 'gemini-2.5-flash' | 'chatgpt-4o' | 'claude-3-5-sonnet' | 'manus-agent' | string;
export type AIProviderId = 'smart-ai' | 'gemini' | 'chatgpt' | 'claude' | 'manus';

export interface AiMessage {
  id: string;
  sender: 'user' | 'ai' | 'model';
  text: string;
  timestamp: string;
  model?: AiModelType;
  provider?: AIProviderId;
  isCode?: boolean;
}

export type AIMessage = AiMessage;

// ---------------------------
// 10. HOT CHAT
// ---------------------------
export interface ChatMember {
  id: string;
  name: string;
  avatar: string;
  phone?: string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joinedAt?: string;
  isOnline?: boolean;
  lastSeenAt?: string;
  muted?: boolean;
  banned?: boolean;
}

export interface ChatRoomPermissions {
  sendMessages: boolean;
  sendMedia: boolean;
  addMembers: boolean;
  pinMessages: boolean;
  editRoom: boolean;
  deleteMessages: boolean;
  startCalls: boolean;
  mentionEveryone: boolean;
}

export interface ChatRoomSettings {
  disappearing: 'off' | '24h' | '7d' | '90d';
  muted: boolean;
  readReceipts: boolean;
  typingIndicator: boolean;
  linkPreviews: boolean;
  mediaAutoSave: boolean;
  enterToSend: boolean;
  slowModeSeconds: 0 | 10 | 30 | 60 | 300;
  approvalRequired: boolean;
}

export interface ChatRoom {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  type: 'public' | 'direct' | 'group';
  avatar: string;
  creatorId?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  membersCount?: number;
  isOnline?: boolean;
  background?: string;
  backgroundUrl?: string;
  avatarUrl?: string;
  members?: ChatMember[];
  permissions?: ChatRoomPermissions;
  adminPermissions?: ChatRoomPermissions;
  moderatorPermissions?: ChatRoomPermissions;
  settings?: ChatRoomSettings;
  inviteLink?: string;
  pinned?: boolean;
  currentUserRole?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  roomId?: string;
  conversationId?: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  body?: string;
  mediaUrl?: string;
  type?: 'text' | 'image' | 'video' | 'voice' | 'file' | 'location' | 'poll';
  status?: 'sent' | 'delivered' | 'read';
  isOutgoing?: boolean;
  isPinned?: boolean;
  pinnedBy?: string;
  pinnedAt?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  isSaved?: boolean;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
  location?: {
    lat: number;
    lng: number;
    isLive?: boolean;
  };
  poll?: {
    question: string;
    options: string[];
    votes: Record<number, string[]>;
    multiple?: boolean;
  };
}

export interface SavedMessageItem {
  id: string;
  roomId: string;
  roomTitle: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  body?: string;
  mediaUrl?: string;
  type?: string;
  savedAt: string;
  timestamp: string;
}


// ---------------------------
// 11. MEDIA & PDF / OCR
// ---------------------------
export interface MediaFolder {
  id: string;
  name: string;
  icon?: string;
  itemCount?: number;
}

export interface MediaItem {
  id: string;
  title?: string;
  name?: string;
  type: 'image' | 'video' | 'audio' | 'pdf' | 'document';
  url: string;
  fileSize?: string;
  sizeBytes?: number;
  date: string;
  folderId?: string;
  tags?: string[];
}

// ---------------------------
// 12. NOTIFICATIONS
// ---------------------------
export type NotificationCategory =
  | 'all'
  | 'chat'
  | 'trips'
  | 'expenses'
  | 'vehicles'
  | 'education'
  | 'food'
  | 'notes'
  | 'religious'
  | 'security'
  | 'backup'
  | 'system';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category:
    | 'chat'
    | 'trips'
    | 'expenses'
    | 'vehicles'
    | 'education'
    | 'food'
    | 'notes'
    | 'religious'
    | 'backup'
    | 'security'
    | 'system';
  date: string;
  isRead: boolean;
  actionTab?: string;
}

// ---------------------------
// 13. EDUCATION & STUDENTS
// ---------------------------
export interface StudentProfile {
  id: string;
  name: string;
  nationalId: string;
  age: string;
  stage: string;
}

export interface StudentExpenseRecord {
  id: string;
  studentId: string;
  subCategory: 'lessons' | 'personal' | 'transport' | 'school' | 'books';
  title: string;
  amount: number;
  date: string;
}

export interface MedicalExpenseRecord {
  id: string;
  familyMember: string;
  facilityName?: string;
  facilityType: 'مستشفى' | 'عيادة خاصة' | 'عيادة أسنان' | 'صيدلية' | 'أخرى';
  conditionDescription: string;
  doctorDiagnosis?: string;
  examinationCost: number;
  medicationCost: number;
  date: string;
  notes?: string;
}

// ---------------------------
// 14. CARD DESIGN SYSTEM & PREFERENCES
// ---------------------------
export type CardStyleType =
  | 'classic'     // كلاسيكي متوازن
  | 'soft'        // ناعم منحني هادئ
  | 'glass'       // زجاجي بلوري شفاف (Glassmorphism)
  | 'floating'    // عائم ثلاثي الأبعاد بظلال عميقة
  | 'gradient'    // تدرجات لونية عصرية مفعمة بالحيوية
  | 'minimal'     // مينيمال بسيط ونظيف
  | 'neon'        // نيون متوهج مستقبلي
  | 'compact'     // مضغوط عالي الكثافة
  | 'outline'     // حدود بارزة واضحة
  | 'dashboard';  // لوحة تحكم ذكية تفاعلية

export type CardRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type CardShadow = 'none' | 'subtle' | 'medium' | 'deep' | 'glow';
export type CardBlur = 'none' | 'low' | 'medium' | 'high';
export type CardAnimation = 'off' | 'subtle' | 'normal' | 'dynamic';
export type CardDensity = 'compact' | 'normal' | 'spacious';
export type CardIconSize = 'small' | 'medium' | 'large';
export type CardBackgroundTheme = 'default' | 'sky' | 'mint' | 'lavender' | 'peach' | 'candy';
export type CardPresetId =
  | 'elegant'
  | 'darkPremium'
  | 'glass'
  | 'minimal'
  | 'colorful'
  | 'dashboard'
  | 'neon';

export interface CardPreferences {
  style: CardStyleType;
  radius: CardRadius;
  shadow: CardShadow;
  opacity: number; // 70..100
  blur: CardBlur;
  animation: CardAnimation;
  density: CardDensity;
  showBadges: boolean;
  showGlow: boolean;
  tilt3D: boolean;
  iconSize?: CardIconSize;
  backgroundTheme?: CardBackgroundTheme;
  activePreset?: CardPresetId;
  hiddenCardIds?: string[];
  cardSizes?: Record<string, 'small' | 'medium' | 'large' | 'wide'>;
}

