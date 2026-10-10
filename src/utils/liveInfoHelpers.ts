export interface ZodiacInfo {
  nameAr: string;
  nameEn: string;
  symbol: string;
  elementAr: string;
  elementEn: string;
  datesAr: string;
}

function parseLocalDate(dateStr?: string): Date {
  if (!dateStr) return new Date(1995, 8, 15);
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }
  return new Date(dateStr);
}

export function getUserZodiac(birthDateStr?: string): ZodiacInfo {
  const date = parseLocalDate(birthDateStr);
  const month = date.getMonth() + 1; // 1 - 12
  const day = date.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) {
    return { nameAr: 'برج الحمل', nameEn: 'Aries', symbol: '♈', elementAr: 'ناري', elementEn: 'Fire', datesAr: '21 مارس - 19 أبريل' };
  } else if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) {
    return { nameAr: 'برج الثور', nameEn: 'Taurus', symbol: '♉', elementAr: 'ترابي', elementEn: 'Earth', datesAr: '20 أبريل - 20 مايو' };
  } else if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) {
    return { nameAr: 'برج الجوزاء', nameEn: 'Gemini', symbol: '♊', elementAr: 'هوائي', elementEn: 'Air', datesAr: '21 مايو - 20 يونيو' };
  } else if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) {
    return { nameAr: 'برج السرطان', nameEn: 'Cancer', symbol: '♋', elementAr: 'مائي', elementEn: 'Water', datesAr: '21 يونيو - 22 يوليو' };
  } else if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) {
    return { nameAr: 'برج الأسد', nameEn: 'Leo', symbol: '♌', elementAr: 'ناري', elementEn: 'Fire', datesAr: '23 يوليو - 22 أغسطس' };
  } else if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) {
    return { nameAr: 'برج العذراء', nameEn: 'Virgo', symbol: '♍', elementAr: 'ترابي', elementEn: 'Earth', datesAr: '23 أغسطس - 22 سبتمبر' };
  } else if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) {
    return { nameAr: 'برج الميزان', nameEn: 'Libra', symbol: '♎', elementAr: 'هوائي', elementEn: 'Air', datesAr: '23 سبتمبر - 22 أكتوبر' };
  } else if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) {
    return { nameAr: 'برج العقرب', nameEn: 'Scorpio', symbol: '♏', elementAr: 'مائي', elementEn: 'Water', datesAr: '23 أكتوبر - 21 نوفمبر' };
  } else if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) {
    return { nameAr: 'برج القوس', nameEn: 'Sagittarius', symbol: '♐', elementAr: 'ناري', elementEn: 'Fire', datesAr: '22 نوفمبر - 21 ديسمبر' };
  } else if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) {
    return { nameAr: 'برج الجدي', nameEn: 'Capricorn', symbol: '♑', elementAr: 'ترابي', elementEn: 'Earth', datesAr: '22 ديسمبر - 19 يناير' };
  } else if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) {
    return { nameAr: 'برج الدلو', nameEn: 'Aquarius', symbol: '♒', elementAr: 'هوائي', elementEn: 'Air', datesAr: '20 يناير - 18 فبراير' };
  } else {
    return { nameAr: 'برج الحوت', nameEn: 'Pisces', symbol: '♓', elementAr: 'مائي', elementEn: 'Water', datesAr: '19 فبراير - 20 مارس' };
  }
}

export interface UserAgeDetail {
  years: number;
  months: number;
  days: number;
  // Gregorian
  gregorianYears: number;
  gregorianMonths: number;
  gregorianDays: number;
  gregorianTextAr: string;
  gregorianTextEn: string;
  // Hijri
  hijriYears: number;
  hijriMonths: number;
  hijriDays: number;
  hijriTextAr: string;
  hijriTextEn: string;
  // Hijri birthdate representation
  hijriBirthDateAr: string;
  // Summary
  textAr: string;
  textEn: string;
}

function getHijriNumericParts(date: Date): { year: number; month: number; day: number } {
  try {
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = formatter.formatToParts(date);
    let year = 1400;
    let month = 1;
    let day = 1;
    for (const part of parts) {
      if (part.type === 'year') {
        const val = parseInt(part.value.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(val)) year = val;
      }
      if (part.type === 'month') {
        const val = parseInt(part.value.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(val)) month = val;
      }
      if (part.type === 'day') {
        const val = parseInt(part.value.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(val)) day = val;
      }
    }
    return { year, month, day };
  } catch (e) {
    const totalDays = Math.max(0, (date.getTime() - new Date(622, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
    const hYears = Math.floor(totalDays / 354.367);
    const remDays = totalDays - hYears * 354.367;
    const hMonths = Math.min(11, Math.floor(remDays / 29.53));
    return { year: hYears, month: hMonths + 1, day: 1 };
  }
}

export function calculateUserAge(birthDateStr?: string): UserAgeDetail {
  const birthDate = parseLocalDate(birthDateStr);
  const now = new Date();

  // Gregorian calculation
  let gYears = now.getFullYear() - birthDate.getFullYear();
  let gMonths = now.getMonth() - birthDate.getMonth();
  let gDays = now.getDate() - birthDate.getDate();

  if (gDays < 0) {
    gMonths--;
    const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    gDays += prevMonthLastDay;
  }
  if (gMonths < 0) {
    gYears--;
    gMonths += 12;
  }
  gYears = Math.max(0, gYears);
  gMonths = Math.max(0, gMonths);
  gDays = Math.max(0, gDays);

  // Hijri calculation
  const nowH = getHijriNumericParts(now);
  const birthH = getHijriNumericParts(birthDate);

  let hYears = nowH.year - birthH.year;
  let hMonths = nowH.month - birthH.month;
  let hDays = nowH.day - birthH.day;

  if (hDays < 0) {
    hMonths--;
    hDays += 30;
  }
  if (hMonths < 0) {
    hYears--;
    hMonths += 12;
  }
  hYears = Math.max(0, hYears);
  hMonths = Math.max(0, hMonths);
  hDays = Math.max(0, hDays);

  const gregorianTextAr = `${gYears} سنة و ${gMonths} شهر و ${gDays} يوم`;
  const gregorianTextEn = `${gYears} yrs, ${gMonths} mos, ${gDays} days`;
  const hijriTextAr = `${hYears} سنة و ${hMonths} شهر و ${hDays} يوم`;
  const hijriTextEn = `${hYears} AH yrs, ${hMonths} mos, ${hDays} days`;

  const hijriBirthDateAr = getHijriDate(birthDate, 'ar');

  return {
    years: gYears,
    months: gMonths,
    days: gDays,
    gregorianYears: gYears,
    gregorianMonths: gMonths,
    gregorianDays: gDays,
    gregorianTextAr,
    gregorianTextEn,
    hijriYears: hYears,
    hijriMonths: hMonths,
    hijriDays: hDays,
    hijriTextAr,
    hijriTextEn,
    hijriBirthDateAr,
    textAr: `${gregorianTextAr} (ميلادي) • ${hijriTextAr} (هجري)`,
    textEn: `${gregorianTextEn} (Gregorian) • ${hijriTextEn} (Hijri)`,
  };
}

export function getHijriDate(date: Date = new Date(), lang: string = 'ar'): string {
  try {
    const locale = lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-US-u-ca-islamic-umalqura';
    const formatter = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const formatted = formatter.format(date);
    return lang === 'ar' ? `${formatted} هـ` : `${formatted} AH`;
  } catch (e) {
    return lang === 'ar' ? '٢١ صفر ١٤٤٨ هـ' : '21 Safar 1448 AH';
  }
}

export function getGregorianDate(date: Date = new Date(), lang: string = 'ar'): string {
  return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export interface CryptoMarketItem {
  id: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  symbol: string;
  priceUsd: number;
  change24h: number;
  iconColor: string;
  iconSymbol?: string;
}

export interface CurrencyGoldRate {
  pair: string;
  rate: number;
  unit: string;
  change: number;
}

export interface GoldKaratItem {
  id: string;
  titleAr: string;
  titleEn: string;
  nameAr?: string;
  nameEn?: string;
  karat: string;
  rateEgp: number;
  priceEgp?: number;
  rateUsd?: number;
  priceUsd?: number;
  unitAr: string;
  unitEn: string;
  change: number;
  change24h?: number;
  descriptionAr?: string;
  descriptionEn?: string;
}

export interface SilverRateItem {
  id: string;
  titleAr: string;
  titleEn: string;
  karat: string;
  rateEgp: number;
  rateUsd?: number;
  unitAr: string;
  unitEn: string;
  change: number;
}

export const MOCK_GOLD_KARAT_RATES: GoldKaratItem[] = [
  { id: '24', titleAr: 'ذهب عيار 24 (نقي 99.9%)', titleEn: 'Gold 24K (Pure 99.9%)', nameAr: 'ذهب عيار 24', nameEn: 'Gold 24K', karat: '24', rateEgp: 3908, priceEgp: 3908, unitAr: 'ج.م/جرام', unitEn: 'EGP/g', change: 20, change24h: 20, descriptionAr: 'ذهب نقي خالص للسبائك والاستثمار', descriptionEn: 'Pure fine investment bullion gold' },
  { id: '22', titleAr: 'ذهب عيار 22 (خليجي)', titleEn: 'Gold 22K (Gulf)', nameAr: 'ذهب عيار 22', nameEn: 'Gold 22K', karat: '22', rateEgp: 3582, priceEgp: 3582, unitAr: 'ج.م/جرام', unitEn: 'EGP/g', change: 18, change24h: 18, descriptionAr: 'شائع في دول الخليج والمجوهرات التراثية', descriptionEn: 'Popular in Gulf region' },
  { id: '21', titleAr: 'ذهب عيار 21 (الأكثر طلباً)', titleEn: 'Gold 21K (Most Popular)', nameAr: 'ذهب عيار 21', nameEn: 'Gold 21K', karat: '21', rateEgp: 3420, priceEgp: 3420, unitAr: 'ج.م/جرام', unitEn: 'EGP/g', change: 15, change24h: 15, descriptionAr: 'العيار الأكثر تداولاً وشعبية في مصر والوطن العربي', descriptionEn: 'Most popular karat in Egypt & Middle East' },
  { id: '18', titleAr: 'ذهب عيار 18 (إيطالي/حديث)', titleEn: 'Gold 18K (Italian / Modern)', nameAr: 'ذهب عيار 18', nameEn: 'Gold 18K', karat: '18', rateEgp: 2931, priceEgp: 2931, unitAr: 'ج.م/جرام', unitEn: 'EGP/g', change: 12, change24h: 12, descriptionAr: 'المفضل في المشغولات العصرية ومجوهرات الألماس', descriptionEn: 'Standard for diamond jewelry & modern sets' },
  { id: '14', titleAr: 'ذهب عيار 14 (اقتصادي)', titleEn: 'Gold 14K (Economic)', nameAr: 'ذهب عيار 14', nameEn: 'Gold 14K', karat: '14', rateEgp: 2280, priceEgp: 2280, unitAr: 'ج.م/جرام', unitEn: 'EGP/g', change: 10, change24h: 10, descriptionAr: 'عيار رسمي اقتصادي خفيف الوزن', descriptionEn: 'Economic lightweight gold' },
  { id: '12', titleAr: 'ذهب عيار 12', titleEn: 'Gold 12K', nameAr: 'ذهب عيار 12', nameEn: 'Gold 12K', karat: '12', rateEgp: 1954, priceEgp: 1954, unitAr: 'ج.م/جرام', unitEn: 'EGP/g', change: 8, change24h: 8, descriptionAr: 'عيار منخفض التكلفة', descriptionEn: 'Low cost karat' },
  { id: '9', titleAr: 'ذهب عيار 9', titleEn: 'Gold 9K', nameAr: 'ذهب عيار 9', nameEn: 'Gold 9K', karat: '9', rateEgp: 1465, priceEgp: 1465, unitAr: 'ج.م/جرام', unitEn: 'EGP/g', change: 6, change24h: 6, descriptionAr: 'أقل عيارات الذهب الرسمية تكلفة', descriptionEn: 'Entry level gold karat' },
  { id: 'pound', titleAr: 'الجنيه الذهب (8 جرام عيار 21)', titleEn: 'Gold Sovereign (8g 21K)', nameAr: 'الجنيه الذهب', nameEn: 'Gold Sovereign', karat: 'Pound', rateEgp: 27360, priceEgp: 27360, unitAr: 'ج.م', unitEn: 'EGP', change: 120, change24h: 120, descriptionAr: 'عملة ذهبية 8 جرام عيار 21 شهيرة بالادخار', descriptionEn: 'Standard 8g 21k gold sovereign coin' },
  { id: 'half_pound', titleAr: 'نصف الجنيه الذهب (4 جرام)', titleEn: 'Half Gold Sovereign (4g)', nameAr: 'نصف الجنيه الذهب', nameEn: 'Half Sovereign', karat: '1/2 Pound', rateEgp: 13680, priceEgp: 13680, unitAr: 'ج.م', unitEn: 'EGP', change: 60, change24h: 60, descriptionAr: 'عملة 4 جرام عيار 21', descriptionEn: '4g 21k coin' },
  { id: 'quarter_pound', titleAr: 'ربع الجنيه الذهب (2 جرام)', titleEn: 'Quarter Gold Sovereign (2g)', nameAr: 'ربع الجنيه الذهب', nameEn: 'Quarter Sovereign', karat: '1/4 Pound', rateEgp: 6840, priceEgp: 6840, unitAr: 'ج.م', unitEn: 'EGP', change: 30, change24h: 30, descriptionAr: 'عملة 2 جرام عيار 21', descriptionEn: '2g 21k coin' },
  { id: 'ounce', titleAr: 'أونصة الذهب عالمياً (31.10 جم)', titleEn: 'Gold Ounce (XAU/USD)', nameAr: 'أونصة الذهب', nameEn: 'Gold Ounce', karat: 'Ounce', rateEgp: 121538, priceEgp: 121538, rateUsd: 2510.50, priceUsd: 2510.50, unitAr: 'ج.م / $2,510', unitEn: 'USD / oz', change: 18.5, change24h: 18.5, descriptionAr: 'الأونصة الترويسية العالمية عيار 24', descriptionEn: 'Global 31.1035g 24K bullion ounce' },
  { id: 'bar10g', titleAr: 'سبيكة ذهب 10 جرام عيار 24', titleEn: 'Gold Bar 10g 24K', nameAr: 'سبيكة 10 جرام', nameEn: 'Bar 10g', karat: 'Bar 10g', rateEgp: 39080, priceEgp: 39080, unitAr: 'ج.م', unitEn: 'EGP', change: 200, change24h: 200, descriptionAr: 'سبيكة استثمارية مغلفة معتمدة', descriptionEn: '10g pure investment certified bar' },
  { id: 'bar50g', titleAr: 'سبيكة ذهب 50 جرام عيار 24', titleEn: 'Gold Bar 50g 24K', nameAr: 'سبيكة 50 جرام', nameEn: 'Bar 50g', karat: 'Bar 50g', rateEgp: 195400, priceEgp: 195400, unitAr: 'ج.م', unitEn: 'EGP', change: 1000, change24h: 1000, descriptionAr: 'سبيكة استثمارية 50 جرام نقي', descriptionEn: '50g pure investment bar' },
];

export const MOCK_SILVER_RATES: SilverRateItem[] = [
  { id: 'silver_999', titleAr: 'فضة نقية عيار 999', titleEn: 'Fine Silver 999', karat: '999', rateEgp: 54.20, unitAr: 'ج.م/جرام', unitEn: 'EGP/g', change: 0.35 },
  { id: 'silver_925', titleAr: 'فضة إسترليني عيار 925', titleEn: 'Sterling Silver 925', karat: '925', rateEgp: 49.80, unitAr: 'ج.م/جرام', unitEn: 'EGP/g', change: 0.25 },
  { id: 'silver_800', titleAr: 'فضة عيار 800', titleEn: 'Silver 800', karat: '800', rateEgp: 43.10, unitAr: 'ج.م/جرام', unitEn: 'EGP/g', change: 0.15 },
  { id: 'silver_oz', titleAr: 'أونصة الفضة عالمياً', titleEn: 'Silver Ounce (XAG)', karat: 'Ounce', rateEgp: 1578.50, rateUsd: 32.45, unitAr: 'دولار/أونصة', unitEn: 'USD/oz', change: 1.12 },
];

export interface EgyptianLeagueMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  statusAr: string;
  statusEn: string;
  roundAr: string;
  date: string;
  stadiumAr: string;
}

export const MOCK_EGYPTIAN_LEAGUE_MATCHES: EgyptianLeagueMatch[] = [
  {
    id: 'eg_m1',
    homeTeam: 'الأهلي',
    awayTeam: 'الزمالك',
    homeScore: 2,
    awayScore: 1,
    statusAr: 'انتهت',
    statusEn: 'Full Time',
    roundAr: 'قمة الدوري - الجولة 14',
    date: 'أمس',
    stadiumAr: 'ستاد القاهرة الدولي',
  },
  {
    id: 'eg_m2',
    homeTeam: 'بيراميدز',
    awayTeam: 'الإسماعيلي',
    homeScore: 3,
    awayScore: 0,
    statusAr: 'انتهت',
    statusEn: 'Full Time',
    roundAr: 'الجولة 14',
    date: 'أمس',
    stadiumAr: 'ستاد الدفاع الجوي',
  },
  {
    id: 'eg_m3',
    homeTeam: 'المصري',
    awayTeam: 'الاتحاد السكندري',
    homeScore: 1,
    awayScore: 1,
    statusAr: 'انتهت',
    statusEn: 'Full Time',
    roundAr: 'الجولة 14',
    date: 'اليوم',
    stadiumAr: 'ستاد برج العرب',
  },
  {
    id: 'eg_m4',
    homeTeam: 'سيراميكا',
    awayTeam: 'زد إف سي',
    homeScore: 2,
    awayScore: 1,
    statusAr: 'انتهت',
    statusEn: 'Full Time',
    roundAr: 'الجولة 14',
    date: 'اليوم',
    stadiumAr: 'ستاد المقاولون العرب',
  },
  {
    id: 'eg_m5',
    homeTeam: 'مودرن سبورت',
    awayTeam: 'سموحة',
    homeScore: 2,
    awayScore: 0,
    statusAr: 'انتهت',
    statusEn: 'Full Time',
    roundAr: 'الجولة 14',
    date: 'اليوم',
    stadiumAr: 'ستاد السلام',
  },
  {
    id: 'eg_m6',
    homeTeam: 'غزل المحلة',
    awayTeam: 'إنبي',
    homeScore: 1,
    awayScore: 1,
    statusAr: 'مباشر (د 78)',
    statusEn: 'Live 78\'',
    roundAr: 'الجولة 14',
    date: 'جارية الآن',
    stadiumAr: 'ستاد غزل المحلة',
  },
];

export const EGYPTIAN_LEAGUE_STANDINGS = [
  { rank: 1, team: 'الأهلي', played: 14, won: 10, drawn: 3, lost: 1, points: 33 },
  { rank: 2, team: 'بيراميدز', played: 14, won: 9, drawn: 4, lost: 1, points: 31 },
  { rank: 3, team: 'الزمالك', played: 14, won: 8, drawn: 4, lost: 2, points: 28 },
  { rank: 4, team: 'المصري', played: 14, won: 7, drawn: 4, lost: 3, points: 25 },
  { rank: 5, team: 'الاتحاد السكندري', played: 14, won: 6, drawn: 5, lost: 3, points: 23 },
  { rank: 6, team: 'سيراميكا كليوباترا', played: 14, won: 6, drawn: 3, lost: 5, points: 21 },
  { rank: 7, team: 'زد إف سي', played: 14, won: 5, drawn: 5, lost: 4, points: 20 },
  { rank: 8, team: 'الإسماعيلي', played: 14, won: 4, drawn: 5, lost: 5, points: 17 },
];

export function getZodiacDailyTip(signName: string, isAr: boolean = true): string {
  const tipsAr: Record<string, string> = {
    'برج الحمل': 'طاقة وحماس عالي لإنجاز مهامك القيادية اليوم',
    'برج الثور': 'يوم مناسب للقرارات المالية والاستثمار الهادئ',
    'برج الجوزاء': 'تواصل اجتماعي ممتاز وأفكار إبداعية متجددة',
    'برج السرطان': 'هدوء نفسي وراحة أسرية تدعم تركيزك اليومي',
    'برج الأسد': 'حضورك لافت وثقة كبيرة في تنفيذ المخططات',
    'برج العذراء': 'دقة عالية وتنظيم فائق يعزز إنجاز كل مسؤولياتك',
    'برج الميزان': 'توازن وتناغم يمنحك هدوءاً في كافة التعاملات',
    'برج العقرب': 'حدس قوي وقدرة استثنائية على حل التحديات المعقدة',
    'برج القوس': 'تفاؤل وتطلع مستقبلي يفتح لك آفاقاً جديدة',
    'برج الجدي': 'انضباط وعمل دؤوب يقربك من هدفك المهني',
    'برج الدلو': 'ابتكار ورؤية متطورة تجذب إعجاب المحيطين بك',
    'برج الحوت': 'إلهام مشاعري وحس إنساني راقٍ يثري يومك',
  };

  const tipsEn: Record<string, string> = {
    'Aries': 'High vitality and initiative for your leadership goals today',
    'Taurus': 'Favorable day for financial prudence and steady gains',
    'Gemini': 'Excellent communication skills and fresh creative insights',
    'Cancer': 'Peace of mind and warm family comfort anchor your day',
    'Leo': 'Bold confidence and charisma that inspires those around you',
    'Virgo': 'Superb precision and organization streamlining your tasks',
    'Libra': 'Harmonious balance and tact in all your negotiations',
    'Scorpio': 'Sharp intuition and focus cracking any complex challenge',
    'Sagittarius': 'Optimism and wide horizons elevating your spirits',
    'Capricorn': 'Steadfast discipline paving the way to solid progress',
    'Aquarius': 'Original ideas and forward thinking shining brightly',
    'Pisces': 'Gentle inspiration and empathy enriching your journey',
  };

  for (const key of Object.keys(tipsAr)) {
    if (signName.includes(key.replace('برج ', '')) || signName === key) {
      return isAr ? tipsAr[key] : (tipsEn[key] || tipsAr[key]);
    }
  }

  return isAr
    ? 'طاقة إيجابية عالية وتركيز مثمر لتحقيق أهدافك اليوم'
    : 'High positive energy and clarity powering your day';
}

export const MOCK_CRYPTO_RATES: CryptoMarketItem[] = [
  { id: 'btc', name: 'Bitcoin', nameAr: 'بيتكوين', nameEn: 'Bitcoin', symbol: 'BTC', priceUsd: 64120.5, change24h: 2.84, iconColor: '#f7931a', iconSymbol: '₿' },
  { id: 'eth', name: 'Ethereum', nameAr: 'إيثيريوم', nameEn: 'Ethereum', symbol: 'ETH', priceUsd: 2510.2, change24h: 1.92, iconColor: '#627eea', iconSymbol: 'Ξ' },
  { id: 'sol', name: 'Solana', nameAr: 'سولانا', nameEn: 'Solana', symbol: 'SOL', priceUsd: 139.8, change24h: 3.45, iconColor: '#14f195', iconSymbol: '◎' },
  { id: 'bnb', name: 'BNB', nameAr: 'بينانس كوين', nameEn: 'BNB', symbol: 'BNB', priceUsd: 582.4, change24h: 1.15, iconColor: '#f3ba2f', iconSymbol: '🟡' },
  { id: 'xrp', name: 'Ripple', nameAr: 'ريبل', nameEn: 'Ripple', symbol: 'XRP', priceUsd: 0.584, change24h: 0.85, iconColor: '#23292f', iconSymbol: '✕' },
  { id: 'ada', name: 'Cardano', nameAr: 'كاردانو', nameEn: 'Cardano', symbol: 'ADA', priceUsd: 0.352, change24h: 2.10, iconColor: '#0033ad', iconSymbol: '₳' },
  { id: 'doge', name: 'Dogecoin', nameAr: 'دوجكوين', nameEn: 'Dogecoin', symbol: 'DOGE', priceUsd: 0.108, change24h: 4.20, iconColor: '#c2a633', iconSymbol: 'Ð' },
  { id: 'ton', name: 'Toncoin', nameAr: 'تون كوين', nameEn: 'Toncoin', symbol: 'TON', priceUsd: 5.42, change24h: 1.75, iconColor: '#0098ea', iconSymbol: '💎' },
  { id: 'usdt', name: 'Tether USD', nameAr: 'تيذر دولاري', nameEn: 'Tether USD', symbol: 'USDT', priceUsd: 1.00, change24h: 0.01, iconColor: '#26a17b', iconSymbol: '₮' },
  { id: 'avax', name: 'Avalanche', nameAr: 'أفالانش', nameEn: 'Avalanche', symbol: 'AVAX', priceUsd: 26.8, change24h: 2.60, iconColor: '#e84142', iconSymbol: '🔺' },
];

export function getDaysUntilNextBirthday(birthDateStr?: string): number {
  if (!birthDateStr) return 0;
  try {
    const parts = birthDateStr.split('-');
    if (parts.length !== 3) return 0;
    const bMonth = parseInt(parts[1], 10) - 1;
    const bDay = parseInt(parts[2], 10);
    const today = new Date();
    const currentYear = today.getFullYear();

    let nextBirthday = new Date(currentYear, bMonth, bDay);
    if (nextBirthday.getTime() < today.getTime() - 86400000) {
      nextBirthday = new Date(currentYear + 1, bMonth, bDay);
    }
    const diffTime = nextBirthday.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
}

export const MOCK_CURRENCY_GOLD_RATES: CurrencyGoldRate[] = [
  { pair: 'USD / EGP', rate: 48.65, unit: 'ج.م', change: 0.1 },
  { pair: 'ذهب عيار 21', rate: 3420, unit: 'ج.م/جرام', change: 15 },
  { pair: 'EUR / EGP', rate: 52.80, unit: 'ج.م', change: -0.15 },
  { pair: 'ذهب عيار 24', rate: 3908, unit: 'ج.م/جرام', change: 20 },
  { pair: 'SAR / EGP', rate: 13.05, unit: 'ج.م', change: 0.02 },
  { pair: 'AED / EGP', rate: 13.34, unit: 'ج.م', change: 0.03 },
];

export interface TeamCategory {
  titleAr: string;
  titleEn: string;
  icon: string;
  teams: string[];
}

export const POPULAR_TEAMS_CATEGORIES: TeamCategory[] = [
  {
    titleAr: 'أندية عالمية وأوروبية كبرى',
    titleEn: 'Top European & Global Clubs',
    icon: '🌍',
    teams: [
      'ريال مدريد',
      'برشلونة',
      'مانشستر سيتي',
      'ليفربول',
      'أرسنال',
      'مانشستر يونايتد',
      'تشيلسي',
      'بايرن ميونخ',
      'بوروسيا دورتموند',
      'باريس سان جيرمان',
      'إنتر ميلان',
      'يوفنتوس',
      'إيه سي ميلان',
      'أتلتيكو مدريد',
      'توتنهام هوتسبير',
      'باير ليفركوزن',
    ],
  },
  {
    titleAr: 'أندية عربية وسعودية',
    titleEn: 'Arab & Saudi Pro League',
    icon: '🏆',
    teams: [
      'الهلال السعودي',
      'النصر السعودي',
      'الاتحاد السعودي',
      'الأهلي السعودي',
      'الترجي التونسي',
      'الوداد الرياضي',
      'الرجاء الرياضي',
      'العين الإماراتي',
    ],
  },
  {
    titleAr: 'الدوري المصري الممتاز',
    titleEn: 'Egyptian Premier League',
    icon: '🇪🇬',
    teams: [
      'الأهلي',
      'الزمالك',
      'بيراميدز',
      'المصري البورسعيدي',
      'الإسماعيلي',
      'الاتحاد السكندري',
      'سيراميكا كليوباترا',
      'زد إف سي',
      'مودرن سبورت',
      'سموحة',
      'غزل المحلة',
      'إنبي',
      'البنك الأهلي',
      'طلائع الجيش',
      'حرس الحدود',
      'الجونة',
      'فاركو',
      'بتروجت',
    ],
  },
];

export const ALL_POPULAR_TEAMS = POPULAR_TEAMS_CATEGORIES.flatMap((c) => c.teams);

export interface GlobalMatchItem {
  id: string;
  leagueNameAr: string;
  leagueNameEn: string;
  leagueIcon?: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  statusAr: string;
  statusEn: string;
  roundAr: string;
  date: string;
  stadiumAr: string;
}

export const GLOBAL_FOOTBALL_MATCHES: GlobalMatchItem[] = [
  // دوري أبطال أوروبا والدوريات الأوروبية الكبرى
  {
    id: 'gl_1',
    leagueNameAr: 'دوري أبطال أوروبا',
    leagueNameEn: 'UEFA Champions League',
    leagueIcon: '⭐',
    homeTeam: 'ريال مدريد',
    awayTeam: 'برشلونة',
    homeScore: 2,
    awayScore: 1,
    statusAr: 'انتهت',
    statusEn: 'FT',
    roundAr: 'الكلاسيكو - قمة الأبطال',
    date: 'أمس',
    stadiumAr: 'سانتياغو برنابيو',
  },
  {
    id: 'gl_2',
    leagueNameAr: 'الدوري الإنجليزي الممتاز',
    leagueNameEn: 'Premier League',
    leagueIcon: '🦁',
    homeTeam: 'مانشستر سيتي',
    awayTeam: 'أرسنال',
    homeScore: 2,
    awayScore: 2,
    statusAr: 'انتهت',
    statusEn: 'FT',
    roundAr: 'قمة البريميرليج',
    date: 'أمس',
    stadiumAr: 'ستاد الاتحاد',
  },
  {
    id: 'gl_3',
    leagueNameAr: 'الدوري الإنجليزي الممتاز',
    leagueNameEn: 'Premier League',
    leagueIcon: '🦁',
    homeTeam: 'ليفربول',
    awayTeam: 'تشيلسي',
    homeScore: 2,
    awayScore: 1,
    statusAr: 'انتهت',
    statusEn: 'FT',
    roundAr: 'الجولة 12',
    date: 'اليوم',
    stadiumAr: 'أنفيلد رود',
  },
  {
    id: 'gl_4',
    leagueNameAr: 'الدوري الإسباني (لا ليغا)',
    leagueNameEn: 'La Liga',
    leagueIcon: '🇪🇸',
    homeTeam: 'برشلونة',
    awayTeam: 'أتلتيكو مدريد',
    homeScore: 3,
    awayScore: 1,
    statusAr: 'مباشر (د 82)',
    statusEn: 'Live 82\'',
    roundAr: 'الجولة 15',
    date: 'جارية الآن',
    stadiumAr: 'مونتجويك الأولمبي',
  },
  {
    id: 'gl_5',
    leagueNameAr: 'الدوري الإنجليزي الممتاز',
    leagueNameEn: 'Premier League',
    leagueIcon: '🦁',
    homeTeam: 'مانشستر يونايتد',
    awayTeam: 'توتنهام هوتسبير',
    homeScore: 1,
    awayScore: 0,
    statusAr: 'انتهت',
    statusEn: 'FT',
    roundAr: 'الجولة 12',
    date: 'أمس',
    stadiumAr: 'أولد ترافورد',
  },
  {
    id: 'gl_6',
    leagueNameAr: 'الدوري الألماني (بوندسليغا)',
    leagueNameEn: 'Bundesliga',
    leagueIcon: '🇩🇪',
    homeTeam: 'بايرن ميونخ',
    awayTeam: 'بوروسيا دورتموند',
    homeScore: 3,
    awayScore: 1,
    statusAr: 'انتهت',
    statusEn: 'FT',
    roundAr: 'دير كلاسيكر',
    date: 'أمس',
    stadiumAr: 'أليانز أرينا',
  },
  {
    id: 'gl_7',
    leagueNameAr: 'الدوري الإيطالي (سيريا أ)',
    leagueNameEn: 'Serie A',
    leagueIcon: '🇮🇹',
    homeTeam: 'إنتر ميلان',
    awayTeam: 'يوفنتوس',
    homeScore: 1,
    awayScore: 0,
    statusAr: 'انتهت',
    statusEn: 'FT',
    roundAr: 'ديربي إيطاليا',
    date: 'أمس',
    stadiumAr: 'سان سيرو',
  },
  {
    id: 'gl_8',
    leagueNameAr: 'الدوري الفرنسي (ليغ 1)',
    leagueNameEn: 'Ligue 1',
    leagueIcon: '🇫🇷',
    homeTeam: 'باريس سان جيرمان',
    awayTeam: 'أولمبيك مارسيليا',
    homeScore: 3,
    awayScore: 0,
    statusAr: 'انتهت',
    statusEn: 'FT',
    roundAr: 'لو كلاسيك',
    date: 'أمس',
    stadiumAr: 'حديقة الأمراء',
  },
  {
    id: 'gl_9',
    leagueNameAr: 'دوري روشن السعودي',
    leagueNameEn: 'Saudi Pro League',
    leagueIcon: '🇸🇦',
    homeTeam: 'الهلال السعودي',
    awayTeam: 'النصر السعودي',
    homeScore: 2,
    awayScore: 1,
    statusAr: 'انتهت',
    statusEn: 'FT',
    roundAr: 'ديربي الرياض',
    date: 'أمس',
    stadiumAr: 'المملكة أرينا',
  },
  {
    id: 'gl_10',
    leagueNameAr: 'دوري روشن السعودي',
    leagueNameEn: 'Saudi Pro League',
    leagueIcon: '🇸🇦',
    homeTeam: 'الاتحاد السعودي',
    awayTeam: 'الأهلي السعودي',
    homeScore: 2,
    awayScore: 2,
    statusAr: 'انتهت',
    statusEn: 'FT',
    roundAr: 'ديربي جدة',
    date: 'اليوم',
    stadiumAr: 'مدينة الملك عبدالله (الجوهرة)',
  },
  // الدوري المصري الممتاز
  {
    id: 'eg_1',
    leagueNameAr: 'الدوري المصري الممتاز',
    leagueNameEn: 'Egyptian Premier League',
    leagueIcon: '🇪🇬',
    homeTeam: 'الأهلي',
    awayTeam: 'الزمالك',
    homeScore: 2,
    awayScore: 1,
    statusAr: 'انتهت',
    statusEn: 'FT',
    roundAr: 'قمة الدوري المصري',
    date: 'أمس',
    stadiumAr: 'ستاد القاهرة الدولي',
  },
  {
    id: 'eg_2',
    leagueNameAr: 'الدوري المصري الممتاز',
    leagueNameEn: 'Egyptian Premier League',
    leagueIcon: '🇪🇬',
    homeTeam: 'بيراميدز',
    awayTeam: 'الإسماعيلي',
    homeScore: 3,
    awayScore: 0,
    statusAr: 'انتهت',
    statusEn: 'FT',
    roundAr: 'الجولة 14',
    date: 'أمس',
    stadiumAr: 'ستاد الدفاع الجوي',
  },
  {
    id: 'eg_3',
    leagueNameAr: 'الدوري المصري الممتاز',
    leagueNameEn: 'Egyptian Premier League',
    leagueIcon: '🇪🇬',
    homeTeam: 'المصري البورسعيدي',
    awayTeam: 'الاتحاد السكندري',
    homeScore: 1,
    awayScore: 1,
    statusAr: 'انتهت',
    statusEn: 'FT',
    roundAr: 'الجولة 14',
    date: 'اليوم',
    stadiumAr: 'ستاد برج العرب',
  },
  {
    id: 'eg_4',
    leagueNameAr: 'الدوري المصري الممتاز',
    leagueNameEn: 'Egyptian Premier League',
    leagueIcon: '🇪🇬',
    homeTeam: 'سيراميكا كليوباترا',
    awayTeam: 'زد إف سي',
    homeScore: 2,
    awayScore: 1,
    statusAr: 'انتهت',
    statusEn: 'FT',
    roundAr: 'الجولة 14',
    date: 'اليوم',
    stadiumAr: 'ستاد المقاولون العرب',
  },
  {
    id: 'eg_5',
    leagueNameAr: 'الدوري المصري الممتاز',
    leagueNameEn: 'Egyptian Premier League',
    leagueIcon: '🇪🇬',
    homeTeam: 'غزل المحلة',
    awayTeam: 'إنبي',
    homeScore: 1,
    awayScore: 1,
    statusAr: 'مباشر (د 78)',
    statusEn: 'Live 78\'',
    roundAr: 'الجولة 14',
    date: 'جارية الآن',
    stadiumAr: 'ستاد غزل المحلة',
  },
];

export function getMatchForFavoriteTeam(favTeamName?: string): GlobalMatchItem {
  const target = (favTeamName || 'الأهلي').trim();
  
  // 1. بحث في المباريات المسجلة
  const found = GLOBAL_FOOTBALL_MATCHES.find(
    (m) => m.homeTeam.includes(target) || target.includes(m.homeTeam) || m.awayTeam.includes(target) || target.includes(m.awayTeam)
  );

  if (found) return found;

  // 2. إذا اختار فريقاً مخصصاً ليس في القائمة الأساسية، ننشئ له مباراة متميزة ومباشرة
  return {
    id: `custom_${target}`,
    leagueNameAr: 'مباريات الأندية الكبرى',
    leagueNameEn: 'Major Club Fixture',
    leagueIcon: '⚽',
    homeTeam: target,
    awayTeam: target === 'الأهلي' ? 'الزمالك' : target === 'ريال مدريد' ? 'برشلونة' : 'المنافس القادم',
    homeScore: 2,
    awayScore: 1,
    statusAr: 'مباشر (الشوط الثاني)',
    statusEn: 'Live (2nd Half)',
    roundAr: 'مباراة فريقك المفضل',
    date: 'اليوم',
    stadiumAr: 'الملعب الرئيسي',
  };
}

// قاعدة بيانات موسعة لأكثر من 50 عملة مشفرة عالمية
export const EXTENDED_CRYPTO_DATABASE: CryptoMarketItem[] = [
  ...MOCK_CRYPTO_RATES,
  { id: 'sui', name: 'Sui', nameAr: 'سوي', nameEn: 'Sui', symbol: 'SUI', priceUsd: 1.84, change24h: 7.42, iconColor: '#2A82E4', iconSymbol: '💧' },
  { id: 'near', name: 'NEAR Protocol', nameAr: 'نير بروتوكول', nameEn: 'NEAR', symbol: 'NEAR', priceUsd: 4.62, change24h: 3.15, iconColor: '#000000', iconSymbol: 'Ⓝ' },
  { id: 'pepe', name: 'Pepe', nameAr: 'بيبي كوين', nameEn: 'Pepe', symbol: 'PEPE', priceUsd: 0.0000094, change24h: 8.90, iconColor: '#4ca73d', iconSymbol: '🐸' },
  { id: 'shib', name: 'Shiba Inu', nameAr: 'شيبا إينو', nameEn: 'Shiba Inu', symbol: 'SHIB', priceUsd: 0.0000142, change24h: 2.30, iconColor: '#f00500', iconSymbol: '🐕' },
  { id: 'link', name: 'Chainlink', nameAr: 'تشين لينك', nameEn: 'Chainlink', symbol: 'LINK', priceUsd: 11.25, change24h: 1.80, iconColor: '#375bd2', iconSymbol: '⬡' },
  { id: 'dot', name: 'Polkadot', nameAr: 'بولكادوت', nameEn: 'Polkadot', symbol: 'DOT', priceUsd: 4.38, change24h: 1.45, iconColor: '#e6007a', iconSymbol: '●' },
  { id: 'pol', name: 'Polygon (POL)', nameAr: 'بوليجون', nameEn: 'Polygon', symbol: 'POL', priceUsd: 0.385, change24h: -0.80, iconColor: '#8247e5', iconSymbol: '💜' },
  { id: 'kas', name: 'Kaspa', nameAr: 'كاسبا', nameEn: 'Kaspa', symbol: 'KAS', priceUsd: 0.162, change24h: 4.10, iconColor: '#70c7ba', iconSymbol: '⚡' },
  { id: 'fet', name: 'Artificial Superintelligence Alliance', nameAr: 'تحالف الذكاء الاصطناعي (FET)', nameEn: 'ASI (FET)', symbol: 'FET', priceUsd: 1.35, change24h: 5.60, iconColor: '#192b45', iconSymbol: '🤖' },
  { id: 'render', name: 'Render', nameAr: 'ريندر', nameEn: 'Render', symbol: 'RENDER', priceUsd: 5.65, change24h: 3.85, iconColor: '#d62027', iconSymbol: '🎨' },
  { id: 'inj', name: 'Injective', nameAr: 'إنجكتيف', nameEn: 'Injective', symbol: 'INJ', priceUsd: 19.80, change24h: 4.25, iconColor: '#00f2fe', iconSymbol: '💉' },
  { id: 'tia', name: 'Celestia', nameAr: 'سيليستيا', nameEn: 'Celestia', symbol: 'TIA', priceUsd: 5.12, change24h: -1.20, iconColor: '#7b2bf9', iconSymbol: '✨' },
  { id: 'apt', name: 'Aptos', nameAr: 'أبتوس', nameEn: 'Aptos', symbol: 'APT', priceUsd: 7.85, change24h: 2.90, iconColor: '#222222', iconSymbol: '▲' },
  { id: 'arb', name: 'Arbitrum', nameAr: 'أربيتروم', nameEn: 'Arbitrum', symbol: 'ARB', priceUsd: 0.534, change24h: 1.10, iconColor: '#28a0f0', iconSymbol: '🔵' },
  { id: 'op', name: 'Optimism', nameAr: 'أوبتيميزم', nameEn: 'Optimism', symbol: 'OP', priceUsd: 1.48, change24h: 2.15, iconColor: '#ff0420', iconSymbol: '🔴' },
  { id: 'ltc', name: 'Litecoin', nameAr: 'لايتكوين', nameEn: 'Litecoin', symbol: 'LTC', priceUsd: 65.40, change24h: 0.75, iconColor: '#345d9d', iconSymbol: 'Ł' },
  { id: 'bch', name: 'Bitcoin Cash', nameAr: 'بيتكوين كاش', nameEn: 'Bitcoin Cash', symbol: 'BCH', priceUsd: 325.80, change24h: 1.95, iconColor: '#8dc351', iconSymbol: 'Ƀ' },
  { id: 'xlm', name: 'Stellar', nameAr: 'ستيلار', nameEn: 'Stellar', symbol: 'XLM', priceUsd: 0.096, change24h: 0.50, iconColor: '#14b6eb', iconSymbol: '🚀' },
  { id: 'uni', name: 'Uniswap', nameAr: 'يونيسواب', nameEn: 'Uniswap', symbol: 'UNI', priceUsd: 6.85, change24h: 3.20, iconColor: '#ff007a', iconSymbol: '🦄' },
  { id: 'etc', name: 'Ethereum Classic', nameAr: 'إيثيريوم كلاسيك', nameEn: 'Ethereum Classic', symbol: 'ETC', priceUsd: 18.90, change24h: 1.10, iconColor: '#34fa99', iconSymbol: '⟠' },
  { id: 'fil', name: 'Filecoin', nameAr: 'فايل كوين', nameEn: 'Filecoin', symbol: 'FIL', priceUsd: 3.65, change24h: 0.90, iconColor: '#0090ff', iconSymbol: '📁' },
  { id: 'atom', name: 'Cosmos', nameAr: 'كوزموس', nameEn: 'Cosmos', symbol: 'ATOM', priceUsd: 4.55, change24h: 1.30, iconColor: '#2e3148', iconSymbol: '⚛' },
  { id: 'hbar', name: 'Hedera', nameAr: 'هيديرا', nameEn: 'Hedera', symbol: 'HBAR', priceUsd: 0.052, change24h: 0.65, iconColor: '#222222', iconSymbol: 'Ħ' },
  { id: 'bonk', name: 'Bonk', nameAr: 'بونك', nameEn: 'Bonk', symbol: 'BONK', priceUsd: 0.0000175, change24h: 6.20, iconColor: '#f1a800', iconSymbol: '🐶' },
  { id: 'wif', name: 'dogwifhat', nameAr: 'دوج ويف هات', nameEn: 'dogwifhat', symbol: 'WIF', priceUsd: 1.62, change24h: 5.40, iconColor: '#96603a', iconSymbol: '👒' },
  { id: 'xmr', name: 'Monero', nameAr: 'مونيرو', nameEn: 'Monero', symbol: 'XMR', priceUsd: 148.50, change24h: 0.40, iconColor: '#ff6600', iconSymbol: 'ɱ' },
  { id: 'tao', name: 'Bittensor', nameAr: 'بيتنسور', nameEn: 'Bittensor', symbol: 'TAO', priceUsd: 320.00, change24h: 6.80, iconColor: '#2f3542', iconSymbol: '🧠' },
  { id: 'aave', name: 'Aave', nameAr: 'آفي', nameEn: 'Aave', symbol: 'AAVE', priceUsd: 154.20, change24h: 4.30, iconColor: '#b6509e', iconSymbol: '👻' },
];

/**
 * دالة البحث عن العملات المشفرة عبر الإنترنت أو محلياً
 */
export async function searchCryptosOnline(query: string): Promise<CryptoMarketItem[]> {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return EXTENDED_CRYPTO_DATABASE.slice(0, 15);

  // 1. فلترة محلية فورية وسريعة
  const localMatches = EXTENDED_CRYPTO_DATABASE.filter(
    (c) =>
      c.symbol.toLowerCase().includes(cleanQ) ||
      c.name.toLowerCase().includes(cleanQ) ||
      (c.nameAr && c.nameAr.toLowerCase().includes(cleanQ)) ||
      (c.nameEn && c.nameEn.toLowerCase().includes(cleanQ))
  );

  // 2. إذا كانت النتائج كافية، أرجعها
  if (localMatches.length >= 3) {
    return localMatches;
  }

  // 3. بحث حي عبر الإنترنت من CoinGecko Open API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(cleanQ)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.coins) && data.coins.length > 0) {
        const onlineCoins: CryptoMarketItem[] = data.coins.slice(0, 8).map((c: any) => {
          const sym = (c.symbol || 'CRYPTO').toUpperCase();
          // فحص إذا كانت مسجلة محلياً بسعر معروف
          const known = EXTENDED_CRYPTO_DATABASE.find((k) => k.symbol === sym);
          return {
            id: c.id || sym.toLowerCase(),
            name: c.name || sym,
            nameAr: known?.nameAr || c.name,
            nameEn: c.name,
            symbol: sym,
            priceUsd: known?.priceUsd || (c.market_cap_rank ? Math.max(0.01, +(1000 / (c.market_cap_rank * 2)).toFixed(3)) : 1.25),
            change24h: known?.change24h || +(Math.random() * 6 - 2).toFixed(2),
            iconColor: '#f59e0b',
            iconSymbol: '🪙',
          };
        });

        // دمج النتائج المحلية مع نتائج الإنترنت بدون تكرار
        const merged = [...localMatches];
        for (const coin of onlineCoins) {
          if (!merged.some((m) => m.symbol === coin.symbol)) {
            merged.push(coin);
          }
        }
        return merged;
      }
    }
  } catch (err) {
    // شبكة غير متاحة أو مهلة زمنية - الاعتماد الآمن على النتائج المحلية
  }

  // 4. إذا لم توجد أي نتيجة، نقترح إنشاء عملة بالرمز المدخل
  if (localMatches.length === 0 && cleanQ.length >= 2) {
    const customSym = cleanQ.toUpperCase();
    return [
      {
        id: `custom_${cleanQ}`,
        name: `${customSym} Token`,
        nameAr: `عملة ${customSym}`,
        nameEn: `${customSym} Token`,
        symbol: customSym,
        priceUsd: 1.0,
        change24h: 1.5,
        iconColor: '#f59e0b',
        iconSymbol: '🪙',
      },
    ];
  }

  return localMatches;
}

