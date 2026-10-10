import React, { useState, useEffect } from 'react';
import {
  MapPin,
  MapPinned,
  Search,
  Mic,
  X,
  ArrowRight,
  ArrowLeft,
  Navigation,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Crosshair,
  Loader2,
  Trash2,
} from 'lucide-react';
import { TripLocation, LocationPickerMode } from './types';
import { MapLocationPicker } from './MapLocationPicker';
import { TextSearchLocationPicker } from './TextSearchLocationPicker';
import { VoiceLocationPicker } from './VoiceLocationPicker';
import { apiUrl } from '../../services/apiConfig';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: LocationPickerMode;
  currentLocation?: TripLocation | null;
  onSelectLocation: (location: TripLocation) => void;
  onAddStopRequest?: (location: TripLocation) => void;
  onDeleteStop?: () => void;
  isEditingStop?: boolean;
  language?: 'ar' | 'en';
}

type PickerTab = 'menu' | 'map' | 'text' | 'voice';

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  mode,
  currentLocation,
  onSelectLocation,
  onAddStopRequest,
  onDeleteStop,
  isEditingStop,
  language = 'ar',
}) => {
  const isRtl = language === 'ar';
  const [activeTab, setActiveTab] = useState<PickerTab>('menu');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [liveAddress, setLiveAddress] = useState<string>(
    currentLocation?.address ||
      (mode === 'pickup'
        ? isRtl
          ? 'مدينة نصر، القاهرة'
          : 'Nasr City, Cairo'
        : mode === 'dropoff'
        ? isRtl
          ? 'التجمع الخامس، القاهرة الجديدة'
          : '5th Settlement, New Cairo'
        : isRtl
        ? 'نقطة توقف إضافية'
        : 'Intermediate Stop')
  );
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  useEffect(() => {
    if (currentLocation?.address) {
      setLiveAddress(currentLocation.address);
    }
  }, [currentLocation, mode]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTab('menu');
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectAndClose = (loc: TripLocation) => {
    onSelectLocation(loc);
    setActiveTab('menu');
    onClose();
  };

  const useCurrentLocation = () => {
    if (mode !== 'pickup') {
      setLocationError(isRtl ? 'موقعي متاح لتحديد نقطة الانطلاق فقط.' : 'My location is available for pickup only.');
      return;
    }
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      setLocationError(isRtl ? 'الموقع الحالي يحتاج HTTPS. افتح SMART TIME عبر HTTPS أو جرّبه على localhost.' : 'Current location requires HTTPS. Open SMART TIME over HTTPS or test it on localhost.');
      return;
    }
    if (!navigator.geolocation) {
      setLocationError(isRtl ? 'الموقع الجغرافي غير متاح على هذا المتصفح.' : 'Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const latitude = pos.coords.latitude;
      const longitude = pos.coords.longitude;
      let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      try {
        const r = await fetch(apiUrl(`/api/maps/reverse-geocode?lat=${latitude}&lng=${longitude}`));
        const data = await r.json();
        if (r.ok && data.address) address = data.address;
      } catch { /* الإحداثيات تظل صالحة حتى لو تعذر تحويلها لعنوان */ }
      handleSelectAndClose({
        address,
        name: isRtl ? 'موقعي الحالي' : 'My current location',
        latitude,
        longitude,
      });
      setLocating(false);
    }, (error) => {
      setLocating(false);
      setLocationError(error.code === 1
        ? (isRtl ? 'اسمح للموقع من المتصفح لاستخدام موقعك الحالي.' : 'Allow location access in your browser.')
        : (isRtl ? 'تعذر تحديد موقعك الحالي.' : 'Unable to determine your current location.'));
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
      id="location-picker-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-picker-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setActiveTab('menu');
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] text-slate-900 dark:text-white"
        id="location-picker-modal-container"
      >
        {/* Header Bar: زر الرجوع + تابويت العنوان المباشر في أعلى الخريطة بدون إغلاق وبدون لوجو ضخم */}
        <div className="flex items-center justify-between gap-2.5 px-3.5 sm:px-5 py-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
          {/* زر الرجوع */}
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'menu') {
                setActiveTab('menu');
              } else {
                onClose();
              }
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200/90 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-black text-xs transition-colors shrink-0 shadow-xs active:scale-95"
            title={isRtl ? 'رجوع' : 'Back'}
            aria-label={isRtl ? 'رجوع' : 'Back'}
          >
            {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            <span>{isRtl ? 'رجوع' : 'Back'}</span>
          </button>

          {/* تابويت العنوان والموقع أعلى الخريطة */}
          <div className="flex items-center gap-2 min-w-0 flex-1" dir={isRtl ? 'rtl' : 'ltr'}>
            <span
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm ${
                mode === 'pickup'
                  ? 'bg-emerald-500 shadow-emerald-500/20'
                  : mode === 'stop'
                  ? 'bg-amber-500 shadow-amber-500/20'
                  : 'bg-rose-500 shadow-rose-500/20'
              }`}
            >
              {mode === 'pickup' ? (
                <Navigation className="w-4 h-4" />
              ) : mode === 'stop' ? (
                <MapPin className="w-4 h-4" />
              ) : (
                <MapPinned className="w-4 h-4" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                  {mode === 'pickup'
                    ? isRtl
                      ? 'نقطة الانطلاق 📍'
                      : 'Pickup'
                    : mode === 'stop'
                    ? isRtl
                      ? isEditingStop
                        ? 'تعديل نقطة التوقف 🛑'
                        : 'نقطة توقف إضافية 🛑'
                      : 'Stop Point'
                    : isRtl
                    ? 'نقطة النزول 🏁'
                    : 'Destination'}
                </span>
                {isGeocoding && (
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 flex items-center gap-1 font-bold">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    <span>{isRtl ? 'جاري التحديد...' : 'Locating...'}</span>
                  </span>
                )}
              </div>
              <p
                id="location-picker-modal-title"
                className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate mt-0.5"
                title={liveAddress}
              >
                {liveAddress || (isRtl ? 'انقر على الخريطة لتحديد الموقع' : 'Select on map')}
              </p>
            </div>
          </div>
        </div>

        {/* Tab navigation pills (when active in a subview) */}
        {activeTab !== 'menu' && (
          <div className="flex items-center justify-center gap-2 p-2.5 bg-slate-50 border-b border-slate-200 text-xs">
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === 'map'
                  ? 'bg-accent-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-500 hover:text-slate-900'
              }`}
              aria-label={isRtl ? 'تحديد من على الخريطة' : 'Map Picker'}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{isRtl ? 'الخريطة' : 'Map'}</span>
            </button>

            <button
              onClick={() => setActiveTab('text')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === 'text'
                  ? 'bg-accent-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-500 hover:text-slate-900'
              }`}
              aria-label={isRtl ? 'كتابة العنوان' : 'Search Address'}
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isRtl ? 'كتابة العنوان' : 'Search'}</span>
            </button>

            <button
              onClick={() => setActiveTab('voice')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === 'voice'
                  ? 'bg-accent-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-500 hover:text-slate-900'
              }`}
              aria-label={isRtl ? 'البحث الصوتي' : 'Voice Search'}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isRtl ? 'البحث الصوتي' : 'Voice'}</span>
            </button>
          </div>
        )}

        {/* Modal Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          {/* Main 3 Options Selection Menu */}
          {activeTab === 'menu' && (
            <div className="space-y-4 py-2" id="location-picker-options-menu">
              {/* موقع المستخدم الحالي — متاح فقط لنقطة الانطلاق */}
              {mode === 'pickup' && (
                <button
                  onClick={useCurrentLocation}
                  disabled={locating}
                  className="w-full p-4 rounded-2xl bg-cyan-50 hover:bg-cyan-100 border-2 border-cyan-200 transition-all flex items-center justify-between group shadow-sm active:scale-98 text-start disabled:opacity-70"
                  id="use-current-location-option-btn"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-cyan-500 text-white shadow-md">
                      {locating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crosshair className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-900">{isRtl ? '📍 موقعي الحالي' : '📍 My current location'}</h3>
                      <p className="text-xs text-slate-500 mt-1">{isRtl ? 'حدد نقطة الانطلاق تلقائيًا من موقعك أينما كنت' : 'Use your device location as the pickup point'}</p>
                    </div>
                  </div>
                  {locating && <span className="text-[10px] font-bold text-cyan-700">{isRtl ? 'جاري التحديد...' : 'Locating...'}</span>}
                </button>
              )}
              {locationError && mode === 'pickup' && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-bold px-3 py-2">{locationError}</div>
              )}

              {/* Option 1: تحديد من على الخريطة */}
              <button
                onClick={() => setActiveTab('map')}
                className="w-full p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-accent-500 transition-all flex items-center justify-between group shadow-lg active:scale-98 text-start"
                id="pick-from-map-option-btn"
                aria-label={isRtl ? 'تحديد من على الخريطة. اختر مكان الانطلاق من الخريطة' : 'Pick from map'}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-md">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900 group-hover:text-accent-700">
                      {isRtl ? '📍 تحديد من على الخريطة' : '📍 Pick from Map'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {mode === 'pickup'
                        ? isRtl
                          ? 'اختر مكان الانطلاق من الخريطة التفاعلية بدقة'
                          : 'Choose pickup point precisely from interactive map'
                        : isRtl
                        ? 'اختر مكان الوصول من الخريطة التفاعلية بدقة'
                        : 'Choose dropoff destination precisely from interactive map'}
                    </p>
                  </div>
                </div>
                <div className="text-slate-500 group-hover:text-accent-400 transition-colors">
                  {isRtl ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </button>

              {/* Option 2: كتابة العنوان */}
              <button
                onClick={() => setActiveTab('text')}
                className="w-full p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-accent-500 transition-all flex items-center justify-between group shadow-lg active:scale-98 text-start"
                id="search-address-option-btn"
                aria-label={isRtl ? 'كتابة العنوان. ابحث عن المكان بالكتابة' : 'Search address by typing'}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3.5 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/40 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white transition-all shadow-md">
                    <Search className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900 group-hover:text-accent-700">
                      {isRtl ? '🔎 كتابة العنوان' : '🔎 Type Address or Place'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {isRtl
                        ? 'ابحث عن اسم المكان أو المعلم أو الشارع بالكتابة المباشرة'
                        : 'Search by place name, street, mall, or landmark'}
                    </p>
                  </div>
                </div>
                <div className="text-slate-500 group-hover:text-accent-400 transition-colors">
                  {isRtl ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </button>

              {/* Option 3: البحث الصوتي */}
              <button
                onClick={() => setActiveTab('voice')}
                className="w-full p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-accent-500 transition-all flex items-center justify-between group shadow-lg active:scale-98 text-start"
                id="voice-search-option-btn"
                aria-label={isRtl ? 'البحث الصوتي. قل اسم مكان الانطلاق أو الوصول' : 'Voice Search'}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3.5 rounded-2xl bg-accent-500/20 text-accent-400 border border-accent-500/40 group-hover:scale-110 group-hover:bg-accent-500 group-hover:text-white transition-all shadow-md">
                    <Mic className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900 group-hover:text-accent-700">
                      {isRtl ? '🎙️ البحث الصوتي' : '🎙️ Voice Search'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {mode === 'pickup'
                        ? isRtl
                          ? 'قل اسم مكان الانطلاق بالصوت وسنحدده لك فوراً'
                          : 'Speak your pickup location name'
                        : isRtl
                        ? 'قل اسم مكان الوصول بالصوت وسنحدده لك فوراً'
                        : 'Speak your destination place name'}
                    </p>
                  </div>
                </div>
                <div className="text-slate-500 group-hover:text-accent-400 transition-colors">
                  {isRtl ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </button>

              {/* Delete Stop Button when editing */}
              {isEditingStop && onDeleteStop && (
                <button
                  onClick={() => {
                    onDeleteStop();
                    setActiveTab('menu');
                    onClose();
                  }}
                  className="w-full p-3.5 sm:p-4 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border-2 border-rose-200 dark:border-rose-800 transition-all flex items-center justify-between group shadow-sm active:scale-98 text-start mt-2"
                  id="delete-stop-from-modal-btn"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-500 text-white shadow-md">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-rose-700 dark:text-rose-300">
                        {isRtl ? '🗑️ حذف نقطة التوقف هذه' : '🗑️ Delete this Stop'}
                      </h3>
                      <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-0.5">
                        {isRtl ? 'إزالة هذه المحطة من مسار الرحلة نهائياً' : 'Remove this stop from trip route'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-rose-700 dark:text-rose-300 px-3 py-1.5 rounded-lg bg-rose-200/60 dark:bg-rose-900/80">
                    {isRtl ? 'حذف الآن' : 'Delete'}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Subview 1: Map Picker */}
          {activeTab === 'map' && (
            <MapLocationPicker
              mode={mode}
              initialLocation={currentLocation}
              onConfirm={handleSelectAndClose}
              onConfirmAndAddStop={(loc) => {
                if (onAddStopRequest) {
                  onAddStopRequest(loc);
                } else {
                  handleSelectAndClose(loc);
                }
              }}
              isEditingStop={isEditingStop}
              onDeleteStop={() => {
                if (onDeleteStop) {
                  onDeleteStop();
                  setActiveTab('menu');
                  onClose();
                }
              }}
              onCancel={() => setActiveTab('menu')}
              language={language}
            />
          )}

          {/* Subview 2: Text Search */}
          {activeTab === 'text' && (
            <TextSearchLocationPicker
              mode={mode}
              onSelect={handleSelectAndClose}
              language={language}
            />
          )}

          {/* Subview 3: Voice Picker */}
          {activeTab === 'voice' && (
            <VoiceLocationPicker
              mode={mode}
              onSelect={handleSelectAndClose}
              language={language}
            />
          )}
        </div>
      </div>
    </div>
  );
};
