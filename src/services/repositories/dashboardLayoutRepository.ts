import { StorageAdapter } from '../storageAdapter';

export interface DashboardModuleItem {
  id: string;
  nameAr: string;
  nameEn: string;
  category: 'primary' | 'secondary' | 'featured';
  visible: boolean;
  order: number;
  iconName: string;
  color: string;
  descriptionAr: string;
  descriptionEn: string;
}

export interface DashboardLayoutSettings {
  columns: 2 | 3 | 4;
  showHeroBanner: boolean;
  showHeroSearch: boolean;
  showDateClock: boolean;
  showSummaryStats: boolean;
  modules: DashboardModuleItem[];
}

export const DEFAULT_DASHBOARD_MODULES: DashboardModuleItem[] = [
  {
    id: 'chat',
    nameAr: 'المحادثات الفورية',
    nameEn: 'Hot Chat',
    category: 'primary',
    visible: true,
    order: 0,
    iconName: 'MessageSquare',
    color: 'indigo',
    descriptionAr: 'محادثات فورية، غرف عائلية، ملفات، صور وردود سريعة.',
    descriptionEn: 'Real-time messaging, group channels, voice notes & files.',
  },
  {
    id: 'media',
    nameAr: 'مركز الوسائط و PDF/OCR',
    nameEn: 'Media Center',
    category: 'primary',
    visible: true,
    order: 1,
    iconName: 'Image',
    color: 'purple',
    descriptionAr: 'معرض الوسائط، فواتير ورخص، وقارئ PDF واستخراج النصوص.',
    descriptionEn: 'Photo & video gallery, document vault, PDF reader & OCR.',
  },
  {
    id: 'religious',
    nameAr: 'القسم الديني والقرآن',
    nameEn: 'Religious Section',
    category: 'primary',
    visible: true,
    order: 2,
    iconName: 'BookOpen',
    color: 'emerald',
    descriptionAr: 'القرآن الكريم، الأذكار اليومية، مواقيت الصلاة واتجاه القبلة.',
    descriptionEn: 'Holy scriptures, daily prayers, athkar and devotionals.',
  },
  {
    id: 'notes',
    nameAr: 'الملاحظات والمحاسبة والحاسبة',
    nameEn: 'Notes & Calculator',
    category: 'primary',
    visible: true,
    order: 3,
    iconName: 'FileText',
    color: 'amber',
    descriptionAr: 'محرر ملاحظات متطور + الحاسبة العلمية والهندسية وسجل العمليات.',
    descriptionEn: 'Advanced rich notes + scientific calculator & history.',
  },
  {
    id: 'expenses',
    nameAr: 'المصروفات والميزانية',
    nameEn: 'Expenses & Budget',
    category: 'primary',
    visible: true,
    order: 4,
    iconName: 'Wallet',
    color: 'rose',
    descriptionAr: 'تسجيل المصاريف، التقارير اليومية والشهرية، الرسوم البيانية والإيصالات.',
    descriptionEn: 'Daily expense logging, category breakdown & monthly analytics.',
  },
  {
    id: 'vault',
    nameAr: 'الخزنة الرقمية المشفرة',
    nameEn: 'Secure Vault',
    category: 'primary',
    visible: true,
    order: 5,
    iconName: 'ShieldCheck',
    color: 'teal',
    descriptionAr: 'خزنة رقمية مشفرة لكلمات السر، أرقام الحسابات، الأكواد والملاحظات السرية.',
    descriptionEn: 'Encrypted safe for passwords, bank codes, secret notes & PINs.',
  },
  {
    id: 'ai',
    nameAr: 'مركز الذكاء الاصطناعي',
    nameEn: 'AI Center',
    category: 'primary',
    visible: true,
    order: 6,
    iconName: 'Bot',
    color: 'blue',
    descriptionAr: 'محدد أدوات AI المتعدد، إجابة الاستفسارات، كتابة النصوص والتحليل الذكي.',
    descriptionEn: 'Multi-model AI suite: Gemini, ChatGPT, Claude with tool selector.',
  },
  {
    id: 'food',
    nameAr: 'المطبخ وقائمة المشتريات',
    nameEn: 'Food & Shopping',
    category: 'primary',
    visible: true,
    order: 7,
    iconName: 'UtensilsCrossed',
    color: 'orange',
    descriptionAr: 'أنظمة كيتو، الطيبات، وصفات عائلية، وقائمة مشتريات ذكية مدمجة.',
    descriptionEn: 'Diets (Keto, Tayyibat, Sports), meal macros & sync to shopping list.',
  },
  {
    id: 'trips',
    nameAr: 'الرحلات ومقارنة النقل الذكي',
    nameEn: 'Smart Trips',
    category: 'featured',
    visible: true,
    order: 8,
    iconName: 'Navigation',
    color: 'amber',
    descriptionAr: 'مقارنة أسعار أوبر وكريم وإندرايف، التوصية الذكية، والمحطات السريعة.',
    descriptionEn: 'Compare live fares across Uber, Careem, inDrive & DiDi.',
  },
];

export const DEFAULT_DASHBOARD_SETTINGS: DashboardLayoutSettings = {
  columns: 4,
  showHeroBanner: true,
  showHeroSearch: true,
  showDateClock: true,
  showSummaryStats: true,
  modules: DEFAULT_DASHBOARD_MODULES,
};

const STORAGE_KEY = 'smart_time_dashboard_layout_settings_v1';

export class DashboardLayoutRepository {
  static getSettings(): DashboardLayoutSettings {
    const raw = StorageAdapter.getItem(STORAGE_KEY, DEFAULT_DASHBOARD_SETTINGS);
    if (!raw || !raw.modules) {
      return DEFAULT_DASHBOARD_SETTINGS;
    }

    // Ensure all default modules exist in saved settings (merge gracefully)
    const existingIds = new Set(raw.modules.map((m: DashboardModuleItem) => m.id));
    const missing = DEFAULT_DASHBOARD_MODULES.filter((d) => !existingIds.has(d.id));

    const combinedModules = [...raw.modules, ...missing].sort(
      (a: DashboardModuleItem, b: DashboardModuleItem) => a.order - b.order
    );

    return {
      ...DEFAULT_DASHBOARD_SETTINGS,
      ...raw,
      modules: combinedModules,
    };
  }

  static saveSettings(settings: DashboardLayoutSettings): void {
    StorageAdapter.setItem(STORAGE_KEY, settings);
  }

  static toggleModuleVisibility(moduleId: string): DashboardLayoutSettings {
    const current = this.getSettings();
    const updated = current.modules.map((m) =>
      m.id === moduleId ? { ...m, visible: !m.visible } : m
    );
    const newSettings = { ...current, modules: updated };
    this.saveSettings(newSettings);
    return newSettings;
  }

  static moveModule(moduleId: string, direction: 'up' | 'down'): DashboardLayoutSettings {
    const current = this.getSettings();
    const modules = [...current.modules];
    const index = modules.findIndex((m) => m.id === moduleId);

    if (index === -1) return current;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return current;

    // Swap positions
    const temp = modules[index];
    modules[index] = modules[targetIndex];
    modules[targetIndex] = temp;

    // Reassign order numbers
    modules.forEach((mod, idx) => {
      mod.order = idx;
    });

    const newSettings = { ...current, modules };
    this.saveSettings(newSettings);
    return newSettings;
  }

  static resetToDefault(): DashboardLayoutSettings {
    this.saveSettings(DEFAULT_DASHBOARD_SETTINGS);
    return DEFAULT_DASHBOARD_SETTINGS;
  }
}
