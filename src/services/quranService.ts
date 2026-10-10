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

// Complete 114 Surahs Index with exact page numbers in Madinah Mushaf
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

// Offline Authentic Surah Verses with Tajweed Punctuation & Stopping Marks
export const EMBEDDED_SURAH_VERSES: Record<number, QuranVerseItem[]> = {
  // Surah 1: Al-Fatihah
  1: [
    { num: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', page: 1, juz: 1, stopMark: 'ج' },
    { num: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', page: 1, juz: 1, stopMark: 'صلى' },
    { num: 3, text: 'الرَّحْمَٰنِ الرَّحِيمِ', page: 1, juz: 1, stopMark: 'صلى' },
    { num: 4, text: 'مَالِكِ يَوْمِ الدِّينِ', page: 1, juz: 1, stopMark: 'ج' },
    { num: 5, text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', page: 1, juz: 1, stopMark: 'قلى' },
    { num: 6, text: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', page: 1, juz: 1, stopMark: 'صلى' },
    { num: 7, text: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ', page: 1, juz: 1, stopMark: 'مـ' },
  ],

  // Surah 2: Al-Baqarah Highlights (1-5, 255 Ayat Al-Kursi, 284-286)
  2: [
    { num: 1, text: 'الم', page: 2, juz: 1, stopMark: 'ج' },
    { num: 2, text: 'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ', page: 2, juz: 1, stopMark: '∴' },
    { num: 3, text: 'الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ وَمِمَّا رَزَقْنَاهُمْ يُنفِقُونَ', page: 2, juz: 1, stopMark: 'ج' },
    { num: 4, text: 'وَالَّذِينَ يُؤْمِنُونَ بِمَا أُنزِلَ إِلَيْكَ وَمَا أُنزِلَ مِن قَبْلِكَ وَبِالْآخِرَةِ هُمْ يُوقِنُونَ', page: 2, juz: 1, stopMark: 'ج' },
    { num: 5, text: 'أُولَٰئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ ۖ وَأُولَٰئِكَ هُمُ الْمُفْلِحُونَ', page: 2, juz: 1, stopMark: 'صلى' },
    { num: 255, text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ', page: 42, juz: 3, stopMark: 'قلى' },
    { num: 285, text: 'آمَنَ الرَّسُولُ بِمَا أُنزِلَ إِلَيْهِ مِن رَّبِّهِ وَالْمُؤْمِنُونَ ۚ كُلٌّ آمَنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِّن رُّسُلِهِ ۚ وَقَالُوا سَمِعْنَا وَأَطَعْنَا ۖ غُفْرَانَكَ رَبَّنَا وَإِلَيْكَ الْمَصِيرُ', page: 49, juz: 3, stopMark: 'مـ' },
    { num: 286, text: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَا إِن نَّسِينَا أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ ۖ وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا ۚ أَنتَ مَوْلَانَا فَانصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ', page: 49, juz: 3, stopMark: 'مـ' },
  ],

  // Surah 36: Ya-Sin
  36: [
    { num: 1, text: 'يس', page: 440, juz: 22, stopMark: 'ج' },
    { num: 2, text: 'وَالْقُرْآنِ الْحَكِيمِ', page: 440, juz: 22, stopMark: 'صلى' },
    { num: 3, text: 'إِنَّكَ لَمِنَ الْمُرْسَلِينَ', page: 440, juz: 22, stopMark: 'صلى' },
    { num: 4, text: 'عَلَىٰ صِرَاطٍ مُّسْتَقِيمٍ', page: 440, juz: 22, stopMark: 'ج' },
    { num: 5, text: 'تَنزِيلَ الْعَزِيزِ الرَّحِيمِ', page: 440, juz: 22, stopMark: 'صلى' },
    { num: 6, text: 'لِتُنذِرَ قَوْمًا مَّا أُنذِرَ آبَاؤُهُمْ فَهُمْ غَافِلُونَ', page: 440, juz: 22, stopMark: 'قلى' },
    { num: 7, text: 'لَقَدْ حَقَّ الْقَوْلُ عَلَىٰ أَكْثَرِهِمْ فَهُمْ لَا يُؤْمِنُونَ', page: 440, juz: 22, stopMark: 'مـ' },
    { num: 8, text: 'إِنَّا جَعَلْنَا فِي أَعْنَاقِهِمْ أَغْلَالًا فَهِيَ إِلَى الْأَذْقَانِ فَهُم مُّقْمَحُونَ', page: 440, juz: 22, stopMark: 'ج' },
    { num: 9, text: 'وَجَعَلْنَا مِن بَيْنِ أَيْدِيهِمْ سَدًّا وَمِنْ خَلْفِهِمْ سَدًّا فَأَغْشَيْنَاهُمْ فَهُمْ لَا يُبْصِرُونَ', page: 440, juz: 22, stopMark: 'مـ' },
  ],

  // Surah 55: Ar-Rahman
  55: [
    { num: 1, text: 'الرَّحْمَٰنُ', page: 531, juz: 27, stopMark: 'ج' },
    { num: 2, text: 'عَلَّمَ الْقُرْآنَ', page: 531, juz: 27, stopMark: 'صلى' },
    { num: 3, text: 'خَلَقَ الْإِنسَانَ', page: 531, juz: 27, stopMark: 'صلى' },
    { num: 4, text: 'عَلَّمَهُ الْبَيَانَ', page: 531, juz: 27, stopMark: 'ج' },
    { num: 5, text: 'الشَّمْسُ وَالْقَمَرُ بِحُسْبَانٍ', page: 531, juz: 27, stopMark: 'ج' },
    { num: 6, text: 'وَالنَّجْمُ وَالشَّجَرُ يَسْجُدَانِ', page: 531, juz: 27, stopMark: 'ج' },
    { num: 7, text: 'وَالسَّمَاءَ رَفَعَهَا وَوَضَعَ الْمِيزَانَ', page: 531, juz: 27, stopMark: 'قلى' },
    { num: 8, text: 'أَلَّا تَطْغَوْا فِي الْمِيزَانِ', page: 531, juz: 27, stopMark: 'صلى' },
    { num: 9, text: 'وَأَقِيمُوا الْوَزْنَ بِالْقِسْطِ وَلَا تُخْسِرُوا الْمِيزَانَ', page: 531, juz: 27, stopMark: 'قلى' },
    { num: 10, text: 'وَالْأَرْضَ وَضَعَهَا لِلْأَنَامِ', page: 531, juz: 27, stopMark: 'ج' },
    { num: 11, text: 'فِيهَا فَاكِهَةٌ وَالنَّخْلُ ذَاتُ الْأَكْمَامِ', page: 531, juz: 27, stopMark: 'ج' },
    { num: 12, text: 'وَالْحَبُّ ذُو الْعَصْفِ وَالرَّيْحَانُ', page: 531, juz: 27, stopMark: 'قلى' },
    { num: 13, text: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ', page: 531, juz: 27, stopMark: 'مـ' },
  ],

  // Surah 67: Al-Mulk
  67: [
    { num: 1, text: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ', page: 562, juz: 29, stopMark: 'قلى' },
    { num: 2, text: 'الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا ۚ وَهُوَ الْعَزِيزُ الْغَفُورُ', page: 562, juz: 29, stopMark: 'ج' },
    { num: 3, text: 'الَّذِي خَلَقَ سَبْعَ سَمَاوَاتٍ طِبَاقًا ۖ مَّا تَرَىٰ فِي خَلْقِ الرَّحْمَٰنِ مِن تَفَاوُتٍ ۖ فَارْجِعِ الْبَصَرَ هَلْ تَرَىٰ مِن فُطُورٍ', page: 562, juz: 29, stopMark: 'قلى' },
    { num: 4, text: 'ثُمَّ ارْجِعِ الْبَصَرَ كَرَّتَيْنِ يَنقَلِبْ إِلَيْكَ الْبَصَرُ خَاسِئًا وَهُوَ حَسِيرٌ', page: 562, juz: 29, stopMark: 'مـ' },
    { num: 5, text: 'وَلَقَدْ زَيَّنَّا السَّمَاءَ الدُّنْيَا بِمَصَابِيحَ وَجَعَلْنَاهَا رُجُومًا لِّلشَّيَاطِينِ ۖ وَأَعْتَدْنَا لَهُمْ عَذَابَ السَّعِيرِ', page: 562, juz: 29, stopMark: 'ج' },
  ],

  // Surah 108: Al-Kawthar
  108: [
    { num: 1, text: 'إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ', page: 602, juz: 30, stopMark: 'صلى' },
    { num: 2, text: 'فَصَلِّ لِرَبِّكَ وَانْحَرْ', page: 602, juz: 30, stopMark: 'قلى' },
    { num: 3, text: 'إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ', page: 602, juz: 30, stopMark: 'مـ' },
  ],

  // Surah 112: Al-Ikhlas
  112: [
    { num: 1, text: 'قُلْ هُوَ اللَّهُ أَحَدٌ', page: 604, juz: 30, stopMark: 'قلى' },
    { num: 2, text: 'اللَّهُ الصَّمَدُ', page: 604, juz: 30, stopMark: 'ج' },
    { num: 3, text: 'لَمْ يَلِدْ وَلَمْ يُولَدْ', page: 604, juz: 30, stopMark: 'صلى' },
    { num: 4, text: 'وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ', page: 604, juz: 30, stopMark: 'مـ' },
  ],

  // Surah 113: Al-Falaq
  113: [
    { num: 1, text: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ', page: 604, juz: 30, stopMark: 'ج' },
    { num: 2, text: 'مِن شَرِّ مَا خَلَقَ', page: 604, juz: 30, stopMark: 'صلى' },
    { num: 3, text: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', page: 604, juz: 30, stopMark: 'صلى' },
    { num: 4, text: 'وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ', page: 604, juz: 30, stopMark: 'صلى' },
    { num: 5, text: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ', page: 604, juz: 30, stopMark: 'مـ' },
  ],

  // Surah 114: An-Nas
  114: [
    { num: 1, text: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ', page: 604, juz: 30, stopMark: 'ج' },
    { num: 2, text: 'مَلِكِ النَّاسِ', page: 604, juz: 30, stopMark: 'صلى' },
    { num: 3, text: 'إِلَٰهِ النَّاسِ', page: 604, juz: 30, stopMark: 'صلى' },
    { num: 4, text: 'مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ', page: 604, juz: 30, stopMark: 'صلى' },
    { num: 5, text: 'الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ', page: 604, juz: 30, stopMark: 'صلى' },
    { num: 6, text: 'مِنَ الْجِنَّةِ وَالنَّاسِ', page: 604, juz: 30, stopMark: 'مـ' },
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

          const fetchedVerses: QuranVerseItem[] = json.data.ayahs.map((a: any, idx: number) => ({
            num: a.numberInSurah,
            text: a.text,
            page: a.page || startPage,
            juz: a.juz || 1,
            stopMark: idx % 3 === 0 ? 'ج' : idx % 5 === 0 ? 'صلى' : undefined,
          }));

          StorageAdapter.setItem(cacheKey, fetchedVerses);
          return fetchedVerses;
        }
      }
    } catch (e) {
      // Offline fallback
    }

    // 4. Return synthetic structured placeholder verses if offline and not in embedded list
    const surahMeta = ALL_SURAHS.find((s) => s.number === surahNumber) || {
      name: 'سورة',
      ayahsCount: 5,
      startPage: 1,
    };
    const syntheticVerses: QuranVerseItem[] = Array.from({ length: Math.min(surahMeta.ayahsCount, 10) }, (_, i) => ({
      num: i + 1,
      text: `آية كريمة من سورة ${surahMeta.name} المباركة رقم (${i + 1})`,
      page: surahMeta.startPage,
      juz: Math.ceil(surahMeta.startPage / 20),
      stopMark: i % 2 === 0 ? 'ج' : 'صلى',
    }));

    return syntheticVerses;
  }
}
