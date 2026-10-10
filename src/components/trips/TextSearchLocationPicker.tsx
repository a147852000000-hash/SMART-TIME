import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, Compass, CheckCircle2 } from 'lucide-react';
import { TripLocation, LocationPickerMode } from './types';
import { apiUrl } from '../../services/apiConfig';

interface TextSearchLocationPickerProps {
  mode: LocationPickerMode;
  onSelect: (location: TripLocation) => void;
  language?: 'ar' | 'en';
}

export const TextSearchLocationPicker: React.FC<TextSearchLocationPickerProps> = ({
  mode,
  onSelect,
  language = 'ar',
}) => {
  const isRtl = language === 'ar';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Quick suggestions for Cairo / Egypt
  const quickLandmarks = [
    { name: 'مطار القاهرة الدولي (CAI)', query: 'مطار القاهرة الدولي' },
    { name: 'مول مصر (Mall of Egypt)', query: 'مول مصر 6 أكتوبر' },
    { name: 'كايرو فستيفال سيتي مول', query: 'كايرو فستيفال سيتي التجمع الخامس' },
    { name: 'سيتي ستارز مدينة نصر', query: 'سيتي ستارز مدينة نصر' },
    { name: 'جامعة القاهرة (الجيزة)', query: 'جامعة القاهرة الجيزة' },
    { name: 'محطة قطارات رمسيس', query: 'محطة مصر رمسيس القاهرة' },
  ];

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(apiUrl(`/api/maps/places-search?query=${encodeURIComponent(query)}`));
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          setResults(data.results);
        }
      } catch (err) {
        console.error('Places search failed:', err);
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectResult = (item: any) => {
    onSelect({
      address: item.address || item.name,
      name: item.name,
      latitude: item.latitude || 30.0444,
      longitude: item.longitude || 31.2357,
      placeId: item.placeId,
    });
  };

  return (
    <div className="flex flex-col h-[480px] sm:h-[540px] w-full bg-slate-900 rounded-2xl p-4 sm:p-5 space-y-4 border border-slate-700">
      {/* Search Input Box */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
          <span>{isRtl ? 'ابحث عن المكان بالكتابة:' : 'Search for Address or Landmark:'}</span>
          <span className="text-[11px] text-accent-400 font-semibold">
            {mode === 'pickup' ? (isRtl ? 'نقطة الانطلاق 📍' : 'Pickup Point 📍') : isRtl ? 'نقطة النزول 🏁' : 'Dropoff Point 🏁'}
          </span>
        </label>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isRtl
                ? 'اكتب اسم المكان أو العنوان (مثال: مطار القاهرة، مدينة نصر...)'
                : 'Type address, landmark, or street name...'
            }
            className="w-full ps-10 pe-10 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all shadow-inner"
            aria-label={isRtl ? 'كتابة العنوان' : 'Type Address'}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-slate-400 hover:text-white absolute end-3 top-1/2 -translate-y-1/2"
              title="مسح"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Suggestions Chips */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-400 block">
          {isRtl ? 'وجهات شائعة وسريعة:' : 'Popular Destinations:'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {quickLandmarks.map((lm) => (
            <button
              key={lm.name}
              onClick={() => setQuery(lm.query)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-accent-500/20 hover:border-accent-500 text-slate-300 hover:text-white border border-slate-700/80 text-xs transition-all font-medium"
            >
              {lm.name}
            </button>
          ))}
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto space-y-2 pe-1">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-slate-400 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-accent-500" />
            <span>{isRtl ? 'جاري البحث عن العناوين...' : 'Searching places...'}</span>
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="space-y-2">
            {results.map((res, idx) => (
              <button
                key={res.placeId || idx}
                onClick={() => handleSelectResult(res)}
                className="w-full p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 hover:border-accent-500 text-start flex items-start gap-3 transition-all group shadow-sm"
              >
                <div className="p-2 rounded-lg bg-accent-500/10 text-accent-400 group-hover:bg-accent-500 group-hover:text-white shrink-0 transition-colors">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-sm text-white group-hover:text-accent-300 truncate">
                    {res.name}
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">
                    {res.address}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!isLoading && results.length === 0 && query.trim().length >= 2 && (
          <div className="text-center py-10 text-slate-400 space-y-2">
            <Compass className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
            <div className="text-xs font-bold text-slate-300">
              {isRtl ? 'لم نجد مكاناً مطابقاً' : 'No places found'}
            </div>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              {isRtl ? 'جرّب كتابة اسم معلم رئيسي أو اختر التحديد من على الخريطة' : 'Try searching with another landmark or use the map'}
            </p>
            <button
              onClick={() => handleSelectResult({ name: query, address: `${query}، القاهرة`, latitude: 30.0444, longitude: 31.2357 })}
              className="mt-2 px-4 py-2 rounded-xl bg-accent-500/20 text-accent-300 border border-accent-500/40 text-xs font-bold hover:bg-accent-500 hover:text-white transition-all inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isRtl ? `استخدام "${query}" كعنوان` : `Use "${query}" as address`}</span>
            </button>
          </div>
        )}

        {!isLoading && query.trim().length < 2 && (
          <div className="text-center py-12 text-slate-500 space-y-2">
            <Search className="w-8 h-8 mx-auto text-slate-700" />
            <div className="text-xs text-slate-400">
              {isRtl ? 'اكتب حرفين على الأقل لبدء البحث' : 'Type at least 2 characters to search'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
