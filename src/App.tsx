import React, { useState, useEffect, useCallback } from 'react';
import {
  AppView,
  Language,
  ThemeMode,
  ColorTheme,
  IconStyle,
  UserProfile,
  Note,
  NoteFolder,
  NoteTag,
  CalculatorHistoryItem,
  Expense,
  BudgetSummary,
  MonthlyIncome,
  Vehicle,
  FuelRecord,
  MaintenanceRecord,
  Student,
  LessonItem,
  EducationExpense,
  AthkarItem,
  SecureRecord,
  MediaFolder,
  MediaItem,
  FavoritePlace,
  RecentTrip,
  ChatRoom,
  AppNotification,
  DailyTask,
} from './types';
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
} from './services';

// Components
import { AndroidStatusBar } from './components/AndroidStatusBar';
import { NavigationHeader } from './components/NavigationHeader';
import { DashboardView } from './components/DashboardView';
import { NotesAndAccountingView } from './components/NotesAndAccountingView';
import { ExpensesView } from './components/ExpensesView';
import { TripsView } from './components/TripsView';
import WalletView from './components/WalletView';
import AdminWalletPanel from './components/AdminWalletPanel';
import { VehiclesView } from './components/VehiclesView';
import { EducationView } from './components/EducationView';
import { ReligiousView } from './components/ReligiousView';
import { SecureVaultView } from './components/SecureVaultView';
import { AiCenterView } from './components/AiCenterView';
import { HotChatView } from './components/HotChatView';
import { MediaCenterView } from './components/MediaCenterView';
import { SportsView } from './components/SportsView';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { VoiceSearchModal } from './components/VoiceSearchModal';
import { SettingsAndBackupModal } from './components/SettingsAndBackupModal';
import { NotificationsModal } from './components/NotificationsModal';
import { LiveNewsPanel } from './components/LiveNewsPanel';
import ServicesPage from '../app/services/page';
import SmartAIServicePage from '../app/services/smart-ai/page';
import { AuthView } from './components/AuthView';
import { CalendarView } from './components/CalendarView';
import AdminCenter from './components/AdminCenter';
import { getStoredSession, restoreSession, startTrialSession, logout as logoutAuth } from './services/authService';
import { acknowledgeEventReminder, createCanonicalTask, deleteCanonicalTask, fetchPendingEventReminders, fetchSmartAiState, importCanonicalTasks, updateCanonicalTask } from './services/aiService';

// Icons
import {
  LayoutDashboard,
  FileText,
  DollarSign,
  Navigation,
  Sparkles,
} from 'lucide-react';

export default function App() {
  const servicePath = typeof window !== 'undefined' ? window.location.pathname : '/';
  // Global App State
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(() => Boolean(getStoredSession()?.token));
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [viewHistory, setViewHistory] = useState<AppView[]>([]);
  const [language, setLanguage] = useState<Language>('ar');
  const [theme, setTheme] = useState<ThemeMode>(() => UserRepository.getProfile().theme || 'light');
  const [colorTheme, setColorTheme] = useState<ColorTheme>('ocean');
  const [iconStyle, setIconStyle] = useState<IconStyle>(() => UserRepository.getProfile().iconStyle || 'classic');

  const handleNavigate = (nextView: AppView) => {
    if (nextView !== currentView) {
      setViewHistory((prev) => [...prev, currentView]);
      setCurrentView(nextView);
    }
  };

  const handleBack = () => {
    if (viewHistory.length > 0) {
      const prev = viewHistory[viewHistory.length - 1];
      setViewHistory((prevH) => prevH.slice(0, -1));
      setCurrentView(prev);
    } else {
      setCurrentView('dashboard');
    }
  };

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const handleVoiceTranscript = useCallback((finalTranscript: string) => {
    setVoiceTranscript(finalTranscript);
    setIsVoiceOpen(false);
  }, []);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // App Data Layers using Repositories
  const [userProfile, setUserProfile] = useState<UserProfile>(() => UserRepository.getProfile());
  const [notes, setNotes] = useState<Note[]>(() => NotesRepository.getNotes());
  const [noteFolders, setNoteFolders] = useState<NoteFolder[]>(() => NotesRepository.getFolders());
  const [noteTags, setNoteTags] = useState<NoteTag[]>(() => NotesRepository.getTags());
  const [calcHistory, setCalcHistory] = useState<CalculatorHistoryItem[]>(() => NotesRepository.getCalculatorHistory());
  const [expenses, setExpenses] = useState<Expense[]>(() => ExpensesRepository.getExpenses());
  const [budget, setBudget] = useState<BudgetSummary>(() => ExpensesRepository.getBudget());
  const [monthlyIncome, setMonthlyIncome] = useState<MonthlyIncome[]>(() => ExpensesRepository.getMonthlyIncome());
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => VehiclesRepository.getVehicles());
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>(() => VehiclesRepository.getFuelRecords());
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>(() =>
    VehiclesRepository.getMaintenanceRecords()
  );
  const [students, setStudents] = useState<Student[]>(() => EducationRepository.getStudents());
  const [lessons, setLessons] = useState<LessonItem[]>(() => EducationRepository.getLessons());
  const [educationExpenses, setEducationExpenses] = useState<EducationExpense[]>(() =>
    EducationRepository.getEducationExpenses()
  );
  const [athkarItems, setAthkarItems] = useState<AthkarItem[]>(() => ReligiousRepository.getAthkarItems());
  const [secureRecords, setSecureRecords] = useState<SecureRecord[]>(() => VaultRepository.getRecords());
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>(() => ChatRepository.getChatRooms());
  const [mediaFolders, setMediaFolders] = useState<MediaFolder[]>(() => MediaRepository.getFolders());
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => MediaRepository.getItems());
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlace[]>(() => TripsRepository.getFavoritePlaces());
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>(() => TripsRepository.getRecentTrips());
  const [notifications, setNotifications] = useState<AppNotification[]>(() => NotificationsRepository.getNotifications());
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>(() => NotesRepository.getDailyTasks());
  useEffect(() => {
    let active = true;
    restoreSession()
      .then((session) => {
        if (!active) return;
        setAuthenticated(Boolean(session));
        if (session) setUserProfile(UserRepository.getProfile());
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      })
      .finally(() => {
        if (active) setAuthChecked(true);
      });
    return () => { active = false; };
  }, []);

  const handleAuthenticated = useCallback(async () => {
    const session = await restoreSession();
    setAuthenticated(Boolean(session));
    if (session) setUserProfile(UserRepository.getProfile());
  }, []);

  const handleGuest = useCallback(async () => {
    try {
      const session = await startTrialSession();
      setAuthenticated(Boolean(session));
      if (session) setUserProfile(UserRepository.getProfile());
    } catch (error) {
      console.error('Trial session error:', error);
      setAuthenticated(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutAuth();
    setAuthenticated(false);
    setAuthChecked(true);
    setViewHistory([]);
    setCurrentView('dashboard');
    setIsSettingsOpen(false);
    setIsNotificationsOpen(false);
    setIsSearchOpen(false);
    setIsVoiceOpen(false);
    setVoiceTranscript('');
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    let stopped = false;

    const deliverDueReminders = async () => {
      try {
        const reminders = await fetchPendingEventReminders(25);
        if (stopped || reminders.length === 0) return;
        for (const reminder of reminders) {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const notification = new Notification(reminder.title, {
              body: `SMART TIME · ${reminder.timezone}`,
              tag: reminder.id,
            });
            notification.onclick = () => {
              window.focus();
              notification.close();
              setCurrentView('calendar');
            };
          }
          await acknowledgeEventReminder(reminder.id);
        }
      } catch (error) {
        console.debug('SMART AI reminder delivery unavailable:', error);
      }
    };

    void deliverDueReminders();
    const timer = window.setInterval(() => { void deliverDueReminders(); }, 15_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [authChecked]);

  useEffect(() => {
    if (!authChecked) return;
    void fetchSmartAiState()
      .then(async (state) => {
        if (state.transactions.length > 0) {
          setExpenses((current) => {
            const byId = new Map(current.map((item) => [item.id, item]));
            for (const transaction of state.transactions as Expense[]) byId.set(transaction.id, transaction);
            const sorted = Array.from(byId.values()) as Expense[];
             return sorted.sort((a, b) => String(b.date).localeCompare(String(a.date)));
          });
        }

        if (state.tasks.length > 0) {
          setDailyTasks(state.tasks);
        } else if (dailyTasks.length > 0) {
          await importCanonicalTasks(dailyTasks);
        }

        if (state.budget) {
          const totalExpenses = state.transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
          const totalBudget = Number(state.budget.monthlyLimit || 0);
          const remaining = Math.round((totalBudget - totalExpenses) * 100) / 100;
          setBudget({
            totalBudget,
            totalExpenses,
            remaining,
            percentUsed: totalBudget > 0 ? Math.min(100, Math.max(0, (totalExpenses / totalBudget) * 100)) : 0,
          });
        }
      })
      .catch((error) => {
        console.warn('SMART AI canonical state sync unavailable:', error);
      });
  }, [authChecked]);

  const handleNavigateSafe = (nextView: AppView) => handleNavigate(nextView);

  const handleToggleDailyTask = async (id: string) => {
    const current = dailyTasks.find((task) => task.id === id);
    if (!current) return;
    try {
      const updatedTask = await updateCanonicalTask({
        ...current,
        completed: !current.completed,
        completedAt: !current.completed ? new Date().toISOString() : undefined,
      });
      setDailyTasks((items) => items.map((item) => item.id === id ? updatedTask : item));
    } catch (error) {
      console.error('Canonical task update failed:', error);
    }
  };

  const handleAddDailyTask = async (task: Omit<DailyTask, 'id' | 'createdAt'>) => {
    try {
      const created = await createCanonicalTask(task);
      setDailyTasks((items) => [created, ...items.filter((item) => item.id !== created.id)]);
    } catch (error) {
      console.error('Canonical task creation failed:', error);
    }
  };

  const handleDeleteDailyTask = async (id: string) => {
    try {
      await deleteCanonicalTask(id);
      setDailyTasks((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Canonical task deletion failed:', error);
    }
  };

  const handleUpdateDailyTasks = async (updated: DailyTask[]) => {
    try {
      const changed = updated.find((next) => {
        const previous = dailyTasks.find((item) => item.id === next.id);
        return previous && JSON.stringify(previous) !== JSON.stringify(next);
      });
      if (changed) {
        const saved = await updateCanonicalTask(changed);
        setDailyTasks((items) => items.map((item) => item.id === saved.id ? saved : item));
      }
    } catch (error) {
      console.error('Canonical task bulk update failed:', error);
    }
  };

  // Setup Theme & RTL
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Load saved color theme once, then apply the "app style" accent theme class to <html>
  useEffect(() => {
    if (userProfile.colorTheme) setColorTheme(userProfile.colorTheme === 'gold' ? 'ocean' : userProfile.colorTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-ocean', 'theme-gold', 'theme-facebook', 'theme-whatsapp', 'theme-telegram', 'theme-instagram', 'theme-youtube');
    root.classList.add(`theme-${colorTheme === 'gold' ? 'ocean' : colorTheme}`);
  }, [colorTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    root.setAttribute('lang', language);
  }, [language]);

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    const updated = { ...userProfile, language: newLang };
    setUserProfile(updated);
    UserRepository.saveProfile(updated);
  };

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    const updated = { ...userProfile, theme: newTheme };
    setUserProfile(updated);
    UserRepository.saveProfile(updated);
  };

  const handleIconStyleChange = (newIconStyle: IconStyle) => {
    setIconStyle(newIconStyle);
    const updated = { ...userProfile, iconStyle: newIconStyle };
    setUserProfile(updated);
    UserRepository.saveProfile(updated);
  };

  const handleColorThemeChange = (newColorTheme: ColorTheme) => {
    setColorTheme(newColorTheme);
    const updated = { ...userProfile, colorTheme: newColorTheme };
    setUserProfile(updated);
    UserRepository.saveProfile(updated);
  };

  const handleToggleTheme = () => {
    handleThemeChange(theme === 'dark' ? 'light' : 'dark');
  };

  const handleResetData = () => {
    if (window.confirm(language === 'ar' ? 'هل أنت متأكد من استعادة بيانات المصنع؟' : 'Reset all data to defaults?')) {
      BackupRepository.resetToDefaults();
      window.location.reload();
    }
  };

  // Android Bottom Navigation Bar Items (Material 3 Tabs)
  const bottomNavItems = [
    { view: 'dashboard' as AppView, label: language === 'ar' ? 'الرئيسية' : 'Home', icon: LayoutDashboard },
    { view: 'trips' as AppView, label: language === 'ar' ? 'المشاوير' : 'Trips', icon: Navigation },
    { view: 'ai' as AppView, label: language === 'ar' ? 'الذكاء' : 'AI', icon: Sparkles, highlight: true },
    { view: 'expenses' as AppView, label: language === 'ar' ? 'المصاريف' : 'Money', icon: DollarSign },
    { view: 'notes' as AppView, label: language === 'ar' ? 'الملاحظات' : 'Notes', icon: FileText },
  ];

  if (servicePath === '/services/smart-ai') return <SmartAIServicePage />;
  if (servicePath === '/services') return <ServicesPage />;
  if (!authChecked) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-bold">جارٍ التحقق من جلسة الحساب…</div>;
  if (!authenticated) {
    return (
      <AuthView
        onAuthenticated={() => { void handleAuthenticated(); }}
        onGuest={() => { void handleGuest(); }}
      />
    );
  }

  const sessionRole = getStoredSession()?.user.role;
  if (authenticated && sessionRole === 'admin') {
    return <AdminCenter onLogout={() => { setAuthenticated(false); setAuthChecked(true); }} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center sm:p-3 selection:bg-accent-500 selection:text-white">
      {/* Authentic Android Mobile Smartphone Shell */}
      <div className="relative w-full sm:max-w-[430px] h-screen sm:h-[93vh] sm:max-h-[915px] bg-white dark:bg-slate-900 sm:rounded-[44px] shadow-2xl sm:ring-1 sm:ring-slate-800 sm:border-[8px] sm:border-slate-800 flex flex-col overflow-hidden">
        
        {/* 1. Android Status Bar (الساعة بالدقائق والساعات فقط) */}
        <AndroidStatusBar
          language={language}
          unreadNotifications={notifications.filter((n) => !n.isRead).length}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenPermissions={() => setIsSettingsOpen(true)}
        />

        {/* 2. Top Android App Toolbar & Live Header Widgets Ribbon */}
        <NavigationHeader
          user={userProfile}
          activeTab={currentView}
          onNavigate={(tab) => handleNavigateSafe(tab as AppView)}
          onBack={handleBack}
          language={language}
          onLanguageChange={handleLanguageChange}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenVoiceSearch={() => setIsVoiceOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isSettingsOpen={isSettingsOpen}
          notifications={notifications}
          dailyTasks={dailyTasks}
          notes={notes}
          onToggleDailyTask={handleToggleDailyTask}
          onAddDailyTask={handleAddDailyTask}
          onDeleteDailyTask={handleDeleteDailyTask}
        />

        {/* 3. Main Android Viewport Container (Scrollable) */}
        <main className="flex-1 w-full overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-3.5 pb-24 scroll-smooth">
          {currentView === 'dashboard' && (
            <DashboardView
              user={userProfile}
              expenses={expenses}
              notes={notes}
              vehicles={vehicles}
              chatRooms={chatRooms}
              onNavigate={(tab) => handleNavigateSafe(tab as AppView)}
              onOpenSearch={() => setIsSearchOpen(true)}
              onOpenVoiceSearch={() => setIsVoiceOpen(true)}
            />
          )}

          {currentView === 'notes' && (
            <NotesAndAccountingView
              language={language}
              notes={notes}
              folders={noteFolders}
              tags={noteTags}
              dailyTasks={dailyTasks}
              onUpdateNotes={(updated) => {
                setNotes(updated);
                NotesRepository.saveNotes(updated);
              }}
              onUpdateDailyTasks={handleUpdateDailyTasks}
              onToggleDailyTask={handleToggleDailyTask}
              onAddDailyTask={handleAddDailyTask}
              onDeleteDailyTask={handleDeleteDailyTask}
            />
          )}

          {currentView === 'calculator' && (
            <NotesAndAccountingView
              language={language}
              notes={notes}
              folders={noteFolders}
              tags={noteTags}
              dailyTasks={dailyTasks}
              initialTab="calculator"
              onUpdateNotes={(updated) => {
                setNotes(updated);
                NotesRepository.saveNotes(updated);
              }}
              onUpdateDailyTasks={handleUpdateDailyTasks}
              onToggleDailyTask={handleToggleDailyTask}
              onAddDailyTask={handleAddDailyTask}
              onDeleteDailyTask={handleDeleteDailyTask}
            />
          )}

          {currentView === 'expenses' && (
            <ExpensesView
              language={language}
              currency={userProfile.currency}
              expenses={expenses}
              userProfile={userProfile}
              onBackToHome={() => handleNavigateSafe('dashboard')}
              onUpdateExpenses={(updated) => {
                setExpenses(updated);
                ExpensesRepository.saveExpenses(updated);
              }}
            />
          )}

          {currentView === 'trips' && (
            <TripsView
              language={language}
              currency={userProfile.currency}
              favoritePlaces={favoritePlaces}
              recentTrips={recentTrips}
              onOpenVoiceSearch={() => setIsVoiceOpen(true)}
              onOpenWallet={() => handleNavigateSafe('wallet' as AppView)}
            />
          )}

          {currentView === 'wallet' && (
            <WalletView onOpenAdmin={() => handleNavigateSafe('admin-wallet' as AppView)} />
          )}

          {currentView === 'admin-wallet' && <AdminWalletPanel />}

          {currentView === 'vehicles' && (
            <VehiclesView
              language={language}
              currency={userProfile.currency}
              vehicles={vehicles}
              fuelRecords={fuelRecords}
              maintenanceRecords={maintenanceRecords}
              onUpdateVehicles={(updated) => {
                setVehicles(updated);
                VehiclesRepository.saveVehicles(updated);
              }}
              onUpdateFuel={(updated) => {
                setFuelRecords(updated);
                VehiclesRepository.saveFuelRecords(updated);
              }}
              onUpdateMaintenance={(updated) => {
                setMaintenanceRecords(updated);
                VehiclesRepository.saveMaintenanceRecords(updated);
              }}
            />
          )}

          {currentView === 'education' && (
            <EducationView
              language={language}
              currency={userProfile.currency}
              students={students}
              lessons={lessons}
              educationExpenses={educationExpenses}
              onUpdateStudents={(updated) => {
                setStudents(updated);
                EducationRepository.saveStudents(updated);
              }}
              onUpdateLessons={(updated) => {
                setLessons(updated);
                EducationRepository.saveLessons(updated);
              }}
              onUpdateEduExpenses={(updated) => {
                setEducationExpenses(updated);
                EducationRepository.saveEducationExpenses(updated);
              }}
            />
          )}

          {currentView === 'religious' && (
            <ReligiousView
              language={language}
              preference={userProfile.religiousPreference || 'islam'}
              athkarItems={athkarItems}
              onUpdateAthkar={(updated) => {
                setAthkarItems(updated);
                ReligiousRepository.saveAthkarItems(updated);
              }}
            />
          )}

          {currentView === 'vault' && (
            <SecureVaultView
              language={language}
              userPin={userProfile.pin || '1234'}
              secureRecords={secureRecords}
              onUpdateRecords={(updated) => {
                setSecureRecords(updated);
                VaultRepository.saveRecords(updated);
              }}
            />
          )}

          {currentView === 'calendar' && (
            <CalendarView language={language} timezone={Intl.DateTimeFormat().resolvedOptions().timeZone} />
          )}

          {currentView === 'ai' && (
            <AiCenterView
              language={language}
              onOpenVoiceSearch={() => setIsVoiceOpen(true)}
              initialInputText={voiceTranscript}
              appContext={{
                profile: userProfile,
                expenses,
                monthlyIncome,
                vehicles,
                fuelRecords,
                students,
                lessons,
                educationExpenses,
                notes,
                dailyTasks,
                recentTrips,
              }}
            />
          )}

          {currentView === 'chat' && (
            <HotChatView language={language} theme={theme} iconStyle={iconStyle} onNavigateHome={() => handleNavigate('dashboard')} />
          )}


          {currentView === 'media' && (
            <MediaCenterView
              language={language}
              folders={mediaFolders}
              mediaItems={mediaItems}
              onUpdateMedia={(updated) => {
                setMediaItems(updated);
                MediaRepository.saveItems(updated);
              }}
            />
          )}

          {currentView === 'sports' && (
            <SportsView user={userProfile} />
          )}

          {currentView === 'dashboard' && (
            <div className="mt-4">
              <LiveNewsPanel language={language} compact />
            </div>
          )}
        </main>

        {/* 4. Android Bottom Navigation Bar (Always visible inside Android container) */}
        <nav className="shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 flex items-center justify-around z-30 select-none">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => handleNavigateSafe(item.view)}
                className={`flex flex-col items-center justify-center p-1.5 rounded-2xl transition-all active:scale-95 ${
                  item.highlight
                    ? isActive
                      ? 'bg-gradient-to-tr from-accent-500 to-amber-500 text-slate-950 font-bold px-3.5 py-1.5 shadow-lg shadow-accent-500/30 -mt-3 ring-3 ring-white dark:ring-slate-900 scale-105'
                      : 'bg-gradient-to-tr from-accent-600 to-amber-600 text-slate-950 font-bold px-3.5 py-1.5 shadow-md shadow-accent-500/25 -mt-3 ring-3 ring-white dark:ring-slate-900 opacity-95'
                    : isActive
                    ? 'text-accent-600 dark:text-accent-400 font-bold bg-accent-500/10 dark:bg-accent-500/15 px-3'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 5. Android Bottom Home Gesture Pill Indicator */}
        <div className="w-full bg-white dark:bg-slate-900 py-1.5 flex justify-center items-center shrink-0 border-t border-slate-100/60 dark:border-slate-800/50">
          <div className="w-32 h-1 bg-slate-400/50 dark:bg-slate-600/60 rounded-full" />
        </div>

        {/* Universal Search Modal */}
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          language={language}
          notes={notes}
          expenses={expenses}
          vehicles={vehicles}
          lessons={lessons}
        />

        {/* Voice Search Modal */}
        <VoiceSearchModal
          isOpen={isVoiceOpen}
          onClose={() => setIsVoiceOpen(false)}
          language={language}
          onTranscript={handleVoiceTranscript}
        />

        {/* Settings & Backup Modal */}
        <SettingsAndBackupModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          language={language}
          theme={theme}
          colorTheme={colorTheme}
          iconStyle={iconStyle}
          onIconStyleChange={handleIconStyleChange}
          onColorThemeChange={handleColorThemeChange}
          userProfile={userProfile}
          onUpdateProfile={(updated) => {
            setUserProfile(updated);
            UserRepository.saveProfile(updated);
          }}
          onLanguageChange={handleLanguageChange}
          onThemeChange={handleThemeChange}
          onDataReset={handleResetData}
          onLogout={() => { void handleLogout(); }}
          isOwner={sessionRole === 'owner'}
        />

        {/* Universal Notifications Modal (مركز الإشعارات الشامل لكل الأقسام) */}
        <NotificationsModal
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          notifications={notifications}
          onMarkAsRead={(id) => {
            const updated = NotificationsRepository.markAsRead(id);
            setNotifications(updated);
          }}
          onMarkAllAsRead={() => {
            const updated = NotificationsRepository.markAllAsRead();
            setNotifications(updated);
          }}
          onDeleteNotification={(id) => {
            const updated = NotificationsRepository.deleteNotification(id);
            setNotifications(updated);
          }}
          onClearAll={() => {
            const updated = NotificationsRepository.clearAll();
            setNotifications(updated);
          }}
          onNavigateToSection={(tab) => {
            handleNavigate(tab as AppView);
            setIsNotificationsOpen(false);
          }}
          language={language}
        />
      </div>
    </div>
  );
}
