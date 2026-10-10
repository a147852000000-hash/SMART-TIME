import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, X, Navigation, AlertCircle, Loader2 } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../services/i18n';
import { apiUrl } from '../services/apiConfig';
import { transcribeVoiceBlob } from '../services/groqSttService';

interface VoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onTranscript?: (transcript: string) => void;
}

const RECORDING_MAX_MS = 90_000;
const SUPPORTED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to encode audio.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

export const VoiceSearchModal: React.FC<VoiceSearchModalProps> = ({
  isOpen,
  onClose,
  language,
  onTranscript,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [speechErrorCode, setSpeechErrorCode] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const clearStopTimer = () => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const resetRecorder = () => {
    clearStopTimer();
    recorderRef.current = null;
    chunksRef.current = [];
    releaseStream();
  };

  const showError = (code: string, message: string) => {
    setSpeechErrorCode(code);
    setError(message);
    setIsStarting(false);
    setIsListening(false);
    setIsProcessing(false);
  };

  const transcribeBlob = async (blob: Blob) => {
    if (!blob.size) {
      showError('empty-audio', language === 'ar' ? 'لم يتم التقاط صوت.' : 'No audio was captured.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSpeechErrorCode(null);

    try {
      const result = await transcribeVoiceBlob(blob, language === 'ar' ? 'ar' : 'en');
      const next = result.transcript.trim();
      if (!next) {
        showError('empty-transcript', language === 'ar' ? 'لم يتم اكتشاف كلام واضح.' : 'No clear speech was detected.');
        return;
      }
      setTranscript(next);
      onTranscriptRef.current?.(next);
      setIsProcessing(false);
    } catch (cause) {
      const code = cause instanceof Error ? String((cause as Error & { code?: string }).code || 'provider-network') : 'provider-network';
      showError(
        code,
        cause instanceof Error
          ? cause.message
          : (language === 'ar' ? 'تعذر الوصول إلى خدمة تحويل الكلام إلى نص.' : 'Speech transcription service is unavailable.'),
      );
    }
  };

  const stopListening = () => {
    clearStopTimer();
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    setIsListening(false);
    setIsProcessing(true);
    recorder.stop();
  };

  const startListening = async () => {
    setIsStarting(true);
    setError(null);
    setSpeechErrorCode(null);
    setTranscript('');
    chunksRef.current = [];

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showError(
        'unsupported',
        language === 'ar' ? 'تسجيل الصوت الحقيقي غير مدعوم في هذا المتصفح.' : 'Real audio recording is not supported in this browser.',
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : 'UnknownError';
      const code = name === 'NotAllowedError' ? 'not-allowed' : name === 'NotFoundError' ? 'audio-capture' : 'microphone-error';
      showError(
        code,
        code === 'not-allowed'
          ? (language === 'ar' ? 'تم رفض إذن الميكروفون.' : 'Microphone permission was denied.')
          : (language === 'ar' ? 'تعذر الوصول إلى الميكروفون.' : 'Microphone capture failed.'),
      );
      return;
    }

    streamRef.current = stream;
    const mimeType = SUPPORTED_MIME_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64_000 }) : new MediaRecorder(stream);
    } catch {
      releaseStream();
      showError(
        'recorder-error',
        language === 'ar' ? 'تعذر بدء تسجيل الصوت.' : 'Could not start audio recording.',
      );
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      showError(
        'recorder-error',
        language === 'ar' ? 'حدث خطأ أثناء تسجيل الصوت.' : 'An error occurred while recording audio.',
      );
      resetRecorder();
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
      resetRecorder();
      await transcribeBlob(blob);
    };

    recorderRef.current = recorder;
    setIsStarting(false);
    setIsListening(true);

    try {
      recorder.start();
      stopTimerRef.current = window.setTimeout(stopListening, RECORDING_MAX_MS);
    } catch {
      resetRecorder();
      showError(
        'recorder-start',
        language === 'ar' ? 'تعذر بدء تسجيل الصوت.' : 'Could not start audio recording.',
      );
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setTranscript('');
    setError(null);
    setSpeechErrorCode(null);
    setIsProcessing(false);
    void startListening();

    return () => {
      clearStopTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch {}
      }
      resetRecorder();
    };
  }, [isOpen, language]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-8 text-center space-y-6 overflow-hidden">
        <div className="flex justify-end -mt-2 -me-2">
          <button
            onClick={() => {
              stopListening();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className={`w-24 h-24 rounded-full bg-gradient-to-tr from-accent-500 via-accent-600 to-yellow-500 text-white flex items-center justify-center shadow-xl shadow-accent-500/30 transition-transform ${isListening ? 'animate-pulse scale-110' : ''}`}>
            {isStarting || isProcessing
              ? <Loader2 className="w-10 h-10 animate-spin" />
              : isListening
                ? <Mic className="w-10 h-10" />
                : <MicOff className="w-10 h-10" />}
          </div>
          {isListening && <div className="absolute inset-0 rounded-full border-4 border-accent-400/40 animate-ping" />}
        </div>

        <div>
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
            {isStarting
              ? language === 'ar' ? 'جاري تشغيل الميكروفون...' : 'Starting microphone...'
              : isProcessing
                ? language === 'ar' ? 'جاري تحويل الكلام إلى نص...' : 'Transcribing speech...'
                : isListening
                  ? language === 'ar' ? 'اتكلم دلوقتي...' : 'Speak now...'
                  : language === 'ar' ? 'انتهى الاستماع' : 'Listening ended'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {language === 'ar' ? 'تحويل الكلام يتم عبر Groq Whisper مع الحفاظ على العربية المصرية.' : 'Speech is transcribed by Groq Whisper.'}
          </p>
          <p className="text-[10px] text-slate-400 mt-2">
            {language === 'ar'
              ? 'التسجيل يُرسل للتحويل فقط ولا يتم حفظ ملف الصوت في SMART TIME.'
              : 'Audio is sent for transcription only and is not persisted by SMART TIME.'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-arabic font-bold text-slate-800 dark:text-slate-100 min-h-[76px] flex items-center justify-center">
          <span>{transcript || (language === 'ar' ? 'في انتظار كلامك...' : 'Waiting for speech...')}</span>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 text-xs font-bold flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <div>
              <span>{error}</span>
              <div className="mt-1 text-[10px] font-mono opacity-80" data-testid="speech-recognition-error-code">
                {language === 'ar' ? `رمز خطأ التعرف: ${speechErrorCode || 'unknown'}` : `Speech recognition error: ${speechErrorCode || 'unknown'}`}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {isListening && (
            <button onClick={stopListening} className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs">
              {language === 'ar' ? 'إيقاف التسجيل' : 'Stop recording'}
            </button>
          )}
          <button
            onClick={() => {
              if (transcript.trim()) onClose();
            }}
            disabled={!transcript.trim()}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-accent-500 to-yellow-600 hover:from-accent-600 hover:to-yellow-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-accent-500/25 transition-all flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4" />
            <span>{language === 'ar' ? 'متابعة' : 'Continue'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
