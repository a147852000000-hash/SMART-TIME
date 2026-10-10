import { STORAGE_KEYS } from './storageKeys';

export const StorageAdapter = {
  setItem<T>(key: string, value: T): boolean {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch {
      return false;
    }
  },

  getItem<T>(key: string, fallback: T | null = null): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as T;
      }
    } catch {
      return fallback;
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};
