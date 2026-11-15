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

export async function fetchLiveNews(language: 'ar' | 'en', category: NewsCategory = 'general'): Promise<LiveNewsArticle[]> {
  try {
    // B-7: the GNews branch is reserved for signed-in sessions; anonymous
    // callers get the free RSS fallback server-side. authHeaders() is empty
    // for guests, so this is safe either way.
    const res = await fetch(apiUrl(`/api/live/news?lang=${language}&country=eg&category=${encodeURIComponent(category)}&max=10`), { headers: { ...authHeaders() } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.articles || [];
  } catch {
    return [];
  }
}

// [news-categories] تصنيفات الأخبار المدعومة في شريط الأخبار — كل تصنيف يُخدم
// من مصدر Google News RSS مجاني على السيرفر (بدون مفتاح وبدون حصة مدفوعة).
export type NewsCategory = 'general' | 'politics' | 'arab' | 'egypt' | 'accidents' | 'middle_east';

export const NEWS_CATEGORIES: { id: NewsCategory; labelAr: string; labelEn: string; emoji: string }[] = [
  { id: 'general', labelAr: 'الأخبار الرئيسية', labelEn: 'Top News', emoji: '📰' },
  { id: 'politics', labelAr: 'أخبار سياسية', labelEn: 'Politics', emoji: '🏛️' },
  { id: 'arab', labelAr: 'أخبار عربية', labelEn: 'Arab News', emoji: '🌍' },
  { id: 'egypt', labelAr: 'أخبار مصرية', labelEn: 'Egypt News', emoji: '🇪🇬' },
  { id: 'accidents', labelAr: 'أخبار حوادث', labelEn: 'Accidents', emoji: '🚨' },
  { id: 'middle_east', labelAr: 'الشرق الأوسط', labelEn: 'Middle East', emoji: '🕌' },
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
