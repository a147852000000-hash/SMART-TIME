import React, { useState, useRef, useEffect } from 'react';
import {
  Home,
  Settings,
  Search,
  Mic,
  Moon,
  Sun,
  Bell,
  SlidersHorizontal,
  ArrowRight,
  ArrowLeft,
  MoreVertical,
  Clock,
  CalendarDays,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { Language, ThemeMode, UserProfile, AppNotification, DailyTask, Note } from '../types';
import { translations } from '../services/i18n';
import { LiveHeaderWidgets } from './LiveHeaderWidgets';
import { DhakirniReminderBar } from './DhakirniReminderBar';
import { BrandLogo } from './BrandLogo';

interface NavigationHeaderProps {
  user: UserProfile;
  activeTab: string;
  onNavigate: (tab: string) => void;
  onBack?: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  isAndroidView?: boolean;
  onToggleAndroidView?: () => void;
  onOpenSearch: () => void;
  onOpenVoiceSearch: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  isSettingsOpen?: boolean;
  notifications: AppNotification[];
  dailyTasks?: DailyTask[];
  notes?: Note[];
  onToggleDailyTask?: (id: string) => void;
  onAddDailyTask?: (task: Omit<DailyTask, 'id' | 'createdAt'>) => void;
  onDeleteDailyTask?: (id: string) => void;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  user,
  activeTab,
  onNavigate,
  onBack,
  language,
  onLanguageChange,
  theme,
  onToggleTheme,
  onOpenSearch,
  onOpenVoiceSearch,
  onOpenNotifications,
  onOpenSettings,
  isSettingsOpen = false,
  notifications,
  dailyTasks = [],
  notes = [],
  onToggleDailyTask,
  onAddDailyTask,
  onDeleteDailyTask,
}) => {
  const t = translations[language];
  const isAr = language === 'ar';
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const menuRef = useRef<HTMLDivElement>(null);

  // تحديث الساعة الثابتة كل ثانية
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // تنسيق الوقت باللغة الإنجليزية/الأرقام اللاتينية الواضحة
  const timeFormatted = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const secondsFormatted = now.getSeconds().toString().padStart(2, '0');

  // التاريخ الميلادي بنفس مساحة الساعة (اليوم، الشهر، السنة)
  const gregorianDateFormatted = now.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Close overflow menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleBackClick = () => {
    if (onBack) {
      onBack();
    } else {
      onNavigate('dashboard');
    }
  };

  const isHomeActive = activeTab === 'dashboard';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs select-none">
      {/* 1. الشريط العلوي (Top Bar) حسب الترتيب المحدد بدقة من الجهة اليسرى (LTR container for consistent left-to-right alignment) */}
      <div
        className="w-full px-2 sm:px-3 h-14 flex items-center justify-between gap-1.5"
        dir="ltr"
      >
        {/* الجانب الأيسر: زر الرجوع (عند التواجد في قسم فرعي) + صورة المستخدم بحواف دائرية + الاسم والمهنة */}
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          {!isHomeActive && (
            <button
              onClick={handleBackClick}
              className="w-8 h-8 rounded-xl bg-accent-500/10 hover:bg-accent-500/20 text-accent-700 dark:text-accent-400 flex items-center justify-center font-bold transition-all active:scale-95 border border-accent-500/20 shrink-0"
              title={isAr ? 'رجوع للخلف' : 'Back'}
              id="android-back-btn"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {/* صورة المستخدم بمربع بحواف دائرية بجانبها اسم ومهنة المستخدم */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 p-1 pe-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all text-left group active:scale-95 min-w-0 max-w-[140px] xs:max-w-[170px] sm:max-w-[210px]"
            title={isAr ? 'الملف الشخصي والإعدادات' : 'User Profile & Settings'}
            id="android-profile-btn"
          >
            {/* مربع بحواف دائرية لصورة المستخدم */}
            <div className="relative shrink-0 w-9 h-9 rounded-2xl overflow-hidden ring-2 ring-accent-500/80 shadow-xs bg-slate-100 dark:bg-slate-800">
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
            </div>

            {/* بجانب الصورة: اسم ومهنة المستخدم */}
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {user.name}
              </span>
              <span className="text-[10px] text-accent-600 dark:text-accent-400 font-semibold truncate">
                {user.occupation || (isAr ? 'الحساب الشخصي' : 'Personal')}
              </span>
            </div>
          </button>
        </div>

        {/* الجانب الأيمن من الشريط العلوي بالترتيب المحدد: 
            أيقونة الإشعارات -> ساعة رقمية مميزة -> أيقونة الترس (الضبط) -> البحث وقائمة الخيارات */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* بجانبه أيقونة الإشعارات */}
          <button
            onClick={onOpenNotifications}
            className="relative w-8.5 h-8.5 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all border border-slate-200/60 dark:border-slate-700/60"
            title={t.notifications}
            id="android-notifications-btn"
          >
            <Bell className="w-4 h-4 text-slate-700 dark:text-slate-200" />
            {unreadCount > 0 && (
              <span className="absolute top-1 end-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-ping" />
            )}
            {unreadCount > 0 && (
              <span className="absolute top-1 end-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {/* بجانبه ساعة رقمية احترافية بخلفية شفافة وتحتها التاريخ الميلادي بنفس المساحة */}
          <div
            className="flex flex-col items-center justify-center px-1.5 py-0.5 rounded-xl bg-transparent hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors shrink-0 select-none cursor-default group"
            title={isAr ? `الساعة: ${timeFormatted} | التاريخ الميلادي: ${gregorianDateFormatted}` : `Time: ${timeFormatted} | Date: ${gregorianDateFormatted}`}
            id="android-distinctive-clock"
          >
            {/* الصف العلوي: أيقونة الساعة + الوقت + الثواني بخلفية شفافة تماماً */}
            <div className="flex items-center gap-1 leading-none">
              <Clock className="w-3.5 h-3.5 text-accent-500 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-mono font-black text-xs sm:text-[13px] tracking-tight text-slate-900 dark:text-white">
                {timeFormatted}
              </span>
              <span className="font-mono text-[9px] font-bold text-accent-600 dark:text-accent-400">
                :{secondsFormatted}
              </span>
            </div>

            {/* الصف السفلي: التاريخ الميلادي بنفس مساحة وعرض الساعة */}
            <div className="w-full flex items-center justify-center gap-1 mt-0.5 pt-0.5 border-t border-slate-200/50 dark:border-slate-800/50 leading-none">
              <span className="text-[9.5px] sm:text-[10px] font-bold font-sans text-slate-500 dark:text-slate-400 tracking-tight whitespace-nowrap">
                📅 {gregorianDateFormatted}
              </span>
            </div>
          </div>

          {/* بجانبه أيقونة الترس (الضبط) */}
          <button
            onClick={onOpenSettings}
            className="w-8.5 h-8.5 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all border border-slate-200/60 dark:border-slate-700/60 group"
            title={isAr ? 'الإعدادات والضبط (Settings)' : 'Settings & Preferences'}
            id="android-settings-gear-btn"
          >
            <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300 text-slate-700 dark:text-slate-200" />
          </button>

          {/* زر البحث السريع */}
          <button
            onClick={onOpenSearch}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-colors hidden xs:flex"
            title={isAr ? 'بحث سريع' : 'Search'}
            id="android-search-btn"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* قائمة الخيارات الإضافية (Android 3-Dots Menu) */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors active:scale-95 ${
                isMenuOpen
                  ? 'bg-accent-500 text-slate-950'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={isAr ? 'خيارات إضافية' : 'More Options'}
              id="android-overflow-menu-btn"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 animate-fadeIn"
                id="android-overflow-dropdown"
                dir={isAr ? 'rtl' : 'ltr'}
              >
                {/* Theme toggle */}
                <button
                  onClick={() => {
                    onToggleTheme();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {theme === 'dark' ? (
                      <Sun className="w-4 h-4 text-accent-400" />
                    ) : (
                      <Moon className="w-4 h-4 text-slate-600" />
                    )}
                    <span>{isAr ? 'المظهر (داكن / فاتح)' : 'Theme Mode'}</span>
                  </span>
                  <span className="text-[10px] text-accent-600 font-bold uppercase">
                    {theme === 'dark' ? (isAr ? 'داكن' : 'Dark') : (isAr ? 'فاتح' : 'Light')}
                  </span>
                </button>

                {/* Voice Search */}
                <button
                  onClick={() => {
                    onOpenVoiceSearch();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Mic className="w-4 h-4 text-accent-500" />
                  <span>{isAr ? 'البحث الصوتي' : 'Voice Search'}</span>
                </button>

                {/* Calendar */}
                <button
                  onClick={() => {
                    onNavigate('calendar');
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <CalendarDays className="w-4 h-4 text-accent-500" />
                  <span>{isAr ? 'التقويم الذكي' : 'Smart Calendar'}</span>
                </button>

                {/* Language options */}
                <div className="py-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {isAr ? 'اللغة' : 'Language'}
                  </div>
                  {(['ar', 'en', 'fr'] as Language[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        onLanguageChange(lang);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        language === lang
                          ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-bold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>
                        {lang === 'ar' ? 'العربية (RTL)' : lang === 'en' ? 'English (LTR)' : 'Français'}
                      </span>
                      {language === lang && <span className="text-accent-500 text-xs">✓</span>}
                    </button>
                  ))}
                </div>

                {/* AI Service */}
                <a
                  href="/services/smart-ai"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-accent-500" />
                  <span>AI Service</span>
                </a>

                {/* Settings Link */}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      onOpenSettings();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-accent-500" />
                    <span>{t.backupAndSettings}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. شريط الأخبار المتحرك (أسفل الشريط العلوي مباشرة):
             يبدأ بأيقونة الشعار الرسمية الفاخرة الثابتة تخرج منها الأخبار والأسعار متحركة نحو اليمين */}
      {!isSettingsOpen && activeTab !== 'settings' && (
        <>
          <div className="w-full bg-slate-100/90 dark:bg-slate-950/80 px-1 py-1 flex items-center">
            <LiveHeaderWidgets
              user={user}
              language={language}
              onGoHome={() => onNavigate('dashboard')}
              isHomeActive={isHomeActive}
              dailyTasks={dailyTasks}
              onToggleDailyTask={onToggleDailyTask}
              onAddDailyTask={onAddDailyTask}
              onNavigate={onNavigate}
            />
          </div>

          {/* 3. أسفله شريط ذكرني بعرض الشاشة */}
          <DhakirniReminderBar
            language={language}
            tasks={dailyTasks}
            notes={notes}
            onToggleTask={(id) => onToggleDailyTask?.(id)}
            onAddTask={(task) => onAddDailyTask?.(task)}
            onDeleteTask={(id) => onDeleteDailyTask?.(id)}
            onNavigateToNotes={() => onNavigate('notes')}
          />
        </>
      )}
    </header>
  );
};
