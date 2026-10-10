import { Language } from '../types';

export interface Translations {
  appName: string;
  appArabicName: string;
  appSlogan: string;
  searchPlaceholder: string;
  voiceSearch: string;
  listening: string;
  speakNow: string;
  dashboard: string;
  notesAndAccounting: string;
  notes: string;
  calculator: string;
  expenses: string;
  vehicles: string;
  education: string;
  food: string;
  shoppingList: string;
  trips: string;
  hotChat: string;
  mediaCenter: string;
  pdfOcr: string;
  secureVault: string;
  religiousSection: string;
  aiCenter: string;
  notifications: string;
  backupAndSettings: string;
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  add: string;
  search: string;
  clear: string;
  export: string;
  import: string;
  history: string;
  favorites: string;
  archive: string;
  all: string;
  total: string;
  average: string;
  highest: string;
  count: string;
  currency: string;
  status: string;
  date: string;
  time: string;
  category: string;
  amount: string;
  actions: string;
  confirm: string;
  loading: string;
  offline: string;
  online: string;
  smartRecommendation: string;
  best: string;
  cheapest: string;
  fastest: string;
  requestRide: string;
  openInApp: string;
  currentLocation: string;
  from: string;
  to: string;
  lockVault: string;
  unlockVault: string;
  enterPin: string;
  generatePassword: string;
  quran: string;
  athkar: string;
  prayerTimes: string;
  bible: string;
  addExpense: string;
  addVehicle: string;
  addFuel: string;
  addMaintenance: string;
  addStudent: string;
  addNote: string;
  send: string;
  typeMessage: string;
  categories: Record<string, string>;
  paymentMethods: Record<string, string>;
}

export const translations: Record<Language, Translations> = {
  ar: {
    appName: 'SMART TIME',
    appArabicName: 'وقتـك من ذهب',
    appSlogan: 'Your Time. Your Gold. — وقتك أثمن ما تملك',
    searchPlaceholder: 'ابحث في كل شيء (ملاحظات، مصاريف، سيارات، وصفات، رحلات)...',
    voiceSearch: 'البحث الصوتي الذكي',
    listening: 'جارٍ الاستماع إليك...',
    speakNow: 'تحدث الآن (مثال: ابحث عن مصاريف الشهر الماضي)...',
    dashboard: 'الرئيسية',
    notesAndAccounting: 'الملاحظات والمحاسبة',
    notes: 'الملاحظات',
    calculator: 'الحاسبة الذكية',
    expenses: 'المصروفات والميزانية',
    vehicles: 'السيارات والوقود',
    education: 'التعليم والأبناء',
    food: 'الطعام والوصفات',
    shoppingList: 'قائمة المشتريات',
    trips: 'الرحلات والنقل الذكي',
    hotChat: 'المحادثات الفورية',
    mediaCenter: 'مركز الوسائط',
    pdfOcr: 'قارئ PDF واستخراج النصوص (OCR)',
    secureVault: 'الخزنة الرقمية الآمنة',
    religiousSection: 'القسم الديني',
    aiCenter: 'مركز الذكاء الاصطناعي',
    notifications: 'الإشعارات',
    backupAndSettings: 'النسخ الاحتياطي والإعدادات',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    add: 'إضافة',
    search: 'بحث',
    clear: 'مسح',
    export: 'تصدير البيانات',
    import: 'استيراد نسخة',
    history: 'السجل',
    favorites: 'المفضلة',
    archive: 'الأرشيف',
    all: 'الكل',
    total: 'الإجمالي',
    average: 'المتوسط',
    highest: 'الأعلى',
    count: 'العدد',
    currency: 'ج.م',
    status: 'الحالة',
    date: 'التاريخ',
    time: 'الوقت',
    category: 'التصنيف',
    amount: 'المبلغ',
    actions: 'الإجراءات',
    confirm: 'تأكيد',
    loading: 'جارٍ التحميل...',
    offline: 'وضع عدم الاتصال',
    online: 'متصل بالإنترنت',
    smartRecommendation: 'التوصيات الذكية',
    best: '🏆 الأفضل لك',
    cheapest: '💰 الأرخص',
    fastest: '⚡ الأسرع',
    requestRide: 'طلب رحلة ومقارنة الأسعار',
    openInApp: 'فتح في التطبيق',
    currentLocation: 'استخدم موقعي الحالي',
    from: 'نقطة الإقلاع (من)',
    to: 'نقطة الوصول (إلى)',
    lockVault: 'قفل الخزنة',
    unlockVault: 'فتح الخزنة',
    enterPin: 'أدخل الرقم السري للخزنة (Master PIN)',
    generatePassword: 'توليد كلمة سر قوية',
    quran: 'القرآن الكريم',
    athkar: 'أذكار المسلم',
    prayerTimes: 'مواقيت الصلاة',
    bible: 'الكتاب المقدس',
    addExpense: 'إضافة مصروف جديد',
    addVehicle: 'إضافة سيارة',
    addFuel: 'تسجيل وقود (بنزين)',
    addMaintenance: 'تسجيل صيانة',
    addStudent: 'إضافة طالب / ابن',
    addNote: 'ملاحظة جديدة',
    send: 'إرسال',
    typeMessage: 'اكتب رسالتك هنا...',
    categories: {
      food: 'طعام ومطاعم',
      vehicle: 'سيارات ووقود',
      education: 'تعليم ودراسة',
      bills: 'فواتير ومرافق',
      transport: 'مواصلات ونقل',
      health: 'صحة وأدوية',
      shopping: 'تسوق وملابس',
      entertainment: 'ترفيه وخروج',
      other: 'أخرى',
    },
    paymentMethods: {
      cash: 'نقدي (كاش)',
      card: 'بطاقة بنكية',
      wallet: 'محفظة إلكترونية',
    },
  },
  en: {
    appName: 'SMART TIME',
    appArabicName: 'Your Time Is Gold',
    appSlogan: 'Your Time. Your Gold.',
    searchPlaceholder: 'Search everything (Notes, Expenses, Cars, Food, Trips)...',
    voiceSearch: 'Global Smart Voice Search',
    listening: 'Listening...',
    speakNow: 'Speak now (e.g., "Show car expenses last month")...',
    dashboard: 'Dashboard',
    notesAndAccounting: 'Notes & Accounting',
    notes: 'Notes',
    calculator: 'Smart Calculator',
    expenses: 'Expenses & Budget',
    vehicles: 'Vehicles & Fuel',
    education: 'Education & Family',
    food: 'Food & Recipes',
    shoppingList: 'Shopping List',
    trips: 'Trips & Mobility',
    hotChat: 'Hot Chat',
    mediaCenter: 'Media Center',
    pdfOcr: 'PDF Reader & OCR',
    secureVault: 'Secure Digital Vault',
    religiousSection: 'Faith & Spiritual',
    aiCenter: 'AI Center',
    notifications: 'Notifications',
    backupAndSettings: 'Backup & Settings',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    clear: 'Clear',
    export: 'Export Data',
    import: 'Import Backup',
    history: 'History',
    favorites: 'Favorites',
    archive: 'Archive',
    all: 'All',
    total: 'Total',
    average: 'Average',
    highest: 'Highest',
    count: 'Count',
    currency: '$',
    status: 'Status',
    date: 'Date',
    time: 'Time',
    category: 'Category',
    amount: 'Amount',
    actions: 'Actions',
    confirm: 'Confirm',
    loading: 'Loading...',
    offline: 'Offline Mode',
    online: 'Online',
    smartRecommendation: 'Smart Recommendations',
    best: '🏆 Best Value',
    cheapest: '💰 Cheapest',
    fastest: '⚡ Fastest',
    requestRide: 'Compare Rides & Fares',
    openInApp: 'Open in Provider App',
    currentLocation: 'Use Current Location',
    from: 'Pickup Location (From)',
    to: 'Destination (To)',
    lockVault: 'Lock Vault',
    unlockVault: 'Unlock Vault',
    enterPin: 'Enter Master PIN',
    generatePassword: 'Generate Strong Password',
    quran: 'Holy Quran',
    athkar: 'Athkar & Supplications',
    prayerTimes: 'Prayer Times',
    bible: 'Holy Bible',
    addExpense: 'Add New Expense',
    addVehicle: 'Add Vehicle',
    addFuel: 'Log Fuel Record',
    addMaintenance: 'Log Maintenance',
    addStudent: 'Add Student / Child',
    addNote: 'New Note',
    send: 'Send',
    typeMessage: 'Type your message...',
    categories: {
      food: 'Food & Dining',
      vehicle: 'Vehicle & Fuel',
      education: 'Education & Tuitions',
      bills: 'Bills & Utilities',
      transport: 'Transport',
      health: 'Health & Pharmacy',
      shopping: 'Shopping',
      entertainment: 'Entertainment',
      other: 'Other',
    },
    paymentMethods: {
      cash: 'Cash',
      card: 'Bank Card',
      wallet: 'Digital Wallet',
    },
  },
  fr: {
    appName: 'SMART TIME',
    appArabicName: 'Votre Temps est d\'Or',
    appSlogan: 'Your Time. Your Gold.',
    searchPlaceholder: 'Rechercher partout...',
    voiceSearch: 'Recherche vocale',
    listening: 'Écoute en cours...',
    speakNow: 'Parlez maintenant...',
    dashboard: 'Tableau de bord',
    notesAndAccounting: 'Notes et Comptabilité',
    notes: 'Notes',
    calculator: 'Calculatrice',
    expenses: 'Dépenses',
    vehicles: 'Véhicules',
    education: 'Éducation',
    food: 'Nourriture & Recettes',
    shoppingList: 'Liste de courses',
    trips: 'Trajets',
    hotChat: 'Discussion',
    mediaCenter: 'Médias',
    pdfOcr: 'PDF & OCR',
    secureVault: 'Coffre-fort',
    religiousSection: 'Section spirituelle',
    aiCenter: 'Centre IA',
    notifications: 'Notifications',
    backupAndSettings: 'Paramètres',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    add: 'Ajouter',
    search: 'Recherche',
    clear: 'Effacer',
    export: 'Exporter',
    import: 'Importer',
    history: 'Historique',
    favorites: 'Favoris',
    archive: 'Archiver',
    all: 'Tout',
    total: 'Total',
    average: 'Moyenne',
    highest: 'Le plus élevé',
    count: 'Nombre',
    currency: '€',
    status: 'Statut',
    date: 'Date',
    time: 'Heure',
    category: 'Catégorie',
    amount: 'Montant',
    actions: 'Actions',
    confirm: 'Confirmer',
    loading: 'Chargement...',
    offline: 'Hors ligne',
    online: 'En ligne',
    smartRecommendation: 'Recommandation',
    best: '🏆 Meilleur',
    cheapest: '💰 Moins cher',
    fastest: '⚡ Plus rapide',
    requestRide: 'Commander',
    openInApp: 'Ouvrir',
    currentLocation: 'Position actuelle',
    from: 'Départ',
    to: 'Arrivée',
    lockVault: 'Verrouiller',
    unlockVault: 'Déverrouiller',
    enterPin: 'Code PIN',
    generatePassword: 'Générer mot de passe',
    quran: 'Saint Coran',
    athkar: 'Invocations',
    prayerTimes: 'Heures de prière',
    bible: 'Sainte Bible',
    addExpense: 'Ajouter dépense',
    addVehicle: 'Ajouter véhicule',
    addFuel: 'Carburant',
    addMaintenance: 'Maintenance',
    addStudent: 'Ajouter élève',
    addNote: 'Nouvelle note',
    send: 'Envoyer',
    typeMessage: 'Votre message...',
    categories: {
      food: 'Nourriture',
      vehicle: 'Véhicule',
      education: 'Éducation',
      bills: 'Factures',
      transport: 'Transport',
      health: 'Santé',
      shopping: 'Shopping',
      entertainment: 'Divertissement',
      other: 'Autre',
    },
    paymentMethods: {
      cash: 'Espèces',
      card: 'Carte bancaire',
      wallet: 'Portefeuille numérique',
    },
  },
};
