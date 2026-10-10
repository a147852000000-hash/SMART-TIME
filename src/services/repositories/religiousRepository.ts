import { AthkarItem, QuranWirdProgress, ChristianPrayer, ChristianDailyReading, ReligiousPreference, QuranReadingPosition } from '../../types';
import { STORAGE_KEYS } from '../storageKeys';
import { StorageAdapter } from '../storageAdapter';
import {
  DEFAULT_ATHKAR,
  DEFAULT_QURAN_WIRD_PROGRESS,
  DEFAULT_CHRISTIAN_PRAYERS,
  DEFAULT_CHRISTIAN_DAILY_READING,
} from '../seedData';

export class ReligiousRepository {
  static getAthkarItems(): AthkarItem[] {
    return StorageAdapter.getItem<AthkarItem[]>(STORAGE_KEYS.ATHKAR_ITEMS, DEFAULT_ATHKAR);
  }

  static saveAthkarItems(items: AthkarItem[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.ATHKAR_ITEMS, items);
  }

  static incrementCounter(id: string): AthkarItem[] {
    const list = this.getAthkarItems();
    const updated = list.map((item) => {
      if (item.id === id) {
        return { ...item, currentCount: item.currentCount + 1 };
      }
      return item;
    });
    this.saveAthkarItems(updated);
    return updated;
  }

  static resetCounter(id: string): AthkarItem[] {
    const list = this.getAthkarItems();
    const updated = list.map((item) => (item.id === id ? { ...item, currentCount: 0 } : item));
    this.saveAthkarItems(updated);
    return updated;
  }

  static getQuranWird(): QuranWirdProgress {
    return StorageAdapter.getItem<QuranWirdProgress>('smart_time_quran_wird', DEFAULT_QURAN_WIRD_PROGRESS);
  }

  static saveQuranWird(wird: QuranWirdProgress): void {
    StorageAdapter.setItem('smart_time_quran_wird', wird);
  }

  static getChristianPrayers(): ChristianPrayer[] {
    return StorageAdapter.getItem<ChristianPrayer[]>('smart_time_christian_prayers', DEFAULT_CHRISTIAN_PRAYERS);
  }

  static getChristianDailyReading(): ChristianDailyReading {
    return StorageAdapter.getItem<ChristianDailyReading>('smart_time_christian_reading', DEFAULT_CHRISTIAN_DAILY_READING);
  }

  static getAdhanAlertEnabled(): boolean {
    return StorageAdapter.getItem<boolean>('smart_time_adhan_alert', true);
  }

  static setAdhanAlertEnabled(enabled: boolean): void {
    StorageAdapter.setItem('smart_time_adhan_alert', enabled);
  }

  static getLastReadingPosition(): QuranReadingPosition {
    return StorageAdapter.getItem<QuranReadingPosition>('smart_time_quran_last_stop', {
      surahNumber: 1,
      surahName: 'الفاتحة',
      ayahNumber: 1,
      pageNumber: 1,
      juzNumber: 1,
      timestamp: new Date().toISOString(),
    });
  }

  static saveLastReadingPosition(position: QuranReadingPosition): void {
    StorageAdapter.setItem('smart_time_quran_last_stop', position);
    // Also sync with wird
    const wird = this.getQuranWird();
    this.saveQuranWird({
      ...wird,
      currentPage: position.pageNumber,
      currentSurahName: `سورة ${position.surahName} (الآية ${position.ayahNumber})`,
      lastPosition: position,
    });
  }
}

