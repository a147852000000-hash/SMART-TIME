import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Check, RefreshCw, MapPin, AlertCircle } from 'lucide-react';
import { TripLocation, LocationPickerMode } from './types';
import { apiUrl } from '../../services/apiConfig';

interface VoiceLocationPickerProps {
  mode: LocationPickerMode;
  onSelect: (location: TripLocation) => void;
  language?: 'ar' | 'en';
}

export const VoiceLocationPicker: React.FC<VoiceLocationPickerProps> = ({
  mode,
  onSelect,
  language = 'ar',
}) => {
  const isRtl = language === 'ar';
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [discoveredLocation, setDiscoveredLocation] = useState<TripLocation | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language === 'ar' ? 'ar-EG' : 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setErrorMsg(null);
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setErrorMsg(isRtl ? 'يرجى السماح بالوصول للميكروفون' : 'Microphone permission denied');
      } else if (event.error !== 'no-speech') {
        setErrorMsg(isRtl ? 'تعذر التعرف على الصوت، حاول ثانية' : 'Could not recognize speech');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    // Auto-start listening on mount
    try {
      recognition.start();
    } catch (e) {
      console.warn('Auto start speech failed:', e);
    }

    return () => {
      try {
        recognition.abort();
      } catch {}
    };
  }, [language, isRtl]);

  // When transcript completes or stops listening, geocode the location
  useEffect(() => {
    if (!transcript.trim() || isListening) return;

    const findLocation = async () => {
      setIsSearching(true);
      try {
        const res = await fetch(apiUrl(`/api/maps/geocode?address=${encodeURIComponent(transcript.trim())}`));
        const data = await res.json();
        if (data.address && data.latitude && data.longitude) {
          setDiscoveredLocation({
            address: data.address,
            name: transcript.trim(),
            latitude: data.latitude,
            longitude: data.longitude,
            placeId: data.placeId,
          });
        } else {
          // Fallback if not directly in geocoding
          setDiscoveredLocation({
            address: `${transcript.trim()}، مصر`,
            name: transcript.trim(),
            latitude: 30.0444,
            longitude: 31.2357,
          });
        }
      } catch (err) {
        setDiscoveredLocation({
          address: `${transcript.trim()}، مصر`,
          name: transcript.trim(),
          latitude: 30.0444,
          longitude: 31.2357,
        });
      } finally {
        setIsSearching(false);
      }
    };

    findLocation();
  }, [transcript, isListening]);

  const handleToggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setDiscoveredLocation(null);
      setTranscript('');
      setErrorMsg(null);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Speech start error:', e);
      }
    }
  };

  const handleConfirm = () => {
    if (discoveredLocation) {
      onSelect(discoveredLocation);
    }
  };

  return (
    <div className="flex flex-col h-[480px] sm:h-[540px] w-full bg-slate-900 rounded-2xl p-5 sm:p-6 space-y-6 border border-slate-700 items-center justify-between text-center">
      {/* Top Header info */}
      <div className="space-y-1">
        <h3 className="text-base font-extrabold text-white">
          {mode === 'pickup'
            ? isRtl
              ? 'تحديد نقطة الانطلاق بالصوت 🎙️'
              : 'Voice Pickup Location 🎙️'
            : isRtl
            ? 'تحديد نقطة النزول بالصوت 🎙️'
            : 'Voice Dropoff Location 🎙️'}
        </h3>
        <p className="text-xs text-slate-400">
          {isRtl
            ? 'تحدث بوضوح باسم المكان (مثال: "مطار القاهرة"، "التجمع الخامس"، "مدينة نصر")'
            : 'Speak clearly with the destination name'}
        </p>
      </div>

      {/* Main Microphone Pulsing Visualizer */}
      <div className="relative flex flex-col items-center justify-center my-4">
        {/* Glowing concentric rings */}
        {isListening && (
          <>
            <div className="absolute w-36 h-36 rounded-full bg-accent-500/20 animate-ping" />
            <div className="absolute w-28 h-28 rounded-full bg-accent-500/30 animate-pulse" />
          </>
        )}

        <button
          onClick={handleToggleListening}
          className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-95 ${
            isListening
              ? 'bg-gradient-to-tr from-accent-500 to-yellow-500 text-white shadow-accent-500/50 scale-105'
              : 'bg-slate-800 text-slate-300 border-2 border-slate-700 hover:border-accent-500 hover:text-white'
          }`}
          aria-label={isRtl ? 'البحث الصوتي' : 'Voice Search'}
        >
          {isListening ? <Mic className="w-10 h-10 animate-bounce" /> : <MicOff className="w-9 h-9" />}
        </button>

        <span className="mt-4 text-xs font-bold text-accent-400">
          {isListening
            ? isRtl
              ? 'جاري الاستماع إليك... تحدث الآن'
              : 'Listening... Speak now'
            : isRtl
            ? 'اضغط على الميكروفون لبدء التحدث'
            : 'Tap microphone to speak'}
        </span>
      </div>

      {/* Live Transcript & Discovered Location Result Card */}
      <div className="w-full max-w-md space-y-3">
        {transcript && (
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-xs">
            <span className="text-[10px] font-bold text-slate-400 block mb-1">
              {isRtl ? 'الصوت المسموع:' : 'Heard:'}
            </span>
            <span className="font-extrabold text-sm text-white">"{transcript}"</span>
          </div>
        )}

        {isSearching && (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-accent-400 font-bold">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{isRtl ? 'جاري تحديد المكان على الخريطة...' : 'Locating on map...'}</span>
          </div>
        )}

        {discoveredLocation && !isSearching && (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/60 shadow-lg text-start space-y-2 animate-fadeIn">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-400">
              <MapPin className="w-4 h-4 shrink-0" />
              <span>{isRtl ? 'هل تقصد هذا المكان؟' : 'Did you mean this place?'}</span>
            </div>
            <div className="font-extrabold text-sm text-white truncate">
              {discoveredLocation.address}
            </div>
            <div className="text-[11px] text-slate-400">
              {discoveredLocation.latitude.toFixed(4)}, {discoveredLocation.longitude.toFixed(4)}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!speechSupported && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-300 text-xs">
            {isRtl
              ? 'متصفحك لا يدعم التعرف الصوتي المباشر. يمكنك استخدام خياري كتابة العنوان أو الخريطة.'
              : 'Speech recognition is not supported in this browser.'}
          </div>
        )}
      </div>

      {/* Confirmation / Retry Actions */}
      <div className="w-full max-w-md grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={handleToggleListening}
          className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isRtl ? 'تحدث مجدداً' : 'Speak Again'}</span>
        </button>

        <button
          onClick={handleConfirm}
          disabled={!discoveredLocation || isSearching}
          className={`py-3 px-4 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md ${
            discoveredLocation
              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30 active:scale-95'
              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
          }`}
          aria-label={isRtl ? 'تأكيد الموقع' : 'Confirm Location'}
        >
          <Check className="w-4 h-4" />
          <span>{isRtl ? 'تأكيد واختيار' : 'Confirm Place'}</span>
        </button>
      </div>
    </div>
  );
};
