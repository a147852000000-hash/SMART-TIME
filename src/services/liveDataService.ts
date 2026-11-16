import { apiUrl } from './apiConfig';
import { authHeaders } from './authService';

export interface LiveMarketData {
  source: string;
  fetchedAt: string;
  gold?: any;
  silver?: any;
  currencies?: Record<string, number>;
  crypto?: Record<string, { usd: number; usd_24h_change?: number }>;
}

export interface LiveNewsArticle {
  title: string;
  description?: string;
  url: string;
  image?: string;
  publishedAt?: string;
  source?: { name?: string; url?: string };
}

export interface LiveSportsMatch {
  fixture?: { id?: number; date?: string; status?: { short?: string; long?: string; elapsed?: number } };
  teams?: { home?: { name?: string; logo?: string }; away?: { name?: string; logo?: string } };
  goals?: { home?: number | null; away?: number | null };
  league?: { name?: string; logo?: string; country?: string };
}

export async function fetchLiveMarket(signal?: AbortSignal): Promise<LiveMarketData | null> {
  try {
    const res = await fetch(apiUrl('/api/live/market'), { signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchLiveNews(language: 'ar' | 'en', category: NewsCategory = 'general', max: number = 30): Promise<LiveNewsArticle[]> {
  try {
    // B-7: the GNews branch is reserved for signed-in sessions; anonymous
    // callers get the free RSS fallback server-side. authHeaders() is empty
    // for guests, so this is safe either way.
    const res = await fetch(apiUrl(`/api/live/news?lang=${language}&country=eg&category=${encodeURIComponent(category)}&max=${max}`), { headers: { ...authHeaders() } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.articles || [];
  } catch {
    return [];
  }
}

// [news-categories] تصنيفات الأخبار المدعومة في شريط الأخبار — كل تصنيف يُخدم
// من مصدر Google News RSS مجاني على السيرفر (بدون مفتاح وبدون حصة مدفوعة).
export type NewsCategory = 'general' | 'politics' | 'arab' | 'egypt' | 'accidents' | 'middle_east' | 'sports';

export const NEWS_CATEGORIES: { id: NewsCategory; labelAr: string; labelEn: string; emoji: string }[] = [
  { id: 'general', labelAr: 'الأخبار الرئيسية', labelEn: 'Top News', emoji: '📰' },
  { id: 'politics', labelAr: 'أخبار سياسية', labelEn: 'Politics', emoji: '🏛️' },
  { id: 'arab', labelAr: 'أخبار عربية', labelEn: 'Arab News', emoji: '🌍' },
  { id: 'egypt', labelAr: 'أخبار مصرية', labelEn: 'Egypt News', emoji: '🇪🇬' },
  { id: 'accidents', labelAr: 'أخبار حوادث', labelEn: 'Accidents', emoji: '🚨' },
  { id: 'middle_east', labelAr: 'الشرق الأوسط', labelEn: 'Middle East', emoji: '🕌' },
  // [football-free] تصنيف رياضة عام يظهر في الشريط والنافذة وتاب الرياضة
  { id: 'sports', labelAr: 'أخبار رياضة', labelEn: 'Sports', emoji: '⚽' },
];

export const ALL_NEWS_CATEGORY_IDS: NewsCategory[] = NEWS_CATEGORIES.map((c) => c.id);

export async function fetchLiveSports(): Promise<LiveSportsMatch[]> {
  try {
    const res = await fetch(apiUrl('/api/live/sports?live=all'), { headers: { ...authHeaders() } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.matches || [];
  } catch {
    return [];
  }
}

// ==================== [football-free] كرة القدم المجانية ====================
// بيانات الدوري المصري والتصفيات الأفريقية وأمم أفريقيا وأخبار الفرق —
// كلها من مصادر مجانية بدون مفاتيح (TheSportsDB + ESPN + Google News RSS) عبر السيرفر.
export interface FootballStandingRow {
  id?: string;
  rank: number;
  team: string;
  latinName?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDiff?: number;
  points: number;
}

export interface FootballStandingGroup {
  name: string;
  rawName?: string;
  teams: FootballStandingRow[];
}

export interface FootballLeagueEvent {
  fixture?: { id?: number; date?: string; status?: { short?: string; long?: string } };
  teams?: { home?: { name?: string; latinName?: string; logo?: string }; away?: { name?: string; latinName?: string; logo?: string } };
  goals?: { home?: number | null; away?: number | null };
  league?: { name?: string; country?: string };
  venue?: string;
}

export interface FootballLeagueData {
  source?: string;
  league: 'egypt' | 'wcq' | 'afcon';
  season?: string;
  fetchedAt?: string;
  status?: string;
  stale?: boolean;
  // الدوري المصري: ترتيب مزدوج + نتائج + مباريات قادمة
  standings?: FootballStandingRow[];
  recent?: FootballLeagueEvent[];
  upcoming?: FootballLeagueEvent[];
  // التصفيات وأمم أفريقيا: مجموعات
  groups?: FootballStandingGroup[];
}

export interface FootballTeamSummary {
  source?: string;
  stale?: boolean;
  team?: { id?: string; name?: string; latinName?: string; league?: string; badge?: string };
  next?: { kind?: string; date?: string; dateEvent?: string; status?: string; home?: string; away?: string; homeScore?: number | null; awayScore?: number | null; league?: string } | null;
  last?: { kind?: string; date?: string; dateEvent?: string; status?: string; home?: string; away?: string; homeScore?: number | null; awayScore?: number | null; league?: string } | null;
}

export type FootballLeagueKey = 'egypt' | 'wcq' | 'afcon';

export const FOOTBALL_LEAGUES: { id: FootballLeagueKey; labelAr: string; labelEn: string; emoji: string }[] = [
  { id: 'egypt', labelAr: 'الدوري المصري', labelEn: 'Egyptian Premier League', emoji: '🇪🇬' },
  { id: 'wcq', labelAr: 'تصفيات كأس العالم — أفريقيا', labelEn: 'World Cup Qualifiers (CAF)', emoji: '🌍' },
  { id: 'afcon', labelAr: 'كأس أمم أفريقيا', labelEn: 'Africa Cup of Nations', emoji: '🏆' },
];

/** ترتيب ونتائج البطولة (الدوري المصري حي — التصفيات وأمم أفريقيا مجموعات كاملة) */
export async function fetchFootballLeague(name: FootballLeagueKey): Promise<FootballLeagueData | null> {
  try {
    const res = await fetch(apiUrl(`/api/live/football/league?name=${encodeURIComponent(name)}`), { headers: { ...authHeaders() } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** ملخص فريق/منتخب: المباراة القادمة + آخر نتيجة */
export async function fetchFootballTeam(name: string): Promise<FootballTeamSummary | null> {
  try {
    const res = await fetch(apiUrl(`/api/live/football/team?name=${encodeURIComponent(name)}`), { headers: { ...authHeaders() } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ==================== [fixtures-tab] مواعيد المباريات المهمة المحلية والعالمية ====================
export interface FootballFixtureItem {
  id?: number | string;
  date?: string | null;      // ISO/UTC من المزود
  dateEvent?: string | null; // التاريخ الخام YYYY-MM-DD
  timeEvent?: string | null; // وقت البداية من المزود
  status?: string | null;
  home: string;
  away: string;
  homeLatin?: string;
  awayLatin?: string;
  homeLogo?: string;
  awayLogo?: string;
  league?: string;
  kind: 'local' | 'world' | 'national' | 'fav';
}

/** مواعيد مباريات مهمة مجتمعة: الدوري المصري والأهلي والزمالك ومنتخب مصر وكبار العالم + فريقك المفضل */
export async function fetchFootballFixtures(fav?: string, max: number = 24): Promise<FootballFixtureItem[]> {
  try {
    const q = new URLSearchParams({ max: String(max) });
    if (fav) q.set('fav', fav);
    const res = await fetch(apiUrl(`/api/live/football/fixtures?${q.toString()}`), { headers: { ...authHeaders() } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.fixtures) ? data.fixtures : [];
  } catch {
    return [];
  }
}

/** أخبار فريق أو منتخب محدد (Google News RSS مجاني عبر السيرفر) */
export async function fetchTeamNews(team: string): Promise<LiveNewsArticle[]> {
  try {
    const res = await fetch(apiUrl(`/api/live/team-news?team=${encodeURIComponent(team)}`), { headers: { ...authHeaders() } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.articles || [];
  } catch {
    return [];
  }
}


export interface LiveWeatherData {
  source: string;
  fetchedAt: string;
  city: string;
  temperatureC: number;
  humidity: number;
  windKmh: number;
  weatherCode: number;
}

export async function fetchLiveWeather(city?: string, signal?: AbortSignal): Promise<LiveWeatherData | null> {
  try {
    const q = city ? `?city=${encodeURIComponent(city)}` : '';
    const res = await fetch(apiUrl(`/api/live/weather${q}`), { signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
