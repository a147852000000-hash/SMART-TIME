import type L from 'leaflet';

/**
 * إعدادات بلاطات الخريطة مع تحويل تلقائي للمصدر المجاني عند فشل MapTiler.
 *
 * المشكلة: داخل غلاف الأندرويد (Capacitor) مصدر الصفحة https://localhost
 * فلو كان مفتاح MapTiler مقيداً بنطاقات أخرى يرجع "Invalid key" وتظهر
 * بلاطات خطأ بدل الخريطة. نفس الشيء لو المفتاح انتهى أو تجاوز الحد المجاني.
 *
 * الحل (مجاني بالكامل): نراقب أخطاء البلاطات — بعد 3 أخطاء نعطل MapTiler
 * لبقية الجلسة ونحوّل الخريطة فوراً إلى OpenStreetMap (أحياء) أو Esri
 * World Imagery (أقمار صناعية) بدون أي تدخل من المستخدم.
 */

export type TileMode = 'street' | 'satellite' | 'hybrid' | 'terrain' | 'dark';

// علم على مستوى الجلسة — بعد أول فشل مع تأكيد نعتمد المصدر المجاني مباشرة
let maptilerDisabled = false;

const STYLE_MAP: Record<TileMode, string> = {
  street: 'streets-v2',
  satellite: 'satellite',
  hybrid: 'hybrid',
  terrain: 'outdoor-v2',
  dark: 'streets-v2-dark',
};

const FALLBACK_URLS: Record<TileMode, string> = {
  street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  hybrid: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  terrain: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
};

export interface TileConfig {
  url: string;
  attribution: string;
  usesMaptiler: boolean;
}

export function getTileConfig(mode: TileMode, key: string): TileConfig {
  if (key && !maptilerDisabled) {
    return {
      url: `https://api.maptiler.com/maps/${STYLE_MAP[mode]}/{z}/{x}/{y}.png?key=${key}`,
      attribution: '&copy; MapTiler &copy; OpenStreetMap contributors',
      usesMaptiler: true,
    };
  }
  const isImagery = mode === 'satellite' || mode === 'hybrid';
  return {
    url: FALLBACK_URLS[mode],
    attribution: isImagery
      ? 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
      : '&copy; OpenStreetMap contributors',
    usesMaptiler: false,
  };
}

/** يراقب أخطاء البلاطات — بعد 3 أخطاء يتحول للمصدر المجاني تلقائياً */
export function attachTileErrorFallback(layer: L.TileLayer, mode: TileMode, key: string): void {
  if (!key) return;
  let errors = 0;
  layer.on('tileerror', () => {
    errors += 1;
    if (errors >= 3 && !maptilerDisabled) {
      maptilerDisabled = true;
      const fallback = getTileConfig(mode, key);
      layer.setUrl(fallback.url);
    }
  });
}
