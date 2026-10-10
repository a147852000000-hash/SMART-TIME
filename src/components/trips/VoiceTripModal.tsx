import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Check, Sparkles, X, MapPin, RefreshCw, AlertCircle, Car } from 'lucide-react';
import { TripLocation } from './types';
import { apiUrl } from '../../services/apiConfig';

interface VoiceTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmTrip: (pickup: TripLocation, dropoff: TripLocation) => void;
  language?: 'ar' | 'en';
}

export const VoiceTripModal: React.FC<VoiceTripModalProps> = ({
  isOpen,
  onClose,
  onConfirmTrip,
  language = 'ar',
}) => {
  const isRtl = language === 'ar';
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedTrip, setParsedTrip] = useState<{
    pickup: TripLocation | null;
    dropoff: TripLocation | null;
  }>({ pickup: null, dropoff: null });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setTranscript('');
      setParsedTrip({ pickup: null, dropoff: null });
      setErrorMsg(null);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg(isRtl ? 'المتصفح لا يدعم التعرف الصوتي المباشر' : 'Speech recognition not supported');
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
      let current = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        current += event.results[i][0].transcript;
      }
      setTranscript(current);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setErrorMsg(isRtl ? 'يرجى السماح بالوصول للميكروفون' : 'Microphone permission denied');
      } else if (event.error !== 'no-speech') {
        setErrorMsg(isRtl ? 'تعذر التقاط الصوت، حاول ثانية' : 'Could not capture speech');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {}

    return () => {
      try {
        recognition.abort();
      } catch {}
    };
  }, [isOpen, language, isRtl]);

  // When speech recognition ends, parse the entire trip
  useEffect(() => {
    if (!transcript.trim() || isListening) return;

    const parseSpeech = async () => {
      setIsProcessing(true);
      setErrorMsg(null);
      try {
        const res = await fetch(apiUrl('/api/maps/parse-voice-trip'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcript.trim() }),
        });
        const data = await res.json();

        if (data.success && (data.pickup || data.dropoff)) {
          // Geocode both points
          const pName = data.pickup || 'موقعك الحالي (مدينة نصر)';
          const dName = data.dropoff || 'مطار القاهرة الدولي';

          const [pRes, dRes] = await Promise.all([
            fetch(apiUrl(`/api/maps/geocode?address=${encodeURIComponent(pName)}`))
              .then((r) => r.json())
              .catch(() => ({ address: pName, latitude: 30.0561, longitude: 31.3301 })),
            fetch(apiUrl(`/api/maps/geocode?address=${encodeURIComponent(dName)}`))
              .then((r) => r.json())
              .catch(() => ({ address: dName, latitude: 30.1219, longitude: 31.4056 })),
          ]);

          setParsedTrip({
            pickup: {
              address: pRes.address || pName,
              name: pName,
              latitude: pRes.latitude || 30.0561,
              longitude: pRes.longitude || 31.3301,
            },
            dropoff: {
              address: dRes.address || dName,
              name: dName,
              latitude: dRes.latitude || 30.1219,
              longitude: dRes.longitude || 31.4056,
            },
          });
        } else {
          setErrorMsg(isRtl ? 'لم نتمكن من تحديد نقطتي الانطلاق والوصول بوضوح' : 'Could not determine route points');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'فشل معالجة الصوت');
      } finally {
        setIsProcessing(false);
      }
    };

    parseSpeech();
  }, [transcript, isListening, isRtl]);

  const handleToggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      setParsedTrip({ pickup: null, dropoff: null });
      setErrorMsg(null);
      try {
        recognitionRef.current.start();
      } catch {}
    }
  };

  const handleConfirm = () => {
    if (parsedTrip.pickup && parsedTrip.dropoff) {
      onConfirmTrip(parsedTrip.pickup, parsedTrip.dropoff);
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-850 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-accent-500 text-white shadow-md shadow-accent-500/30">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-extrabold text-base text-white">
                {isRtl ? 'طلب مشوار كامل بالصوت والذكاء الاصطناعي' : 'Voice Trip Assistant'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {isRtl ? 'تحدث بجملة واحدة مثل: "من مدينة نصر لمطار القاهرة"' : 'Speak: "From City X to Airport Y"'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex flex-col items-center text-center">
          {/* Glowing Microphone Visualizer */}
          <div className="relative flex flex-col items-center justify-center my-2">
            {isListening && (
              <>
                <div className="absolute w-32 h-32 rounded-full bg-accent-500/20 animate-ping" />
                <div className="absolute w-24 h-24 rounded-full bg-accent-500/30 animate-pulse" />
              </>
            )}

            <button
              onClick={handleToggleListening}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-95 ${
                isListening
                  ? 'bg-gradient-to-tr from-accent-500 to-yellow-500 text-white shadow-accent-500/50 scale-105'
                  : 'bg-slate-800 text-slate-300 border-2 border-slate-700 hover:border-accent-500 hover:text-white'
              }`}
            >
              {isListening ? <Mic className="w-8 h-8 animate-bounce" /> : <MicOff className="w-8 h-8" />}
            </button>

            <span className="mt-3 text-xs font-bold text-accent-400">
              {isListening
                ? isRtl
                  ? 'جاري الاستماع... اذكر نقطة الانطلاق والوصول'
                  : 'Listening... mention pickup & dropoff'
                : isRtl
                ? 'اضغط للتحدث بالرحلة'
                : 'Tap to speak route'}
            </span>
          </div>

          {/* Transcript display */}
          {transcript && (
            <div className="w-full p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200">
              <span className="text-[10px] font-bold text-slate-400 block mb-1">
                {isRtl ? 'ما تم سماعه:' : 'Heard:'}
              </span>
              <span className="font-extrabold text-sm text-white">"{transcript}"</span>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-accent-400 font-bold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isRtl ? 'جاري تحليل المسار وتحديد الإحداثيات...' : 'Analyzing route...'}</span>
            </div>
          )}

          {/* Route Detected Card */}
          {parsedTrip.pickup && parsedTrip.dropoff && !isProcessing && (
            <div className="w-full p-4 rounded-2xl bg-slate-800/90 border border-slate-700 shadow-lg text-start space-y-3 animate-fadeIn">
              <div className="text-xs font-black text-accent-400 flex items-center gap-1.5">
                <Car className="w-4 h-4" />
                <span>{isRtl ? 'تم التعرف على مسار الرحلة بنجاح:' : 'Route Detected:'}</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400">{isRtl ? 'نقطة الانطلاق:' : 'Pickup:'}</div>
                    <div className="text-xs font-extrabold text-white truncate">{parsedTrip.pickup.address}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="p-1 rounded-lg bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400">{isRtl ? 'نقطة الوصول:' : 'Destination:'}</div>
                    <div className="text-xs font-extrabold text-white truncate">{parsedTrip.dropoff.address}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="w-full p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="w-full grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleToggleListening}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isRtl ? 'إعادة التحدث' : 'Speak Again'}</span>
            </button>

            <button
              onClick={handleConfirm}
              disabled={!parsedTrip.pickup || !parsedTrip.dropoff || isProcessing}
              className={`py-3 px-4 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md ${
                parsedTrip.pickup && parsedTrip.dropoff
                  ? 'bg-gradient-to-r from-accent-500 to-yellow-600 hover:from-accent-600 hover:to-yellow-700 shadow-accent-500/30 active:scale-95'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isRtl ? 'تأكيد وبدء المقارنة' : 'Confirm & Compare'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
