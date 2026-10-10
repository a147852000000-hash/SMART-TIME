import React, { useState, useEffect, useRef } from 'react';
import {
  CloudSun,
  Sparkles,
  Trophy,
  Coins,
  Calendar,
  Clock,
  TrendingUp,
  X,
  Flame,
  Star,
  Activity,
  Calculator,
  Bitcoin,
  ChevronRight,
  ShieldCheck,
  Home,
  Newspaper,
  ArrowRight,
  ArrowLeft,
  ListTodo,
  CheckCircle2,
  Circle,
  Plus,
  ExternalLink,
  BellRing,
} from 'lucide-react';
import { Language, UserProfile, DailyTask, TaskPriority, TaskCategory } from '../types';
import { NotesRepository } from '../services/repositories/notesRepository';
import { fetchLiveMarket, fetchLiveNews, fetchLiveSports, fetchLiveWeather, LiveMarketData, LiveNewsArticle, LiveSportsMatch, LiveWeatherData } from '../services/liveDataService';
import {
  MOCK_CRYPTO_RATES,
  MOCK_CURRENCY_GOLD_RATES,
  MOCK_SILVER_RATES,
  MOCK_GOLD_KARAT_RATES,
  MOCK_EGYPTIAN_LEAGUE_MATCHES,
  EGYPTIAN_LEAGUE_STANDINGS,
  GLOBAL_FOOTBALL_MATCHES,
  getMatchForFavoriteTeam,
  EXTENDED_CRYPTO_DATABASE,
  CryptoMarketItem,
  getZodiacDailyTip,
  calculateUserAge,
  getUserZodiac,
  getHijriDate,
  getGregorianDate,
} from '../utils/liveInfoHelpers';

interface LiveHeaderWidgetsProps {
  user: UserProfile;
  language: Language;
  onGoHome?: () => void;
  isHomeActive?: boolean;
  dailyTasks?: DailyTask[];
  onToggleDailyTask?: (id: string) => void;
  onAddDailyTask?: (task: Omit<DailyTask, 'id' | 'createdAt'>) => void;
  onNavigate?: (tab: string) => void;
}

export const LiveHeaderWidgets: React.FC<LiveHeaderWidgetsProps> = ({
  user,
  language,
  onGoHome,
  isHomeActive = false,
  dailyTasks,
  onToggleDailyTask,
  onAddDailyTask,
  onNavigate,
}) => {
  const [now, setNow] = useState(new Date());
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [silverCalcGrams, setSilverCalcGrams] = useState<number>(10);
  const [goldCalcGrams, setGoldCalcGrams] = useState<number>(10);
  const [goldCalcKarat, setGoldCalcKarat] = useState<string>('21');
  const [liveMarket, setLiveMarket] = useState<LiveMarketData | null>(null);
  const [liveNews, setLiveNews] = useState<LiveNewsArticle[]>([]);
  const [liveSports, setLiveSports] = useState<LiveSportsMatch[]>([]);
  const [liveWeather, setLiveWeather] = useState<LiveWeatherData | null>(null);
  const pointerDownTimeRef = useRef(0);

  // مهام وتنبيهات قسم ذكرني (المهمات اليومية)
  const [localDailyTasks, setLocalDailyTasks] = useState<DailyTask[]>(() => {
    if (dailyTasks && dailyTasks.length > 0) return dailyTasks;
    try {
      return NotesRepository.getDailyTasks();
    } catch {
      return [];
    }
  });

  // مزامنة المهام عند تحديث الـ props
  useEffect(() => {
    if (dailyTasks) {
      setLocalDailyTasks(dailyTasks);
    }
  }, [dailyTasks]);

  // حالة المهام التفاعلية في النافذة المنبثقة
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<DailyTask | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState<TaskPriority>('medium');
  const [quickTaskDueTime, setQuickTaskDueTime] = useState('');
  const [taskFilter, setTaskFilter] = useState<'pending' | 'all'>('pending');

  const pendingDailyTasks = localDailyTasks.filter((t) => !t.completed);
  const completedDailyTasks = localDailyTasks.filter((t) => t.completed);

  const handleToggleTask = (taskId: string) => {
    if (onToggleDailyTask) {
      onToggleDailyTask(taskId);
    }
    const updated = localDailyTasks.map((t) =>
      t.id === taskId
        ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }
        : t
    );
    setLocalDailyTasks(updated);
    try {
      NotesRepository.saveDailyTasks(updated);
    } catch (e) {
      // ignore
    }
  };

  const handleCreateQuickTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    const newTask: Omit<DailyTask, 'id' | 'createdAt'> = {
      title: quickTaskTitle.trim(),
      completed: false,
      priority: quickTaskPriority,
      category: 'general' as TaskCategory,
      dueTime: quickTaskDueTime || undefined,
      dueDate: new Date().toISOString().split('T')[0],
      reminderEnabled: true,
    };
    if (onAddDailyTask) {
      onAddDailyTask(newTask);
    }
    const created = NotesRepository.addDailyTask(newTask);
    setLocalDailyTasks(created);
    setQuickTaskTitle('');
    setQuickTaskDueTime('');
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Live Internet feed: market data is refreshed frequently, news/scores on their natural cadence.
  useEffect(() => {
    let mounted = true;
    const refreshMarket = async () => { const data = await fetchLiveMarket(); if (mounted && data) setLiveMarket(data); };
    const refreshNews = async () => { const data = await fetchLiveNews(language); if (mounted && data.length) setLiveNews(data); };
    const refreshSports = async () => { const data = await fetchLiveSports(); if (mounted && data.length) setLiveSports(data); };
    const refreshWeather = async () => { const data = await fetchLiveWeather(user.city || 'Cairo'); if (mounted && data) setLiveWeather(data); };
    refreshMarket(); refreshNews(); refreshSports(); refreshWeather();
    const marketTimer = window.setInterval(refreshMarket, 60_000);
    const newsTimer = window.setInterval(refreshNews, 300_000);
    const sportsTimer = window.setInterval(refreshSports, 15_000);
    const weatherTimer = window.setInterval(refreshWeather, 600_000);
    return () => { mounted = false; window.clearInterval(marketTimer); window.clearInterval(newsTimer); window.clearInterval(sportsTimer); window.clearInterval(weatherTimer); };
  }, [language, user.city]);

  const isAr = language === 'ar';
  const age = calculateUserAge(user.birthDate);
  const zodiac = getUserZodiac(user.birthDate);
  const hijri = getHijriDate(now, language);
  const gregorian = getGregorianDate(now, language);

  const formattedTime = now.toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // تفضيلات الشريط من الملف الشخصي مع قيم افتراضية متكاملة
  const prefs = user.tickerPreferences || {
    showDailyTasks: true,
    showZakkirni: true,
    showTimeAndDate: true,
    showGold: true,
    showSilver: true,
    showZodiac: true,
    showEgyptianLeague: true,
    showCrypto: true,
    showCurrencies: true,
    showWeather: true,
    showCustomMessage: true,
    customMessage: 'وقتك من ذهب ⏳ استثمر يومك في طاعة الله والإنجاز',
    favoriteEgyptianTeam: 'الأهلي',
    silverUnit: '999',
    goldUnit: '21',
    selectedCryptos: ['BTC', 'ETH', 'SOL'],
    speed: 'slow',
  };

  // سرعة حركة شريط الأخبار المريح
  const getTickerDuration = () => {
    switch (prefs.speed) {
      case 'very_slow':
        return '55s';
      case 'medium':
        return '26s';
      case 'fast':
        return '17s';
      case 'slow':
      default:
        return '38s';
    }
  };

  const usdLive = liveMarket?.currencies?.EGP;
  const usdRate = usdLive ? { ...MOCK_CURRENCY_GOLD_RATES[0], rate: usdLive } : MOCK_CURRENCY_GOLD_RATES[0];
  const sarRate = liveMarket?.currencies?.SAR && usdLive
    ? { pair: 'SAR / EGP', rate: usdLive / liveMarket.currencies.SAR, unit: 'ج.م', change: 0 }
    : (MOCK_CURRENCY_GOLD_RATES[4] || { pair: 'SAR / EGP', rate: 13.05, unit: 'ج.م', change: 0.02 });
  const aedRate = liveMarket?.currencies?.AED && usdLive
    ? { pair: 'AED / EGP', rate: usdLive / liveMarket.currencies.AED, unit: 'ج.م', change: 0 }
    : (MOCK_CURRENCY_GOLD_RATES[5] || { pair: 'AED / EGP', rate: 13.34, unit: 'ج.م', change: 0.03 });
  const liveGoldUsdOz = Number(liveMarket?.gold?.price ?? liveMarket?.gold?.priceUsd ?? liveMarket?.gold?.value ?? 0);
  const liveSilverUsdOz = Number(liveMarket?.silver?.price ?? liveMarket?.silver?.priceUsd ?? liveMarket?.silver?.value ?? 0);
  const liveGoldGramEgp = liveGoldUsdOz > 0 && usdLive ? (liveGoldUsdOz * usdLive) / 31.1034768 : null;
  const liveSilverGramEgp = liveSilverUsdOz > 0 && usdLive ? (liveSilverUsdOz * usdLive) / 31.1034768 : null;

  // Build the complete gold/silver tables from the live international feed.
  // Mock values remain only as a safe fallback when the internet feed is unavailable.
  const goldBase = liveGoldGramEgp || MOCK_GOLD_KARAT_RATES.find((g) => g.id === '24')?.priceEgp || 0;
  const liveGoldKaratRates = MOCK_GOLD_KARAT_RATES.map((item) => {
    const karat = Number(item.karat);
    let priceEgp = item.priceEgp;
    if (Number.isFinite(karat) && karat > 0 && karat <= 24 && goldBase > 0) {
      priceEgp = goldBase * (karat / 24);
    } else if (item.id === 'pound' && goldBase > 0) {
      priceEgp = goldBase * 21 / 24 * 8;
    } else if (item.id === 'half_pound' && goldBase > 0) {
      priceEgp = goldBase * 21 / 24 * 4;
    } else if (item.id === 'quarter_pound' && goldBase > 0) {
      priceEgp = goldBase * 21 / 24 * 2;
    } else if (item.id === 'ounce' && liveGoldUsdOz > 0) {
      priceEgp = liveGoldUsdOz * (usdLive || 0);
    } else if (item.id === 'bar10g' && goldBase > 0) {
      priceEgp = goldBase * 10;
    } else if (item.id === 'bar50g' && goldBase > 0) {
      priceEgp = goldBase * 50;
    }
    return { ...item, priceEgp, rateEgp: priceEgp || item.rateEgp, priceUsd: item.id === 'ounce' && liveGoldUsdOz > 0 ? liveGoldUsdOz : item.priceUsd };
  });
  const silverBase = liveSilverGramEgp || MOCK_SILVER_RATES[0].rateEgp;
  const liveSilverRates = MOCK_SILVER_RATES.map((item) => {
    let rateEgp = item.rateEgp;
    if (item.id === 'silver_999') rateEgp = silverBase;
    if (item.id === 'silver_925') rateEgp = silverBase * 0.925;
    if (item.id === 'silver_800') rateEgp = silverBase * 0.8;
    if (item.id === 'silver_oz' && liveSilverUsdOz > 0) rateEgp = liveSilverUsdOz * (usdLive || 0);
    return { ...item, rateEgp, rateUsd: item.id === 'silver_oz' && liveSilverUsdOz > 0 ? liveSilverUsdOz : item.rateUsd };
  });
  const marketIsLive = Boolean(liveMarket && liveGoldUsdOz > 0 && usdLive);
  const weatherIsLive = Boolean(liveWeather);
  const weatherLabel = (code: number) => {
    if ([0, 1].includes(code)) return isAr ? 'صافي' : 'Clear';
    if ([2, 3].includes(code)) return isAr ? 'غائم جزئياً' : 'Partly cloudy';
    if ([45, 48].includes(code)) return isAr ? 'ضباب' : 'Fog';
    if ([51, 53, 55, 56, 57].includes(code)) return isAr ? 'رذاذ' : 'Drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return isAr ? 'أمطار' : 'Rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return isAr ? 'ثلوج' : 'Snow';
    if ([95, 96, 99].includes(code)) return isAr ? 'عواصف رعدية' : 'Thunderstorm';
    return isAr ? 'متغير' : 'Variable';
  };
  
  // أسعار الذهب حسب اختيار المستخدم مع دعم كافة العيارات والسبائك
  const isAllGold = prefs.goldUnit === 'all';
  const selectedGoldItems = isAllGold
    ? [
        liveGoldKaratRates.find((g) => g.id === '21')!,
        liveGoldKaratRates.find((g) => g.id === '24')!,
        liveGoldKaratRates.find((g) => g.id === '18')!,
        liveGoldKaratRates.find((g) => g.id === 'pound')!,
      ].filter(Boolean)
    : [
        liveGoldKaratRates.find((g) => g.id === (prefs.goldUnit || '21')) ||
          MOCK_GOLD_KARAT_RATES[2],
      ];

  // العملات المشفرة المختارة في تفضيلات المستخدم (تشمل العملات المضافة والمختارة من النت)
  const userCryptoSymbols = (prefs.selectedCryptos && prefs.selectedCryptos.length > 0)
    ? prefs.selectedCryptos
    : ['BTC', 'ETH', 'SOL'];

  const allKnownCryptosMap = new Map<string, CryptoMarketItem>();
  EXTENDED_CRYPTO_DATABASE.forEach((c) => allKnownCryptosMap.set(c.symbol, c));
  (prefs.customCryptos || []).forEach((c) => allKnownCryptosMap.set(c.symbol, c));

  const selectedCryptosList: CryptoMarketItem[] = userCryptoSymbols.map((sym) => {
    return (
      allKnownCryptosMap.get(sym) || {
        id: sym.toLowerCase(),
        name: sym,
        nameAr: sym,
        nameEn: sym,
        symbol: sym,
        priceUsd: 1.0,
        change24h: 1.5,
        iconColor: '#f59e0b',
        iconSymbol: '🪙',
      }
    );
  });

  // أسعار الفضة حسب اختيار المستخدم
  const silverRate999 = liveSilverRates[0];
  const silverRate925 = liveSilverRates[1];
  const silverRateOz = liveSilverRates[3];
  const selectedSilver = prefs.silverUnit === '925' 
    ? silverRate925 
    : prefs.silverUnit === 'ounce' 
    ? silverRateOz 
    : silverRate999;

  // نصيحة وبرج المستخدم
  const zodiacTip = getZodiacDailyTip(user.zodiacSign || zodiac.nameAr, isAr);

  // مباريات فريقك المفضل (دعم الأندية العالمية والمحلية)
  const favTeam = prefs.favoriteTeam || prefs.favoriteEgyptianTeam || 'الأهلي';
  const liveFavoriteMatch = liveSports.find((m) => {
    const home = m.teams?.home?.name || '';
    const away = m.teams?.away?.name || '';
    const fav = favTeam.toLowerCase();
    return home.toLowerCase().includes(fav) || away.toLowerCase().includes(fav) || fav.includes(home.toLowerCase()) || fav.includes(away.toLowerCase());
  });
  const highlightedMatch = liveFavoriteMatch
    ? { id: String(liveFavoriteMatch.fixture?.id || 'live-favorite'), homeTeam: liveFavoriteMatch.teams?.home?.name || favTeam, awayTeam: liveFavoriteMatch.teams?.away?.name || '—', homeScore: liveFavoriteMatch.goals?.home ?? 0, awayScore: liveFavoriteMatch.goals?.away ?? 0, leagueNameAr: liveFavoriteMatch.league?.name || 'مباشر', leagueNameEn: liveFavoriteMatch.league?.name || 'Live' }
    : getMatchForFavoriteTeam(favTeam);
  const otherMatches = GLOBAL_FOOTBALL_MATCHES.filter((m) => m.id !== highlightedMatch.id);

  // يتوقف الشريط فقط عند الوقوف عليه بالماوس أو الضغط واللمس بالأصبع
  const isPaused = isInteracting || activeModal !== null;

  const handleItemClick = (modalType: string) => {
    const pressDuration = Date.now() - pointerDownTimeRef.current;
    if (pressDuration < 280) {
      setActiveModal(modalType);
    }
  };

  // دالة تصيير الأرقام والبيانات في شريط الأخبار المباشرة
  const renderTickerItems = (keyPrefix: string) => (
    <div key={keyPrefix} className="flex items-center gap-3 px-3 shrink-0 whitespace-nowrap text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-[13px] font-mono leading-normal">
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] sm:text-[11px] font-black tracking-wide ${marketIsLive ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400'}`} title={marketIsLive ? (isAr ? 'بيانات السوق من الإنترنت' : 'Internet market feed') : (isAr ? 'البيانات الحية غير متاحة حالياً — يتم استخدام آخر قيم احتياطية' : 'Live feed unavailable — fallback values are shown')}>
        <span className={`w-2 h-2 rounded-full ${marketIsLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
        {marketIsLive ? (isAr ? 'مباشر' : 'LIVE') : (isAr ? 'احتياطي' : 'FALLBACK')}
      </span>
      
      {/* 0. مهام وتنبيهات قسم ذكرني (Zakkirni Reminders & Tasks) */}
      {prefs.showDailyTasks !== false && prefs.showZakkirni !== false && (
        <>
          {pendingDailyTasks.length > 0 ? (
            pendingDailyTasks.slice(0, 6).map((task) => {
              const isHigh = task.priority === 'high';
              const isMed = task.priority === 'medium';
              return (
                <React.Fragment key={`ticker-task-${task.id}`}>
                  <button
                    onClick={() => {
                      setSelectedTaskForModal(task);
                      setActiveModal('zakkirni');
                    }}
                    className={`flex items-center gap-1.5 hover:scale-[1.03] cursor-pointer active:scale-95 transition-all shrink-0 px-2.5 py-1 rounded-lg border shadow-2xs group ${
                      isHigh
                        ? 'bg-rose-50/90 dark:bg-rose-950/60 border-rose-300 dark:border-rose-900/70 text-rose-900 dark:text-rose-200'
                        : isMed
                        ? 'bg-amber-50/90 dark:bg-amber-950/60 border-amber-300 dark:border-amber-900/70 text-amber-900 dark:text-amber-200'
                        : 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-900/70 text-emerald-900 dark:text-emerald-200'
                    }`}
                    title={isAr ? `تذكير ذكرني: ${task.title} — انقر لعرض التفاصيل أو إكمال المهمة` : `Zakkirni Task: ${task.title}`}
                  >
                    <span className="flex items-center gap-1 font-black text-xs font-sans">
                      <BellRing className={`w-3.5 h-3.5 shrink-0 ${isHigh ? 'text-rose-500 animate-pulse' : isMed ? 'text-amber-500' : 'text-emerald-500'}`} />
                      <span className={isHigh ? 'text-rose-700 dark:text-rose-400' : isMed ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}>
                        {isAr ? 'ذكرني:' : 'Remind:'}
                      </span>
                    </span>
                    <span className="text-xs font-bold font-sans max-w-[180px] sm:max-w-[260px] truncate text-slate-900 dark:text-white">
                      {task.title}
                    </span>
                    {task.dueTime && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <Clock className="w-2.5 h-2.5 text-amber-500" />
                        {task.dueTime}
                      </span>
                    )}
                    <span
                      className={`text-[9px] font-sans font-black px-1.5 py-0.5 rounded border ${
                        isHigh
                          ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30'
                          : isMed
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {isHigh ? (isAr ? 'عاجل' : 'High') : isMed ? (isAr ? 'مهم' : 'Med') : (isAr ? 'عادي' : 'Low')}
                    </span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>
                </React.Fragment>
              );
            })
          ) : (
            <>
              <button
                onClick={() => {
                  setSelectedTaskForModal(null);
                  setActiveModal('zakkirni');
                }}
                className="flex items-center gap-1.5 hover:scale-[1.03] cursor-pointer active:scale-95 transition-all shrink-0 bg-emerald-50/80 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 shadow-2xs"
                title={isAr ? 'ذكرني: لا توجد مهام معلقة — انقر لإضافة مهمة أو فتح المفكرة' : 'Zakkirni: All caught up!'}
              >
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1 font-sans">
                  <span>✨</span>
                  <span>{isAr ? 'ذكرني:' : 'Zakkirni:'}</span>
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-sans">
                  {isAr ? 'تم إنجاز كافة مهام اليوم بنجاح 👏' : 'All today tasks completed 👏'}
                </span>
              </button>
              <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>
            </>
          )}
        </>
      )}

      {/* 1. التاريخ الهجري والميلادي */}
      {prefs.showTimeAndDate !== false && (
        <>
          <button
            onClick={() => handleItemClick('time')}
            className="flex items-center gap-1.5 hover:text-accent-500 cursor-pointer active:scale-95 transition-colors shrink-0"
            title={isAr ? 'التاريخ والتقويم (هجري وميلادي)' : 'Date & Calendar'}
          >
            <Calendar className="w-3.5 h-3.5 text-accent-500 shrink-0" />
            <span className="text-xs text-accent-600 dark:text-accent-400 font-sans font-bold">
              {hijri}
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-sans font-medium">
              {gregorian}
            </span>
          </button>
          <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>
        </>
      )}

      {/* 2. سعر الفضة (جديد ومربوط بالملف الشخصي) */}
      {prefs.showSilver !== false && (
        <>
          <button
            onClick={() => handleItemClick('silver')}
            className="flex items-center gap-1.5 hover:text-slate-400 cursor-pointer active:scale-95 transition-colors shrink-0 bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700"
            title={isAr ? 'أسعار الفضة' : 'Silver Rates'}
          >
            <span className="text-slate-400 font-bold text-sm">🥈</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-sans">
              {isAr ? 'الفضة' : 'Silver'} ({selectedSilver.karat}):
            </span>
            <span className="font-bold font-mono text-slate-900 dark:text-white text-xs sm:text-[13px]">
              {prefs.silverUnit === 'ounce' ? `$${selectedSilver.rateUsd}` : `${selectedSilver.rateEgp} ج.م`}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
              +{selectedSilver.change}%
            </span>
          </button>
          <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>
        </>
      )}

      {/* 3. أسعار الذهب (دعم جميع العيارات والجنيه والسبائك) */}
      {prefs.showGold !== false && (
        <>
          {selectedGoldItems.map((goldItem) => (
            <React.Fragment key={goldItem.id}>
              <button
                onClick={() => handleItemClick('gold')}
                className="flex items-center gap-1.5 hover:text-accent-500 cursor-pointer active:scale-95 transition-colors shrink-0 bg-accent-50/80 dark:bg-accent-950/50 px-2.5 py-1 rounded-lg border border-accent-200 dark:border-accent-900/60"
                title={isAr ? `ذهب ${goldItem.nameAr} - انقر لعرض جميع العيارات وحاسبة الجرام` : `Gold ${goldItem.nameEn} - Click for all karats & calculator`}
              >
                <span className="text-accent-500 font-bold text-sm">🥇</span>
                <span className="text-xs font-bold text-accent-700 dark:text-accent-300 font-sans">
                  {isAr ? goldItem.nameAr : goldItem.nameEn}:
                </span>
                <span className="font-bold font-mono text-accent-950 dark:text-accent-200 text-xs sm:text-[13px]">
                  {liveGoldGramEgp ? `${Math.round(liveGoldGramEgp * (goldItem.id === '24' ? 1 : goldItem.id === '21' ? 21/24 : goldItem.id === '18' ? 18/24 : 1)).toLocaleString()} ج.م` : (goldItem.priceEgp ? `${goldItem.priceEgp.toLocaleString()} ج.م` : `$${goldItem.priceUsd}`)}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                  +{goldItem.change24h}
                </span>
              </button>
              <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>
            </React.Fragment>
          ))}
        </>
      )}

      {/* 4. مباراة فريقك المفضل (أندية عالمية ومحلية) */}
      {(prefs.showEgyptianLeague !== false || prefs.showFavoriteTeam !== false) && (
        <>
          <button
            onClick={() => handleItemClick('league')}
            className="flex items-center gap-1.5 hover:text-emerald-500 cursor-pointer active:scale-95 transition-colors shrink-0 bg-emerald-50/80 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/60"
            title={isAr ? `فريقك المفضل (${favTeam}) - انقر لعرض جدول المباريات` : `Favorite Team (${favTeam}) - Click for scores`}
          >
            <Trophy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 font-sans">
              {isAr ? 'فريقك المفضل' : 'Favorite'}:
            </span>
            <span className="font-bold font-sans text-slate-900 dark:text-white flex items-center gap-1.5 text-xs sm:text-[13px]">
              <span className={highlightMatchStyles(highlightedMatch.homeTeam, favTeam)}>
                {highlightedMatch.homeTeam}
              </span>
              <span className="font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-xs text-emerald-600 font-bold shadow-2xs">
                {highlightedMatch.homeScore} - {highlightedMatch.awayScore}
              </span>
              <span className={highlightMatchStyles(highlightedMatch.awayTeam, favTeam)}>
                {highlightedMatch.awayTeam}
              </span>
            </span>
            {highlightedMatch.leagueNameAr && (
              <span className="hidden sm:inline-flex items-center text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded font-sans font-bold">
                {isAr ? highlightedMatch.leagueNameAr : highlightedMatch.leagueNameEn}
              </span>
            )}
            {otherMatches[0] && (
              <span className="hidden md:inline-flex items-center gap-1 text-xs text-slate-500 font-sans ps-1 border-s border-emerald-200 dark:border-emerald-800">
                <span>{liveSports[0]?.teams?.home?.name || otherMatches[0].homeTeam} {liveSports[0]?.goals?.home ?? otherMatches[0].homeScore}-{liveSports[0]?.goals?.away ?? otherMatches[0].awayScore} {liveSports[0]?.teams?.away?.name || otherMatches[0].awayTeam}</span>
              </span>
            )}
          </button>
          <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>
        </>
      )}

      {/* 5. برج وعمر المستخدم مع طاقة اليوم */}
      {prefs.showZodiac !== false && (
        <>
          <button
            onClick={() => handleItemClick('zodiac')}
            className="flex items-center gap-1.5 hover:text-purple-500 cursor-pointer active:scale-95 transition-colors shrink-0 bg-purple-50/80 dark:bg-purple-950/50 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-900/60"
            title={isAr ? 'برج وعمر المستخدم وطاقة اليوم' : 'User Zodiac, Age & Energy'}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="font-bold text-xs text-purple-700 dark:text-purple-300 font-sans">
              {user.zodiacSign || zodiac.nameAr} {zodiac.symbol} • {age.years} {isAr ? 'سنة' : 'yrs'}:
            </span>
            <span className="text-xs text-purple-950 dark:text-purple-200 font-sans font-medium max-w-[160px] truncate">
              {zodiacTip}
            </span>
          </button>
          <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>
        </>
      )}

      {/* 5.5 أهم الأخبار المحلية */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0 font-sans"
        title={isAr ? 'أهم الأخبار المحلية' : 'Local News Headlines'}
      >
        <Newspaper className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <span className="font-bold text-xs">
          {isAr ? '📰 أخبار مباشرة:' : '📰 Live News:'}
        </span>
        <span className="text-xs text-slate-800 dark:text-slate-200 font-medium max-w-[210px] truncate">
          {liveNews[0]?.title || (isAr ? 'جاري تحميل الأخبار من الإنترنت…' : 'Loading live news…')}
        </span>
      </div>
      <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>

      {/* 6. العملات المشفرة الرقمية (اختيار المستخدم) */}
      {prefs.showCrypto !== false && (
        <>
          {selectedCryptosList.map((cryptoCoin) => (
            <React.Fragment key={cryptoCoin.id}>
              <button
                onClick={() => handleItemClick('crypto')}
                className="flex items-center gap-1.5 hover:text-accent-500 cursor-pointer active:scale-95 transition-colors shrink-0 bg-accent-500/10 dark:bg-accent-500/15 px-2 py-1 rounded-lg border border-accent-500/20"
                title={isAr ? `${cryptoCoin.nameAr} (${cryptoCoin.symbol}) - انقر لعرض قائمة العملات المشفرة` : `${cryptoCoin.nameEn} - Click for crypto market`}
              >
                <span className="text-accent-500 font-black text-xs">{cryptoCoin.iconSymbol || '🪙'}</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                  {cryptoCoin.symbol}:
                </span>
                <span className="font-bold font-mono text-slate-900 dark:text-white text-xs sm:text-[13px]">
                  ${(() => { const idMap: Record<string,string> = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple' }; const v = liveMarket?.crypto?.[idMap[cryptoCoin.symbol]]?.usd; return (v ?? cryptoCoin.priceUsd).toLocaleString(undefined, { maximumFractionDigits: 8 }); })()}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold ${
                    cryptoCoin.change24h >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-500'
                  }`}
                >
                  {cryptoCoin.change24h >= 0 ? `+${cryptoCoin.change24h}%` : `${cryptoCoin.change24h}%`}
                </span>
              </button>
              <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>
            </React.Fragment>
          ))}
        </>
      )}

      {/* 7. العملات الأساسية (USD, SAR, AED) */}
      {prefs.showCurrencies !== false && (
        <>
          <button
            onClick={() => handleItemClick('rates')}
            className="flex items-center gap-1 hover:text-emerald-500 cursor-pointer active:scale-95 transition-colors shrink-0"
            title={isAr ? 'سعر صرف الدولار' : 'USD Rate'}
          >
            <span className="text-emerald-600 font-bold text-xs">$</span>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              USD:
            </span>
            <span className="font-bold font-mono text-slate-900 dark:text-white text-xs sm:text-[13px]">
              {usdRate.rate}
            </span>
          </button>

          <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>

          <button
            onClick={() => handleItemClick('rates')}
            className="flex items-center gap-1 hover:text-emerald-500 cursor-pointer active:scale-95 transition-colors shrink-0"
            title={isAr ? 'الريال السعودي' : 'SAR Rate'}
          >
            <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              SAR:
            </span>
            <span className="font-bold font-mono text-slate-900 dark:text-white text-xs sm:text-[13px]">
              {sarRate.rate}
            </span>
          </button>

          <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>

          <button
            onClick={() => handleItemClick('rates')}
            className="flex items-center gap-1 hover:text-emerald-500 cursor-pointer active:scale-95 transition-colors shrink-0"
            title={isAr ? 'الدرهم الإماراتي' : 'AED Rate'}
          >
            <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              AED:
            </span>
            <span className="font-bold font-mono text-slate-900 dark:text-white text-xs sm:text-[13px]">
              {aedRate.rate}
            </span>
          </button>

          <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>
        </>
      )}

      {/* 8. الطقس والحرارة */}
      {prefs.showWeather !== false && (
        <>
          <button
            onClick={() => handleItemClick('weather')}
            className="flex items-center gap-1.5 hover:text-sky-500 cursor-pointer active:scale-95 transition-colors shrink-0"
            title={isAr ? 'الطقس' : 'Weather'}
          >
            <CloudSun className="w-4 h-4 text-accent-500" />
            <span className="font-bold font-mono text-sky-600 dark:text-sky-400 text-xs sm:text-[13px]">
              {weatherIsLive ? `${Math.round(liveWeather!.temperatureC)}°C` : '—'}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-sans">
              {user.city || (isAr ? 'القاهرة' : 'Cairo')}
            </span>
          </button>
          <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>
        </>
      )}

      {/* 9. عبارة المستخدم المخصصة */}
      {prefs.showCustomMessage && prefs.customMessage && (
        <>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-500/15 text-accent-700 dark:text-accent-300 text-xs font-sans font-bold shrink-0">
            <span>📢</span>
            <span>{prefs.customMessage}</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* حاوية شريط الأخبار: زر الشعار الثابت على اليمين مع بقاء حركة الشريط */}
      <div
        className="relative w-full overflow-hidden select-none flex items-center bg-slate-50/90 dark:bg-slate-900/90 border-y border-slate-200/70 dark:border-slate-800/70 rounded-xl"
        id="live-ticker-strip-container"
        dir="rtl"
      >
        {/* أيقونة الشعار الرسمية الفاخرة الثابتة على اليمين */}
        <div className="z-20 shrink-0 flex items-center px-2 py-0.5 bg-slate-100/95 dark:bg-slate-900/95 border-l border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <button
            onClick={onGoHome}
            className={`flex items-center justify-center p-1 px-2 rounded-xl transition-all shadow-xs active:scale-95 shrink-0 ${
              isHomeActive
                ? 'bg-accent-500/20 ring-1.5 ring-accent-500 shadow-accent-500/25'
                : 'bg-white/80 dark:bg-slate-800/80 hover:bg-accent-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/80 hover:border-accent-400/60'
            }`}
            title={isAr ? 'شعار SMART TIME — انقر للرجوع للشاشة الرئيسية' : 'SMART TIME Logo — Click to go to Dashboard'}
            id="ticker-fixed-logo-btn"
          >
            {/* الشعار بدون smart time gold: أيقونة الشعار عريضة وواضحة جداً بخلفية شفافة */}
            <img
              src="/emblem-icon-glow.png"
              alt="شعار البرنامج"
              className="h-7 sm:h-8 w-auto min-w-[36px] sm:min-w-[42px] object-contain drop-shadow-sm hover:scale-105 transition-transform"
            />
          </button>
          
          {/* سهم اتجاه الحركة متجهاً لليمين */}
          <div
            className="me-1.5 flex items-center justify-center text-accent-500 font-bold select-none"
            title={isAr ? 'حركة شريط الأخبار والأسعار لليمين' : 'Live news moving right'}
          >
            <ArrowRight className="w-3.5 h-3.5 text-accent-500 animate-pulse shrink-0 stroke-[2.5]" />
          </div>
        </div>

        {/* مسار الأخبار المتحركة */}
        <div
          className="relative flex-1 overflow-hidden min-w-0 py-0.5"
          dir="ltr"
          onPointerDown={() => {
            pointerDownTimeRef.current = Date.now();
            setIsInteracting(true);
          }}
          onPointerUp={() => {
            setIsInteracting(false);
          }}
          onPointerCancel={() => setIsInteracting(false)}
          onPointerLeave={() => setIsInteracting(false)}
          onTouchStart={() => {
            pointerDownTimeRef.current = Date.now();
            setIsInteracting(true);
          }}
          onTouchEnd={() => {
            setIsInteracting(false);
          }}
          onTouchCancel={() => setIsInteracting(false)}
          onMouseEnter={() => setIsInteracting(true)}
          onMouseLeave={() => setIsInteracting(false)}
          title={
            isAr
              ? 'شريط الأخبار المخصص — اضغط للتوقف، وانقر على أي عنصر لمعرفة تفاصيله'
              : 'Customized Live Ticker — Press to hold, click any item for details'
          }
        >
          {/* تدرج تلاشي ناعم بجانب زر الشعار في اليمين */}
          <div
            className="absolute top-0 bottom-0 right-0 z-10 w-4 pointer-events-none bg-gradient-to-l from-slate-100 dark:from-slate-900 to-transparent"
          />

          {/* شريط التحريك المعكوس باتجاه اليمين */}
          <div
            className="flex items-center animate-marquee-right"
            style={{
              animationPlayState: isPaused ? 'paused' : 'running',
              animationDuration: getTickerDuration(),
            }}
          >
            {renderTickerItems('track-a')}
            {renderTickerItems('track-b')}
          </div>
        </div>
      </div>

      {/* نافذة تفاصيل الفضة المنبثقة (Silver Modal) */}
      {activeModal === 'silver' && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🥈</span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {isAr ? 'أسعار الفضة اليوم' : 'Silver Prices Today'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {isAr ? 'تحديث لحظي لعيارات الفضة والأونصة العالمية' : 'Live rates & ounce prices'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* بطاقات أسعار الفضة بالعيار */}
            <div className="space-y-2 mb-4">
              {liveSilverRates.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50"
                >
                  <div>
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      {isAr ? item.titleAr : item.titleEn}
                    </span>
                    <div className="text-[10px] text-slate-400">
                      {item.karat === 'Ounce' ? 'XAG / USD' : `${isAr ? 'عيار' : 'Karat'} ${item.karat}`}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="font-bold font-mono text-xs text-slate-900 dark:text-white">
                      {item.rateUsd ? `$${item.rateUsd}` : `${item.rateEgp} ج.م`}
                    </div>
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono">
                      +{item.change}% اليوم
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* حاسبة جرامات الفضة التفاعلية */}
            <div className="p-3 bg-accent-500/10 rounded-2xl border border-accent-500/20 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-accent-700 dark:text-accent-400 mb-2">
                <Calculator className="w-3.5 h-3.5" />
                <span>{isAr ? 'حاسبة قيمة الفضة السريعة' : 'Quick Silver Value'}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={silverCalcGrams}
                  onChange={(e) => setSilverCalcGrams(Math.max(1, Number(e.target.value)))}
                  className="w-20 p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-center font-bold text-xs"
                />
                <span className="text-slate-500">{isAr ? 'جرام فضة 999 =' : 'grams 999 ='}</span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                  {(silverCalcGrams * silverRate999.rateEgp).toLocaleString()} ج.م
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل الدوري والمباريات العالمية والمحلية (League Modal) */}
      {activeModal === 'league' && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  ⚽
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {isAr ? `مباريات اليوم وفريقك المفضل (${favTeam})` : `Matches & Favorite Club (${favTeam})`}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {isAr ? 'تغطية حية لأهم أندية العالم والبطولات المحلية والدولية' : 'Live coverage of global and local leagues'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* مباريات الجولة وأبرز المباريات العالمية والمحلية */}
            <div className="mb-4">
              <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{isAr ? 'أهم المباريات والنتائج' : 'Key Match Fixtures'}</span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {favTeam ? (isAr ? `فريقك: ${favTeam} ⭐` : `Team: ${favTeam} ⭐`) : ''}
                </span>
              </h4>
              <div className="space-y-2">
                {GLOBAL_FOOTBALL_MATCHES.map((match) => {
                  const isFav =
                    (favTeam && match.homeTeam.toLowerCase().includes(favTeam.toLowerCase())) ||
                    (favTeam && match.awayTeam.toLowerCase().includes(favTeam.toLowerCase()));
                  return (
                    <div
                      key={match.id}
                      className={`p-2.5 rounded-2xl border transition-all ${
                        isFav
                          ? 'bg-accent-50/70 dark:bg-accent-950/30 border-accent-400 dark:border-accent-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                        <span className="font-semibold flex items-center gap-1.5">
                          {match.leagueNameAr && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                              {isAr ? match.leagueNameAr : match.leagueNameEn}
                            </span>
                          )}
                          <span>{match.roundAr}</span>
                          <span>•</span>
                          <span>{match.stadiumAr}</span>
                        </span>
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded-md ${
                            match.statusAr.includes('مباشر')
                              ? 'bg-red-500 text-white animate-pulse'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {match.statusAr}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-bold text-xs">
                        <div
                          className={`flex items-center gap-1.5 flex-1 ${
                            favTeam && match.homeTeam.toLowerCase().includes(favTeam.toLowerCase())
                              ? 'text-accent-600 dark:text-accent-400 font-black'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span className="truncate">{match.homeTeam}</span>
                          {favTeam && match.homeTeam.toLowerCase().includes(favTeam.toLowerCase()) && (
                            <Star className="w-3.5 h-3.5 fill-accent-500 text-accent-500 shrink-0" />
                          )}
                        </div>
                        <div className="px-3 py-1 bg-white dark:bg-slate-900 rounded-xl shadow-xs font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 mx-2 shrink-0">
                          {match.homeScore} - {match.awayScore}
                        </div>
                        <div
                          className={`flex items-center justify-end gap-1.5 flex-1 ${
                            favTeam && match.awayTeam.toLowerCase().includes(favTeam.toLowerCase())
                              ? 'text-accent-600 dark:text-accent-400 font-black'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {favTeam && match.awayTeam.toLowerCase().includes(favTeam.toLowerCase()) && (
                            <Star className="w-3.5 h-3.5 fill-accent-500 text-accent-500 shrink-0" />
                          )}
                          <span className="truncate">{match.awayTeam}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* جدول الترتيب المصغر */}
            <div>
              <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-accent-500" />
                <span>{isAr ? 'صدارة جدول الترتيب' : 'League Standings'}</span>
              </h4>
              <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 text-[11px]">
                <table className="w-full text-center">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-[10px]">
                    <tr>
                      <th className="py-1.5 px-2 text-start">#</th>
                      <th className="py-1.5 px-2 text-start">{isAr ? 'الفريق' : 'Team'}</th>
                      <th className="py-1.5 px-1">{isAr ? 'لعب' : 'P'}</th>
                      <th className="py-1.5 px-1">{isAr ? 'فوز' : 'W'}</th>
                      <th className="py-1.5 px-2 font-black text-accent-600">{isAr ? 'نقاط' : 'Pts'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {EGYPTIAN_LEAGUE_STANDINGS.map((team) => (
                      <tr
                        key={team.rank}
                        className={team.team.includes(favTeam) ? 'bg-accent-50/70 dark:bg-accent-950/40 font-bold' : ''}
                      >
                        <td className="py-1.5 px-2 text-start text-slate-400">{team.rank}</td>
                        <td className="py-1.5 px-2 text-start font-medium text-slate-900 dark:text-white">
                          {team.team}
                        </td>
                        <td className="py-1.5 px-1 text-slate-500">{team.played}</td>
                        <td className="py-1.5 px-1 text-emerald-600">{team.won}</td>
                        <td className="py-1.5 px-2 font-bold font-mono text-accent-600 dark:text-accent-400">
                          {team.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل برج المستخدم (Zodiac Modal) */}
      {activeModal === 'zodiac' && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp text-xs"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{zodiac.symbol}</span>
                <div>
                  <h3 className="font-bold text-sm text-purple-600 dark:text-purple-400">
                    {user.zodiacSign || zodiac.nameAr}
                  </h3>
                  <p className="text-[10px] text-slate-400">{zodiac.datesAr} • {zodiac.elementAr}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span>{isAr ? 'رسالة وطاقة برجك لليوم' : 'Today\'s Astrological Energy'}</span>
                </div>
                <p className="text-xs leading-relaxed font-medium">
                  {zodiacTip}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-0.5">{isAr ? 'العمر (ميلادي)' : 'Gregorian Age'}</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono text-[11px]">
                    {age.gregorianTextAr || `${age.years} سنة و ${age.months} شهر`}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block mb-0.5">{isAr ? 'العمر (هجري)' : 'Hijri Age'}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                    {age.hijriTextAr || `${age.years} سنة و ${age.months} شهر`}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl">
                💡 {isAr ? 'يمكنك تعديل تاريخ ميلادك وبرجك المفضل في أي وقت من الملف الشخصي ليتم تحديث الشريط تلقائياً.' : 'You can adjust birthdate and zodiac in your profile at any time.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل الذهب والسبائك الشاملة (Gold Modal) */}
      {activeModal === 'gold' && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-accent-500/15 text-accent-600 dark:text-accent-400 flex items-center justify-center font-bold">
                  🥇
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {isAr ? 'بورصة أسعار الذهب والسبائك' : 'Gold Bullion & Karats Market'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {isAr ? 'تحديث لحظي لكافة العيارات والجنيه والأونصة مع حاسبة الجرامات' : 'Live rates for all karats, bullion & coin calculator'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* حاسبة أسعار الذهب الفورية */}
            <div className="mb-4 p-3.5 rounded-2xl bg-accent-50 dark:bg-accent-950/30 border border-accent-200 dark:border-accent-850">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-accent-900 dark:text-accent-200 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-accent-600" />
                  <span>{isAr ? 'حاسبة قيمة الذهب السريعة' : 'Instant Gold Value Calculator'}</span>
                </span>
                <span className="text-[10px] text-accent-700 dark:text-accent-400 font-medium">
                  {isAr ? 'سعر الذهب الصافي بدون مصنعية' : 'Raw gold estimate'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    {isAr ? 'الوزن (جرام):' : 'Weight (Grams):'}
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={goldCalcGrams}
                    onChange={(e) => setGoldCalcGrams(Math.max(0.1, parseFloat(e.target.value) || 0))}
                    className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    {isAr ? 'العيار:' : 'Karat:'}
                  </label>
                  <select
                    value={goldCalcKarat}
                    onChange={(e) => setGoldCalcKarat(e.target.value)}
                    className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {liveGoldKaratRates.filter((g) => g.priceEgp && !g.id.startsWith('pound') && !g.id.startsWith('bar')).map((g) => (
                      <option key={g.id} value={g.id}>
                        {isAr ? g.nameAr : g.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="p-2 rounded-xl bg-accent-500 text-slate-950 text-center font-bold">
                    <span className="text-[9px] block text-accent-950/80 font-medium">
                      {isAr ? 'القيمة الإجمالية التقديرية' : 'Estimated Total'}
                    </span>
                    <span className="text-sm font-mono font-extrabold">
                      {(() => {
                        const target = liveGoldKaratRates.find((g) => g.id === goldCalcKarat) || MOCK_GOLD_KARAT_RATES[2];
                        const total = (target.priceEgp || 3420) * goldCalcGrams;
                        return `${Math.round(total).toLocaleString()} ج.م`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* قائمة كافة عيارات الذهب والسبائك والجنيهات */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                {isAr ? 'أسعار جميع العيارات الرسمية اليوم:' : 'All Official Karats & Products Today:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {liveGoldKaratRates.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between ${
                      (prefs.goldUnit === item.id || (prefs.goldUnit === 'all' && ['24', '21', 'pound'].includes(item.id)))
                        ? 'bg-accent-50/60 dark:bg-accent-950/30 border-accent-300 dark:border-accent-800 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {isAr ? item.nameAr : item.nameEn}
                        </span>
                        {(prefs.goldUnit === item.id) && (
                          <span className="text-[9px] bg-accent-500 text-white font-bold px-1.5 py-0.2 rounded-md">
                            {isAr ? 'المختار' : 'Active'}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        {item.priceUsd ? `عالمي: $${item.priceUsd}` : 'محلي معتمد'}
                      </span>
                    </div>

                    <div className="text-end">
                      <span className="font-mono font-extrabold text-xs text-accent-600 dark:text-accent-400 block">
                        {item.priceEgp ? `${item.priceEgp.toLocaleString()} ج.م` : `$${item.priceUsd}`}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        +{item.change24h} ج.م
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                {isAr
                  ? 'يمكنك تحديد العيار المفضل لديك (عيار 24، 21، 18 أو الجنيه الذهب) من نافذة الإعدادات ليظهر دائماً في الشريط.'
                  : 'You can set your preferred gold karat or coin from settings to display permanently in the ticker.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل العملات الرقمية المشفرة (Crypto Modal) */}
      {activeModal === 'crypto' && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-accent-500/15 text-accent-600 dark:text-accent-400 flex items-center justify-center font-bold">
                  <Bitcoin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {isAr ? 'سوق العملات الرقمية المشفرة (Crypto Market)' : 'Cryptocurrency Live Market'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {isAr
                      ? `أسعار حية بالدولار والجنيه المصري (سعر الصرف: ${usdRate.rate} ج.م)`
                      : `Live prices in USD & EGP (Pegged at ${usdRate.rate} EGP)`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* شبكة العملات المشفرة مع مقارنة بالجنيه المصري */}
            <div className="space-y-2">
              {(() => {
                const combinedCoinsMap = new Map<string, CryptoMarketItem>();
                selectedCryptosList.forEach((c) => combinedCoinsMap.set(c.symbol, c));
                EXTENDED_CRYPTO_DATABASE.forEach((c) => {
                  if (!combinedCoinsMap.has(c.symbol)) {
                    combinedCoinsMap.set(c.symbol, c);
                  }
                });
                const allModalCoins = Array.from(combinedCoinsMap.values());

                return allModalCoins.map((coin) => {
                  const isSelectedInTicker = (prefs.selectedCryptos || ['BTC', 'ETH', 'SOL']).includes(coin.symbol);
                  const egpPrice = Math.round(coin.priceUsd * (usdRate.rate || 48.65));
                  return (
                    <div
                      key={coin.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                        isSelectedInTicker
                          ? 'bg-accent-50/50 dark:bg-accent-950/20 border-accent-300/80 dark:border-accent-800/80 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-extrabold text-base">
                          {coin.iconSymbol || '🪙'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                              {coin.symbol}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {isAr ? coin.nameAr : coin.nameEn}
                            </span>
                            {isSelectedInTicker && (
                              <span className="text-[9px] bg-accent-500/20 text-accent-700 dark:text-accent-300 font-bold px-1.5 py-0.2 rounded-md">
                                {isAr ? 'في الشريط' : 'On Ticker'}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            ≈ {egpPrice.toLocaleString()} ج.م
                          </span>
                        </div>
                      </div>

                      <div className="text-end">
                        <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white block">
                          ${coin.priceUsd.toLocaleString()}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-bold ${
                            coin.change24h >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500'
                          }`}
                        >
                          {coin.change24h >= 0 ? `+${coin.change24h}%` : `${coin.change24h}%`}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="mt-4 p-2.5 rounded-xl bg-accent-500/10 border border-accent-500/20 text-[10px] text-accent-900 dark:text-accent-200 flex items-center justify-between">
              <span>
                {isAr
                  ? '💡 يمكنك تخصيص العملات المشفرة التي تظهر في شريط الأخبار من نافذة الإعدادات.'
                  : '💡 You can customize which crypto coins appear in the live ticker from settings.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل الأسعار العامة (Rates Modal) */}
      {activeModal === 'rates' && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
              <span className="font-bold text-xs text-accent-600">
                {isAr ? 'تفاصيل أسعار الذهب والعملات' : 'Gold & Currency Rates'}
              </span>
              <button
                onClick={() => setActiveModal(null)}
                className="text-xs px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{isAr ? 'الذهب عيار 24' : 'Gold 24K'}</span>
                <span className="font-mono font-bold text-accent-600">
                  {MOCK_GOLD_KARAT_RATES[0].rateEgp} {MOCK_GOLD_KARAT_RATES[0].unitAr}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{isAr ? 'الذهب عيار 21' : 'Gold 21K'}</span>
                <span className="font-mono font-bold text-accent-600">
                  {MOCK_GOLD_KARAT_RATES[2].rateEgp} {MOCK_GOLD_KARAT_RATES[2].unitAr}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{isAr ? 'الفضة عيار 999' : 'Silver 999'}</span>
                <span className="font-mono font-bold text-slate-400">{silverRate999.rateEgp} ج.م</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Bitcoin (BTC)</span>
                <span className="font-mono font-bold text-accent-500">
                  ${MOCK_CRYPTO_RATES[0].priceUsd.toLocaleString()} (+{MOCK_CRYPTO_RATES[0].change24h}%)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Ethereum (ETH)</span>
                <span className="font-mono font-bold text-indigo-500">
                  ${MOCK_CRYPTO_RATES[1].priceUsd.toLocaleString()} (+{MOCK_CRYPTO_RATES[1].change24h}%)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">USD / EGP</span>
                <span className="font-mono font-bold text-emerald-600">{usdRate.rate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">SAR / EGP</span>
                <span className="font-mono font-bold text-emerald-600">{sarRate.rate}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">AED / EGP</span>
                <span className="font-mono font-bold text-emerald-600">{aedRate.rate}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل الوقت والتقويم (Time Modal) */}
      {activeModal === 'time' && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-xs w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
              <span className="font-bold text-xs text-accent-600">
                {isAr ? 'الوقت والتقويم' : 'Time & Calendar'}
              </span>
              <button
                onClick={() => setActiveModal(null)}
                className="text-xs px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{isAr ? 'الساعة' : 'Time'}</span>
                <span className="font-mono font-bold text-sm">{formattedTime}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{isAr ? 'التاريخ الهجري' : 'Hijri'}</span>
                <span className="font-bold text-accent-600">{hijri}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">{isAr ? 'التاريخ الميلادي' : 'Gregorian'}</span>
                <span className="font-mono">{gregorian}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل الطقس (Weather Modal) */}
      {activeModal === 'weather' && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-xs w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp text-xs"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
              <span className="font-bold text-xs text-sky-600">
                {isAr ? 'حالة الطقس المباشرة' : 'Live Weather'}
              </span>
              <button
                onClick={() => setActiveModal(null)}
                className="text-xs px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{isAr ? 'المدينة' : 'City'}</span>
                <span className="font-bold">{user.city || (isAr ? 'القاهرة' : 'Cairo')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{isAr ? 'الحرارة' : 'Temperature'}</span>
                <span className="font-mono font-bold text-sky-600">{weatherIsLive ? `${Math.round(liveWeather!.temperatureC)}°C` : '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{isAr ? 'الحالة' : 'Condition'}</span>
                <span className="font-bold">{weatherIsLive ? weatherLabel(liveWeather!.weatherCode) : (isAr ? 'غير متاح حالياً' : 'Unavailable')}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">{isAr ? 'الرطوبة' : 'Humidity'}</span>
                <span className="font-mono font-bold">{weatherIsLive ? `${Math.round(liveWeather!.humidity)}%` : '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{isAr ? 'الرياح' : 'Wind'}</span>
                <span className="font-mono font-bold">{weatherIsLive ? `${Math.round(liveWeather!.windKmh)} كم/س` : '—'}</span>
              </div>
              <div className="pt-1 text-[9px] text-slate-400 flex items-center justify-between">
                <span>{weatherIsLive ? 'LIVE · Open-Meteo' : (isAr ? 'لا توجد بيانات حية' : 'No live data')}</span>
                {weatherIsLive && <span>{new Date(liveWeather!.fetchedAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل مهام وتنبيهات ذكرني (Zakkirni Daily Tasks Modal) */}
      {activeModal === 'zakkirni' && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp text-xs max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white font-sans flex items-center gap-2">
                    {isAr ? 'تنبيهات ومهام ذكرني' : 'Zakkirni Reminders & Tasks'}
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      {pendingDailyTasks.length} {isAr ? 'متبقية' : 'Pending'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                    {isAr ? 'مهامك المعروضة في شريط الأخبار العلوي مع إمكانية الإنجاز الفوري' : 'Your live tasks from header ticker'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <button
                onClick={() => setTaskFilter('pending')}
                className={`flex-1 py-1.5 px-3 rounded-xl font-bold font-sans transition-all text-xs flex items-center justify-center gap-1.5 ${
                  taskFilter === 'pending'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
                }`}
              >
                <span>{isAr ? 'المهام المعلقة' : 'Pending Tasks'}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-white">
                  {pendingDailyTasks.length}
                </span>
              </button>
              <button
                onClick={() => setTaskFilter('all')}
                className={`flex-1 py-1.5 px-3 rounded-xl font-bold font-sans transition-all text-xs flex items-center justify-center gap-1.5 ${
                  taskFilter === 'all'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
                }`}
              >
                <span>{isAr ? 'جميع المهام' : 'All Tasks'}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-white">
                  {localDailyTasks.length}
                </span>
              </button>
            </div>

            {/* Task list scrollable */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
              {(taskFilter === 'pending' ? pendingDailyTasks : localDailyTasks).length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-850/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300 font-sans mb-1">
                    {taskFilter === 'pending'
                      ? (isAr ? '✨ لا توجد مهام معلقة! جميع المهام منجزة 👏' : '✨ No pending tasks! All caught up 👏')
                      : (isAr ? 'لا توجد مهام حالياً في قسم ذكرني' : 'No tasks in Zakkirni')}
                  </p>
                  <p className="text-xs font-sans text-slate-400">
                    {isAr ? 'يمكنك إضافة مهمة جديدة بالأسفل أو فتح قسم ذكرني' : 'Add a new task below'}
                  </p>
                </div>
              ) : (
                (taskFilter === 'pending' ? pendingDailyTasks : localDailyTasks).map((t) => {
                  const isHigh = t.priority === 'high';
                  const isMed = t.priority === 'medium';
                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                        t.completed
                          ? 'bg-slate-50/80 dark:bg-slate-850/50 border-slate-200 dark:border-slate-800 opacity-60'
                          : isHigh
                          ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                          : isMed
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
                          : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-750'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleTask(t.id)}
                        className="flex items-center gap-2.5 text-right flex-1 min-w-0 cursor-pointer"
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors border ${
                            t.completed
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-slate-300 dark:border-slate-600 hover:border-amber-500 text-transparent hover:text-amber-500'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`font-bold font-sans text-xs truncate ${
                              t.completed
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {t.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                            {t.dueTime && (
                              <span className="flex items-center gap-0.5 font-mono">
                                <Clock className="w-3 h-3 text-amber-500" />
                                {t.dueTime}
                              </span>
                            )}
                            {t.dueDate && <span>{t.dueDate}</span>}
                          </div>
                        </div>
                      </button>
                      <span
                        className={`text-[9px] font-sans font-black px-2 py-0.5 rounded-full shrink-0 border ${
                          t.completed
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                            : isHigh
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            : isMed
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {t.completed
                          ? (isAr ? 'مكتملة' : 'Done')
                          : isHigh
                          ? (isAr ? 'عاجل' : 'High')
                          : isMed
                          ? (isAr ? 'مهم' : 'Med')
                          : (isAr ? 'عادي' : 'Low')}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Add Task Form */}
            <form onSubmit={handleCreateQuickTask} className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 mb-3 shrink-0">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5 font-sans">
                {isAr ? '⚡ إضافة مهمة سريعة لذكرني:' : '⚡ Quick Add to Zakkirni:'}
              </span>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  placeholder={isAr ? 'عنوان المهمة والتذكير...' : 'Task title...'}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-amber-500 font-sans"
                />
                <div className="flex items-center gap-1.5">
                  <select
                    value={quickTaskPriority}
                    onChange={(e) => setQuickTaskPriority(e.target.value as TaskPriority)}
                    className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[11px] outline-none font-sans"
                  >
                    <option value="high">{isAr ? 'عاجل 🔴' : 'High'}</option>
                    <option value="medium">{isAr ? 'مهم 🟡' : 'Medium'}</option>
                    <option value="low">{isAr ? 'عادي 🟢' : 'Low'}</option>
                  </select>
                  <input
                    type="time"
                    value={quickTaskDueTime}
                    onChange={(e) => setQuickTaskDueTime(e.target.value)}
                    className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[11px] outline-none font-mono"
                    title={isAr ? 'وقت التذكير' : 'Due time'}
                  />
                  <button
                    type="submit"
                    disabled={!quickTaskTitle.trim()}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold font-sans text-xs flex items-center gap-1 transition-colors shrink-0 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAr ? 'إضافة' : 'Add'}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Navigate to full Notes & Zakkirni tab */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <span className="text-[10px] text-slate-400 font-sans">
                {isAr ? 'يتم حفظ كافة المهام تلقائياً وتحديث شريط الأخبار فوراً' : 'Tasks update the live ticker instantly'}
              </span>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    onNavigate('notes');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold font-sans text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                  <span>{isAr ? 'فتح قسم ذكرني والملاحظات' : 'Open Zakkirni & Notes'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// مساعدة لتمييز اسم الفريق المفضل
function highlightMatchStyles(teamName: string, favTeam: string): string {
  if (teamName.includes(favTeam)) {
    return 'text-accent-600 dark:text-accent-400 font-black';
  }
  return 'text-slate-800 dark:text-slate-200 font-bold';
}
