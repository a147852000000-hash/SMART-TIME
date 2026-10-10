import { apiUrl } from './apiConfig';

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

export async function fetchLiveNews(language: 'ar' | 'en'): Promise<LiveNewsArticle[]> {
  try {
    const res = await fetch(apiUrl(`/api/live/news?lang=${language}&country=eg&category=general&max=10`));
    if (!res.ok) return [];
    const data = await res.json();
    return data.articles || [];
  } catch {
    return [];
  }
}

export async function fetchLiveSports(): Promise<LiveSportsMatch[]> {
  try {
    const res = await fetch(apiUrl('/api/live/sports?live=all'));
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
