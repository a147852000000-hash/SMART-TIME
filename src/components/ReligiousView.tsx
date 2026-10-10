import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  Clock,
  RotateCcw,
  Search,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Heart,
  Bookmark,
  Bell,
  BellRing,
  Check,
  Flame,
  Calendar,
  Cross,
  HelpCircle,
  Play,
  Volume1,
  Share2,
  BookmarkCheck,
  BookmarkPlus,
  Compass,
  ArrowRight,
  ArrowLeft,
  Info,
  Radio,
  Sliders,
} from 'lucide-react';
import {
  AthkarItem,
  ReligiousPreference,
  Language,
  QuranWirdProgress,
  ChristianPrayer,
  ChristianDailyReading,
  QuranReadingPosition,
  QuranBookmark,
  MuadhinOption,
  AdhanType,
} from '../types';
import { translations } from '../services/i18n';
import { ReligiousRepository } from '../services';
import {
  QuranService,
  ALL_SURAHS,
  QURANIC_PUNCTUATION_SIGNS,
  QuranVerseItem,
  QuranSurahInfo,
} from '../services/quranService';

interface ReligiousViewProps {
  language: Language;
  preference?: ReligiousPreference;
  athkarItems: AthkarItem[];
  onUpdateAthkar: (items: AthkarItem[]) => void;
}

const MUADHIN_LIST: MuadhinOption[] = [
  { id: 'abdelbaset', nameAr: 'الشيخ عبد الباسط عبد الصمد', nameEn: 'Sheikh Abdulbasit Abdulsamad', location: 'مصر (تسجيلات نادرة)' },
  { id: 'mulla', nameAr: 'الشيخ علي أحمد ملا (شيخ المؤذنين)', nameEn: 'Sheikh Ali Ahmed Mulla', location: 'الحرم المكي الشريف' },
  { id: 'bukhari', nameAr: 'الشيخ عصام بخاري', nameEn: 'Sheikh Essam Bukhari', location: 'المسجد النبوي الشريف' },
  { id: 'afasy', nameAr: 'الشيخ مشاري راشد العفاسي', nameEn: 'Sheikh Mishary Rashid Al-Afasy', location: 'الكويت' },
];

export const ReligiousView: React.FC<ReligiousViewProps> = ({
  language,
  preference = 'muslim',
  athkarItems,
  onUpdateAthkar,
}) => {
  const t = translations[language];

  // Religion Mode (Muslim / Christian)
  const [religionMode, setReligionMode] = useState<'muslim' | 'christian'>(preference === 'christian' ? 'christian' : 'muslim');

  // Muslim Active Tab (wird, quran, bookmarks, prayers_adhan, athkar)
  const [muslimTab, setMuslimTab] = useState<'wird' | 'quran' | 'bookmarks' | 'prayers_adhan' | 'athkar'>('wird');

  // Christian Active Tab
  const [christianTab, setChristianTab] = useState<'agpeya' | 'daily_reading' | 'bible_verses'>('agpeya');

  // Adhan Alert & Settings
  const [adhanEnabled, setAdhanEnabled] = useState<boolean>(() => ReligiousRepository.getAdhanAlertEnabled());
  const [selectedMuadhin, setSelectedMuadhin] = useState<string>('mulla');
  const [adhanType, setAdhanType] = useState<AdhanType>('full');
  const [playingAdhan, setPlayingAdhan] = useState(false);

  // Quran Wird Progress & Last Stop Position
  const [wird, setWird] = useState<QuranWirdProgress>(() => ReligiousRepository.getQuranWird());
  const [pagesReadToday, setPagesReadToday] = useState(wird.dailyGoalPages || 4);
  const [showWirdDoneMessage, setShowWirdDoneMessage] = useState(false);
  const [lastStopPosition, setLastStopPosition] = useState<QuranReadingPosition>(() => ReligiousRepository.getLastReadingPosition());

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<QuranBookmark[]>(() => QuranService.getBookmarks());

  // Quran Reader state
  const [selectedSurah, setSelectedSurah] = useState<number>(lastStopPosition.surahNumber || 1);
  const [surahSearch, setSurahSearch] = useState('');
  const [versesList, setVersesList] = useState<QuranVerseItem[]>([]);
  const [isLoadingVerses, setIsLoadingVerses] = useState(false);
  const [highlightedAyah, setHighlightedAyah] = useState<number | null>(lastStopPosition.ayahNumber || 1);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedSignInfo, setSelectedSignInfo] = useState<(typeof QURANIC_PUNCTUATION_SIGNS)[0] | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  // Christian Data
  const [christianPrayers] = useState<ChristianPrayer[]>(() => ReligiousRepository.getChristianPrayers());
  const [selectedChristianPrayerId, setSelectedChristianPrayerId] = useState<string>('pr_baker');
  const [dailyReading] = useState<ChristianDailyReading>(() => ReligiousRepository.getChristianDailyReading());

  // Athkar State
  const [athkarCategory, setAthkarCategory] = useState<'morning' | 'evening' | 'tasbeeh'>('morning');

  // Prayer times data (Cairo / Default)
  const prayerTimes = [
    { nameAr: 'الفجر', nameEn: 'Fajr', time: '05:02 ص', isNext: false, reminder: true },
    { nameAr: 'الشروق', nameEn: 'Sunrise', time: '06:26 ص', isNext: false, reminder: false },
    { nameAr: 'الظهر', nameEn: 'Dhuhr', time: '12:08 م', isNext: false, reminder: true },
    { nameAr: 'العصر', nameEn: 'Asr', time: '03:22 م', isNext: true, reminder: true },
    { nameAr: 'المغرب', nameEn: 'Maghrib', time: '05:51 م', isNext: false, reminder: true },
    { nameAr: 'العشاء', nameEn: 'Isha', time: '07:09 م', isNext: false, reminder: true },
  ];

  // Load verses when selectedSurah changes
  useEffect(() => {
    let isMounted = true;
    setIsLoadingVerses(true);

    QuranService.getSurahVerses(selectedSurah)
      .then((verses) => {
        if (isMounted) {
          setVersesList(verses);
          setIsLoadingVerses(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoadingVerses(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSurah]);

  // Play pleasant acoustic audio chime for stop marker
  const playChimeSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      // audio fallback
    }
  };

  /**
   * Jump directly to the saved last stop in Quran reader
   */
  const handleJumpToLastStop = (targetSurah?: number, targetAyah?: number) => {
    const sNum = targetSurah ?? lastStopPosition.surahNumber;
    const aNum = targetAyah ?? lastStopPosition.ayahNumber;
    const surahMeta = ALL_SURAHS.find((s) => s.number === sNum) || { name: 'الفاتحة', startPage: 1 };

    setSelectedSurah(sNum);
    setMuslimTab('quran');
    setHighlightedAyah(aNum);

    playChimeSound();

    setToastMessage(`📍 تم الانتقال مباشرة إلى آخر علامة وقف: سورة ${surahMeta.name} - الآية ${aNum} (الصفحة ${lastStopPosition.pageNumber})`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);

    // Smooth scroll to verse container
    setTimeout(() => {
      const el = document.getElementById(`ayah-item-${sNum}-${aNum}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  };

  /**
   * Click on punctuation mark or Ayah to set it as last stop
   */
  const handlePunctuationClick = (verse: QuranVerseItem, surahInfo: QuranSurahInfo) => {
    const newStop: QuranReadingPosition = {
      surahNumber: surahInfo.number,
      surahName: surahInfo.name,
      ayahNumber: verse.num,
      pageNumber: verse.page,
      juzNumber: verse.juz,
      timestamp: new Date().toISOString(),
    };

    ReligiousRepository.saveLastReadingPosition(newStop);
    setLastStopPosition(newStop);
    setHighlightedAyah(verse.num);

    playChimeSound();

    // Sync Wird state
    const updatedWird: QuranWirdProgress = {
      ...wird,
      currentPage: verse.page,
      currentSurahName: `سورة ${surahInfo.name} (الآية ${verse.num})`,
      lastPosition: newStop,
    };
    setWird(updatedWird);
    ReligiousRepository.saveQuranWird(updatedWird);

    setToastMessage(`🔖 تم حفظ علامة الوقف بنجاح: سورة ${surahInfo.name} • الآية ${verse.num} (الصفحة ${verse.page})`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  /**
   * Toggle Bookmark for a verse
   */
  const handleToggleBookmark = (verse: QuranVerseItem, surahInfo: QuranSurahInfo) => {
    const res = QuranService.toggleBookmark({
      surahNumber: surahInfo.number,
      surahName: surahInfo.name,
      ayahNumber: verse.num,
      pageNumber: verse.page,
    });
    setBookmarks(res.bookmarks);
    setToastMessage(res.isAdded ? '✨ تم إضافة الآية إلى الإشارات المرجعية' : 'تم إزالة الآية من الإشارات المرجعية');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Complete Today's Quran Wird
  const handleCompleteTodayWird = () => {
    const nextPage = Math.min(wird.totalPages, wird.currentPage + pagesReadToday);
    const updated: QuranWirdProgress = {
      ...wird,
      currentPage: nextPage,
      streakDays: wird.streakDays + 1,
      lastReadDate: new Date().toISOString().split('T')[0],
    };
    setWird(updated);
    ReligiousRepository.saveQuranWird(updated);
    setShowWirdDoneMessage(true);
    setTimeout(() => setShowWirdDoneMessage(false), 4000);
  };

  // Update Wird Reminder
  const handleToggleWirdReminder = () => {
    const updated: QuranWirdProgress = {
      ...wird,
      reminderEnabled: !wird.reminderEnabled,
    };
    setWird(updated);
    ReligiousRepository.saveQuranWird(updated);
  };

  // Toggle Adhan Sound
  const handleToggleAdhan = () => {
    const nextVal = !adhanEnabled;
    setAdhanEnabled(nextVal);
    ReligiousRepository.setAdhanAlertEnabled(nextVal);
  };

  // Test synthetic Adhan chime
  const handleTestAdhan = () => {
    if (playingAdhan) {
      setPlayingAdhan(false);
      return;
    }
    setPlayingAdhan(true);
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 1.5);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 2);
    } catch (e) {
      // Audio fallback
    }
    setTimeout(() => setPlayingAdhan(false), 3000);
  };

  // Athkar logic
  const currentAthkarList = athkarItems.filter((item) => item.categoryId === athkarCategory);

  const handleTapDhikr = (id: string) => {
    const updated = athkarItems.map((item) => {
      if (item.id === id) {
        const nextCount = item.currentCount < item.repeatCount ? item.currentCount + 1 : item.currentCount;
        return { ...item, currentCount: nextCount };
      }
      return item;
    });
    onUpdateAthkar(updated);
    ReligiousRepository.saveAthkarItems(updated);
  };

  const handleResetAthkar = () => {
    const updated = athkarItems.map((item) =>
      item.categoryId === athkarCategory ? { ...item, currentCount: 0 } : item
    );
    onUpdateAthkar(updated);
    ReligiousRepository.saveAthkarItems(updated);
  };

  const currentSurahMeta = ALL_SURAHS.find((s) => s.number === selectedSurah) || ALL_SURAHS[0];
  const quranCompletionPct = Math.round((wird.currentPage / wird.totalPages) * 100);
  const activeChristianPrayer = christianPrayers.find((p) => p.id === selectedChristianPrayerId) || christianPrayers[0];

  return (
    <div className="space-y-6" id="religious-module">
      {/* Toast Notification for Stop Markers and Bookmarks */}
      {showToast && toastMessage && (
        <div className="fixed bottom-6 start-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-950 font-bold text-xs sm:text-sm shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 border border-accent-500/40">
          <Bookmark className="w-4 h-4 text-accent-400 dark:text-accent-600 shrink-0 fill-current" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* TOP HEADER: RELIGION SELECTION (MUSLIM / CHRISTIAN) */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-850 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {language === 'ar' ? 'القسم الديني والروحانيات' : 'Religious & Spiritual Center'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar'
              ? 'مقسم باحترام تام إلى: إسلامي (ورد القرآن، علامات الترقيم والوقف، المصحف، الأذان والمؤذن، الأذكار) ومسيحي (الأجبية، القراءات، الآيات)'
              : 'Dedicated sections for Islamic (Quran Wird, Stop Marks, Adhan) and Christian canonical practices'}
          </p>
        </div>

        {/* Master Religion Switcher */}
        <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={() => setReligionMode('muslim')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              religionMode === 'muslim'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            id="muslim-section-toggle"
          >
            <span className="text-base">☪️</span>
            <span>{language === 'ar' ? 'القسم الإسلامي' : 'Islamic Section'}</span>
          </button>

          <button
            onClick={() => setReligionMode('christian')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              religionMode === 'christian'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            id="christian-section-toggle"
          >
            <span className="text-base">✝️</span>
            <span>{language === 'ar' ? 'القسم المسيحي' : 'Christian Section'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: ISLAMIC SUITE */}
      {/* ========================================================= */}
      {religionMode === 'muslim' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Islamic Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 bg-white dark:bg-slate-850 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
            {[
              { id: 'wird', label: language === 'ar' ? 'ورد القرآن اليومي 📖' : 'Daily Quran Wird' },
              { id: 'quran', label: language === 'ar' ? 'المصحف وعلامات الوقف 📜' : 'Mushaf & Stop Marks' },
              { id: 'bookmarks', label: language === 'ar' ? 'علامات الوقف المحفوظة 🔖' : 'Saved Bookmarks' },
              { id: 'prayers_adhan', label: language === 'ar' ? 'مواقيت وتنبيه الأذان 🕌' : 'Adhan & Prayer Times' },
              { id: 'athkar', label: language === 'ar' ? 'الأذكار والمسبحة 📿' : 'Athkar & Tasbeeh' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMuslimTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  muslimTab === tab.id
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 1.1 QURAN DAILY WIRD TAB WITH STOP MARKS AND CONTINUE READING */}
          {muslimTab === 'wird' && (
            <div className="space-y-6">
              {/* Daily Wird Hero Card */}
              <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-emerald-900/20 space-y-6 relative overflow-hidden">
                <div className="absolute -end-10 -bottom-10 w-48 h-48 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold">
                      <Flame className="w-3.5 h-3.5 text-accent-300" />
                      <span>{wird.streakDays} يوم متتالي من القراءة اليومية المستمرة</span>
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black mt-2">ورد القرآن الكريم اليومي</h2>
                    <p className="text-xs sm:text-sm text-emerald-100 mt-1">
                      آخر علامة وقف: <span className="font-bold text-accent-300">سورة {lastStopPosition.surahName} (الآية {lastStopPosition.ayahNumber})</span> • صفحة {wird.currentPage} من {wird.totalPages}
                    </p>
                  </div>

                  {/* Reminder Toggle Badge */}
                  <div className="flex items-center gap-3 bg-black/20 backdrop-blur-md p-3 rounded-2xl shrink-0">
                    <div>
                      <span className="text-[10px] text-emerald-200 block font-medium">موعد التذكير بالورد</span>
                      <span className="font-mono-num font-bold text-xs">{wird.reminderTime}</span>
                    </div>
                    <button
                      onClick={handleToggleWirdReminder}
                      className={`p-2 rounded-xl transition-all ${
                        wird.reminderEnabled ? 'bg-accent-400 text-slate-900 shadow-md' : 'bg-white/10 text-white'
                      }`}
                      title="تفعيل/تعطيل التذكير"
                    >
                      <BellRing className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar & Stats */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-100">
                    <span>نسبة إنجاز ختمة القرآن الكريم</span>
                    <span className="font-mono-num text-white text-sm">{quranCompletionPct}%</span>
                  </div>
                  <div className="w-full h-3.5 rounded-full bg-black/30 overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-400 to-emerald-300 transition-all duration-500 shadow-sm"
                      style={{ width: `${quranCompletionPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-emerald-200 font-mono-num">
                    <span>الصفحة الحالية: {wird.currentPage}</span>
                    <span>المتبقي: {wird.totalPages - wird.currentPage} صفحة لختم المصحف</span>
                  </div>
                </div>

                {/* KEY FEATURE: PROMINENT CONTINUE READING FROM LAST STOP BUTTON */}
                <div className="p-4 rounded-2xl bg-black/25 backdrop-blur-md border border-accent-400/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-accent-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-md">
                      <Bookmark className="w-6 h-6 fill-current" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-accent-300">موضع التوقف الحالي للقراءة</span>
                        <span className="text-[10px] bg-accent-400/20 px-2 py-0.5 rounded-full text-accent-200 font-mono-num border border-accent-400/30">
                          صفحة {lastStopPosition.pageNumber}
                        </span>
                      </div>
                      <div className="text-sm sm:text-base font-black text-white mt-0.5">
                        سورة {lastStopPosition.surahName} — الآية ({lastStopPosition.ayahNumber})
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJumpToLastStop()}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-accent-400 via-accent-300 to-yellow-400 hover:from-accent-300 hover:to-accent-200 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-accent-500/30 active:scale-95 transition-all group"
                    id="continue-reading-btn"
                  >
                    <span>{language === 'ar' ? 'متابعة القراءة من آخر علامة وقف' : 'Continue from Last Stop'}</span>
                    <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 group-hover:-translate-x-1 transition-transform" />
                  </button>
                </div>

                {/* QUICK PUNCTUATION & STOPPING MARKS BAR */}
                <div className="space-y-2 pt-1 border-t border-white/15">
                  <div className="flex items-center justify-between text-xs text-emerald-100 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent-300" />
                      <span>علامات الترقيم والوقف القرآني (اضغط للانتقال المباشر لآخر وقف):</span>
                    </span>
                    <span className="text-[10px] text-emerald-200">دليل أحكام الوقف والتجويد</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                    {/* Last stop shortcut button */}
                    <button
                      onClick={() => handleJumpToLastStop()}
                      className="p-2.5 rounded-xl bg-accent-400/90 hover:bg-accent-300 text-slate-950 font-black text-xs flex flex-col items-center justify-center gap-1 shadow-md transition-all active:scale-95"
                      title="الانتقال المباشر لآخر علامة وقف"
                    >
                      <Bookmark className="w-4 h-4 fill-current text-slate-900" />
                      <span className="text-[10px] leading-tight">آخر وقف 🔖</span>
                    </button>

                    {/* Tajweed stopping marks */}
                    {QURANIC_PUNCTUATION_SIGNS.map((sign) => (
                      <button
                        key={sign.symbol}
                        onClick={() => {
                          setSelectedSignInfo(sign);
                          handleJumpToLastStop();
                        }}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white flex flex-col items-center justify-center gap-0.5 border border-white/10 transition-all text-center group"
                        title={sign.nameAr}
                      >
                        <span className="font-arabic font-black text-base text-accent-300 group-hover:scale-110 transition-transform">
                          {sign.symbol}
                        </span>
                        <span className="text-[9px] font-medium text-emerald-100 line-clamp-1">
                          {sign.nameAr}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Daily Action Controls */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/15">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold">{language === 'ar' ? 'مقدار الورد اليومي:' : 'Daily Pages:'}</span>
                    <div className="flex items-center gap-2 bg-white/15 p-1 rounded-xl">
                      <button
                        onClick={() => setPagesReadToday(Math.max(1, pagesReadToday - 1))}
                        className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold flex items-center justify-center text-sm"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-black font-mono-num text-sm">{pagesReadToday}</span>
                      <button
                        onClick={() => setPagesReadToday(pagesReadToday + 1)}
                        className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold flex items-center justify-center text-sm"
                      >
                        +
                      </button>
                      <span className="text-[11px] px-1 text-emerald-200">صفحات</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCompleteTodayWird}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-black text-xs shadow-md active:scale-95 transition-all"
                    id="complete-wird-btn"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{language === 'ar' ? 'تمت قراءة ورد اليوم بنجاح ✨' : 'Mark Today\'s Wird Done'}</span>
                  </button>
                </div>
              </div>

              {/* Toast Message on completion */}
              {showWirdDoneMessage && (
                <div className="p-4 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-500 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>
                    ما شاء الله! تقبل الله طاعتكم. تم تحديث الورد وتقدمت إلى الصفحة {wird.currentPage}، وزاد رصيدك في الالتزام إلى {wird.streakDays} يوماً!
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 1.2 QURAN READER TAB (FULL MUSHAF WITH INTERACTIVE PUNCTUATION MARKS) */}
          {muslimTab === 'quran' && (
            <div className="space-y-6">
              {/* Quran Control & Search Banner */}
              <div className="bg-white dark:bg-slate-850 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <span>المصحف الشريف وعلامات الوقف</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                          114 سورة
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        انقر على أي آية أو علامة ترقيم (۝) لتثبيت موضع الوقف الفوري والانتقال إليه عند القراءة
                      </p>
                    </div>
                  </div>

                  {/* Direct Jump to Last Stop in Quran Header */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleJumpToLastStop()}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-300 hover:to-accent-400 text-slate-950 font-black text-xs shadow-md shadow-accent-500/20 active:scale-95 transition-all"
                      title="الذهاب الفوري لآخر علامة وقف محفوظة"
                    >
                      <Bookmark className="w-4 h-4 fill-current" />
                      <span>آخر وقف: سورة {lastStopPosition.surahName} ({lastStopPosition.ayahNumber})</span>
                    </button>

                    <button
                      onClick={() => setSelectedSignInfo(QURANIC_PUNCTUATION_SIGNS[0])}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5"
                      title="دليل علامات الوقف"
                    >
                      <Info className="w-4 h-4 text-emerald-500" />
                      <span className="hidden sm:inline">دليل الوقف</span>
                    </button>
                  </div>
                </div>

                {/* Tajweed Punctuation & Stopping Signs Interactive Guide Strip */}
                <div className="p-3 rounded-2xl bg-accent-50/50 dark:bg-slate-900/60 border border-accent-200/60 dark:border-slate-800 flex items-center gap-2 overflow-x-auto pb-2">
                  <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 shrink-0 flex items-center gap-1">
                    <span>علامات الترقيم:</span>
                  </span>
                  {QURANIC_PUNCTUATION_SIGNS.map((sign) => (
                    <button
                      key={sign.symbol}
                      onClick={() => setSelectedSignInfo(sign)}
                      className="px-2.5 py-1 rounded-xl text-xs font-bold border border-accent-300/50 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-accent-100/50 dark:hover:bg-slate-700 flex items-center gap-1.5 shrink-0 transition-all"
                    >
                      <span className="font-arabic font-bold text-accent-600 dark:text-accent-400 text-sm">
                        {sign.symbol}
                      </span>
                      <span className="text-[10px]">{sign.nameAr}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quran Split Layout (Index & Reading View) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 114 Surahs Directory (4 cols) */}
                <div className="lg:col-span-4 bg-white dark:bg-slate-850 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-700 dark:text-slate-300">فهرس السور الكريمة</span>
                    <span className="text-[10px] text-slate-400 font-mono-num">{ALL_SURAHS.length} سورة</span>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={surahSearch}
                      onChange={(e) => setSurahSearch(e.target.value)}
                      placeholder={language === 'ar' ? 'ابحث باسم السورة أو رقمها...' : 'Search surah by name or number...'}
                      className="w-full ps-9 pe-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                  </div>

                  {/* Scrollable Surahs List */}
                  <div className="space-y-1.5 max-h-[560px] overflow-y-auto pe-1">
                    {ALL_SURAHS.filter(
                      (s) =>
                        s.name.includes(surahSearch) ||
                        s.englishName.toLowerCase().includes(surahSearch.toLowerCase()) ||
                        String(s.number) === surahSearch.trim()
                    ).map((surah) => {
                      const isSelected = selectedSurah === surah.number;
                      const hasLastStop = lastStopPosition.surahNumber === surah.number;

                      return (
                        <button
                          key={surah.number}
                          onClick={() => {
                            setSelectedSurah(surah.number);
                            setHighlightedAyah(null);
                          }}
                          className={`w-full p-3 rounded-2xl border text-start flex items-center justify-between transition-all relative ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold shadow-sm'
                              : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono-num text-xs font-bold ${
                                isSelected
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {surah.number}
                            </span>
                            <div>
                              <div className="font-bold text-sm text-slate-900 dark:text-white font-arabic flex items-center gap-1.5">
                                <span>سورة {surah.name}</span>
                                {hasLastStop && (
                                  <Bookmark className="w-3.5 h-3.5 text-accent-500 fill-current" title="موضع آخر وقف محفوظ هنا" />
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">{surah.englishName} • {surah.type}</div>
                            </div>
                          </div>

                          <div className="text-end text-[11px] text-slate-400">
                            <span className="block font-mono-num font-medium">{surah.ayahsCount} آية</span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono-num">
                              ص {surah.startPage}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Surah Reading View with Verses & Punctuation Marks (8 cols) */}
                <div className="lg:col-span-8 bg-white dark:bg-slate-850 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                  {/* Surah Header Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-black text-2xl sm:text-3xl font-arabic text-emerald-700 dark:text-emerald-400">
                          سورة {currentSurahMeta.name}
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-100 dark:bg-accent-950/60 text-accent-800 dark:text-accent-300">
                          {currentSurahMeta.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        عدد آياتها: {currentSurahMeta.ayahsCount} آية • تبدأ من صفحة {currentSurahMeta.startPage} • الجزء {Math.ceil(currentSurahMeta.startPage / 20)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          isPlayingAudio
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
                        }`}
                      >
                        {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        <span>{isPlayingAudio ? 'إيقاف التلاوة' : 'استماع للتلاوة'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Bismillah Header for Surahs other than At-Tawbah */}
                  {selectedSurah !== 9 && (
                    <div className="text-center py-3 bg-accent-50/40 dark:bg-slate-900/40 rounded-2xl border border-accent-200/40 dark:border-slate-800">
                      <p className="font-arabic text-xl sm:text-2xl font-bold text-slate-800 dark:text-accent-100">
                        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                      </p>
                    </div>
                  )}

                  {/* Surah Verses List with Interactive Punctuation Marks */}
                  {isLoadingVerses ? (
                    <div className="py-20 text-center text-slate-400 text-xs space-y-2">
                      <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
                      <span>جارِ تحميل آيات سورة {currentSurahMeta.name}...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {versesList.map((verse) => {
                        const isLastStop =
                          lastStopPosition.surahNumber === selectedSurah &&
                          lastStopPosition.ayahNumber === verse.num;
                        const isHighlighted = highlightedAyah === verse.num;
                        const isBookmarked = bookmarks.some(
                          (b) => b.surahNumber === selectedSurah && b.ayahNumber === verse.num
                        );

                        return (
                          <div
                            key={verse.num}
                            id={`ayah-item-${selectedSurah}-${verse.num}`}
                            className={`p-5 rounded-3xl border-2 transition-all relative group ${
                              isLastStop
                                ? 'bg-accent-50/80 dark:bg-accent-950/30 border-accent-400 ring-2 ring-accent-400/40 shadow-md'
                                : isHighlighted
                                ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-400'
                                : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 hover:border-accent-300'
                            }`}
                          >
                            {/* Visual Stop Badge if this is the last stop */}
                            {isLastStop && (
                              <div className="absolute -top-3 end-6 px-3 py-0.5 rounded-full bg-accent-400 text-slate-950 font-black text-[10px] flex items-center gap-1 shadow-md animate-bounce">
                                <Bookmark className="w-3 h-3 fill-current" />
                                <span>آخر موضع وقف للقراءة 🔖</span>
                              </div>
                            )}

                            <div className="flex flex-col gap-3">
                              {/* Verse Calligraphy Text */}
                              <div className="text-xl sm:text-2xl font-bold font-arabic text-slate-900 dark:text-white leading-loose text-justify text-start pe-2">
                                <span>{verse.text}</span>{' '}

                                {/* INTERACTIVE AYAH END & PUNCTUATION MARK */}
                                <button
                                  onClick={() => handlePunctuationClick(verse, currentSurahMeta)}
                                  className={`inline-flex items-center justify-center gap-1 mx-1 px-2.5 py-1 rounded-2xl border transition-all align-middle active:scale-90 select-none group/mark ${
                                    isLastStop
                                      ? 'bg-accent-400 border-accent-500 text-slate-950 font-black shadow-md scale-105'
                                      : 'bg-white dark:bg-slate-800 border-accent-400/80 text-accent-700 dark:text-accent-400 hover:bg-accent-100 dark:hover:bg-slate-700'
                                  }`}
                                  title="انقر لتثبيت علامة الوقف هنا"
                                >
                                  <span className="text-sm">۝</span>
                                  <span className="font-mono-num text-xs font-black">{verse.num}</span>

                                  {/* Optional Tajweed stopping mark on verse */}
                                  {verse.stopMark && (
                                    <span className="text-[11px] px-1 bg-black/10 dark:bg-white/10 rounded font-arabic font-bold">
                                      {verse.stopMark}
                                    </span>
                                  )}
                                </button>
                              </div>

                              {/* Action Footer for Verse */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800 text-xs">
                                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                                  <span className="font-mono-num font-medium">الآية {verse.num}</span>
                                  <span>•</span>
                                  <span className="font-mono-num">الصفحة {verse.page}</span>
                                  {verse.stopMark && (
                                    <>
                                      <span>•</span>
                                      <span className="text-accent-600 dark:text-accent-400 font-bold">
                                        علامة وقف: ({verse.stopMark})
                                      </span>
                                    </>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Set Stop Button */}
                                  <button
                                    onClick={() => handlePunctuationClick(verse, currentSurahMeta)}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                                      isLastStop
                                        ? 'bg-accent-400 text-slate-950 shadow-sm'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-accent-100 hover:text-accent-900'
                                    }`}
                                  >
                                    <Bookmark className="w-3.5 h-3.5" />
                                    <span>{isLastStop ? 'علامة الوقف الحالية' : 'تثبيت الوقف هنا'}</span>
                                  </button>

                                  {/* Bookmark Toggle */}
                                  <button
                                    onClick={() => handleToggleBookmark(verse, currentSurahMeta)}
                                    className={`p-1.5 rounded-xl border transition-all ${
                                      isBookmarked
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-400'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600'
                                    }`}
                                    title="حفظ في الإشارات المرجعية"
                                  >
                                    <BookmarkCheck className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 1.3 BOOKMARKS & SAVED STOPS TAB */}
          {muslimTab === 'bookmarks' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                      <Bookmark className="w-5 h-5 text-accent-500 fill-current" />
                      <span>علامات الوقف والإشارات المرجعية المحفوظة</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      قائمة بجميع مواضع التوقف والآيات التي قمت بتعليمها للرجوع المباشر إليها
                    </p>
                  </div>

                  <button
                    onClick={() => handleJumpToLastStop()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-400 hover:bg-accent-300 text-slate-950 font-black text-xs shadow-md transition-all shrink-0"
                  >
                    <Bookmark className="w-4 h-4 fill-current" />
                    <span>الذهاب إلى آخر علامة وقف 🔖</span>
                  </button>
                </div>

                {/* Bookmarks Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {bookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between gap-3 hover:border-accent-400 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-100 dark:bg-accent-950/60 text-accent-700 dark:text-accent-300 flex items-center justify-center font-bold">
                          <Bookmark className="w-5 h-5 fill-current" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white font-arabic">
                            سورة {bm.surahName} — الآية {bm.ayahNumber}
                          </h4>
                          <span className="text-xs text-slate-400">
                            الصفحة {bm.pageNumber} • {bm.note}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleJumpToLastStop(bm.surahNumber, bm.ayahNumber)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm"
                      >
                        قراءة الآية
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 1.4 ADHAN ALERTS & PRAYER TIMES (WITH MUADHIN & ADHAN TYPE SELECTOR) */}
          {muslimTab === 'prayers_adhan' && (
            <div className="space-y-6">
              {/* Next Prayer & Adhan Control Banner */}
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-emerald-600/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="text-xs text-emerald-200 font-bold uppercase tracking-wider">
                    {language === 'ar' ? 'الصلاة القادمة وتنبيه الأذان' : 'Next Prayer & Adhan Alert'}
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black mt-1">صلاة العصر (Asr)</h3>
                  <p className="text-xs text-emerald-100 mt-1">
                    متبقي حوالي 45 دقيقة • موعد الأذان: <span className="font-bold font-mono-num text-white">03:22 م</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Test Adhan Audio Button */}
                  <button
                    onClick={handleTestAdhan}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md ${
                      playingAdhan ? 'bg-rose-500 text-white animate-pulse' : 'bg-white text-emerald-800 hover:bg-emerald-50'
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>{playingAdhan ? 'جاري تشغيل صوت الأذان 🔊' : 'اختبار صوت الأذان'}</span>
                  </button>

                  {/* Master Adhan Switch */}
                  <button
                    onClick={handleToggleAdhan}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
                      adhanEnabled
                        ? 'bg-emerald-500 border-emerald-400 text-white'
                        : 'bg-black/30 border-white/20 text-white/70'
                    }`}
                  >
                    <BellRing className="w-4 h-4" />
                    <span>{adhanEnabled ? 'التنبيه التلقائي: مُفعل' : 'التنبيه: معطل'}</span>
                  </button>
                </div>
              </div>

              {/* 6 Prayer Times Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {prayerTimes.map((p) => (
                  <div
                    key={p.nameEn}
                    className={`p-4 rounded-2xl border text-center transition-all ${
                      p.isNext
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30'
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <span>{language === 'ar' ? p.nameAr : p.nameEn}</span>
                      {p.reminder && <Bell className="w-3 h-3 text-emerald-500" />}
                    </div>
                    <div className="text-lg font-black font-mono-num text-slate-900 dark:text-white mt-1">
                      {p.time}
                    </div>
                    {p.isNext ? (
                      <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                        {language === 'ar' ? 'الأذان القادم' : 'Next'}
                      </span>
                    ) : (
                      <span className="inline-block mt-2 text-[10px] text-slate-400 font-medium">تنبيه تلقائي</span>
                    )}
                  </div>
                ))}
              </div>

              {/* NEW FEATURES PER REQUIREMENTS: MUADHIN SELECTION & ADHAN SOUND TYPE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Muadhin Selection Tab */}
                <div className="bg-white dark:bg-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Radio className="w-4 h-4 text-emerald-600" />
                      <span>اختيار المؤذن وصوت الأذان 🎙️</span>
                    </h4>
                    <span className="text-[11px] text-emerald-600 font-bold">أصوات نقية</span>
                  </div>

                  <div className="space-y-2">
                    {MUADHIN_LIST.map((m) => (
                      <label
                        key={m.id}
                        onClick={() => setSelectedMuadhin(m.id)}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                          selectedMuadhin === m.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-white">
                            {language === 'ar' ? m.nameAr : m.nameEn}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{m.location}</div>
                        </div>
                        <input
                          type="radio"
                          name="muadhin"
                          checked={selectedMuadhin === m.id}
                          onChange={() => setSelectedMuadhin(m.id)}
                          className="accent-emerald-600"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* 2. Adhan Type Selection (Full vs. Takbeer Only) */}
                <div className="bg-white dark:bg-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-accent-500" />
                      <span>نوع الأذان والتنبيه 🔔</span>
                    </h4>
                    <span className="text-[11px] text-accent-600 font-bold">خيارات التنبيه</span>
                  </div>

                  <div className="space-y-3">
                    <label
                      onClick={() => setAdhanType('full')}
                      className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        adhanType === 'full'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white">
                          الأذان كاملاً (Full Adhan)
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          سماع الأذان كاملاً حتى نهاية الدعاء بصوت المؤذن المختار
                        </p>
                      </div>
                      <input
                        type="radio"
                        name="adhanType"
                        checked={adhanType === 'full'}
                        onChange={() => setAdhanType('full')}
                        className="accent-emerald-600"
                      />
                    </label>

                    <label
                      onClick={() => setAdhanType('takbeer_only')}
                      className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        adhanType === 'takbeer_only'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white">
                          التكبير فقط "الله أكبر الله أكبر"
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          تنبيه مختصر للتذكير بدخول الوقت دون مقاطعة العمل
                        </p>
                      </div>
                      <input
                        type="radio"
                        name="adhanType"
                        checked={adhanType === 'takbeer_only'}
                        onChange={() => setAdhanType('takbeer_only')}
                        className="accent-emerald-600"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 1.5 ATHKAR & TASBEEH */}
          {muslimTab === 'athkar' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAthkarCategory('morning')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      athkarCategory === 'morning'
                        ? 'bg-accent-500 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'أذكار الصباح' : 'Morning Athkar'}</span>
                  </button>

                  <button
                    onClick={() => setAthkarCategory('evening')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      athkarCategory === 'evening'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'أذكار المساء' : 'Evening Athkar'}</span>
                  </button>

                  <button
                    onClick={() => setAthkarCategory('tasbeeh')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      athkarCategory === 'tasbeeh'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'المسبحة الإلكترونية' : 'Digital Tasbeeh'}</span>
                  </button>
                </div>

                <button
                  onClick={handleResetAthkar}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-accent-500 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'إعادة ضبط العدادات' : 'Reset Counters'}</span>
                </button>
              </div>

              {/* Athkar Cards List */}
              <div className="space-y-3.5">
                {currentAthkarList.map((item) => {
                  const isCompleted = item.currentCount >= item.repeatCount;
                  const remaining = item.repeatCount - item.currentCount;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleTapDhikr(item.id)}
                      className={`p-5 rounded-3xl border transition-all cursor-pointer select-none active:scale-99 ${
                        isCompleted
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-500/50 shadow-sm'
                          : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <p className="text-base sm:text-lg font-bold font-arabic text-slate-900 dark:text-white leading-loose text-start">
                            {item.text}
                          </p>
                          {item.virtue && (
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              ✨ {item.virtue}
                            </div>
                          )}
                        </div>

                        {/* Interactive Count Circle */}
                        <div className="flex items-center justify-end gap-3 shrink-0">
                          <div
                            className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-mono-num transition-transform ${
                              isCompleted
                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            {isCompleted ? (
                              <>
                                <CheckCircle2 className="w-6 h-6" />
                                <span className="text-[10px] font-bold mt-0.5">{language === 'ar' ? 'تم' : 'Done'}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-xl font-black">{remaining}</span>
                                <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                                  / {item.repeatCount}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: CHRISTIAN SUITE */}
      {/* ========================================================= */}
      {religionMode === 'christian' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Christian Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 bg-white dark:bg-slate-850 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
            {[
              { id: 'agpeya', label: language === 'ar' ? 'صلوات الأجبية اليومية ⛪' : 'Agpeya Canonical Prayers' },
              { id: 'daily_reading', label: language === 'ar' ? 'القراءات والسنكسار 📜' : 'Daily Katameros & Saint' },
              { id: 'bible_verses', label: language === 'ar' ? 'آيات الكتاب المقدس والتأملات 🕊️' : 'Bible Verses' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setChristianTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  christianTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 2.1 AGPEYA CANONICAL PRAYERS */}
          {christianTab === 'agpeya' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Prayers Hour List (4 cols) */}
              <div className="lg:col-span-4 space-y-3">
                {christianPrayers.map((prayer) => (
                  <button
                    key={prayer.id}
                    onClick={() => setSelectedChristianPrayerId(prayer.id)}
                    className={`w-full p-4 rounded-2xl border text-start transition-all ${
                      selectedChristianPrayerId === prayer.id
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 shadow-sm'
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-blue-300'
                    }`}
                  >
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {prayer.title}
                    </h4>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium block mt-0.5">
                      {prayer.hourName}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {prayer.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* Selected Prayer Content (8 cols) */}
              <div className="lg:col-span-8 bg-white dark:bg-slate-850 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                  <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold">
                    {activeChristianPrayer.hourName}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
                    {activeChristianPrayer.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {activeChristianPrayer.description}
                  </p>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-base sm:text-lg leading-relaxed text-slate-800 dark:text-slate-200 font-arabic text-justify">
                  {activeChristianPrayer.text}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span>صلاة الأجبية الأرثوذكسية اليومية</span>
                  <button
                    onClick={() => alert('تم حفظ موضع القراءة في صلواتك!')}
                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold hover:underline"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>حفظ الموضع</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2.2 DAILY READINGS & SYNAXARIUM */}
          {christianTab === 'daily_reading' && (
            <div className="space-y-6">
              {/* Daily Thought Banner */}
              <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-blue-900/20 space-y-4">
                <span className="px-3 py-1 rounded-full bg-white/20 text-[11px] font-bold">
                  تأمل وآية اليوم
                </span>
                <h3 className="text-xl sm:text-2xl font-black leading-snug">
                  {dailyReading.thoughtOfDay}
                </h3>
                <div className="flex items-center gap-2 text-xs text-blue-200 pt-2">
                  <Calendar className="w-4 h-4" />
                  <span>{dailyReading.saintOfDay}</span>
                </div>
              </div>

              {/* Gospel & Epistle Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Gospel */}
                <div className="bg-white dark:bg-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span>✝️</span>
                      <span>إنجيل اليوم (Holy Gospel)</span>
                    </h4>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {dailyReading.gospelReference}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-arabic text-justify">
                    {dailyReading.gospelText}
                  </p>
                </div>

                {/* Epistle */}
                <div className="bg-white dark:bg-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span>📜</span>
                      <span>الرسائل والبولس (Epistle)</span>
                    </h4>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {dailyReading.epistleReference}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-arabic text-justify">
                    {dailyReading.epistleText}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2.3 BIBLE VERSES & SPIRITUAL CONTEMPLATIONS */}
          {christianTab === 'bible_verses' && (
            <div className="space-y-4">
              {[
                {
                  theme: 'المحبة والسلام 💖',
                  ref: 'يوحنا 14: 27',
                  text: '«سَلاَماً أَتْرُكُ لَكُمْ. سَلاَمِي أُعْطِيكُمْ. لَيْسَ كَمَا يُعْطِي العَالَمُ أُعْطِيكُمْ أَنَا. لاَ تَضْطَرِبْ قُلُوبُكُمْ وَلاَ تَرْهَبْ.»',
                },
                {
                  theme: 'الرجاء والاطمئنان 🕊️',
                  ref: 'إشعياء 41: 10',
                  text: '«لاَ تَخَفْ لأَنِّي مَعَكَ. لاَ تَتَلَفَّتْ لأَنِّي إِلهُكَ. قَدْ أَيَّدْتُكَ وَأَعَنْتُكَ وَعَضَدْتُكَ بِيَمِينِ بِرِّي.»',
                },
                {
                  theme: 'القوة والمساندة 💪',
                  ref: 'فيلبي 4: 13',
                  text: '«أَسْتَطِيعُ كُلَّ شَيْءٍ فِي المَسِيحِ الَّذِي يُقَوِّينِي.»',
                },
                {
                  theme: 'الشكر والبركة 🙏',
                  ref: 'مزمور 23: 1',
                  text: '«الرَّبُّ رَاعِيَّ فَلاَ يُعْوِزُنِي شَيْءٌ. فِي مَرَاعٍ خُضْرٍ يُرْبِضُنِي. إِلَى مِيَاهِ الرَّاحَةِ يُورِدُنِي.»',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-6 bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 hover:border-blue-400 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-black">
                      {item.theme}
                    </span>
                    <span className="text-xs font-bold text-slate-500 font-mono-num">{item.ref}</span>
                  </div>
                  <p className="text-base sm:text-lg font-bold font-arabic text-slate-900 dark:text-white leading-relaxed">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAJWEED PUNCTUATION MODAL INFO */}
      {/* ========================================================= */}
      {selectedSignInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-850 p-6 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-accent-400 text-slate-950 flex items-center justify-center font-arabic font-black text-2xl shadow-md">
                  {selectedSignInfo.symbol}
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {selectedSignInfo.nameAr}
                  </h4>
                  <span className="text-xs text-accent-600 dark:text-accent-400 font-bold">
                    علامة ترقيم ووقف قرآنية
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedSignInfo(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                <span className="font-bold text-slate-900 dark:text-white block mb-1">المعنى والتوضيح:</span>
                <p>{selectedSignInfo.description}</p>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                <span className="font-bold block mb-1">حكم التجويد والوقف:</span>
                <p>{selectedSignInfo.rule}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedSignInfo(null);
                  handleJumpToLastStop();
                }}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-300 hover:to-accent-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Bookmark className="w-4 h-4 fill-current" />
                <span>الانتقال إلى آخر علامة وقف 🔖</span>
              </button>

              <button
                onClick={() => setSelectedSignInfo(null)}
                className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
