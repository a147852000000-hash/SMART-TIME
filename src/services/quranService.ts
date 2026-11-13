import { QuranReadingPosition, QuranBookmark } from '../types';
import { StorageAdapter } from './storageAdapter';

export interface QuranSurahInfo {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  ayahsCount: number;
  type: 'مكية' | 'مدنية';
  startPage: number;
}

export interface QuranVerseItem {
  num: number;
  text: string;
  page: number;
  juz: number;
  stopMark?: string; // مـ, لا, ج, صلى, قلى
  stopDescription?: string;
}

export interface QuranPunctuationSign {
  symbol: string;
  nameAr: string;
  description: string;
  rule: string;
  color: string;
}

// Quranic Stopping and Punctuation Signs Guide
export const QURANIC_PUNCTUATION_SIGNS: QuranPunctuationSign[] = [
  {
    symbol: 'مـ',
    nameAr: 'وقف لازم',
    description: 'يلزم الوقف هنا، لأن الوصل قد يغير المعنى المراد.',
    rule: 'وجوب الوقف والابتداء بما بعده',
    color: 'emerald',
  },
  {
    symbol: 'قلى',
    nameAr: 'الوقف أولى',
    description: 'يجوز الوصل ولكن الوقف على هذه الكلمة أرجح وأولى.',
    rule: 'جواز الأمرين مع رجحان الوقف',
    color: 'amber',
  },
  {
    symbol: 'ج',
    nameAr: 'وقف جائز',
    description: 'يجوز الوقف ويجوز الوصل على السواء دون ترجيح أحدهما على الآخر.',
    rule: 'جواز الوقف والوصل باستواء',
    color: 'sky',
  },
  {
    symbol: 'صلى',
    nameAr: 'الوصل أولى',
    description: 'يجوز الوقف ولكن الوصل مع ما بعده أرجح وأولى.',
    rule: 'جواز الأمرين مع رجحان الوصل',
    color: 'indigo',
  },
  {
    symbol: 'لا',
    nameAr: 'لا تقف',
    description: 'النهي عن الوقف هنا، لأن المعنى لم يتم بعد، والوصل واجب إلا لضرورة انقطاع النفس.',
    rule: 'وجوب الوصل والنهي عن الوقف القاطع للمعنى',
    color: 'rose',
  },
  {
    symbol: '∴ ∴',
    nameAr: 'تعانق الوقف (المراقبة)',
    description: 'موضعان متقاربان للوقف، إذا وقفت على أحدهما امتنع الوقف على الآخر.',
    rule: 'الوقف على أحدهما دون الآخر',
    color: 'purple',
  },
  {
    symbol: '۝',
    nameAr: 'علامة نهاية الآية وترقيمها',
    description: 'سنة متبعة عن النبي ﷺ للوقف على رؤوس الآي وترقيم موضع القراءة.',
    rule: 'سنة مؤكدة للوقف وتحديد الورد والوقفات',
    color: 'amber',
  },
];

// Surah index for the offline picker. NOT the full 114 list: only surahs
// whose metadata is present in the repo are listed, so the UI never shows a
// surah with made-up metadata. Complete mushaf data comes from the online
// fetch path (alquran.cloud) instead.
export const ALL_SURAHS: QuranSurahInfo[] = [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Fatihah', englishNameTranslation: 'The Opening', ayahsCount: 7, type: 'مكية', startPage: 1 },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqarah', englishNameTranslation: 'The Cow', ayahsCount: 286, type: 'مدنية', startPage: 2 },
  { number: 3, name: 'آل عمران', englishName: 'Ali \'Imran', englishNameTranslation: 'Family of Imran', ayahsCount: 200, type: 'مدنية', startPage: 50 },
  { number: 4, name: 'النساء', englishName: 'An-Nisa', englishNameTranslation: 'The Women', ayahsCount: 176, type: 'مدنية', startPage: 77 },
  { number: 5, name: 'المائدة', englishName: 'Al-Ma\'idah', englishNameTranslation: 'The Table Spread', ayahsCount: 120, type: 'مدنية', startPage: 106 },
  { number: 6, name: 'الأنعام', englishName: 'Al-An\'am', englishNameTranslation: 'The Cattle', ayahsCount: 165, type: 'مكية', startPage: 128 },
  { number: 7, name: 'الأعراف', englishName: 'Al-A\'raf', englishNameTranslation: 'The Heights', ayahsCount: 206, type: 'مكية', startPage: 151 },
  { number: 8, name: 'الأنفال', englishName: 'Al-Anfal', englishNameTranslation: 'The Spoils of War', ayahsCount: 75, type: 'مدنية', startPage: 177 },
  { number: 9, name: 'التوبة', englishName: 'At-Tawbah', englishNameTranslation: 'The Repentance', ayahsCount: 129, type: 'مدنية', startPage: 187 },
  { number: 10, name: 'يونس', englishName: 'Yunus', englishNameTranslation: 'Jonah', ayahsCount: 109, type: 'مكية', startPage: 208 },
  { number: 11, name: 'هود', englishName: 'Hud', englishNameTranslation: 'Hud', ayahsCount: 123, type: 'مكية', startPage: 221 },
  { number: 12, name: 'يوسف', englishName: 'Yusuf', englishNameTranslation: 'Joseph', ayahsCount: 111, type: 'مكية', startPage: 235 },
  { number: 13, name: 'الرعد', englishName: 'Ar-Ra\'d', englishNameTranslation: 'The Thunder', ayahsCount: 43, type: 'مدنية', startPage: 249 },
  { number: 14, name: 'إبراهيم', englishName: 'Ibrahim', englishNameTranslation: 'Abraham', ayahsCount: 52, type: 'مكية', startPage: 255 },
  { number: 15, name: 'الحجر', englishName: 'Al-Hijr', englishNameTranslation: 'The Rocky Tract', ayahsCount: 99, type: 'مكية', startPage: 262 },
  { number: 16, name: 'النحل', englishName: 'An-Nahl', englishNameTranslation: 'The Bee', ayahsCount: 128, type: 'مكية', startPage: 267 },
  { number: 17, name: 'الإسراء', englishName: 'Al-Isra', englishNameTranslation: 'The Night Journey', ayahsCount: 111, type: 'مكية', startPage: 282 },
  { number: 18, name: 'الكهف', englishName: 'Al-Kahf', englishNameTranslation: 'The Cave', ayahsCount: 110, type: 'مكية', startPage: 293 },
  { number: 19, name: 'مريم', englishName: 'Maryam', englishNameTranslation: 'Mary', ayahsCount: 98, type: 'مكية', startPage: 305 },
  { number: 20, name: 'طه', englishName: 'Taha', englishNameTranslation: 'Ta-Ha', ayahsCount: 135, type: 'مكية', startPage: 312 },
  { number: 36, name: 'يس', englishName: 'Ya-Sin', englishNameTranslation: 'Ya Sin', ayahsCount: 83, type: 'مكية', startPage: 440 },
  { number: 55, name: 'الرحمن', englishName: 'Ar-Rahman', englishNameTranslation: 'The Beneficent', ayahsCount: 78, type: 'مدنية', startPage: 531 },
  { number: 56, name: 'الواقعة', englishName: 'Al-Waqi\'ah', englishNameTranslation: 'The Inevitable', ayahsCount: 96, type: 'مكية', startPage: 534 },
  { number: 67, name: 'الملك', englishName: 'Al-Mulk', englishNameTranslation: 'The Sovereignty', ayahsCount: 30, type: 'مكية', startPage: 562 },
  { number: 108, name: 'الكوثر', englishName: 'Al-Kawthar', englishNameTranslation: 'Abundance', ayahsCount: 3, type: 'مكية', startPage: 602 },
  { number: 112, name: 'الإخلاص', englishName: 'Al-Ikhlas', englishNameTranslation: 'The Sincerity', ayahsCount: 4, type: 'مكية', startPage: 604 },
  { number: 113, name: 'الفلق', englishName: 'Al-Falaq', englishNameTranslation: 'The Daybreak', ayahsCount: 5, type: 'مكية', startPage: 604 },
  { number: 114, name: 'الناس', englishName: 'An-Nas', englishNameTranslation: 'Mankind', ayahsCount: 6, type: 'مكية', startPage: 604 },
];

// Offline embedded verses: ONLY surahs embedded COMPLETELY, verse-for-verse,
// with no fabricated tajweed/stop marks (a wrong stop mark is a religious
// ruling, so none are asserted here — stop marks must come from a verified
// mushaf source, not from code). Partial ("highlights") surahs were removed:
// showing 8 verses of Al-Baqarah as if it were the whole surah is misleading.
export const EMBEDDED_SURAH_VERSES: Record<number, QuranVerseItem[]> = {
  1: [
    { num: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', page: 1, juz: 1 },
    { num: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', page: 1, juz: 1 },
    { num: 3, text: 'الرَّحْمَٰنِ الرَّحِيمِ', page: 1, juz: 1 },
    { num: 4, text: 'مَالِكِ يَوْمِ الدِّينِ', page: 1, juz: 1 },
    { num: 5, text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', page: 1, juz: 1 },
    { num: 6, text: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', page: 1, juz: 1 },
    { num: 7, text: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ', page: 1, juz: 1 },
  ],

  108: [
    { num: 1, text: 'إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ', page: 602, juz: 30 },
    { num: 2, text: 'فَصَلِّ لِرَبِّكَ وَانْحَرْ', page: 602, juz: 30 },
    { num: 3, text: 'إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ', page: 602, juz: 30 },
  ],

  112: [
    { num: 1, text: 'قُلْ هُوَ اللَّهُ أَحَدٌ', page: 604, juz: 30 },
    { num: 2, text: 'اللَّهُ الصَّمَدُ', page: 604, juz: 30 },
    { num: 3, text: 'لَمْ يَلِدْ وَلَمْ يُولَدْ', page: 604, juz: 30 },
    { num: 4, text: 'وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ', page: 604, juz: 30 },
  ],

  113: [
    { num: 1, text: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ', page: 604, juz: 30 },
    { num: 2, text: 'مِن شَرِّ مَا خَلَقَ', page: 604, juz: 30 },
    { num: 3, text: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', page: 604, juz: 30 },
    { num: 4, text: 'وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ', page: 604, juz: 30 },
    { num: 5, text: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ', page: 604, juz: 30 },
  ],

  114: [
    { num: 1, text: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ', page: 604, juz: 30 },
    { num: 2, text: 'مَلِكِ النَّاسِ', page: 604, juz: 30 },
    { num: 3, text: 'إِلَٰهِ النَّاسِ', page: 604, juz: 30 },
    { num: 4, text: 'مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ', page: 604, juz: 30 },
    { num: 5, text: 'الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ', page: 604, juz: 30 },
    { num: 6, text: 'مِنَ الْجِنَّةِ وَالنَّاسِ', page: 604, juz: 30 },
  ],
};

const STORAGE_KEY_LAST_STOP = 'smart_time_quran_last_stop';
const STORAGE_KEY_BOOKMARKS = 'smart_time_quran_bookmarks';

export class QuranService {
  /**
   * Retrieves the user's last saved reading position / stop mark
   */
  static getLastStop(): QuranReadingPosition {
    const fallback: QuranReadingPosition = {
      surahNumber: 1,
      surahName: 'الفاتحة',
      ayahNumber: 1,
      pageNumber: 1,
      juzNumber: 1,
      timestamp: new Date().toISOString(),
    };
    return StorageAdapter.getItem<QuranReadingPosition>(STORAGE_KEY_LAST_STOP, fallback);
  }

  /**
   * Saves a new stop position when the user clicks any Ayah punctuation mark or stop button
   */
  static saveLastStop(position: QuranReadingPosition): void {
    StorageAdapter.setItem(STORAGE_KEY_LAST_STOP, {
      ...position,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Retrieves all saved bookmarks
   */
  static getBookmarks(): QuranBookmark[] {
    const defaultBookmarks: QuranBookmark[] = [
      {
        id: 'bm_default',
        surahNumber: 1,
        surahName: 'الفاتحة',
        ayahNumber: 1,
        pageNumber: 1,
        note: 'بداية الورد القرآني المبارك',
        createdAt: new Date().toISOString(),
      },
    ];
    return StorageAdapter.getItem<QuranBookmark[]>(STORAGE_KEY_BOOKMARKS, defaultBookmarks);
  }

  /**
   * Toggles or adds a bookmark
   */
  static toggleBookmark(item: { surahNumber: number; surahName: string; ayahNumber: number; pageNumber: number; note?: string }): { bookmarks: QuranBookmark[]; isAdded: boolean } {
    const list = this.getBookmarks();
    const existingIndex = list.findIndex(
      (b) => b.surahNumber === item.surahNumber && b.ayahNumber === item.ayahNumber
    );

    if (existingIndex >= 0) {
      const updated = list.filter((_, idx) => idx !== existingIndex);
      StorageAdapter.setItem(STORAGE_KEY_BOOKMARKS, updated);
      return { bookmarks: updated, isAdded: false };
    } else {
      const newBm: QuranBookmark = {
        id: `bm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        surahNumber: item.surahNumber,
        surahName: item.surahName,
        ayahNumber: item.ayahNumber,
        pageNumber: item.pageNumber,
        note: item.note || `علامة وقف في ${item.surahName} آية ${item.ayahNumber}`,
        createdAt: new Date().toISOString(),
      };
      const updated = [newBm, ...list];
      StorageAdapter.setItem(STORAGE_KEY_BOOKMARKS, updated);
      return { bookmarks: updated, isAdded: true };
    }
  }

  /**
   * Deletes a bookmark by ID
   */
  static deleteBookmark(id: string): QuranBookmark[] {
    const list = this.getBookmarks();
    const updated = list.filter((b) => b.id !== id);
    StorageAdapter.setItem(STORAGE_KEY_BOOKMARKS, updated);
    return updated;
  }

  /**
   * Gets verses for a Surah with instant fallback to embedded verses or online fetch
   */
  static async getSurahVerses(surahNumber: number): Promise<QuranVerseItem[]> {
    // 1. Check embedded verses
    if (EMBEDDED_SURAH_VERSES[surahNumber]) {
      return EMBEDDED_SURAH_VERSES[surahNumber];
    }

    // 2. Check cached surahs in localStorage
    const cacheKey = `smart_time_surah_cache_${surahNumber}`;
    const cached = StorageAdapter.getItem<QuranVerseItem[] | null>(cacheKey, null);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    // 3. Try fetching from public Al-Quran Cloud API with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/quran-uthmani`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data.ayahs)) {
          const surahMeta = ALL_SURAHS.find((s) => s.number === surahNumber);
          const startPage = surahMeta?.startPage || 1;

          // No synthetic stop marks: assigning وقف marks by modulo arithmetic
          // fabricates religious rulings. Real marks must come from a verified
          // mushaf source.
          const fetchedVerses: QuranVerseItem[] = json.data.ayahs.map((a: any) => ({
            num: a.numberInSurah,
            text: a.text,
            page: a.page || startPage,
            juz: a.juz || 1,
          }));

          StorageAdapter.setItem(cacheKey, fetchedVerses);
          return fetchedVerses;
        }
      }
    } catch (e) {
      // Offline fallback
    }

    // 4. Offline with no embedded/cache data: return an empty list. NEVER
    // fabricate placeholder "verses" — invented text presented as Quran is
    // religious misinformation. The UI shows an offline notice for empty lists.
    console.warn(`[QuranService] Offline and no cached verses for surah ${surahNumber}.`);
    return [];
  }
}
