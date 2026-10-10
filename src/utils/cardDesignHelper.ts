import {
  CardPreferences,
  CardStyleType,
  CardRadius,
  CardShadow,
  CardBlur,
  CardAnimation,
  CardDensity,
  CardIconSize,
  CardBackgroundTheme,
  CardPresetId,
} from '../types';

export interface CardStyleMeta {
  id: CardStyleType;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  emoji: string;
  previewBgLight: string;
  previewBgDark: string;
  previewBorder: string;
}

export const CARD_STYLES_LIST: CardStyleMeta[] = [
  {
    id: 'floating',
    nameAr: 'ثلاثي الأبعاد العائم',
    nameEn: '3D Floating',
    descriptionAr: 'واجهة تفاعلية عميقة مع انعكاس ضوئي وتأثير إمالة واقعي',
    descriptionEn: 'Tactile 3D depth with specular glare and interactive tilt',
    emoji: '🛸',
    previewBgLight: 'bg-white shadow-lg shadow-slate-900/10 border-slate-200',
    previewBgDark: 'dark:bg-slate-900 dark:shadow-black/50 dark:border-slate-800',
    previewBorder: 'border',
  },
  {
    id: 'glass',
    nameAr: 'الزجاجي الكريستالي',
    nameEn: 'Crystal Glass',
    descriptionAr: 'تصميم زجاجي شفاف ومضبب (Glassmorphism) بلمعان أنيق',
    descriptionEn: 'Frosted glass translucency with refined backdrop blur',
    emoji: '🪟',
    previewBgLight: 'bg-white/70 backdrop-blur-md border-white/60 shadow-sm',
    previewBgDark: 'dark:bg-slate-900/60 dark:backdrop-blur-md dark:border-white/10',
    previewBorder: 'border',
  },
  {
    id: 'soft',
    nameAr: 'الناعم المنحني',
    nameEn: 'Soft Curved',
    descriptionAr: 'زوايا ناعمة وتدرج مريح للعين مع ظلال خفيفة ومريحة',
    descriptionEn: 'Gentle curves with relaxing colors and soft ambient shadows',
    emoji: '☁️',
    previewBgLight: 'bg-slate-50/90 border-slate-200/60 shadow-xs',
    previewBgDark: 'dark:bg-slate-850 dark:border-slate-800/80',
    previewBorder: 'border',
  },
  {
    id: 'gradient',
    nameAr: 'تدرج لوني حيوي',
    nameEn: 'Vibrant Gradient',
    descriptionAr: 'ألوان متدرجة حديثة ومفعمة بالحيوية والحركة',
    descriptionEn: 'Dynamic modern color gradients with high-energy vibrancy',
    emoji: '🎨',
    previewBgLight: 'bg-gradient-to-br from-white via-slate-50 to-amber-500/10 border-amber-500/30 shadow-md',
    previewBgDark: 'dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-850 dark:to-amber-950/30 dark:border-amber-500/20',
    previewBorder: 'border',
  },
  {
    id: 'neon',
    nameAr: 'النيون المتوهج',
    nameEn: 'Cyber Neon',
    descriptionAr: 'إشعاع نيون ملون على الحواف يعطي طابعاً مستقبلياً جذاباً',
    descriptionEn: 'Luminous edge glow with high-contrast futuristic aesthetics',
    emoji: '⚡',
    previewBgLight: 'bg-slate-900 text-white border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.35)]',
    previewBgDark: 'dark:bg-slate-950 dark:border-cyan-400 dark:shadow-[0_0_18px_rgba(6,182,212,0.4)]',
    previewBorder: 'border',
  },
  {
    id: 'dashboard',
    nameAr: 'لوحة تحكم ذكية',
    nameEn: 'Pro Dashboard',
    descriptionAr: 'بطاقة عملية غنية بالمؤشرات والحالة والبيانات الحية',
    descriptionEn: 'Information-dense cards with rich indicators and live metrics',
    emoji: '📊',
    previewBgLight: 'bg-white border-slate-300 shadow-sm',
    previewBgDark: 'dark:bg-slate-900 dark:border-slate-700',
    previewBorder: 'border-2',
  },
  {
    id: 'classic',
    nameAr: 'كلاسيكي عملي',
    nameEn: 'Classic Clean',
    descriptionAr: 'تصميم متوازن وواضح مستوحى من واجهات جوجل وتطبيقات النظام',
    descriptionEn: 'Balanced, clear structure inspired by native Material Design',
    emoji: '📱',
    previewBgLight: 'bg-white border-slate-200 shadow-xs',
    previewBgDark: 'dark:bg-slate-900 dark:border-slate-800',
    previewBorder: 'border',
  },
  {
    id: 'minimal',
    nameAr: 'مينيمال فائق البساطة',
    nameEn: 'Ultra Minimal',
    descriptionAr: 'خطوط دقيقة ونظيفة بدون ظلال زائدة لتركيز كامل على المحتوى',
    descriptionEn: 'Zero distractions, crisp borders, and distraction-free layout',
    emoji: '⚪',
    previewBgLight: 'bg-transparent border-slate-300/80 shadow-none',
    previewBgDark: 'dark:bg-transparent dark:border-slate-800 dark:shadow-none',
    previewBorder: 'border',
  },
  {
    id: 'outline',
    nameAr: 'حدود بارزة ومفرغة',
    nameEn: 'Bold Outline',
    descriptionAr: 'إطار عريض وواضح بلون مميز يعطي استقلالية بصرية قوية',
    descriptionEn: 'Pronounced accented stroke with semi-translucent interior',
    emoji: '🔲',
    previewBgLight: 'bg-white/50 border-slate-900/40 shadow-xs',
    previewBgDark: 'dark:bg-slate-900/40 dark:border-slate-600',
    previewBorder: 'border-2',
  },
  {
    id: 'compact',
    nameAr: 'مضغوط عالي الكثافة',
    nameEn: 'Compact Density',
    descriptionAr: 'مساحات محسوبة لعرض أكبر عدد من الأقسام في شاشة واحدة',
    descriptionEn: 'Tight micro-spacing optimized to view maximum modules on screen',
    emoji: '📐',
    previewBgLight: 'bg-white border-slate-200 shadow-2xs',
    previewBgDark: 'dark:bg-slate-900 dark:border-slate-800',
    previewBorder: 'border',
  },
];

export interface CardPresetMeta {
  id: CardPresetId;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  emoji: string;
  preferences: CardPreferences;
}

export const CARD_PRESETS: CardPresetMeta[] = [
  {
    id: 'dashboard',
    nameAr: 'لوحة التحكم الذكية',
    nameEn: 'Pro Dashboard',
    descriptionAr: 'عائم ثلاثي الأبعاد مع مؤشرات حية وانعكاس واقعي',
    descriptionEn: '3D floating depth with live indicators and specular glare',
    emoji: '📊',
    preferences: {
      style: 'floating',
      radius: 'xl',
      shadow: 'medium',
      opacity: 100,
      blur: 'low',
      animation: 'normal',
      density: 'normal',
      showBadges: true,
      showGlow: true,
      tilt3D: true,
      iconSize: 'medium',
      backgroundTheme: 'default',
      activePreset: 'dashboard',
    },
  },
  {
    id: 'glass',
    nameAr: 'الزجاج الكريستالي',
    nameEn: 'Crystal Glass',
    descriptionAr: 'زجاجي شفاف مضبب مع ضوء محيطي خفيف',
    descriptionEn: 'High glassmorphism blur with ambient light refraction',
    emoji: '🪟',
    preferences: {
      style: 'glass',
      radius: 'xl',
      shadow: 'subtle',
      opacity: 80,
      blur: 'high',
      animation: 'normal',
      density: 'normal',
      showBadges: true,
      showGlow: true,
      tilt3D: true,
      iconSize: 'medium',
      backgroundTheme: 'default',
      activePreset: 'glass',
    },
  },
  {
    id: 'elegant',
    nameAr: 'الأنيق الهادئ',
    nameEn: 'Elegant Soft',
    descriptionAr: 'منحنيات ناعمة وألوان هادئة للعين ومريحة للاستخدام المطول',
    descriptionEn: 'Soft curves with soothing tones for extended eye comfort',
    emoji: '🌸',
    preferences: {
      style: 'soft',
      radius: 'full',
      shadow: 'subtle',
      opacity: 95,
      blur: 'low',
      animation: 'subtle',
      density: 'spacious',
      showBadges: true,
      showGlow: false,
      tilt3D: false,
      iconSize: 'large',
      backgroundTheme: 'default',
      activePreset: 'elegant',
    },
  },
  {
    id: 'darkPremium',
    nameAr: 'بريميوم داكن فخم',
    nameEn: 'Dark Luxury',
    descriptionAr: 'ظلال عميقة ولمسات فخمة تبرز في الوضع الليلي',
    descriptionEn: 'Deep contrast shadows and premium metallic highlights',
    emoji: '👑',
    preferences: {
      style: 'floating',
      radius: 'lg',
      shadow: 'deep',
      opacity: 100,
      blur: 'medium',
      animation: 'dynamic',
      density: 'normal',
      showBadges: true,
      showGlow: true,
      tilt3D: true,
      iconSize: 'medium',
      backgroundTheme: 'default',
      activePreset: 'darkPremium',
    },
  },
  {
    id: 'colorful',
    nameAr: 'الحيوي الملون',
    nameEn: 'Vibrant Pop',
    descriptionAr: 'تدرجات لونية نشيطة وجريئة وتفاعلات حركية ممتعة',
    descriptionEn: 'Energetic gradients with dynamic bouncy micro-interactions',
    emoji: '🌈',
    preferences: {
      style: 'gradient',
      radius: 'xl',
      shadow: 'medium',
      opacity: 100,
      blur: 'low',
      animation: 'dynamic',
      density: 'normal',
      showBadges: true,
      showGlow: true,
      tilt3D: true,
      iconSize: 'medium',
      backgroundTheme: 'default',
      activePreset: 'colorful',
    },
  },
  {
    id: 'neon',
    nameAr: 'النيون المستقبلي',
    nameEn: 'Cyber Neon',
    descriptionAr: 'توهج نيون مستقبلي على الحواف والأيقونات',
    descriptionEn: 'Vibrant cyberpunk neon glow with glowing borders',
    emoji: '⚡',
    preferences: {
      style: 'neon',
      radius: 'lg',
      shadow: 'glow',
      opacity: 90,
      blur: 'medium',
      animation: 'dynamic',
      density: 'normal',
      showBadges: true,
      showGlow: true,
      tilt3D: true,
      iconSize: 'medium',
      backgroundTheme: 'default',
      activePreset: 'neon',
    },
  },
  {
    id: 'minimal',
    nameAr: 'مينيمال عصري',
    nameEn: 'Modern Minimal',
    descriptionAr: 'تصميم مسطح خفيف بدون أي عناصر تشتيت',
    descriptionEn: 'Ultra-flat clean design focusing solely on raw content',
    emoji: '✨',
    preferences: {
      style: 'minimal',
      radius: 'md',
      shadow: 'none',
      opacity: 100,
      blur: 'none',
      animation: 'off',
      density: 'compact',
      showBadges: false,
      showGlow: false,
      tilt3D: false,
      iconSize: 'small',
      backgroundTheme: 'default',
      activePreset: 'minimal',
    },
  },
];

export const DEFAULT_CARD_PREFERENCES: CardPreferences = {
  style: 'floating',
  radius: 'xl',
  shadow: 'medium',
  opacity: 100,
  blur: 'low',
  animation: 'normal',
  density: 'normal',
  showBadges: true,
  showGlow: true,
  tilt3D: true,
  iconSize: 'medium',
  backgroundTheme: 'default',
  activePreset: 'dashboard',
  hiddenCardIds: [],
  cardSizes: {},
};

export const STORAGE_CARD_PREFERENCES_KEY = 'smart_time_card_preferences_v1';

// Radius helper
export function getCardRadiusClass(radius: CardRadius): string {
  switch (radius) {
    case 'none':
      return 'rounded-none';
    case 'sm':
      return 'rounded-lg';
    case 'md':
      return 'rounded-xl';
    case 'lg':
      return 'rounded-2xl';
    case 'xl':
      return 'rounded-3xl';
    case 'full':
      return 'rounded-[28px]';
    default:
      return 'rounded-3xl';
  }
}

// Shadow helper
export function getCardShadowClass(shadow: CardShadow): string {
  switch (shadow) {
    case 'none':
      return 'shadow-none';
    case 'subtle':
      return 'shadow-xs hover:shadow-sm';
    case 'medium':
      return 'shadow-md hover:shadow-lg';
    case 'deep':
      return 'shadow-xl hover:shadow-2xl';
    case 'glow':
      return 'shadow-[0_0_20px_rgba(32,184,214,0.3)] hover:shadow-[0_0_25px_rgba(32,184,214,0.5)]';
    default:
      return 'shadow-md';
  }
}

// Blur helper
export function getCardBlurClass(blur: CardBlur): string {
  switch (blur) {
    case 'none':
      return '';
    case 'low':
      return 'backdrop-blur-xs';
    case 'medium':
      return 'backdrop-blur-md';
    case 'high':
      return 'backdrop-blur-xl';
    default:
      return '';
  }
}

// Density helper
export function getCardDensityClasses(density: CardDensity): {
  padding: string;
  iconSize: string;
  titleSize: string;
  badgeSize: string;
} {
  switch (density) {
    case 'compact':
      return {
        padding: 'p-2 sm:p-2.5',
        iconSize: 'w-8 h-8 sm:w-9 sm:h-9',
        titleSize: 'text-xs',
        badgeSize: 'text-[9px] px-1 py-0.2',
      };
    case 'spacious':
      return {
        padding: 'p-4 sm:p-5',
        iconSize: 'w-13 h-13 sm:w-15 sm:h-15',
        titleSize: 'text-sm sm:text-base font-black',
        badgeSize: 'text-[11px] px-2.5 py-0.5',
      };
    case 'normal':
    default:
      return {
        padding: 'p-3 sm:p-3.5',
        iconSize: 'w-11 h-11 sm:w-13 sm:h-13',
        titleSize: 'text-xs sm:text-sm font-black',
        badgeSize: 'text-[10px] px-2 py-0.5',
      };
  }
}


export function getCardIconSizeClass(size?: CardIconSize): string {
  switch (size) {
    case 'small':
      return 'w-8 h-8 sm:w-9 sm:h-9';
    case 'large':
      return 'w-12 h-12 sm:w-14 sm:h-14';
    case 'medium':
    default:
      return 'w-10 h-10 sm:w-12 sm:h-12';
  }
}

export function getCardBackgroundClass(theme?: CardBackgroundTheme): string {
  switch (theme) {
    case 'sky':
      return 'card-bg-sky';
    case 'mint':
      return 'card-bg-mint';
    case 'lavender':
      return 'card-bg-lavender';
    case 'peach':
      return 'card-bg-peach';
    case 'candy':
      return 'card-bg-candy';
    case 'default':
    default:
      return '';
  }
}

// Main Card Styling Resolver
export function resolveCardContainerClasses(
  preferences: CardPreferences,
  tone: string = 'chat',
  isReorderMode: boolean = false
): string {
  const radius = getCardRadiusClass(preferences.radius);
  const shadow = getCardShadowClass(preferences.shadow);
  const blur = getCardBlurClass(preferences.blur);
  const backgroundClass = getCardBackgroundClass(preferences.backgroundTheme);

  let styleClasses = '';

  switch (preferences.style) {
    case 'glass':
      styleClasses = `bg-white/80 dark:bg-slate-900/75 border border-white/60 dark:border-slate-700/60 ${blur}`;
      break;
    case 'soft':
      styleClasses = 'bg-slate-50/95 dark:bg-slate-850/95 border border-slate-200/80 dark:border-slate-800';
      break;
    case 'gradient':
      styleClasses = `dashboard-section-card dashboard-section-${tone} bg-gradient-to-br from-white via-white to-slate-100/90 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border border-slate-200 dark:border-slate-800`;
      break;
    case 'neon':
      styleClasses = `bg-slate-900/95 text-white border-2 border-cyan-400 dark:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_22px_rgba(6,182,212,0.5)]`;
      break;
    case 'minimal':
      styleClasses = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800';
      break;
    case 'outline':
      styleClasses = `bg-white/90 dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-700 hover:border-accent-500`;
      break;
    case 'compact':
      styleClasses = 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800';
      break;
    case 'dashboard':
      styleClasses = `dashboard-section-card dashboard-section-${tone} border border-slate-200 dark:border-slate-800`;
      break;
    case 'classic':
      styleClasses = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800';
      break;
    case 'floating':
    default:
      styleClasses = `dashboard-section-card dashboard-section-${tone}`;
      break;
  }

  const reorderRing = isReorderMode
    ? 'ring-2 ring-amber-400 dark:ring-amber-500 scale-[0.98] shadow-lg'
    : '';

  return `${radius} ${shadow} ${styleClasses} ${backgroundClass} ${reorderRing} transition-all duration-200 relative overflow-hidden select-none`;
}
