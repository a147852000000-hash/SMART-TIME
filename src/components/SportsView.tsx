import React, { useEffect, useMemo, useState } from 'react';
import {
  Trophy,
  Dumbbell,
  Heart,
  Search,
  Newspaper,
  CheckCircle2,
  Trash2,
  ExternalLink,
  RefreshCw,
  Activity,
  ArrowRight,
  Play,
  Bike,
  Waves,
  Footprints,
  Move,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  GripVertical,
  Flag,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  fetchLiveNews,
  fetchLiveSports,
  fetchFootballLeague,
  fetchFootballTeam,
  fetchTeamNews,
  FOOTBALL_LEAGUES,
  FootballLeagueKey,
  FootballLeagueData,
  FootballTeamSummary,
  LiveNewsArticle,
  LiveSportsMatch,
} from '../services/liveDataService';
import { isFavoriteTeamMatch } from '../utils/liveInfoHelpers';
import { apiUrl } from '../services/apiConfig';
import { authHeaders } from '../services/authService';
import { STORAGE_KEYS } from '../services/storageKeys';
import { StorageAdapter } from '../services/storageAdapter';

interface SportsViewProps {
  user: UserProfile;
}

interface ExerciseItem {
  id: string;
  name: string;
  gifUrl: string;
  target: string;
  equipment: string;
  bodyPart?: string;
  secondaryMuscles?: string[];
  instructions?: string[];
}

interface WorkoutLog {
  id: string;
  title: string;
  category: string;
  duration: number;
  calories: number;
  date: string;
}

type Tab = 'home' | 'exercises' | 'favorites' | 'hobby' | 'news';
// [football-free] التابات الفرعية داخل التاب الرياضي المخصص
type SportsSubTab = 'results' | 'standings' | 'favteam' | 'national' | 'newsfeed';

// [football-free] تنسيق تاريخ المباراة بشكل عربي مختصر (يحافظ على التاريخ الخام كاحتياط)
function formatMatchDate(d?: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d).slice(0, 10);
  return dt.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

// [football-free] نص حالة المباراة بالعربية
function statusLabelAr(short?: string | null, isAr = true): string {
  const s = String(short || '').toUpperCase();
  if (!isAr) {
    const en: Record<string, string> = { FT: 'FT', NS: 'Not started', '1H': '1st half', '2H': '2nd half', HT: 'Half time', PST: 'Postponed', CANC: 'Cancelled', AET: 'AET', PEN: 'Pens' };
    return en[s] || s || '';
  }
  const ar: Record<string, string> = {
    FT: 'انتهت', AET: 'بعد الوقت الإضافي', PEN: 'بركلات الترجيح',
    NS: 'لم تبدأ', TBD: 'لم تحدد', '1H': 'الشوط الأول', '2H': 'الشوط الثاني',
    HT: 'بين الشوطين', PST: 'مؤجلة', CANC: 'ملغاة',
  };
  if (ar[s]) return ar[s];
  if (['LIVE', 'IN PLAY', 'ET', 'BT', 'P'].includes(s)) return 'جارية الآن';
  return s || '';
}

// [football-free] تمييز صف فريقك المفضل في جدول الترتيب (تسامح في الـ «ال» التعريف)
function isFavTeamRow(teamName: string | undefined, favTeam: string): boolean {
  if (!teamName || !favTeam) return false;
  const norm = (s: string) => s.replace(/ال\s*/u, '').trim();
  return teamName === favTeam || norm(teamName) === norm(favTeam);
}

// [football-free] بطاقة ملخص فريق/منتخب: المباراة القادمة + آخر نتيجة + أخبار الفريق
const TeamSummaryBlock: React.FC<{
  isAr: boolean;
  title: string;
  loading: boolean;
  summary: FootballTeamSummary | null;
  articles: LiveNewsArticle[];
}> = ({ isAr, title, loading, summary, articles }) => {
  const team = summary?.team;
  const next = summary?.next || null;
  const last = summary?.last || null;
  return (
    <>
      <div className="rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-black text-sm">{title}</div>
        {loading ? (
          <div className="py-10 text-center text-slate-500">{isAr ? 'جاري تحميل بيانات الفريق…' : 'Loading team data…'}</div>
        ) : !team ? (
          <div className="p-5 text-sm text-slate-500">
            {isAr ? 'لم نتمكن من جلب بيانات الفريق الآن — تأكد من الاتصال بالإنترنت وجرب التحديث.' : 'Could not load team data — check connection and refresh.'}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              {team.badge ? (
                <img src={team.badge} alt={team.name || ''} className="w-12 h-12 rounded-xl object-contain bg-slate-100 dark:bg-slate-800 p-1" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl">⚽</div>
              )}
              <div>
                <div className="font-black text-sm">{team.name}</div>
                {team.league && <div className="text-[11px] text-slate-500">{team.league}</div>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-1">{isAr ? '📅 المباراة القادمة' : 'Next match'}</div>
                {next ? (
                  <>
                    <div className="text-xs font-bold">{next.home} × {next.away}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{formatMatchDate(next.date || next.dateEvent)} {next.league ? `— ${next.league}` : ''}</div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500">{isAr ? 'لا توجد مباراة قادمة معلنة' : 'No upcoming match'}</div>
                )}
              </div>
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-bold text-slate-500 mb-1">{isAr ? '⏮️ آخر نتيجة' : 'Last result'}</div>
                {last ? (
                  <>
                    <div className="text-xs font-bold">{last.home} × {last.away}</div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {last.homeScore ?? '-'} : {last.awayScore ?? '-'} — {statusLabelAr(last.status, isAr)} {last.league ? `— ${last.league}` : ''}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500">{isAr ? 'لا توجد نتيجة سابقة' : 'No previous result'}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {articles.length ? articles.slice(0, 12).map((n, i) => (
          <a
            key={`tn-${n.url}-${i}`}
            href={n.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:shadow-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center shrink-0">
              <Newspaper className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm leading-6">{n.title}</h3>
              <p className="text-[11px] text-slate-500 mt-1">{n.source?.name || (isAr ? 'مصدر إخباري' : 'News source')}</p>
            </div>
            <ExternalLink className="w-4 h-4 shrink-0" />
          </a>
        )) : !loading && (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-500">
            {isAr ? 'لا توجد أخبار متاحة للفريق حاليًا — جرب التحديث بعد قليل.' : 'No team news available right now.'}
          </div>
        )}
      </div>
    </>
  );
};

const MUSCLES = [
  { label: 'الكل', value: 'all' },
  { label: 'الصدر', value: 'chest' },
  { label: 'الظهر', value: 'back' },
  { label: 'الأكتاف', value: 'shoulders' },
  { label: 'الذراعين', value: 'upper arms' },
  { label: 'الأرجل', value: 'upper legs' },
  { label: 'البطن', value: 'waist' },
];

const HOBBIES = [
  { name: 'كرة القدم', icon: Trophy },
  { name: 'كمال الأجسام', icon: Dumbbell },
  { name: 'السباحة', icon: Waves },
  { name: 'الجري', icon: Footprints },
  { name: 'كرة السلة', icon: Activity },
  { name: 'ركوب الدراجات', icon: Bike },
];

const initialHomeCards = [
  {
    id: 'exercises',
    tab: 'exercises' as Tab,
    icon: Dumbbell,
    title: 'مكتبة التمارين المصورة',
    text: 'تمارين للصدر والظهر والأكتاف والذراعين والأرجل والبطن مع صور GIF.',
    action: 'استكشف التمارين',
  },
  {
    id: 'favorites',
    tab: 'favorites' as Tab,
    icon: Heart,
    title: 'متابعة تمارينك المفضلة',
    text: 'كل ما حفظته في مكان واحد مع تحديد التمارين المكتملة وحذفها.',
    action: 'عرض المحفوظ',
  },
  {
    id: 'hobby',
    tab: 'hobby' as Tab,
    icon: Trophy,
    title: 'هوايتك ومحرك البحث',
    text: 'اختر رياضتك وابحث مباشرة في Google أو YouTube عن التدريب والمحتوى.',
    action: 'ابدأ البحث',
  },
  {
    id: 'news',
    tab: 'news' as Tab,
    icon: Newspaper,
    title: 'الرياضة — نتائج وجداول وأخبار',
    text: 'نتائج الدوري المصري وجداول التصفيات وأمم أفريقيا وأخبار فريقك المفضل والمنتخب — مصادر مجانية حية.',
    action: 'افتح التاب الرياضي',
  },
];

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export const SportsView: React.FC<SportsViewProps> = ({ user }) => {
  const isAr = user.language === 'ar';
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [exerciseError, setExerciseError] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('all');
  const [favorites, setFavorites] = useState<ExerciseItem[]>(() => readStorage('my_favorite_workouts', []));
  const [completed, setCompleted] = useState<string[]>(() => readStorage('my_completed_workouts', []));
  const [selectedHobby, setSelectedHobby] = useState('كرة القدم');
  const [searchQuery, setSearchQuery] = useState('');
  const [news, setNews] = useState<LiveNewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [liveMatches, setLiveMatches] = useState<LiveSportsMatch[]>([]);
  const [sportsLoading, setSportsLoading] = useState(false);
  // ==================== [football-free] حالة التاب الرياضي المخصص ====================
  const [sportsSubTab, setSportsSubTab] = useState<SportsSubTab>('results');
  // فريقك المفضل (من إعدادات شريط الأخبار) والمنتخب
  const favTeam = user.tickerPreferences?.favoriteTeam || user.tickerPreferences?.favoriteEgyptianTeam || 'الأهلي';
  // [national-team] إظهار منتخب البلد — مفعّل افتراضيًا وقابل للإخفاء من إعدادات شريط الأخبار
  const showNationalTeam = user.tickerPreferences?.showNationalTeam !== false;
  const [favTeamSummary, setFavTeamSummary] = useState<FootballTeamSummary | null>(null);
  const [favTeamNews, setFavTeamNews] = useState<LiveNewsArticle[]>([]);
  const [favTeamLoading, setFavTeamLoading] = useState(false);
  const [nationalSummary, setNationalSummary] = useState<FootballTeamSummary | null>(null);
  const [nationalNews, setNationalNews] = useState<LiveNewsArticle[]>([]);
  const [nationalLoading, setNationalLoading] = useState(false);
  const [leagueKey, setLeagueKey] = useState<FootballLeagueKey>('egypt');
  const [leagueData, setLeagueData] = useState<FootballLeagueData | null>(null);
  const [leagueLoading, setLeagueLoading] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>(() =>
    readStorage(STORAGE_KEYS.WORKOUT_LOGS, [
      { id: 'seed-1', title: 'جري خفيف صباحي', category: 'كارديو', duration: 30, calories: 280, date: 'اليوم' },
      { id: 'seed-2', title: 'تمارين حديد (أرجل وبطن)', category: 'قوة', duration: 45, calories: 350, date: 'أمس' },
    ])
  );
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDuration, setNewDuration] = useState('30');
  const [newCalories, setNewCalories] = useState('200');

  // Reorder mode for Sports Home Cards
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [cardOrder, setCardOrder] = useState<string[]>(() =>
    readStorage(STORAGE_KEYS.SPORTS_CARDS_ORDER, initialHomeCards.map((c) => c.id))
  );

  useEffect(() => {
    StorageAdapter.setItem('my_favorite_workouts', favorites);
  }, [favorites]);
  useEffect(() => {
    StorageAdapter.setItem('my_completed_workouts', completed);
  }, [completed]);
  useEffect(() => {
    StorageAdapter.setItem(STORAGE_KEYS.WORKOUT_LOGS, workouts);
  }, [workouts]);
  useEffect(() => {
    StorageAdapter.setItem(STORAGE_KEYS.SPORTS_CARDS_ORDER, cardOrder);
  }, [cardOrder]);

  const orderedCards = useMemo(() => {
    const list = [...initialHomeCards];
    list.sort((a, b) => {
      const idxA = cardOrder.indexOf(a.id);
      const idxB = cardOrder.indexOf(b.id);
      return (idxA >= 0 ? idxA : 999) - (idxB >= 0 ? idxB : 999);
    });
    return list;
  }, [cardOrder]);

  const handleMoveCard = (index: number, direction: 'up' | 'down', e?: React.MouseEvent) => {
    e?.stopPropagation();
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedCards.length) return;

    const newOrder = orderedCards.map((c) => c.id);
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setCardOrder(newOrder);

    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate(10);
      } catch {}
    }
  };

  const handleResetCardOrder = () => {
    setCardOrder(initialHomeCards.map((c) => c.id));
    setIsReorderMode(false);
  };

  const loadExercises = async (muscle = selectedMuscle) => {
    setLoading(true);
    setExerciseError('');
    try {
      const q = muscle === 'all' ? '' : `?bodyPart=${encodeURIComponent(muscle)}`;
      const res = await fetch(apiUrl(`/api/sports/exercises${q}`), { headers: { ...authHeaders() } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'تعذر تحميل التمارين');
      setExercises(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setExercises([]);
      setExerciseError(e?.message || 'تعذر الاتصال بمكتبة التمارين.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'exercises') loadExercises(selectedMuscle);
  }, [activeTab, selectedMuscle]);

  const loadNews = async () => {
    setNewsLoading(true);
    // [football-free] أخبار الرياضة الفعلية — كانت تجلب الأخبار الرئيسية بالخطأ
    const data = await fetchLiveNews(isAr ? 'ar' : 'en', 'sports');
    setNews(data);
    setNewsLoading(false);
  };
  const loadLive = async () => {
    setSportsLoading(true);
    setLiveMatches(await fetchLiveSports());
    setSportsLoading(false);
  };
  // [football-free] محملات التاب الرياضي: ترتيب البطولة + ملخص الفريق + أخبار الفريق
  const loadLeague = async (key: FootballLeagueKey = leagueKey) => {
    setLeagueLoading(true);
    const data = await fetchFootballLeague(key);
    setLeagueData(data);
    setLeagueLoading(false);
  };
  const loadTeamBlock = async (teamName: string, target: 'fav' | 'national') => {
    const setSummary = target === 'fav' ? setFavTeamSummary : setNationalSummary;
    const setNewsList = target === 'fav' ? setFavTeamNews : setNationalNews;
    const setLoading = target === 'fav' ? setFavTeamLoading : setNationalLoading;
    setLoading(true);
    const [summary, articles] = await Promise.all([fetchFootballTeam(teamName), fetchTeamNews(teamName)]);
    setSummary(summary);
    setNewsList(articles);
    setLoading(false);
  };
  // تحميل بيانات التاب الفرعي النشط فقط (خفيف على المزودات المجانية + كاش السيرفر يحمي الحصة)
  useEffect(() => {
    if (activeTab !== 'news') return;
    // [football-free] نتائج الدوري المصري: إن كانت بيانات تاب الترتيب لبطولة أخرى نعيد جلب الدوري المصري
    if (sportsSubTab === 'results') { if (!leagueData || leagueData.league !== 'egypt') loadLeague('egypt'); loadLive(); }
    else if (sportsSubTab === 'standings') { loadLeague(leagueKey); }
    else if (sportsSubTab === 'favteam') { loadTeamBlock(favTeam, 'fav'); }
    else if (sportsSubTab === 'national') { loadTeamBlock(isAr ? 'المنتخب المصري' : 'Egypt', 'national'); }
    else if (sportsSubTab === 'newsfeed') { loadNews(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, sportsSubTab, leagueKey]);
  // زر التحديث يعيد جلب بيانات التاب الفرعي الحالي
  const refreshSportsTab = () => {
    if (sportsSubTab === 'results') { loadLeague('egypt'); loadLive(); }
    else if (sportsSubTab === 'standings') { loadLeague(leagueKey); }
    else if (sportsSubTab === 'favteam') { loadTeamBlock(favTeam, 'fav'); }
    else if (sportsSubTab === 'national') { loadTeamBlock(isAr ? 'المنتخب المصري' : 'Egypt', 'national'); }
    else { loadNews(); }
  };

  const toggleFavorite = (exercise: ExerciseItem) => {
    setFavorites((prev) =>
      prev.some((x) => x.id === exercise.id) ? prev.filter((x) => x.id !== exercise.id) : [...prev, exercise]
    );
  };
  const toggleComplete = (id: string) =>
    setCompleted((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const go = (tab: Tab) => setActiveTab(tab);
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = encodeURIComponent(`${selectedHobby} ${searchQuery}`);
    window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener,noreferrer');
  };
  const handleYoutubeSearch = () => {
    if (!searchQuery.trim()) return;
    window.open(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(`${selectedHobby} ${searchQuery}`)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };
  const addWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setWorkouts((prev) => [
      {
        id: Date.now().toString(),
        title: newTitle.trim(),
        category: 'تمرين',
        duration: Number(newDuration) || 30,
        calories: Number(newCalories) || 200,
        date: 'اليوم',
      },
      ...prev,
    ]);
    setNewTitle('');
    setIsAdding(false);
  };

  const filteredFavorites = useMemo(() => favorites, [favorites]);

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full space-y-5 pb-24 animate-fade-in text-slate-900 dark:text-white select-none">
      <div className="rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
              <Dumbbell className="w-6 h-6 text-slate-900 dark:text-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500">SMART TIME</div>
              <h1 className="text-xl font-black">المركز الرياضي التفاعلي</h1>
              <p className="text-xs text-slate-500 mt-1">تمارينك، متابعتك، هواياتك وأخبار الرياضة في مكان واحد</p>
            </div>
          </div>
          {activeTab !== 'home' ? (
            <button
              onClick={() => go('home')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-bold shadow-2xs"
            >
              <ArrowRight className="w-4 h-4" /> الرئيسية
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsReorderMode(!isReorderMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition ${
                  isReorderMode
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
                title={isAr ? 'ترتيب البطاقات' : 'Reorder cards'}
              >
                <Move className="w-3.5 h-3.5" />
                <span>{isReorderMode ? (isAr ? 'تم ✓' : 'Done') : isAr ? 'ترتيب' : 'Reorder'}</span>
              </button>
              {isReorderMode && (
                <button
                  type="button"
                  onClick={handleResetCardOrder}
                  className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200"
                  title="استعادة الافتراضي"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {activeTab === 'home' && (
        <>
          {isReorderMode && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl flex items-center justify-between gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-amber-600" />
                <span>{isAr ? 'استخدم أزرار الأسهم لتحريك وإعادة ترتيب بطاقات الرياضة.' : 'Use arrow buttons to reorder sports cards.'}</span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {orderedCards.map((card, idx) => (
              <div
                key={card.tab}
                onClick={isReorderMode ? undefined : () => go(card.tab)}
                className={`text-right group rounded-3xl bg-white dark:bg-slate-950 border p-5 transition-all relative ${
                  isReorderMode
                    ? 'border-amber-400 ring-1 ring-amber-400 cursor-move'
                    : 'border-slate-200 dark:border-slate-800 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                    <card.icon className="w-6 h-6" />
                  </div>
                  {isReorderMode && (
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => handleMoveCard(idx, 'up', e)}
                        className={`p-1.5 rounded-lg text-xs font-black ${
                          idx === 0 ? 'text-slate-300 dark:text-slate-700' : 'bg-amber-100 text-amber-800'
                        }`}
                        title="تحريك لأعلى"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === orderedCards.length - 1}
                        onClick={(e) => handleMoveCard(idx, 'down', e)}
                        className={`p-1.5 rounded-lg text-xs font-black ${
                          idx === orderedCards.length - 1 ? 'text-slate-300 dark:text-slate-700' : 'bg-amber-100 text-amber-800'
                        }`}
                        title="تحريك لأسفل"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <h2 className="font-black text-lg">{card.title}</h2>
                <p className="text-sm text-slate-500 mt-2 leading-6">{card.text}</p>
                {!isReorderMode && (
                  <div className="mt-5 text-xs font-black text-amber-600 dark:text-amber-400">
                    {card.tab === 'favorites' ? `${card.action} (${favorites.length})` : card.action} ←
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {([
              ['8,432', 'خطوات اليوم', Footprints],
              ['750', 'سعر حراري', Activity],
              ['72 bpm', 'نبضات القلب', Heart],
            ] as Array<[string, string, React.ComponentType<{ className?: string }>]>).map(([value, label, Icon]) => (
              <div
                key={String(label)}
                className="rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 text-center"
              >
                <Icon className="w-5 h-5 mx-auto mb-2" />
                <div className="font-black text-lg">{value}</div>
                <div className="text-[11px] text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'exercises' && (
        <section className="space-y-4">
          <div className="rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex flex-wrap gap-2">
              {MUSCLES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setSelectedMuscle(m.value)}
                  className={`px-4 py-2 rounded-xl text-xs font-black border transition ${
                    selectedMuscle === m.value
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">مصدر التمارين: ExerciseDB عبر خادم SMART TIME</p>
              <button
                onClick={() => loadExercises()}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          {exerciseError && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 p-4 text-sm">
              {exerciseError}
              <div className="text-xs mt-1">أضف RAPIDAPI_KEY في ملف البيئة ثم أعد تشغيل الخادم.</div>
            </div>
          )}
          {loading ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3" />
              جاري تحميل التمارين والصور المتحركة...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {exercises.map((item) => {
                const fav = favorites.some((x) => x.id === item.id);
                return (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm"
                  >
                    <div className="relative h-56 bg-slate-50 dark:bg-white flex items-center justify-center">
                      <img src={item.gifUrl} alt={item.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                      <button
                        onClick={() => toggleFavorite(item)}
                        className="absolute top-3 left-3 w-10 h-10 rounded-full bg-white/95 shadow flex items-center justify-center"
                      >
                        <Heart className={`w-5 h-5 ${fav ? 'fill-red-500 text-red-500' : ''}`} />
                      </button>
                    </div>
                    <div className="p-4">
                      <h3 className="font-black text-base capitalize">{item.name}</h3>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                        <span className="rounded-xl bg-slate-100 dark:bg-slate-900 p-2">
                          العضلة: <b>{item.target}</b>
                        </span>
                        <span className="rounded-xl bg-slate-100 dark:bg-slate-900 p-2">
                          الأداة: <b>{item.equipment}</b>
                        </span>
                      </div>
                      <button
                        onClick={() => toggleFavorite(item)}
                        className={`w-full mt-3 py-2.5 rounded-xl text-xs font-black ${
                          fav ? 'bg-red-50 text-red-600' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        }`}
                      >
                        {fav ? '♥ في المفضلة' : '♡ إضافة إلى المفضلة'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === 'favorites' && (
        <section className="rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="font-black text-lg flex items-center gap-2">
            <Heart className="text-red-500" /> تمارينك المفضلة ({filteredFavorites.length})
          </h2>
          {filteredFavorites.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              لا توجد تمارين محفوظة بعد. افتح مكتبة التمارين واضغط القلب.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {filteredFavorites.map((item) => {
                const done = completed.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-3"
                  >
                    <img src={item.gifUrl} alt={item.name} className="w-20 h-20 object-contain rounded-xl bg-white" />
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-black text-sm ${done ? 'line-through text-slate-400' : ''}`}>{item.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.target} • {item.equipment}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => toggleComplete(item.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                            done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 dark:bg-slate-900'
                          }`}
                        >
                          <CheckCircle2 className="inline w-4 h-4 ml-1" />
                          {done ? 'مكتمل' : 'تم الإنجاز'}
                        </button>
                        <button
                          onClick={() => toggleFavorite(item)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600"
                        >
                          <Trash2 className="inline w-4 h-4 ml-1" />
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === 'hobby' && (
        <section className="max-w-4xl mx-auto rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="font-black text-lg flex items-center gap-2">
            <Trophy /> هوايتك الرياضية
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-5">
            {HOBBIES.map((h) => {
              const I = h.icon;
              return (
                <button
                  key={h.name}
                  onClick={() => setSelectedHobby(h.name)}
                  className={`p-3 rounded-2xl border text-sm font-bold flex items-center gap-2 ${
                    selectedHobby === h.name
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <I className="w-4 h-4" />
                  {h.name}
                </button>
              );
            })}
          </div>
          <form onSubmit={handleSearch} className="flex gap-2 mt-6">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`ابحث عن أي شيء في ${selectedHobby}...`}
              className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm outline-none"
            />
            <button className="px-5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black text-sm">
              <Search className="inline w-4 h-4 ml-1" /> Google
            </button>
          </form>
          <button
            onClick={handleYoutubeSearch}
            className="w-full mt-2 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-sm"
          >
            <Play className="inline w-4 h-4 ml-1" /> البحث في YouTube
          </button>
        </section>
      )}

      {activeTab === 'news' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-lg flex items-center gap-2">
              <Trophy className="text-amber-500" /> {isAr ? 'الرياضة — نتائج وجداول وأخبار' : 'Sports — Results, Tables & News'}
            </h2>
            <button
              onClick={refreshSportsTab}
              title={isAr ? 'تحديث بيانات القسم الحالي' : 'Refresh current section'}
              className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
            >
              <RefreshCw className={`w-4 h-4 ${newsLoading || sportsLoading || leagueLoading || favTeamLoading || nationalLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* [football-free] شريط التابات الفرعية: النتائج / الترتيب والجداول / فريقك المفضل / منتخب مصر / أخبار رياضة */}
          <div className="flex gap-1.5 overflow-x-auto p-1.5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 no-scrollbar">
            {([
              ['results', 'النتائج', 'Results', <Activity key="i" className="w-4 h-4" />],
              ['standings', 'الترتيب والجداول', 'Standings', <Trophy key="i" className="w-4 h-4" />],
              ['favteam', 'فريقك المفضل', 'Favorite Club', <Heart key="i" className="w-4 h-4" />],
              ...(showNationalTeam ? [['national', 'منتخب مصر', 'National Team', <Flag key="i" className="w-4 h-4" />] as const] : []),
              ['newsfeed', 'أخبار رياضة', 'Sports News', <Newspaper key="i" className="w-4 h-4" />],
            ] as const).map(([key, ar, en, icon]) => (
              <button
                key={key}
                onClick={() => setSportsSubTab(key as SportsSubTab)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  sportsSubTab === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {icon}
                {isAr ? ar : en}
              </button>
            ))}
          </div>

          {/* ============ 1) النتائج المباشرة + نتائج الدوري المصري + القادمة ============ */}
          {sportsSubTab === 'results' && (
            <>
              <div className="rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-black text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> النتائج المباشرة الآن
                </div>
                {sportsLoading && <div className="p-5 text-sm text-slate-500">جاري تحميل المباريات المباشرة…</div>}
                {liveMatches.slice(0, 8).map((m, i) => (
                  <div
                    key={`live-${m.fixture?.id || i}`}
                    className="p-3 border-b last:border-0 border-slate-100 dark:border-slate-800 flex justify-between items-center"
                  >
                    <div className="text-xs">
                      <div className="text-slate-500">{m.league?.name || 'مباراة'}</div>
                      <b>{m.teams?.home?.name || 'Home'}</b>
                      <br />
                      <b>{m.teams?.away?.name || 'Away'}</b>
                    </div>
                    <div className="font-black">
                      {m.goals?.home ?? '-'} : {m.goals?.away ?? '-'}
                    </div>
                  </div>
                ))}
                {!sportsLoading && !liveMatches.length && (
                  <div className="p-5 text-sm text-slate-500">
                    لا توجد مباريات مباشرة الآن — تصفح أحدث نتائج الدوري المصري أدناه.
                  </div>
                )}
              </div>

              {/* أحدث نتائج الدوري المصري */}
              <div className="rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-black text-sm flex items-center justify-between">
                  <span>🇪🇬 أحدث نتائج الدوري المصري</span>
                  {leagueData?.season && <span className="text-[10px] font-bold text-slate-400">موسم {leagueData.season}</span>}
                </div>
                {leagueLoading && <div className="p-5 text-sm text-slate-500">جاري تحميل نتائج الدوري…</div>}
                {!leagueLoading && (leagueData?.recent?.length ? leagueData.recent : []).map((m, i) => (
                  <div key={`rec-${m.fixture?.id || i}`} className="p-3 border-b last:border-0 border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold flex-1">
                        <div>{m.teams?.home?.name || '—'}</div>
                        <div className="mt-1">{m.teams?.away?.name || '—'}</div>
                      </div>
                      <div className="text-center font-black text-sm bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-1.5">
                        {m.goals?.home ?? '-'} : {m.goals?.away ?? '-'}
                      </div>
                      <div className="text-[10px] text-slate-400 w-16 text-left shrink-0">
                        {formatMatchDate(m.fixture?.date)}
                        <div className="mt-0.5">{statusLabelAr(m.fixture?.status?.short, isAr)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {!leagueLoading && !(leagueData?.recent?.length) && (
                  <div className="p-5 text-sm text-slate-500">لا توجد نتائج حديثة متاحة حاليًا — جرب التحديث بعد قليل.</div>
                )}
              </div>

              {/* المباريات القادمة */}
              <div className="rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-black text-sm">📅 المباريات القادمة — الدوري المصري</div>
                {!leagueLoading && (leagueData?.upcoming?.length ? leagueData.upcoming : []).map((m, i) => (
                  <div key={`up-${m.fixture?.id || i}`} className="p-3 border-b last:border-0 border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="text-xs font-bold">
                      {m.teams?.home?.name || '—'} <span className="text-slate-400">×</span> {m.teams?.away?.name || '—'}
                    </div>
                    <div className="text-[10px] text-slate-400 shrink-0 text-left">{formatMatchDate(m.fixture?.date)}</div>
                  </div>
                ))}
                {!leagueLoading && !(leagueData?.upcoming?.length) && (
                  <div className="p-5 text-sm text-slate-500">لا توجد مباريات قادمة معلنة حاليًا.</div>
                )}
              </div>
            </>
          )}

          {/* ============ 2) الترتيب والجداول: الدوري المصري / تصفيات كأس العالم / أمم أفريقيا ============ */}
          {sportsSubTab === 'standings' && (
            <>
              <div className="flex gap-1.5 overflow-x-auto p-1.5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 no-scrollbar">
                {FOOTBALL_LEAGUES.map((lg) => (
                  <button
                    key={lg.id}
                    onClick={() => setLeagueKey(lg.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      leagueKey === lg.id
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {lg.emoji} {isAr ? lg.labelAr : lg.labelEn}
                  </button>
                ))}
              </div>

              {leagueLoading && (
                <div className="py-10 text-center text-slate-500">جاري تحميل جدول الترتيب…</div>
              )}

              {/* الدوري المصري: جدول ترتيب واحد */}
              {!leagueLoading && leagueKey === 'egypt' && (leagueData?.standings?.length ? (
                <div className="rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-black text-sm">🇪🇬 جدول ترتيب الدوري المصري</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
                          <th className="p-2 font-bold">#</th>
                          <th className="p-2 font-bold text-right">الفريق</th>
                          <th className="p-2 font-bold">لعب</th>
                          <th className="p-2 font-bold">فاز</th>
                          <th className="p-2 font-bold">تعادل</th>
                          <th className="p-2 font-bold">خسر</th>
                          <th className="p-2 font-bold">+/-</th>
                          <th className="p-2 font-bold">نقاط</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leagueData.standings.map((row, i) => (
                          <tr key={row.id || row.team || i} className={`border-t border-slate-100 dark:border-slate-800 ${isFavTeamRow(row.team, favTeam) ? 'bg-emerald-500/10' : ''}`}>
                            <td className="p-2 text-center font-black">{row.rank || i + 1}</td>
                            <td className="p-2 font-bold whitespace-nowrap">{row.team}</td>
                            <td className="p-2 text-center">{row.played}</td>
                            <td className="p-2 text-center">{row.won}</td>
                            <td className="p-2 text-center">{row.drawn}</td>
                            <td className="p-2 text-center">{row.lost}</td>
                            <td className="p-2 text-center">{typeof row.goalDiff === 'number' && row.goalDiff > 0 ? `+${row.goalDiff}` : (row.goalDiff ?? 0)}</td>
                            <td className="p-2 text-center font-black text-blue-600 dark:text-blue-400">{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-500">
                  لم يتوفر جدول ترتيب للدوري المصري حاليًا — جرب التحديث بعد قليل.
                </div>
              ))}

              {/* التصفيات وأمم أفريقيا: مجموعات */}
              {!leagueLoading && leagueKey !== 'egypt' && (leagueData?.groups?.length ? leagueData.groups : []).map((g, gi) => (
                <div key={g.rawName || gi} className="rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-black text-sm">
                    {FOOTBALL_LEAGUES.find((lg) => lg.id === leagueKey)?.emoji} {g.name}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
                          <th className="p-2 font-bold">#</th>
                          <th className="p-2 font-bold text-right">المنتخب</th>
                          <th className="p-2 font-bold">لعب</th>
                          <th className="p-2 font-bold">فاز</th>
                          <th className="p-2 font-bold">تعادل</th>
                          <th className="p-2 font-bold">خسر</th>
                          <th className="p-2 font-bold">+/-</th>
                          <th className="p-2 font-bold">نقاط</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.teams.map((row, i) => (
                          <tr key={row.id || row.team || i} className={`border-t border-slate-100 dark:border-slate-800 ${isFavTeamRow(row.team, isAr ? 'المنتخب المصري' : 'Egypt') ? 'bg-emerald-500/10' : ''}`}>
                            <td className="p-2 text-center font-black">{row.rank || i + 1}</td>
                            <td className="p-2 font-bold whitespace-nowrap">{row.team}</td>
                            <td className="p-2 text-center">{row.played}</td>
                            <td className="p-2 text-center">{row.won}</td>
                            <td className="p-2 text-center">{row.drawn}</td>
                            <td className="p-2 text-center">{row.lost}</td>
                            <td className="p-2 text-center">{typeof row.goalDiff === 'number' && row.goalDiff > 0 ? `+${row.goalDiff}` : (row.goalDiff ?? 0)}</td>
                            <td className="p-2 text-center font-black text-blue-600 dark:text-blue-400">{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {!leagueLoading && leagueKey !== 'egypt' && !(leagueData?.groups?.length) && (
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-500">
                  لم تتوفر جداول هذه البطولة حاليًا — جرب التحديث بعد قليل.
                </div>
              )}
            </>
          )}

          {/* ============ 3) فريقك المفضل: ملخص + أخبار ============ */}
          {sportsSubTab === 'favteam' && (
            <TeamSummaryBlock
              isAr={isAr}
              title={isAr ? `⚽ فريقك المفضل — ${favTeam}` : `Favorite Club — ${favTeam}`}
              loading={favTeamLoading}
              summary={favTeamSummary}
              articles={favTeamNews}
            />
          )}

          {/* ============ 4) منتخب مصر: ملخص + أخبار (قابل للإخفاء من الإعدادات) ============ */}
          {sportsSubTab === 'national' && (
            <TeamSummaryBlock
              isAr={isAr}
              title={isAr ? '🇪🇬 منتخب مصر — أخبار ومباريات ونتائج' : 'Egypt National Team — News & Results'}
              loading={nationalLoading}
              summary={nationalSummary}
              articles={nationalNews}
            />
          )}

          {/* ============ 5) أخبار رياضة ============ */}
          {sportsSubTab === 'newsfeed' && (
            <div className="space-y-3">
              {newsLoading ? (
                <div className="py-10 text-center text-slate-500">جاري تحميل الأخبار...</div>
              ) : news.length ? (
                news.map((n, i) => (
                  <a
                    key={`${n.url}-${i}`}
                    href={n.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center shrink-0">
                      <Newspaper className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm leading-6">{n.title}</h3>
                      <p className="text-[11px] text-slate-500 mt-1">{n.source?.name || 'مصدر إخباري'}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 shrink-0" />
                  </a>
                ))
              ) : (
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-500">
                  لم تصل أخبار مباشرة حاليًا.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {isAdding && (
        <form
          onSubmit={addWorkout}
          className="fixed inset-x-4 bottom-4 z-50 max-w-lg mx-auto rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-5 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black">تسجيل تمرين</h3>
            <button type="button" onClick={() => setIsAdding(false)}>
              ✕
            </button>
          </div>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="اسم التمرين"
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent mb-2"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              placeholder="الدقائق"
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"
            />
            <input
              type="number"
              value={newCalories}
              onChange={(e) => setNewCalories(e.target.value)}
              placeholder="السعرات"
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"
            />
          </div>
          <button className="w-full mt-3 py-3 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black">
            حفظ التمرين
          </button>
        </form>
      )}
      {activeTab === 'home' && (
        <button
          onClick={() => setIsAdding(true)}
          className="fixed bottom-5 left-5 z-40 rounded-full px-4 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black shadow-xl"
        >
          <PlusIcon /> إضافة تمرين
        </button>
      )}
    </div>
  );
};

function PlusIcon() {
  return <span className="inline-block ml-1">＋</span>;
}
