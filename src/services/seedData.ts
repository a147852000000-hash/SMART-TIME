import {
  UserProfile,
  Note,
  NoteFolder,
  NoteTag,
  DailyTask,
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
  ChatRoom,
  ChatMessage,
  MediaFolder,
  MediaItem,
  AppNotification,
  AthkarItem,
  AiMessage,
  QuranWirdProgress,
  QuranAyah,
  ChristianPrayer,
  ChristianDailyReading,
} from '../types';

export const DEFAULT_USER: UserProfile = {
  id: 'usr_main_1',
  // No fake identity: new or guest profiles start empty and are filled in by
  // onboarding / the authenticated account (applyUserToProfile).
  name: '',
  email: '',
  phone: '',
  avatarUrl: '',
  country: 'مصر',
  city: '',
  gender: 'male',
  occupation: '',
  currency: 'EGP',
  language: 'ar',
  theme: 'light',
  religiousPreference: 'islam',
  isOnboarded: false,
  biometricEnabled: false,
  birthDate: '',
  zodiacSign: '',
  tickerPreferences: {
    showDailyTasks: true,
    showZakkirni: true,
    showTimeAndDate: true,
    showGold: true,
    showSilver: true,
    showZodiac: false,
    showEgyptianLeague: true,
    showCrypto: true,
    showCurrencies: true,
    showWeather: true,
    showCustomMessage: true,
    customMessage: 'وقتك من ذهب — استثمر يومك في طاعة الله والإنجاز',
    favoriteEgyptianTeam: 'الأهلي',
    favoriteTeam: 'الأهلي',
    silverUnit: '999',
    goldUnit: '24',
    selectedCryptos: ['BTC', 'ETH', 'SOL'],
    speed: 'slow',
  },
  vehiclePreferences: {
    primaryVehicleName: '',
    fuelType: 'gasoline95',
    serviceIntervalKm: 10000,
  },
  budgetPreferences: {
    monthlyBudgetLimit: 0,
    alertThresholdPercent: 80,
    defaultPaymentMethod: 'cash',
  },
  religiousDetails: {
    reciter: 'الشيخ محمود خليل الحصري',
    prayerCalculationMethod: 'الهيئة المصرية العامة للمساحة',
    athkarReminderEnabled: true,
  },
  educationPreferences: {
    defaultGradeLevel: 'الصف الثالث الإعدادي',
    homeworkAlerts: true,
  },
};

export const DEFAULT_NOTE_FOLDERS: NoteFolder[] = [
  { id: 'f_work', name: 'العمل والمشاريع', color: '#3b82f6', icon: 'Briefcase' },
  { id: 'f_personal', name: 'يوميات وأفكار', color: '#10b981', icon: 'User' },
  { id: 'f_finance', name: 'حسابات واستثمارات', color: '#f59e0b', icon: 'DollarSign' },
];

export const DEFAULT_NOTE_TAGS: NoteTag[] = [
  { id: 't_urgent', name: 'عاجل', color: '#ef4444' },
  { id: 't_idea', name: 'فكرة', color: '#8b5cf6' },
  { id: 't_meeting', name: 'اجتماع', color: '#06b6d4' },
];

export const DEFAULT_DAILY_TASKS: DailyTask[] = [] /* DailyTask[]: no fabricated demo data (B-14) */;

export const DEFAULT_NOTES: Note[] = [] /* Note[]: no fabricated demo data (B-14) */;

export const DEFAULT_EXPENSES: Expense[] = [] /* Expense[]: no fabricated demo data (B-14) */;

export const DEFAULT_BUDGET: BudgetSummary = {
  totalBudget: 0,
  totalExpenses: 0,
  remaining: 0,
  percentUsed: 0,
} /* honest zero state until the user sets a budget (B-14) */;

export const DEFAULT_VEHICLES: Vehicle[] = [] /* Vehicle[]: no fabricated demo data (B-14) */;

export const DEFAULT_FUEL_RECORDS: FuelRecord[] = [] /* FuelRecord[]: no fabricated demo data (B-14) */;

export const DEFAULT_MAINTENANCE_RECORDS: MaintenanceRecord[] = [] /* MaintenanceRecord[]: no fabricated demo data (B-14) */;

export const DEFAULT_STUDENTS: Student[] = [] /* Student[]: no fabricated demo data (B-14) */;

export const DEFAULT_LESSONS: LessonItem[] = [] /* LessonItem[]: no fabricated demo data (B-14) */;

export const DEFAULT_EDUCATION_EXPENSES: EducationExpense[] = [] /* EducationExpense[]: no fabricated demo data (B-14) */;

export const DEFAULT_FAVORITE_PLACES: FavoritePlace[] = [] /* FavoritePlace[]: no fabricated demo data (B-14) */;

export const DEFAULT_RECENT_TRIPS: RecentTrip[] = [] /* RecentTrip[]: no fabricated demo data (B-14) */;

export const DEFAULT_CHAT_ROOMS: ChatRoom[] = [] /* ChatRoom[]: no fabricated demo data (B-14) */;

export const DEFAULT_CHAT_MESSAGES: ChatMessage[] = [] /* ChatMessage[]: no fabricated demo data (B-14) */;

export const DEFAULT_MEDIA_FOLDERS: MediaFolder[] = [] /* MediaFolder[]: no fabricated demo data (B-14) */;

export const DEFAULT_MEDIA_ITEMS: MediaItem[] = [] /* MediaItem[]: no fabricated demo data (B-14) */;

export const DEFAULT_NOTIFICATIONS: AppNotification[] = [] /* AppNotification[]: no fabricated demo data (B-14) */;

export const DEFAULT_ATHKAR: AthkarItem[] = [
  {
    id: 'athk_1',
    categoryId: 'morning',
    text: 'أَصْبَحْنَا وَأَصْبَحَ المُلْكُ لِلَّهِ، وَالحَمْدُ لِلَّهِ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ المُلْكُ وَلَهُ الحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.',
    repeatCount: 1,
    currentCount: 0,
    virtue: 'حفظ وبركة طوال اليوم',
  },
  {
    id: 'athk_2',
    categoryId: 'morning',
    text: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ.',
    repeatCount: 1,
    currentCount: 0,
  },
  {
    id: 'athk_3',
    categoryId: 'morning',
    text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ: عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ.',
    repeatCount: 3,
    currentCount: 0,
    virtue: 'تعدل عبادة ساعات طويلة',
  },
  {
    id: 'athk_4',
    categoryId: 'morning',
    text: 'بِسْمِ اللَّهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلاَ فِي السَّمَاءِ وَهُوَ السَّمِيعُ العَلِيمُ.',
    repeatCount: 3,
    currentCount: 0,
    virtue: 'لم يضره شيء حتى يمسي',
  },
  {
    id: 'athk_5',
    categoryId: 'evening',
    text: 'أَمْسَيْنَا وَأَمْسَى المُلْكُ لِلَّهِ، وَالحَمْدُ لِلَّهِ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ.',
    repeatCount: 1,
    currentCount: 0,
  },
  {
    id: 'athk_6',
    categoryId: 'evening',
    text: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.',
    repeatCount: 3,
    currentCount: 0,
    virtue: 'حماية وحصن من كل سوء',
  },
  {
    id: 'athk_7',
    categoryId: 'tasbeeh',
    text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ',
    repeatCount: 33,
    currentCount: 0,
    virtue: 'كلمتان خفيفتان على اللسان ثقيلتان في الميزان',
  },
  {
    id: 'athk_8',
    categoryId: 'tasbeeh',
    text: 'أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ وَأَتُوبُ إِلَيْهِ',
    repeatCount: 100,
    currentCount: 0,
    virtue: 'مغفرة للذنوب وتفريج للكروب وسعة في الرزق',
  },
];

export const DEFAULT_AI_MESSAGES: AiMessage[] = [
  {
    id: 'ai_1',
    sender: 'ai',
    text: 'مرحبًا بك في مركز الذكاء الاصطناعي الفائق لتطبيق SMART TIME! أنا مساعدك الذكي المتكامل، كيف يمكنني خدمتك اليوم؟',
    timestamp: '09:00 ص',
    model: 'gemini-2.5-flash',
  },
];

export const DEFAULT_QURAN_WIRD_PROGRESS: QuranWirdProgress = {
  currentPage: 1,
  totalPages: 604,
  dailyGoalPages: 1,
  currentSurahName: '',
  reminderTime: '',
  reminderEnabled: false,
  streakDays: 0,
  lastReadDate: '',
} /* neutral progress until the user actually reads (B-14) */;

export const DEFAULT_QURAN_AYAH_TOPICS: QuranAyah[] = [
  {
    numberInSurah: 53,
    surahNumber: 39,
    surahName: 'الزمر',
    text: 'قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ ۚ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا ۚ إِنَّهُ هُوَ الْغَفُورُ الرَّحِيمُ',
    juzNumber: 24,
    topicColor: 'green',
    topicLabelAr: 'الرحمة والمغفرة والرجاء 💚',
    tafsir: 'دعوة للتائبين بعدم اليأس من رحمة الله العظيمة الشاملة لكل الذنوب لمن تاب وأناب.',
  },
  {
    numberInSurah: 255,
    surahNumber: 2,
    surahName: 'البقرة',
    text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ...',
    juzNumber: 3,
    topicColor: 'blue',
    topicLabelAr: 'العقيدة والتوحيد وأسماء الله 💙',
    tafsir: 'أعظم آية في كتاب الله تبين كمال وحدانية الله وقدرته وحفظه للكون.',
  },
  {
    numberInSurah: 183,
    surahNumber: 2,
    surahName: 'البقرة',
    text: 'يَا أَيُّهَا الَّذِينَ آمَنُوا كُتِبَ عَلَيْكُمُ الصِّيَامُ كَمَا كُتِبَ عَلَى الَّذِينَ مِن قَبْلِكُمْ لَعَلَّكُمْ تَتَّقُونَ',
    juzNumber: 2,
    topicColor: 'yellow',
    topicLabelAr: 'الأحكام والعبادات والمعاملات 💛',
    tafsir: 'فرض صيام شهر رمضان لتحقيق التقوى وتزكية النفس.',
  },
  {
    numberInSurah: 133,
    surahNumber: 3,
    surahName: 'آل عمران',
    text: 'وَسَارِعُوا إِلَىٰ مَغْفِرَةٍ مِّن رَّبِّكُمْ وَجَنَّةٍ عَرْضُهَا السَّمَاوَاتُ وَالْأَرْضُ أُعِدَّتْ لِلْمُتَّقِينَ',
    juzNumber: 4,
    topicColor: 'purple',
    topicLabelAr: 'الجنة والنعيم والترغيب 💜',
    tafsir: 'حث المؤمنين على المسارعة في الخيرات لنيل جنة النعيم المقيم.',
  },
  {
    numberInSurah: 10,
    surahNumber: 12,
    surahName: 'يوسف',
    text: 'قَالَ قَائِلٌ مِّنْهُمْ لَا تَقْتُلُوا يُوسُفَ وَأَلْقُوهُ فِي غَيَابَتِ الْجُبِّ يَلْتَقِطْهُ بَعْضُ السَّيَّارَةِ إِن كُنتُمْ فَاعِلِينَ',
    juzNumber: 12,
    topicColor: 'red',
    topicLabelAr: 'قصص الأنبياء والعبر 🧡',
    tafsir: 'بداية ابتلاء نبي الله يوسف عليه السلام وتدبير الله ولطفه به حتى التمكين.',
  },
];

export const DEFAULT_CHRISTIAN_PRAYERS: ChristianPrayer[] = [
  {
    id: 'pr_baker',
    title: 'صلاة باكر 🌅',
    hourName: 'الساعة الأولى من النهار',
    description: 'تُقام تذكاراً لقيامة الرب يسوع المسيح من بين الأموات والنور الحقيقي للعالم.',
    text: 'هلم نسجد ونركع للمسيح ملكنا وإلهنا. يا رب اسمع صلاتي، وانصت إلى طلبتي بحقك. استجب لي بعدلك، ولا تدخل في المحاكمة مع عبدك، فإنه لن يتزكى قدامك أي حي.',
  },
  {
    id: 'pr_ghoroub',
    title: 'صلاة الغروب (الساعة الحادية عشرة) 🌇',
    hourName: 'وقت غروب الشمس',
    description: 'تذكار إنزال جسد الرب يسوع من على الصليب وشكر على نعمة اليوم.',
    text: 'نشكرك يا ضابط الكل، لأنك جزت بنا هذا النهار بسلام وأتيت بنا إلى المساء شاكرين. أهلنا يا رب أن نرضيك في هذا المساء وكل أيام حياتنا.',
  },
  {
    id: 'pr_noom',
    title: 'صلاة النوم 🌙',
    hourName: 'الساعة الثانية عشرة',
    description: 'تذكار وضع جسد المخلص في القبر وطلب الحماية والسلام الروحي أثناء النوم.',
    text: 'أيها الرب إلهنا، الذي أعطانا النوم راحة لضعف جسدنا، نجنا من كل دنس واسترنا بظل جناحيك، واحفظنا في هذه الليلة بسلام وطهارة.',
  },
  {
    id: 'pr_nesf_leil',
    title: 'صلاة نصف الليل ⭐',
    hourName: 'السهر والاستعداد',
    description: 'تذكار المجئ الثاني للرب يسوع وسهر العذارى الحكيمات.',
    text: 'قوموا يا بني النور لنسبح رب القوات، لكي ينعم علينا بخلاص نفوسنا. هوذا العريس يأتي في نصف الليل، فطوبى للعبد الذي يجده مستيقظاً.',
  },
];

export const DEFAULT_CHRISTIAN_DAILY_READING: ChristianDailyReading = {
  date: new Date().toISOString().split('T')[0],
  saintOfDay: 'تذكار القديس مار مرقس الرسول كاروز الديار المصرية',
  thoughtOfDay: '«المَحَبَّةُ لاَ تَسْقُطُ أَبَداً» (1 كو 13: 8) - عش يومك بالمحبة والوداعة والسلام مع الجميع.',
  gospelReference: 'إنجيل متى 5: 1-12 (الموعظة على الجبل)',
  gospelText: '«طُوبَى لِلْمَسَاكِينِ بِالرُّوحِ، لأَنَّ لَهُمْ مَلَكُوتَ السَّمَاوَاتِ. طُوبَى لِلْحَزَانَى، لأَنَّهُمْ يُعَزَّوْنَ. طُوبَى لِلْوُدَعَاءِ، لأَنَّهُمْ يَرِثُونَ الأَرْضَ. طُوبَى لِلْجِيَاعِ وَالعِطَاشِ إِلَى البِرِّ، لأَنَّهُمْ يُشْبَعُونَ. طُوبَى لِلرُّحَمَاءِ، لأَنَّهُمْ يُرْحَمُونَ. طُوبَى لِلأَنْقِيَاءِ القَلْبِ، لأَنَّهُمْ يُعَايِنُونَ اللهَ. طُوبَى لِصَانِعِي السَّلاَمِ، لأَنَّهُمْ أَبْنَاءَ اللهِ يُدْعَوْنَ.»',
  epistleReference: 'رسالة بولس الرسول الأولى إلى أهل كورنثوس 13',
  epistleText: '«إِنْ كُنْتُ أَتَكَلَّمُ بِأَلْسِنَةِ النَّاسِ وَالمَلاَئِكَةِ وَلكِنْ لَيْسَ لِي مَحَبَّةٌ، فَقَدْ صِرْتُ نُحَاساً يَطِنُّ أَوْ صَنْجاً يَرِنُّ. المَحَبَّةُ تَتَأَنَّى وَتَرْفُقُ. المَحَبَّةُ لاَ تَحْسِدُ...»',
};

