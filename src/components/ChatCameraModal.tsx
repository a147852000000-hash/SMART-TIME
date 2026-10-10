import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  X,
  RotateCw,
  Send,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface ChatCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File, caption?: string) => void;
  isAr?: boolean;
  isDark?: boolean;
}

export const ChatCameraModal: React.FC<ChatCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  isAr = true,
  isDark = true,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [isFlashing, setIsFlashing] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0); // 0, 3, 5
  const [countdown, setCountdown] = useState<number>(0);
  const [isCounting, setIsCounting] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const timerIntervalRef = useRef<any>(null);

  // Stop camera stream safely
  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  // Start camera stream
  const startCamera = async (mode: 'environment' | 'user') => {
    stopStream();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        isAr
          ? 'المتصفح أو البيئة الحالية لا تدعم الوصول المباشر للكاميرا. يمكنك اختيار صورة من المعرض.'
          : 'Camera access is not supported in this browser. You can choose a photo from the gallery.'
      );
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => undefined);
      }
    } catch (err: any) {
      console.warn('Camera access failed, trying fallback mode:', err);
      try {
        // Fallback: any video device
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => undefined);
        }
      } catch (fallbackErr: any) {
        setCameraError(
          isAr
            ? 'تعذر تشغيل الكاميرا. يرجى التأكد من منح الإذن لاستخدام الكاميرا أو اختيار صورة من المعرض.'
            : 'Could not access the camera. Please grant camera permissions or choose a photo from the gallery.'
        );
      }
    }
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen && !capturedPhotoUrl) {
      startCamera(facingMode);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isOpen, facingMode, capturedPhotoUrl]);

  // Handle Capture Snapshot
  const executeCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flash simulation
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    // Flip horizontally if front-camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);
        setCapturedFile(file);
        setCapturedPhotoUrl(previewUrl);
        stopStream();
      },
      'image/jpeg',
      0.9
    );
  };

  const handleCaptureClick = () => {
    if (timerSeconds > 0) {
      setIsCounting(true);
      setCountdown(timerSeconds);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            setIsCounting(false);
            executeCapture();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      executeCapture();
    }
  };

  const handleRetake = () => {
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }
    setCapturedPhotoUrl(null);
    setCapturedFile(null);
    setCaption('');
  };

  const handleSend = () => {
    if (capturedFile) {
      onCapture(capturedFile, caption.trim() || undefined);
      handleClose();
    }
  };

  const handleClose = () => {
    stopStream();
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }
    setCapturedPhotoUrl(null);
    setCapturedFile(null);
    setCaption('');
    setIsCounting(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    onClose();
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCapturedFile(file);
    setCapturedPhotoUrl(url);
    stopStream();
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in"
      id="chat-camera-modal"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="relative w-full max-w-lg bg-slate-950 rounded-3xl overflow-hidden border border-accent-500/30 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 text-white">
            <div className="w-8 h-8 rounded-xl bg-accent-500/20 text-accent-500 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">
                {capturedPhotoUrl
                  ? isAr ? 'معاينة الصورة الملتقطة' : 'Photo Preview'
                  : isAr ? 'الكاميرا المباشرة' : 'Live Camera'}
              </h3>
              <p className="text-[10px] text-slate-400">
                {capturedPhotoUrl
                  ? isAr ? 'يمكنك إضافة تعليق وإرسال الصورة للمحادثة' : 'Add a caption and send to chat'
                  : isAr ? 'التقط صورة فورية بجودة عالية' : 'Snap an instant high-quality photo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder / Preview Canvas */}
        <div className="relative flex-1 min-h-[360px] sm:min-h-[440px] bg-black flex items-center justify-center overflow-hidden">
          {/* Visual Flash Effect */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white z-50 animate-out fade-out duration-200 pointer-events-none" />
          )}

          {/* Countdown Overlay */}
          {isCounting && (
            <div className="absolute inset-0 z-40 bg-black/50 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border-4 border-accent-500 bg-black/60 flex items-center justify-center text-4xl font-black text-accent-500 animate-ping">
                {countdown}
              </div>
            </div>
          )}

          {capturedPhotoUrl ? (
            /* Review captured photo */
            <img
              src={capturedPhotoUrl}
              alt="Captured"
              className="w-full h-full object-contain max-h-[50vh]"
            />
          ) : cameraError ? (
            /* Error State with fallback to gallery */
            <div className="p-6 text-center max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h4 className="text-white font-bold text-sm mb-2">
                {isAr ? 'الكاميرا غير متاحة' : 'Camera Unavailable'}
              </h4>
              <p className="text-slate-400 text-xs mb-4 leading-relaxed">{cameraError}</p>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-xl bg-accent-500 hover:bg-accent-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition"
              >
                <ImageIcon className="w-4 h-4" />
                <span>{isAr ? 'اختيار صورة من المعرض' : 'Choose from gallery'}</span>
              </button>
            </div>
          ) : (
            /* Live Camera Stream */
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />

              {/* Grid / Guidelines */}
              <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="w-full h-full grid grid-cols-3 grid-rows-3 border border-white/40">
                  <div className="border border-white/20" />
                  <div className="border border-white/20" />
                  <div className="border border-white/20" />
                  <div className="border border-white/20" />
                  <div className="border border-white/20" />
                  <div className="border border-white/20" />
                  <div className="border border-white/20" />
                  <div className="border border-white/20" />
                  <div className="border border-white/20" />
                </div>
              </div>

              {/* Top camera controls (Timer & Flip) */}
              <div className="absolute top-3 start-3 end-3 flex items-center justify-between z-20">
                {/* Timer Toggle */}
                <button
                  type="button"
                  onClick={() => setTimerSeconds((prev) => (prev === 0 ? 3 : prev === 3 ? 5 : 0))}
                  className={`px-3 py-1.5 rounded-xl backdrop-blur-md border text-xs font-bold flex items-center gap-1.5 transition ${
                    timerSeconds > 0
                      ? 'bg-accent-500 text-slate-950 border-accent-400'
                      : 'bg-black/40 text-white border-white/20 hover:bg-black/60'
                  }`}
                  title={isAr ? 'المؤقت الزمني' : 'Timer'}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timerSeconds === 0 ? (isAr ? 'فوري' : 'Instant') : `${timerSeconds}s`}</span>
                </button>

                {/* Flip camera */}
                <button
                  type="button"
                  onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                  className="p-2.5 rounded-xl bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white transition active:rotate-180"
                  title={isAr ? 'تبديل الكاميرا (أمامية / خلفية)' : 'Flip camera'}
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* Hidden Canvas for Snapshots */}
          <canvas ref={canvasRef} className="hidden" />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleGallerySelect}
          />
        </div>

        {/* Bottom Control Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          {capturedPhotoUrl ? (
            /* After Capture: Caption + Retake & Send buttons */
            <div className="space-y-3">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={isAr ? 'أضف تعليقاً على الصورة (اختياري)...' : 'Add a caption (optional)...'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-accent-500"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{isAr ? 'إعادة الالتقاط' : 'Retake'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-accent-500 hover:bg-accent-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
                >
                  <Send className="w-4 h-4 rtl:rotate-180" />
                  <span>{isAr ? 'إرسال إلى المحادثة' : 'Send to Chat'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Live Controls: Gallery button, Big Shutter button, Close */
            <div className="flex items-center justify-between px-4">
              {/* Gallery Fallback */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition"
                title={isAr ? 'اختيار من المعرض' : 'Gallery'}
              >
                <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold">{isAr ? 'المعرض' : 'Gallery'}</span>
              </button>

              {/* Big Shutter Button */}
              <button
                type="button"
                disabled={!!cameraError || isCounting}
                onClick={handleCaptureClick}
                className="relative w-16 h-16 rounded-full border-4 border-accent-500 flex items-center justify-center transition active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed group"
                title={isAr ? 'التقاط صورة' : 'Take photo'}
              >
                <div className="w-12 h-12 rounded-full bg-accent-500 group-hover:bg-accent-400 transition" />
              </button>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={handleClose}
                className="flex flex-col items-center gap-1 text-slate-400 hover:text-rose-400 transition"
                title={isAr ? 'إلغاء' : 'Cancel'}
              >
                <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center">
                  <X className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold">{isAr ? 'إلغاء' : 'Cancel'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
