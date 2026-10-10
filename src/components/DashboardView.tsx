import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Expense, Note, Vehicle, ChatRoom, AppView } from '../types';
import {
  MessageSquare,
  DollarSign,
  Navigation,
  Trophy,
  FileText,
  Shield,
  Sparkles,
  Moon,
  Star,
  GripVertical,
  Car,
  GraduationCap,
  Film,
  Wallet,
  ArrowUpRight,
  SlidersHorizontal,
  LayoutGrid,
  Layers,
  Flame,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Check,
  Move,
  Palette,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Settings,
} from 'lucide-react';
import { useCardPreferences } from '../context/CardSettingsContext';
import {
  resolveCardContainerClasses,
  getCardDensityClasses,
  getCardIconSizeClass,
} from '../utils/cardDesignHelper';
import { CardCustomizerModal } from './CardCustomizerModal';
import { STORAGE_KEYS } from '../services/storageKeys';
import { StorageAdapter } from '../services/storageAdapter';
import { Organic3DDashboard } from './Organic3DDashboard';
import { DashboardSkeletonLoader } from './DashboardSkeletonLoader';

interface DashboardViewProps {
  user: UserProfile;
  expenses: Expense[];
  notes: Note[];
  vehicles: Vehicle[];
  chatRooms: ChatRoom[];
  onNavigate: (tab: AppView, subView?: string) => void;
  onOpenSearch: () => void;
  onOpenVoiceSearch: () => void;
  isLoading?: boolean;
}


interface SectionCard {
  id: AppView;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  icon: React.ComponentType<{ className?: string }>;
  isFavorite?: boolean;
  emoji: string;
  tone: string;
  gradient: string;
  darkGradient: string;
}

const ALL_SECTIONS: SectionCard[] = [
  {
    id: 'expenses',
    titleAr: 'المصاريف والدخل',
    titleEn: 'Expenses & Income',
    subtitleAr: 'الميزانية، الدخل الحر، ودخل مشاوير السيارة',
    subtitleEn: 'Budget, income & car trip earnings',
    icon: DollarSign,
    emoji: '💰',
    tone: 'expenses',
    gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    darkGradient: 'from-emerald-950/40 via-teal-950/20 to-slate-900',
  },
  {
    id: 'notes',
    titleAr: 'الملاحظات والحسابات',
    titleEn: 'Notes & Accounting',
    subtitleAr: 'المفكرة الذكية، الحاسبة، ومهام اليوم',
    subtitleEn: 'Smart notebook, calculator & tasks',
    icon: FileText,
    emoji: '📝',
    tone: 'notes',
    gradient: 'from-teal-500/20 via-cyan-500/10 to-transparent',
    darkGradient: 'from-teal-950/40 via-cyan-950/20 to-slate-900',
  },
  {
    id: 'chat',
    titleAr: 'المحادثات المباشرة',
    titleEn: 'Live Chat',
    subtitleAr: 'غرف التواصل والمراسلة الفورية',
    subtitleEn: 'Instant rooms & messaging',
    icon: MessageSquare,
    emoji: '💬',
    tone: 'chat',
    gradient: 'from-cyan-500/20 via-sky-500/10 to-transparent',
    darkGradient: 'from-cyan-950/40 via-sky-950/20 to-slate-900',
  },
  {
    id: 'trips',
    titleAr: 'الرحلات والملاحة',
    titleEn: 'Trips & Maps',
    subtitleAr: 'الأماكن المفضلة، المسارات والمواقع',
    subtitleEn: 'Saved spots, navigation & routes',
    icon: Navigation,
    emoji: '🧭',
    tone: 'trips',
    gradient: 'from-sky-500/20 via-blue-500/10 to-transparent',
    darkGradient: 'from-sky-950/40 via-blue-950/20 to-slate-900',
  },

  {
    id: 'ai',
    titleAr: 'الذكاء الاصطناعي',
    titleEn: 'AI Assistant',
    subtitleAr: 'مساعد SMART TIME الفوري الذكي',
    subtitleEn: 'Smart generative assistant & tools',
    icon: Sparkles,
    emoji: '✨',
    tone: 'ai',
    gradient: 'from-fuchsia-500/20 via-purple-500/10 to-transparent',
    darkGradient: 'from-fuchsia-950/40 via-purple-950/20 to-slate-900',
  },
  {
    id: 'religious',
    titleAr: 'القسم الديني',
    titleEn: 'Religious Hub',
    subtitleAr: 'الأذكار اليومية، التسبيح والقرآن الكريم',
    subtitleEn: 'Daily Athkar, tasbeeh & Quran',
    icon: Moon,
    emoji: '🌙',
    tone: 'religious',
    gradient: 'from-blue-500/20 via-indigo-500/10 to-transparent',
    darkGradient: 'from-blue-950/40 via-indigo-950/20 to-slate-900',
  },
  {
    id: 'sports',
    titleAr: 'القسم الرياضي',
    titleEn: 'Sports & Fitness',
    subtitleAr: 'التمارين، اللياقة البدنية والأنشطة',
    subtitleEn: 'Workouts, daily fitness & activities',
    icon: Trophy,
    emoji: '🏆',
    tone: 'sports',
    gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
    darkGradient: 'from-amber-950/40 via-orange-950/20 to-slate-900',
  },
  {
    id: 'vault',
    titleAr: 'الخزانة الخاصة',
    titleEn: 'Secure Vault',
    subtitleAr: 'تشفير وحماية البيانات الحساسة برقم سري',
    subtitleEn: 'Encrypted passwords & private records',
    icon: Shield,
    emoji: '🔐',
    tone: 'vault',
    gradient: 'from-slate-500/20 via-zinc-500/10 to-transparent',
    darkGradient: 'from-slate-800/50 via-zinc-900/30 to-slate-900',
  },
  {
    id: 'vehicles',
    titleAr: 'المركبات والصيانة',
    titleEn: 'Vehicles',
    subtitleAr: 'سجل استهلاك الوقود ومواعيد الصيانة',
    subtitleEn: 'Fuel consumption & maintenance logs',
    icon: Car,
    emoji: '🚗',
    tone: 'vehicles',
    gradient: 'from-indigo-500/20 via-blue-500/10 to-transparent',
    darkGradient: 'from-indigo-950/40 via-blue-950/20 to-slate-900',
  },
  {
    id: 'education',
    titleAr: 'القسم التعليمي',
    titleEn: 'Education',
    subtitleAr: 'متابعة الطلاب، الدروس والمصروفات الدراسية',
    subtitleEn: 'Students, timetable & school expenses',
    icon: GraduationCap,
    emoji: '🎓',
    tone: 'education',
    gradient: 'from-violet-500/20 via-purple-500/10 to-transparent',
    darkGradient: 'from-violet-950/40 via-purple-950/20 to-slate-900',
  },
  {
    id: 'media',
    titleAr: 'الوسائط والملفات',
    titleEn: 'Media Center',
    subtitleAr: 'ألبومات الصور، المستندات والملفات',
    subtitleEn: 'Photo albums, documents & files',
    icon: Film,
    emoji: '🎬',
    tone: 'media',
    gradient: 'from-rose-500/20 via-pink-500/10 to-transparent',
    darkGradient: 'from-rose-950/40 via-pink-950/20 to-slate-900',
  },
  {
    id: 'wallet',
    titleAr: 'المحفظة الذكية',
    titleEn: 'Smart Wallet',
    subtitleAr: 'إدارة البطاقات، الرصيد والتحويلات',
    subtitleEn: 'Cards, balance & transactions',
    icon: Wallet,
    emoji: '💳',
    tone: 'wallet',
    gradient: 'from-yellow-500/20 via-amber-500/10 to-transparent',
    darkGradient: 'from-yellow-950/40 via-amber-950/20 to-slate-900',
  },
];

// 3D TACTILE INTERACTIVE CARD COMPONENT WITH 10 STYLES & REORDERING CAPABILITIES
const Interactive3DCard: React.FC<{
  section: SectionCard;
  index: number;
  totalCards: number;
  isAr: boolean;
  statBadge?: string;
  isReorderMode: boolean;
  isHidden?: boolean;
  isWide?: boolean;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onToggleVisibility?: (e: React.MouseEvent) => void;
  onToggleSize?: (e: React.MouseEvent) => void;
  onMoveCard: (direction: 'prev' | 'next', e?: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  layoutMode: 'grid' | 'detailed';
}> = ({
  section,
  index,
  totalCards,
  isAr,
  statBadge,
  isReorderMode,
  isHidden = false,
  isWide = false,
  onClick,
  onToggleFavorite,
  onToggleVisibility,
  onToggleSize,
  onMoveCard,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  layoutMode,
}) => {
  const { preferences } = useCardPreferences();
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Calculate 3D tilt coordinates on mouse / pointer move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isReorderMode || !preferences.tilt3D || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -8; // Max 8 deg tilt
    const rotateY = ((x - centerX) / centerX) * 8;

    setRotate({ x: rotateX, y: rotateY });
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.35,
    });
  };

  const handleMouseEnter = () => {
    if (!isReorderMode) setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
    setGlare({ x: 50, y: 50, opacity: 0 });
  };

  const IconComponent = section.icon;
  const densityClasses = getCardDensityClasses(preferences.density);
  const cardContainerClass = resolveCardContainerClasses(preferences, section.tone, isReorderMode);
  const iconSizeClass = preferences.iconSize ? getCardIconSizeClass(preferences.iconSize) : densityClasses.iconSize;

  // Detailed / Wide Card Layout
  if (layoutMode === 'detailed' || isWide) {
    return (
      <div
        ref={cardRef}
        data-card-id={section.id}
        draggable={isReorderMode}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={isReorderMode ? undefined : onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          opacity: isHidden ? 0.45 : preferences.opacity / 100,
          transform:
            isHovered && !isReorderMode && preferences.tilt3D
              ? `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) translateY(-3px) scale3d(1.012, 1.012, 1.012)`
              : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale3d(1, 1, 1)',
        }}
        className={`${cardContainerClass} ${densityClasses.padding} flex items-center justify-between gap-3 sm:gap-4 cursor-pointer select-none transition-all duration-200 ${
          isWide ? 'col-span-2' : ''
        }`}
      >
        {/* Real-time Specular Glare Layer */}
        {!isReorderMode && preferences.tilt3D && (
          <div
            className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 rounded-inherit"
            style={{
              background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255, 255, 255, 0.4), transparent 60%)`,
              opacity: glare.opacity,
            }}
          />
        )}

        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 z-20">
          {/* Reorder Mode Controls */}
          {isReorderMode && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-xs">
                {index + 1}
              </span>
              <div className="text-amber-500 p-1">
                <GripVertical className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Icon Box */}
          <div
            style={{
              transform:
                isHovered && !isReorderMode && preferences.tilt3D
                  ? 'translateZ(20px)'
                  : 'translateZ(0px)',
            }}
            className={`dashboard-section-icon ${iconSizeClass} rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 shadow-sm`}
          >
            <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>

          <div
            className="min-w-0"
            style={{
              transform:
                isHovered && !isReorderMode && preferences.tilt3D
                  ? 'translateZ(14px)'
                  : 'translateZ(0px)',
            }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`dashboard-section-title font-black ${densityClasses.titleSize} tracking-tight`}>
                {isAr ? section.titleAr : section.titleEn}
              </span>
              <span className="text-sm sm:text-base" aria-hidden="true">
                {section.emoji}
              </span>
              {statBadge && preferences.showBadges && (
                <span className={`${densityClasses.badgeSize} rounded-full font-black bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 shadow-2xs`}>
                  {statBadge}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 font-medium">
              {isAr ? section.subtitleAr : section.subtitleEn}
            </p>
          </div>
        </div>

        {/* Actions side */}
        <div
          className="flex items-center gap-1.5 shrink-0 z-20"
          style={{
            transform:
              isHovered && !isReorderMode && preferences.tilt3D
                ? 'translateZ(16px)'
                : 'translateZ(0px)',
          }}
        >
          {isReorderMode ? (
            <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-800 p-1 rounded-xl border border-amber-300 dark:border-amber-700 shadow-xs">
              {onToggleVisibility && (
                <button
                  type="button"
                  onClick={onToggleVisibility}
                  className={`p-1.5 rounded-lg text-xs font-black transition-all ${
                    isHidden
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                  title={isHidden ? (isAr ? 'إظهار البطاقة' : 'Show') : isAr ? 'إخفاء البطاقة' : 'Hide'}
                >
                  {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}

              {onToggleSize && (
                <button
                  type="button"
                  onClick={onToggleSize}
                  className="p-1.5 rounded-lg text-xs font-black bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  title={isWide ? (isAr ? 'حجم قياسي' : 'Standard size') : isAr ? 'حجم عريض' : 'Wide size'}
                >
                  {isWide ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              )}

              <button
                type="button"
                disabled={index === 0}
                onClick={(e) => onMoveCard('prev', e)}
                className={`p-1.5 rounded-lg text-xs font-black transition-all ${
                  index === 0
                    ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 hover:bg-amber-200 active:scale-95'
                }`}
                title={isAr ? 'تحريك للأعلى' : 'Move Up'}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={index === totalCards - 1}
                onClick={(e) => onMoveCard('next', e)}
                className={`p-1.5 rounded-lg text-xs font-black transition-all ${
                  index === totalCards - 1
                    ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 hover:bg-amber-200 active:scale-95'
                }`}
                title={isAr ? 'تحريك للأسفل' : 'Move Down'}
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onToggleFavorite}
                className={`p-2 rounded-xl transition-all ${
                  section.isFavorite
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-500 shadow-xs'
                    : 'bg-black/5 dark:bg-white/5 text-slate-400 hover:text-amber-500'
                }`}
                title={isAr ? 'المفضلة' : 'Favorite'}
              >
                <Star className={`w-4 h-4 ${section.isFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
              </button>

              <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-slate-900 transition-colors shadow-xs">
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Square Grid Card Layout
  return (
    <div
      ref={cardRef}
      data-card-id={section.id}
      draggable={isReorderMode}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={isReorderMode ? undefined : onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        opacity: isHidden ? 0.45 : preferences.opacity / 100,
        transform:
          isHovered && !isReorderMode && preferences.tilt3D
            ? `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) translateY(-4px) scale3d(1.02, 1.02, 1.02)`
            : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale3d(1, 1, 1)',
      }}
      className={`${cardContainerClass} aspect-square ${densityClasses.padding} flex flex-col items-center justify-between text-center cursor-pointer select-none transition-all duration-200`}
    >
      {/* Specular Glare Reflection */}
      {!isReorderMode && preferences.tilt3D && (
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 rounded-inherit"
          style={{
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255, 255, 255, 0.35), transparent 60%)`,
            opacity: glare.opacity,
          }}
        />
      )}

      {/* Top micro bar: Index/Reorder or Favorite button & Drag handle */}
      <div
        className="w-full flex items-center justify-between z-20"
        style={{
          transform:
            isHovered && !isReorderMode && preferences.tilt3D
              ? 'translateZ(18px)'
              : 'translateZ(0px)',
        }}
      >
        {isReorderMode ? (
          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] shadow-xs">
              #{index + 1}
            </span>
            {onToggleVisibility && (
              <button
                type="button"
                onClick={onToggleVisibility}
                className={`p-1 rounded-md text-[10px] font-bold ${
                  isHidden
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                    : 'bg-black/5 dark:bg-white/10 text-slate-400'
                }`}
                title={isHidden ? (isAr ? 'إظهار' : 'Show') : isAr ? 'إخفاء' : 'Hide'}
              >
                {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`p-1 rounded-lg transition-transform active:scale-90 ${
              section.isFavorite
                ? 'text-amber-500 bg-amber-100/80 dark:bg-amber-950/60'
                : 'text-slate-300 dark:text-slate-600 hover:text-amber-500'
            }`}
            title={isAr ? 'المفضلة' : 'Favorite'}
          >
            <Star className={`w-3.5 h-3.5 ${section.isFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
          </button>
        )}

        {isReorderMode ? (
          <div className="text-amber-500 p-0.5">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        ) : statBadge && preferences.showBadges ? (
          <span className={`${densityClasses.badgeSize} font-black rounded-md bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 shadow-2xs`}>
            {statBadge}
          </span>
        ) : (
          <div className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
            <GripVertical className="w-3 h-3" />
          </div>
        )}
      </div>

      {/* Center 3D Floating Icon & Emoji Box */}
      <div
        className="flex flex-col items-center z-20 my-auto"
        style={{
          transform:
            isHovered && !isReorderMode && preferences.tilt3D
              ? 'translateZ(26px)'
              : 'translateZ(0px)',
        }}
      >
        <div className="relative mb-0.5">
          <div className={`dashboard-section-icon ${densityClasses.iconSize} rounded-2xl flex items-center justify-center shadow-md`}>
            <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="absolute -bottom-1 -right-1 text-sm sm:text-base filter drop-shadow-sm select-none">
            {section.emoji}
          </span>
        </div>
      </div>

      {/* Bottom Title OR Interactive Touch Move Buttons in Reorder Mode */}
      <div
        className="w-full z-20"
        style={{
          transform:
            isHovered && !isReorderMode && preferences.tilt3D
              ? 'translateZ(18px)'
              : 'translateZ(0px)',
        }}
      >
        {isReorderMode ? (
          <div className="flex items-center justify-center gap-1 bg-white/95 dark:bg-slate-800 p-0.5 rounded-lg border border-amber-300 dark:border-amber-700 shadow-xs w-full">
            <button
              type="button"
              disabled={index === 0}
              onClick={(e) => onMoveCard('prev', e)}
              className={`flex-1 py-1 rounded-md text-[11px] font-black flex items-center justify-center transition-all ${
                index === 0
                  ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 hover:bg-amber-200 active:scale-95'
              }`}
              title={isAr ? 'تقديم للبداية' : 'Move forward'}
            >
              {isAr ? <ArrowRight className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3" />}
            </button>
            <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 truncate max-w-[48px]">
              {isAr ? section.titleAr : section.titleEn}
            </span>
            <button
              type="button"
              disabled={index === totalCards - 1}
              onClick={(e) => onMoveCard('next', e)}
              className={`flex-1 py-1 rounded-md text-[11px] font-black flex items-center justify-center transition-all ${
                index === totalCards - 1
                  ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 hover:bg-amber-200 active:scale-95'
              }`}
              title={isAr ? 'تأخير للنهاية' : 'Move backward'}
            >
              {isAr ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            </button>
          </div>
        ) : (
          <span className={`dashboard-section-title font-black ${densityClasses.titleSize} tracking-tight block truncate`}>
            {isAr ? section.titleAr : section.titleEn}
          </span>
        )}
      </div>
    </div>
  );
};


export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  expenses,
  notes,
  vehicles,
  chatRooms,
  onNavigate,
  isLoading = false,
}) => {
  const isAr = user.language === 'ar';
  const { preferences, toggleCardVisibility, setCardSize } = useCardPreferences();

  // Skeleton loading state for repository hydration and layout transitions
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsDataLoading(false);
    }, 260);
    return () => clearTimeout(timer);
  }, []);

  // Card customizer modal state
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  // Layout mode: 'organic' (عرض انسيابي ثلاثي الأبعاد) | 'grid' (شبكة 3D) | 'detailed' (بطاقات تفصيلية)
  const [layoutMode, setLayoutMode] = useState<'organic' | 'grid' | 'detailed'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DASHBOARD_LAYOUT);
      if (saved === 'organic' || saved === 'grid' || saved === 'detailed') {
        return saved;
      }
      return 'organic';
    } catch (e) {
      return 'organic';
    }
  });

  const handleLayoutModeChange = (mode: 'organic' | 'grid' | 'detailed') => {
    if (mode === layoutMode) return;
    setIsDataLoading(true);
    setLayoutMode(mode);
    setTimeout(() => {
      setIsDataLoading(false);
    }, 160);
  };

  // Reorder mode toggle
  const [isReorderMode, setIsReorderMode] = useState<boolean>(false);

  // Filter category: 'all' | 'favorites'
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites'>('all');

  // Load section order and favorites from localStorage
  const [sections, setSections] = useState<SectionCard[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DASHBOARD_SECTIONS_V2);
      if (saved) {
        const parsed = JSON.parse(saved);
        const ordered: SectionCard[] = [];
        // Map saved order
        parsed.forEach((item: any) => {
          const found = ALL_SECTIONS.find((s) => s.id === item.id);
          if (found) {
            ordered.push({ ...found, isFavorite: item.isFavorite });
          }
        });
        // Append any new sections that were missing
        ALL_SECTIONS.forEach((s) => {
          if (!ordered.some((o) => o.id === s.id)) {
            ordered.push(s);
          }
        });
        return ordered;
      }
    } catch (e) {}
    return ALL_SECTIONS;
  });

  const [draggedId, setDraggedId] = useState<AppView | null>(null);

  useEffect(() => {
    try {
      StorageAdapter.setItem(STORAGE_KEYS.DASHBOARD_LAYOUT, layoutMode);
    } catch (e) {}
  }, [layoutMode]);

  useEffect(() => {
    try {
      StorageAdapter.setItem(
        STORAGE_KEYS.DASHBOARD_SECTIONS_V2,
        sections.map((s) => ({ id: s.id, isFavorite: s.isFavorite }))
      );
    } catch (e) {}
  }, [sections]);

  const handleCardClick = (id: AppView) => {
    if (isReorderMode) return;
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(12);
      } catch (e) {}
    }
    onNavigate(id);
  };

  const toggleFavorite = (id: AppView, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s))
    );
  };

  // Move a card by index (prev or next)
  const handleMoveCard = (id: AppView, direction: 'prev' | 'next', e?: React.MouseEvent) => {
    e?.stopPropagation();
    const index = sections.findIndex((s) => s.id === id);
    if (index === -1) return;

    const targetIndex = direction === 'prev' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const newSections = [...sections];
    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;

    setSections(newSections);

    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(12);
      } catch (e) {}
    }
  };

  // Reset to default layout
  const handleResetOrder = () => {
    if (window.confirm(isAr ? 'هل تريد استعادة الترتيب الافتراضي للبطاقات؟' : 'Reset cards to default order?')) {
      setSections(ALL_SECTIONS);
      setIsReorderMode(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: AppView) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: AppView) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = sections.findIndex((s) => s.id === draggedId);
    const targetIndex = sections.findIndex((s) => s.id === targetId);

    if (draggedIndex < 0 || targetIndex < 0) return;

    const newSections = [...sections];
    const [removed] = newSections.splice(draggedIndex, 1);
    newSections.splice(targetIndex, 0, removed);

    setSections(newSections);
    setDraggedId(null);
  };

  // Helper to get real live stats badges for each card
  const getStatBadge = (id: AppView): string | undefined => {
    switch (id) {
      case 'expenses':
        return expenses.length > 0 ? `${expenses.length} سجل` : undefined;
      case 'notes':
        return notes.length > 0 ? `${notes.length} ملاحظة` : undefined;
      case 'vehicles':
        return vehicles.length > 0 ? `${vehicles.length} مركبة` : undefined;
      case 'chat':
        return chatRooms.length > 0 ? `${chatRooms.length} غرف` : undefined;
      case 'ai':
        return 'نشط ⚡';
      case 'vault':
        return 'مشفر 🛡️';
      default:
        return undefined;
    }
  };

  const hiddenIds = preferences.hiddenCardIds || [];
  const cardSizes = preferences.cardSizes || {};

  // Filter cards: In Reorder Mode show all cards so user can toggle visibility. In normal mode filter hidden out.
  const visibleSections = sections.filter((s) => {
    if (!isReorderMode && hiddenIds.includes(s.id)) return false;
    if (activeFilter === 'favorites') return s.isFavorite;
    return true;
  });

  const favoritesCount = sections.filter((s) => s.isFavorite).length;

  return (
    <div
      className="w-full min-h-full flex flex-col pb-16 select-none animate-fade-in space-y-4 smart-dashboard-reference-bg"
      id="android-dashboard-grid-view"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Top Minimal Toolbar: View switchers & Card Settings Gear at the top left */}
      <div className="flex items-center justify-between gap-2 px-1 py-0.5">
        {/* Quick Reorder Action */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsReorderMode(!isReorderMode)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs ${
              isReorderMode
                ? 'bg-amber-500 text-slate-950 animate-pulse'
                : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={isAr ? 'تحريك وإعادة ترتيب البطاقات باللمس أو الأسهم' : 'Reorder cards'}
          >
            <Move className="w-3.5 h-3.5" />
            <span>{isReorderMode ? (isAr ? 'إنهاء الترتيب ✓' : 'Done') : (isAr ? 'ترتيب البطاقات ⇅' : 'Reorder')}</span>
          </button>

          {isReorderMode && (
            <button
              type="button"
              onClick={handleResetOrder}
              className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 flex items-center gap-1 border border-rose-200 dark:border-rose-800 transition shadow-xs"
              title={isAr ? 'الترتيب الافتراضي' : 'Reset default'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isAr ? 'افتراضي' : 'Reset'}</span>
            </button>
          )}

          {favoritesCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter(activeFilter === 'favorites' ? 'all' : 'favorites')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all border ${
                activeFilter === 'favorites'
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-800 hover:text-amber-500'
              }`}
              title={isAr ? 'المفضلة' : 'Favorites'}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>{favoritesCount}</span>
            </button>
          )}
        </div>

        {/* Top Left in RTL (Screen Left): View Modes & Card Settings Gear */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-1 rounded-2xl shadow-xs">
          <button
            type="button"
            onClick={() => handleLayoutModeChange('organic')}
            className={`px-2 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all ${
              layoutMode === 'organic'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            title={isAr ? 'العرض الانسيابي ثلاثي الأبعاد بالألوان الخفيفة' : '3D Organic Light View'}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden xs:inline text-[11px]">{isAr ? 'انسيابي 3D' : '3D'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleLayoutModeChange('grid')}
            className={`p-1.5 rounded-xl transition-all ${
              layoutMode === 'grid'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            title={isAr ? 'عرض شبكة 3D' : 'Grid view'}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleLayoutModeChange('detailed')}
            className={`p-1.5 rounded-xl transition-all ${
              layoutMode === 'detailed'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            title={isAr ? 'عرض بطاقات تفصيلية' : 'Detailed cards'}
          >
            <Layers className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          {/* Gear Cog Icon for Card Customizer Studio */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsCustomizerOpen(true); }}
            className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90"
            title={isAr ? 'ضبط وتخصيص نمط وتصميم البطاقات' : 'Card Design & Settings'}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Helper Bar when Reorder Mode is active */}
      {isReorderMode && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl flex items-center justify-between gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 flex-wrap">
            <GripVertical className="w-4 h-4 text-amber-600" />
            <span>
              {isAr
                ? 'اسحب أي بطاقة باللمس لتغيير موضعها، أو استخدم أزرار الأسهم، واضغط رمز العين لإظهار/إخفاء البطاقة.'
                : 'Drag any card by touch to reposition, or use arrow buttons, and tap the eye icon to hide/show.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsReorderMode(false)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black text-xs shrink-0"
          >
            {isAr ? 'حفظ والانتهاء ✓' : 'Done'}
          </button>
        </div>
      )}

      {/* Skeleton Loading State OR Cards Render */}
      {isDataLoading || isLoading ? (
        <DashboardSkeletonLoader layoutMode={layoutMode} isAr={isAr} />
      ) : layoutMode === 'organic' ? (
        <Organic3DDashboard onNavigate={handleCardClick} isAr={isAr} />
      ) : visibleSections.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
          <Star className="w-10 h-10 mx-auto text-amber-400" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'لا توجد بطاقات معروضة' : 'No cards displayed'}
          </p>
          <p className="text-xs text-slate-400">
            {isAr
              ? 'تأكد من عدم إخفاء جميع البطاقات أو إلغاء فلتر المفضلة.'
              : 'Make sure cards are not hidden or disable the favorites filter.'}
          </p>
        </div>
      ) : layoutMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full">
          {visibleSections.map((section, index) => {
            const isHidden = hiddenIds.includes(section.id);
            const isWide = cardSizes[section.id] === 'wide';
            return (
              <Interactive3DCard
                key={section.id}
                section={section}
                index={index}
                totalCards={visibleSections.length}
                isAr={isAr}
                statBadge={getStatBadge(section.id)}
                isReorderMode={isReorderMode}
                isHidden={isHidden}
                isWide={isWide}
                onClick={() => handleCardClick(section.id)}
                onToggleFavorite={(e) => toggleFavorite(section.id, e)}
                onToggleVisibility={(e) => {
                  e?.stopPropagation();
                  toggleCardVisibility(section.id);
                }}
                onToggleSize={(e) => {
                  e?.stopPropagation();
                  setCardSize(section.id, isWide ? 'medium' : 'wide');
                }}
                onMoveCard={(direction, e) => handleMoveCard(section.id, direction, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragStart={(e) => handleDragStart(e, section.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, section.id)}
                layoutMode="grid"
              />
            );
          })}
        </div>
      ) : (
        <div className="space-y-2.5 w-full">
          {visibleSections.map((section, index) => {
            const isHidden = hiddenIds.includes(section.id);
            return (
              <Interactive3DCard
                key={section.id}
                section={section}
                index={index}
                totalCards={visibleSections.length}
                isAr={isAr}
                statBadge={getStatBadge(section.id)}
                isReorderMode={isReorderMode}
                isHidden={isHidden}
                isWide={false}
                onClick={() => handleCardClick(section.id)}
                onToggleFavorite={(e) => toggleFavorite(section.id, e)}
                onToggleVisibility={(e) => {
                  e?.stopPropagation();
                  toggleCardVisibility(section.id);
                }}
                onMoveCard={(direction, e) => handleMoveCard(section.id, direction, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragStart={(e) => handleDragStart(e, section.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, section.id)}
                layoutMode="detailed"
              />
            );
          })}
        </div>
      )}

      {/* Card Customizer Studio Modal (triggered via top gear icon) */}
      <CardCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        language={user.language || 'ar'}
        sections={sections.map((section) => ({
          id: section.id,
          titleAr: section.titleAr,
          titleEn: section.titleEn,
          emoji: section.emoji,
        }))}
      />
    </div>
  );
};

