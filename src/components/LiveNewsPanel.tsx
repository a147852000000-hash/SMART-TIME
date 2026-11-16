import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, ExternalLink, Newspaper, RefreshCw, Trophy } from 'lucide-react';
import { Language, UserProfile } from '../types';
import {
  fetchLiveNews,
  fetchFootballLeague,
  fetchFootballFixtures,
  FootballLeagueData,
  FootballLeagueKey,
  FootballStandingRow,
  FootballFixtureItem,
  LiveNewsArticle,
  NEWS_CATEGORIES,
  NewsCategory,
} from '../services/liveDataService';

interface LiveNewsPanelProps {
  language: Language;
  compact?: boolean;
  // [tables-fixtures-tabs] بيانات المستخدم: تتحكم في إظهار/إخفاء تابي الجداول والمواعيد + فريقه المفضل للتمييز في الجداول
  user?: UserProfile;
}

// [tables-fixtures-tabs] تابات اللوحة: تصنيفات الأخبار + تابي الجداول والمواعيد (قابلان للإخفاء من الإعدادات)
type PanelTab = NewsCategory | 'tables' | 'fixtures';

const TABLES_TAB_LABEL_AR = 'الجداول والترتيب';
const TABLES_TAB_LABEL_EN = 'Standings';
const FIXTURES_TAB_LABEL_AR = 'مواعيد المباريات';
const FIXTURES_TAB_LABEL_EN = 'Fixtures';

// تطبيع اسم الفريق للمقارنة (حذف «ال» التعريف والمسافات الزائدة) — نفس أسلوب تاب الرياضة
function normTeamName(s?: string | null): string {
  return String(s || '').replace(/ال\s*/u, '').replace(/\s+/g, ' ').trim();
}
// صف منتخب مصر في جداول التصفيات
function isEgyptTeamRow(teamName?: string | null): boolean {
  const n = normTeamName(teamName);
  return n === 'مصر' || n === 'Egypt' || n.startsWith('منتخب');
}
// صف فريقك المفضل في جدول الدوري
function isFavTeamRow(teamName?: string | null, favTeam?: string): boolean {
  if (!teamName || !favTeam) return false;
  return normTeamName(teamName) === normTeamName(favTeam);
}

// بطاقة جدول ترتيب مدمجة (تناسب عرض الشاشة في الرئيسية)
const StandingsTableCard: React.FC<{
  title: string;
  season?: string;
  rows: FootballStandingRow[];
  favTeam?: string;
  highlightEgypt?: boolean;
  loading: boolean;
  emptyText: string;
}> = ({ title, season, rows, favTeam, highlightEgypt, loading, emptyText }) => (
  <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
    <div className="p-3 border-b border-slate-100 dark:border-slate-800 font-black text-xs flex items-center justify-between gap-2">
      <span className="truncate">{title}</span>
      {season && <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">موسم {season}</span>}
    </div>
    {loading ? (
      <div className="py-6 text-center text-[11px] text-slate-500">جاري تحميل الجدول…</div>
    ) : rows.length ? (
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
              <th className="py-1.5 px-1 font-bold">#</th>
              <th className="py-1.5 px-1 font-bold text-right">الفريق</th>
              <th className="py-1.5 px-1 font-bold">ل</th>
              <th className="py-1.5 px-1 font-bold">ف</th>
              <th className="py-1.5 px-1 font-bold">ت</th>
              <th className="py-1.5 px-1 font-bold">خ</th>
              <th className="py-1.5 px-1 font-bold">+/−</th>
              <th className="py-1.5 px-1 font-bold">نقاط</th>
            </tr>
          </thead>
          <tbody>
            {rows
              // ترتيب الصفوف حسب المركز الفعلي (بعض المزودات تعيد الفرق بالأبجدية)
              .map((row, i) => ({ row, i }))
              .sort((a, b) => (a.row.rank || a.i + 1) - (b.row.rank || b.i + 1))
              .map(({ row, i }) => {
                const isFav = isFavTeamRow(row.team, favTeam);
                const isEgypt = highlightEgypt && isEgyptTeamRow(row.team);
                return (
                  <tr
                    key={row.id || `${row.team}-${i}`}
                    className={`border-t border-slate-100 dark:border-slate-800 ${isFav || isEgypt ? 'bg-emerald-500/10' : ''}`}
                  >
                    <td className="py-1.5 px-1 text-center font-black">{row.rank || i + 1}</td>
                    <td className="py-1.5 px-1 font-bold whitespace-nowrap">
                      {row.team}
                      {isFav && <span className="ms-1" title="فريقك المفضل">⭐</span>}
                      {isEgypt && <span className="ms-1" title="منتخب مصر">🦅</span>}
                    </td>
                    <td className="py-1.5 px-1 text-center">{row.played}</td>
                    <td className="py-1.5 px-1 text-center">{row.won}</td>
                    <td className="py-1.5 px-1 text-center">{row.drawn}</td>
                    <td className="py-1.5 px-1 text-center">{row.lost}</td>
                    <td className="py-1.5 px-1 text-center">
                      {typeof row.goalDiff === 'number' && row.goalDiff > 0 ? `+${row.goalDiff}` : (row.goalDiff ?? 0)}
                    </td>
                    <td className="py-1.5 px-1 text-center font-black text-blue-600 dark:text-blue-400">{row.points}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="p-4 text-[11px] text-slate-500">{emptyText}</div>
    )}
  </div>
);

// شارات نوع المباراة في تاب المواعيد
const FIXTURE_KIND_META: Record<string, { ar: string; en: string; emoji: string; cls: string }> = {
  local: { ar: 'محلية', en: 'Local', emoji: '🇪🇬', cls: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20' },
  national: { ar: 'منتخب مصر', en: 'Egypt NT', emoji: '🦅', cls: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20' },
  world: { ar: 'عالمية', en: 'World', emoji: '🌍', cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20' },
  fav: { ar: 'فريقك', en: 'Your team', emoji: '⭐', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
};

// عنوان اليوم: اليوم / غدًا / اسم اليوم والتاريخ
function fixtureDayLabel(item: FootballFixtureItem): string {
  const raw = item.dateEvent || (item.date ? String(item.date).slice(0, 10) : '');
  if (!raw) return '—';
  const dt = new Date(`${raw.slice(0, 10)}T12:00:00`);
  if (isNaN(dt.getTime())) return raw;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'غدًا';
  return dt.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
}
// وقت انطلاق المباراة بتوقيت المستخدم
function fixtureTimeLabel(item: FootballFixtureItem): string {
  const iso = item.date ? new Date(item.date) : null;
  if (iso && !isNaN(iso.getTime())) {
    return iso.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }
  if (item.timeEvent) return String(item.timeEvent).slice(0, 5);
  return '—';
}

export const LiveNewsPanel: React.FC<LiveNewsPanelProps> = ({ language, compact = false, user }) => {
  const isAr = language === 'ar';
  const [activeTab, setActiveTab] = useState<PanelTab>('general');
  // [news-categories] ذاكرة لكل تصنيف: الرجوع لتصنيف سبق جلبه يكون فوريًا بدون انتظار
  const [articlesByCat, setArticlesByCat] = useState<Record<string, LiveNewsArticle[]>>({});
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // ==================== [tables-fixtures-tabs] حالة تابي الجداول والمواعيد ====================
  const showTablesTab = user?.tickerPreferences?.showTablesTab !== false;
  const showFixturesTab = user?.tickerPreferences?.showFixturesTab !== false;
  const favTeam = user?.tickerPreferences?.favoriteTeam || user?.tickerPreferences?.favoriteEgyptianTeam || '';
  // تاب الجداول: الدوري المصري + جدول التصفيات المختار (تصفيات كأس العالم أو كأس أمم أفريقيا)
  const [qualKey, setQualKey] = useState<FootballLeagueKey>('wcq');
  const [egyptData, setEgyptData] = useState<FootballLeagueData | null>(null);
  const [qualData, setQualData] = useState<FootballLeagueData | null>(null);
  const [tablesLoading, setTablesLoading] = useState(false);
  // تاب المواعيد
  const [fixtures, setFixtures] = useState<FootballFixtureItem[] | null>(null);
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [kindFilter, setKindFilter] = useState<'all' | 'local' | 'world' | 'fav'>('all');

  const isNewsTab = activeTab !== 'tables' && activeTab !== 'fixtures';

  const refresh = async (cat: NewsCategory) => {
    setLoading(true);
    const data = await fetchLiveNews(language === 'fr' ? 'en' : language, cat);
    if (data.length) {
      setArticlesByCat((prev) => ({ ...prev, [cat]: data }));
      setUpdatedAt(new Date());
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isNewsTab) return; // تابا الجداول والمواعيد يجلبان بياناتهما في مؤثرات مستقلة
    refresh(activeTab as NewsCategory);
    const timer = window.setInterval(() => refresh(activeTab as NewsCategory), 300_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, language]);

  // [tables-fixtures-tabs] تحميل الجداول: الدوري المصري + التصفيات المختارة (كاش السيرفر يجعلها خفيفة)
  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    const [eg, qd] = await Promise.all([fetchFootballLeague('egypt'), fetchFootballLeague(qualKey)]);
    setEgyptData(eg);
    setQualData(qd);
    setTablesLoading(false);
  }, [qualKey]);

  // [tables-fixtures-tabs] تحميل مواعيد المباريات المهمة (يشمل فريقك المفضل)
  const loadFixtures = useCallback(async () => {
    setFixturesLoading(true);
    const list = await fetchFootballFixtures(favTeam || undefined);
    setFixtures(list);
    setFixturesLoading(false);
  }, [favTeam]);

  useEffect(() => {
    if (activeTab === 'tables') loadTables();
  }, [activeTab, loadTables]);
  useEffect(() => {
    if (activeTab === 'fixtures') loadFixtures();
  }, [activeTab, loadFixtures]);

  // لو أُخفي التاب النشط من الإعدادات نرجع تلقائيًا لتصنيف الأخبار الرئيسي
  useEffect(() => {
    if (activeTab === 'tables' && !showTablesTab) setActiveTab('general');
    if (activeTab === 'fixtures' && !showFixturesTab) setActiveTab('general');
  }, [showTablesTab, showFixturesTab, activeTab]);

  // زر التحديث يعيد جلب بيانات التاب النشط
  const handleRefresh = () => {
    if (activeTab === 'tables') loadTables();
    else if (activeTab === 'fixtures') loadFixtures();
    else refresh(activeTab as NewsCategory);
  };
  const busy = loading || tablesLoading || fixturesLoading;

  const articles = isNewsTab ? (articlesByCat[activeTab] || []) : [];
  const activeMeta = isNewsTab ? NEWS_CATEGORIES.find((c) => c.id === activeTab) : undefined;
  const activeExtraLabel = activeTab === 'tables'
    ? (isAr ? `🏆 ${TABLES_TAB_LABEL_AR}` : `🏆 ${TABLES_TAB_LABEL_EN}`)
    : activeTab === 'fixtures'
      ? (isAr ? `📅 ${FIXTURES_TAB_LABEL_AR}` : `📅 ${FIXTURES_TAB_LABEL_EN}`)
      : '';

  // ==================== [tables-fixtures-tabs] بيانات مشتقة لتاب الجداول ====================
  // المجموعة الافتراضية في جدول التصفيات: المجموعة التي بها منتخب مصر وإلا الأولى
  const defaultGroupName = useMemo(() => {
    const groups = qualData?.groups || [];
    const eg = groups.find((g) => g.teams.some((t) => isEgyptTeamRow(t.team)));
    return eg?.name || groups[0]?.name || '';
  }, [qualData]);
  const [selectedGroupName, setSelectedGroupName] = useState<string>('');
  const activeGroupName = selectedGroupName && (qualData?.groups || []).some((g) => g.name === selectedGroupName)
    ? selectedGroupName
    : defaultGroupName;
  const activeGroup = (qualData?.groups || []).find((g) => g.name === activeGroupName);
  useEffect(() => { setSelectedGroupName(''); }, [qualKey]); // عند تبديل البطولة نرجع لمجموعة مصر

  // ==================== [tables-fixtures-tabs] بيانات مشتقة لتاب المواعيد ====================
  const fixturesWithFilter = useMemo(() => {
    const list = fixtures || [];
    if (kindFilter === 'all') return list;
    if (kindFilter === 'local') return list.filter((f) => f.kind === 'local' || f.kind === 'national');
    return list.filter((f) => f.kind === kindFilter);
  }, [fixtures, kindFilter]);
  const fixturesByDay = useMemo(() => {
    const map = new Map<string, FootballFixtureItem[]>();
    for (const f of fixturesWithFilter) {
      const key = (f.dateEvent || (f.date ? String(f.date).slice(0, 10) : '')) || '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [fixturesWithFilter]);
  const favFixturesCount = (fixtures || []).filter((f) => f.kind === 'fav').length;

  return (
    <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
            {activeTab === 'tables' ? <Trophy className="w-5 h-5" /> : activeTab === 'fixtures' ? <CalendarClock className="w-5 h-5" /> : <Newspaper className="w-5 h-5" />}
          </span>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {activeTab === 'tables' ? (isAr ? 'الجداول والترتيب' : 'Standings') : activeTab === 'fixtures' ? (isAr ? 'مواعيد المباريات المهمة' : 'Key Fixtures') : (isAr ? 'آخر الأخبار' : 'Latest News')}
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {activeMeta
                ? `${activeMeta.emoji} ${isAr ? activeMeta.labelAr : activeMeta.labelEn} — `
                : activeExtraLabel ? `${activeExtraLabel} — ` : ''}
              {updatedAt ? (isAr ? `آخر تحديث ${updatedAt.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}` : `Updated ${updatedAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`) : (isAr ? 'متصل بالإنترنت' : 'Internet feed')}
            </p>
          </div>
        </div>
        <button onClick={handleRefresh} disabled={busy} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title={isAr ? 'تحديث' : 'Refresh'}>
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* [news-categories] تبويبات التصنيفات + [tables-fixtures-tabs] تابا الجداول والمواعيد */}
      <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
        {NEWS_CATEGORIES.map((cat) => {
          const isActive = cat.id === activeTab;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition-colors shrink-0 ${
                isActive
                  ? 'bg-blue-500 text-white border-blue-500 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'
              }`}
              title={isAr ? `عرض ${cat.labelAr}` : `Show ${cat.labelEn}`}
            >
              {cat.emoji} {isAr ? cat.labelAr : cat.labelEn}
            </button>
          );
        })}
        {/* [tables-fixtures-tabs] تابا الجداول والمواعيد — يظهران أو يخفيان من إعدادات شريط الأخبار */}
        {showTablesTab && (
          <button
            onClick={() => setActiveTab('tables')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition-colors shrink-0 ${
              activeTab === 'tables'
                ? 'bg-blue-500 text-white border-blue-500 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'
            }`}
            title={isAr ? 'جداول الدوري المصري والتصفيات' : 'Egyptian league & qualifiers standings'}
          >
            🏆 {isAr ? TABLES_TAB_LABEL_AR : TABLES_TAB_LABEL_EN}
          </button>
        )}
        {showFixturesTab && (
          <button
            onClick={() => setActiveTab('fixtures')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition-colors shrink-0 ${
              activeTab === 'fixtures'
                ? 'bg-blue-500 text-white border-blue-500 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'
            }`}
            title={isAr ? 'مواعيد المباريات المهمة المحلية والعالمية' : 'Key local & world fixtures'}
          >
            📅 {isAr ? FIXTURES_TAB_LABEL_AR : FIXTURES_TAB_LABEL_EN}
          </button>
        )}
      </div>

      {/* ==================== محتوى تابي الجداول والمواعيد ==================== */}
      {activeTab === 'tables' && (
        <div className="p-3 space-y-3">
          {/* جدول الدوري المصري */}
          <StandingsTableCard
            title={isAr ? '🇪🇬 جدول ترتيب الدوري المصري' : '🇪🇬 Egyptian Premier League'}
            season={egyptData?.season}
            rows={egyptData?.standings || []}
            favTeam={favTeam}
            loading={tablesLoading && !egyptData}
            emptyText={isAr ? 'لم يتوفر جدول الدوري المصري حاليًا — اضغط التحديث بعد قليل.' : 'Table unavailable right now.'}
          />

          {/* جدول التصفيات: تصفيات كأس العالم / كأس أمم أفريقيا */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {([['wcq', 'تصفيات كأس العالم — أفريقيا', '🌍'], ['afcon', 'كأس أمم أفريقيا', '🏆']] as Array<[FootballLeagueKey, string, string]>).map(([key, arLabel, emoji]) => (
              <button
                key={key}
                onClick={() => setQualKey(key)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border transition-colors shrink-0 ${
                  qualKey === key
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {emoji} {isAr ? arLabel : (key === 'wcq' ? 'WC Qualifiers (CAF)' : 'Africa Cup of Nations')}
              </button>
            ))}
          </div>

          {/* مجموعات التصفيات مع اختيار المجموعة (افتراضيًا مجموعة مصر) */}
          {(qualData?.groups?.length || 0) > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(qualData?.groups || []).map((g) => (
                <button
                  key={g.rawName || g.name}
                  onClick={() => setSelectedGroupName(g.name)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border transition-colors shrink-0 ${
                    g.name === activeGroupName
                      ? 'bg-blue-500 text-white border-blue-500 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {g.name}
                  {g.teams.some((t) => isEgyptTeamRow(t.team)) && ' 🦅'}
                </button>
              ))}
            </div>
          )}
          {activeGroup && (
            <StandingsTableCard
              title={`${activeGroup.name}`}
              rows={activeGroup.teams}
              highlightEgypt
              loading={tablesLoading && !qualData}
              emptyText={isAr ? 'لا توجد بيانات لهذه المجموعة حاليًا.' : 'No data for this group.'}
            />
          )}
          {!tablesLoading && !(qualData?.groups?.length) && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
              لم تتوفر جداول التصفيات حاليًا — جرب التحديث بعد قليل.
            </div>
          )}
          <p className="text-[9px] text-slate-400 px-1">
            {isAr
              ? 'مصادر مجانية: TheSportsDB (الدوري المصري) وESPN (التصفيات) — يتم التحديث تلقائيًا كل 30 دقيقة على السيرفر'
              : 'Free sources: TheSportsDB & ESPN — cached server-side for 30 minutes'}
          </p>
        </div>
      )}

      {activeTab === 'fixtures' && (
        <div className="p-3 space-y-2">
          {/* فلتر نوع المباريات: الكل / المحلية / العالمية / فريقك */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {([
              ['all', 'الكل', '🗂️'],
              ['local', 'محلية', '🇪🇬'],
              ['world', 'عالمية', '🌍'],
              ...(favFixturesCount ? [['fav', `فريقك (${favFixturesCount})`, '⭐'] as const] : []),
            ] as Array<['all' | 'local' | 'world' | 'fav', string, string]>).map(([key, arLabel, emoji]) => (
              <button
                key={key}
                onClick={() => setKindFilter(key)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border transition-colors shrink-0 ${
                  kindFilter === key
                    ? 'bg-blue-500 text-white border-blue-500 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {emoji} {isAr ? arLabel : (key === 'all' ? 'All' : key === 'local' ? 'Local' : key === 'world' ? 'World' : 'Your team')}
              </button>
            ))}
          </div>

          {fixturesLoading && !fixtures && (
            <div className="py-6 text-center text-[11px] text-slate-500">جاري تحميل مواعيد المباريات…</div>
          )}
          {fixturesByDay.map(([dayKey, list]) => (
            <div key={dayKey} className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300">
                📆 {fixtureDayLabel(list[0])}{' '}
                <span className="text-slate-400 font-bold">
                  ({list.length === 1 ? (isAr ? 'مباراة واحدة' : '1 match') : list.length === 2 ? (isAr ? 'مباريتان' : '2 matches') : `${list.length} ${isAr ? 'مباريات' : 'matches'}`})
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.map((f, i) => {
                  const meta = FIXTURE_KIND_META[f.kind] || FIXTURE_KIND_META.world;
                  const isFavMatch = f.kind === 'fav';
                  return (
                    <div key={`${f.id}-${i}`} className={`px-3 py-2 ${isFavMatch ? 'bg-amber-500/5' : ''}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                          {f.league || 'مباراة'}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${meta.cls}`}>{meta.emoji} {isAr ? meta.ar : meta.en}</span>
                          <span className="text-[10px] font-mono font-bold text-slate-500">{fixtureTimeLabel(f)}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                        <span className={`flex-1 truncate ${isFavMatch && f.homeLatin ? '' : ''} text-slate-900 dark:text-slate-100`}>{f.home}</span>
                        <span className="text-[9px] text-slate-400 font-black shrink-0">×</span>
                        <span className="flex-1 truncate text-left text-slate-900 dark:text-slate-100">{f.away}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!fixturesLoading && fixtures && fixturesWithFilter.length === 0 && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
              {fixtures && fixtures.length ? 'لا توجد مباريات ضمن هذا الفلتر حاليًا.' : 'لم تتوفر مواعيد مباريات حاليًا — اضغط التحديث بعد قليل.'}
            </div>
          )}
          <p className="text-[9px] text-slate-400 px-1">
            {isAr
              ? 'مواعيد مباريات الدوري المصري والأهلي والزمالك ومنتخب مصر وفريقك المفضل وكبار العالم — مصدر مجاني TheSportsDB مع كاش 15 دقيقة'
              : 'Egyptian league, Al Ahly, Zamalek, Egypt NT, your favorite club & top world clubs — free TheSportsDB source, 15-min cache'}
          </p>
        </div>
      )}

      {/* ==================== قائمة الأخبار (التصنيفات) ==================== */}
      {isNewsTab && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {(compact ? articles.slice(0,4) : articles.slice(0,10)).map((article, i) => (
            <a key={`${article.url}-${i}`} href={article.url} target="_blank" rel="noreferrer" className="block p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold leading-6 text-slate-900 dark:text-white">{article.title}</h4>
                  <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span>{article.source?.name || 'News'}</span>
                    {article.publishedAt && <span>• {new Date(article.publishedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US', {hour:'2-digit',minute:'2-digit'})}</span>}
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              </div>
            </a>
          ))}
          {!loading && articles.length === 0 && <div className="p-5 text-xs text-slate-500">{isAr ? 'تعذر جلب الأخبار الآن. سيتم إعادة المحاولة تلقائيًا.' : 'News is temporarily unavailable. Retrying automatically.'}</div>}
          {loading && articles.length === 0 && <div className="p-5 text-xs text-slate-500">{isAr ? 'جاري تحميل الأخبار…' : 'Loading news…'}</div>}
        </div>
      )}
    </section>
  );
};
