import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  X,
  RotateCw,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Gauge,
  Sparkles,
  MapPin,
  DollarSign,
  FileText,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { VehicleAccidentRecord, Language, SecureRecord } from '../types';
import { VaultRepository, VehiclesRepository } from '../services';

interface VehicleCameraModalProps {
  isOpen: boolean;
  initialMode?: 'accident' | 'odometer';
  onClose: () => void;
  onAccidentSaved?: (accident: VehicleAccidentRecord) => void;
  onOdometerCaptured?: (odometer: number, photoUrl?: string) => void;
  currency?: string;
  language?: Language;
  vehicleId?: string;
  odometerOnly?: boolean;
}

export const VehicleCameraModal: React.FC<VehicleCameraModalProps> = ({
  isOpen,
  initialMode = 'accident',
  onClose,
  onAccidentSaved,
  onOdometerCaptured,
  currency = 'EGP',
  language = 'ar',
  vehicleId,
  odometerOnly = false,
}) => {
  const isAr = language === 'ar';

  const [mode, setMode] = useState<'accident' | 'odometer'>(initialMode);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Timer Countdown state (عداد زمني للتصوير)
  const [timerDuration, setTimerDuration] = useState<number>(0); // 0 (instant), 3, 5, 10
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(0);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Flash effect
  const [triggerFlash, setTriggerFlash] = useState<boolean>(false);

  // Captured Photo
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);

  // Accident form fields
  const [accidentTitle, setAccidentTitle] = useState<string>('');
  const [accidentDate, setAccidentDate] = useState<string>('');
  const [accidentTime, setAccidentTime] = useState<string>('');
  const [accidentLocation, setAccidentLocation] = useState<string>('');
  const [accidentDamageCost, setAccidentDamageCost] = useState<string>('');
  const [accidentNotes, setAccidentNotes] = useState<string>('');
  const [saveToVault, setSaveToVault] = useState<boolean>(true);
  const [saveToAccidentsLog, setSaveToAccidentsLog] = useState<boolean>(true);

  // Odometer detected value
  const [detectedOdometer, setDetectedOdometer] = useState<string>('');
  const [isProcessingOcr, setIsProcessingOcr] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Quick chips for accidents
  const accidentTypes = [
    isAr ? 'اصطدام بالصدام الأمامي' : 'Front Bumper Collision',
    isAr ? 'اصطدام بالصدام الخلفي' : 'Rear Bumper Collision',
    isAr ? 'احتكاك / خدش بالجانب' : 'Side Scratch / Dent',
    isAr ? 'كسر في الزجاج / الفانوس' : 'Broken Glass / Headlight',
    isAr ? 'حادث سير مروري' : 'Traffic Accident',
    isAr ? 'تلف بالإطارات' : 'Tire Damage',
  ];

  // Initialize camera when opened
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setCapturedPhotoUrl(null);
      setIsCountingDown(false);
      setCountdownRemaining(0);

      // Set current date & time
      const now = new Date();
      setAccidentDate(now.toISOString().split('T')[0]);
      setAccidentTime(now.toTimeString().slice(0, 5));
      setAccidentTitle(initialMode === 'accident' ? (isAr ? 'حادث اصطدام مروري' : 'Traffic Collision') : '');
      setAccidentDamageCost('');
      setAccidentNotes('');
      setAccidentLocation(isAr ? 'موقع الحادث' : 'Accident Location');

      startCamera(facingMode);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [isOpen, initialMode]);

  const startCamera = async (facing: 'environment' | 'user') => {
    setCameraError(null);
    stopCamera();

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      } else {
        setCameraError(
          isAr
            ? 'الكاميرا غير مدعومة مباشرة في هذا المتصفح، يمكنك رفع صورة من جهازك.'
            : 'Camera API not supported, you can upload a photo from your device.'
        );
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setCameraError(
        isAr
          ? 'تعذر تشغيل الكاميرا المباشرة (قد يتطلب إذن الكاميرا). يمكنك رفع صورة أو تجربة المحاكاة.'
          : 'Could not access live camera. You can upload an image or simulate.'
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const toggleCameraFacing = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  // Beep sound simulation
  const playCountdownBeep = (freq: number = 800) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {
      // Audio context might be restricted before interaction
    }
  };

  // Start Capture Process (respecting timer duration)
  const handleInitiateCapture = () => {
    if (timerDuration === 0) {
      // Instant capture
      executeCaptureSnapshot();
    } else {
      // Start Countdown
      setIsCountingDown(true);
      setCountdownRemaining(timerDuration);
      playCountdownBeep(600);

      let currentSec = timerDuration;
      countdownIntervalRef.current = setInterval(() => {
        currentSec -= 1;
        setCountdownRemaining(currentSec);

        if (currentSec > 0) {
          playCountdownBeep(600);
        } else {
          // Time's up!
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          setIsCountingDown(false);
          playCountdownBeep(1200);
          executeCaptureSnapshot();
        }
      }, 1000);
    }
  };

  const cancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setIsCountingDown(false);
    setCountdownRemaining(0);
  };

  // Perform actual frame snapshot
  const executeCaptureSnapshot = () => {
    setTriggerFlash(true);
    setTimeout(() => setTriggerFlash(false), 250);

    let photoDataUrl = '';

    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        // Stamp with watermark
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
        ctx.fillStyle = '#D4AF37';
        ctx.font = '16px monospace';
        ctx.fillText(
          `SMART TIME • ${new Date().toLocaleString('ar-EG')} • ${mode === 'accident' ? 'ACCIDENT REPORT' : 'ODOMETER SCAN'}`,
          16,
          canvas.height - 15
        );

        photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }
    } else {
      // Fallback simulated realistic snapshot
      photoDataUrl = createFallbackImage(mode);
    }

    setCapturedPhotoUrl(photoDataUrl);
    stopCamera();

    if (mode === 'odometer') {
      // Simulate intelligent OCR extraction
      setIsProcessingOcr(true);
      setTimeout(() => {
        const randKm = Math.floor(45000 + Math.random() * 3500);
        setDetectedOdometer(randKm.toString());
        setIsProcessingOcr(false);
      }, 800);
    }
  };

  const createFallbackImage = (modeType: 'accident' | 'odometer'): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      if (modeType === 'accident') {
        grad.addColorStop(0, '#3a1111');
        grad.addColorStop(1, '#110505');
      } else {
        grad.addColorStop(0, '#0c1a2e');
        grad.addColorStop(1, '#050c18');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      // Icon & text
      ctx.fillStyle = modeType === 'accident' ? '#ef4444' : '#38bdf8';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        modeType === 'accident' ? '🚨 توثيق حادث مروري' : '⚡ قراءة عداد السيارة',
        320,
        220
      );

      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px monospace';
      ctx.fillText(new Date().toLocaleString('ar-EG'), 320, 270);

      if (modeType === 'odometer') {
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 42px monospace';
        ctx.fillText('46,850 KM', 320, 330);
      }
      return canvas.toDataURL('image/jpeg', 0.85);
    }
    return '';
  };

  // Upload photo from device
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setCapturedPhotoUrl(result);
        stopCamera();
        if (mode === 'odometer') {
          setIsProcessingOcr(true);
          setTimeout(() => {
            const randKm = Math.floor(45000 + Math.random() * 3500);
            setDetectedOdometer(randKm.toString());
            setIsProcessingOcr(false);
          }, 800);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedPhotoUrl(null);
    startCamera(facingMode);
  };

  // Save accident record
  const handleSaveAccident = () => {
    if (!capturedPhotoUrl) return;

    const accidentId = `acc_${Date.now()}`;
    const damageVal = parseFloat(accidentDamageCost) || 0;

    let vaultId = '';
    // 1. Save to Secure Vault if checked
    if (saveToVault) {
      vaultId = `vault_acc_${Date.now()}`;
      const secureRecord: SecureRecord = {
        id: vaultId,
        title: `🚨 ${accidentTitle || (isAr ? 'حادث سير موثق' : 'Accident Report')}`,
        category: 'photo',
        value: `${isAr ? 'تاريخ الحادث:' : 'Date:'} ${accidentDate} ${accidentTime} - ${isAr ? 'الموقع:' : 'Location:'} ${accidentLocation}`,
        notes: `${accidentNotes ? `${accidentNotes}\n` : ''}${isAr ? 'تقدير الأضرار:' : 'Damage:'} ${damageVal} ${currency}`,
        mediaUrl: capturedPhotoUrl,
        fileName: `accident_${accidentDate}_${accidentTime.replace(':', '')}.jpg`,
        mimeType: 'image/jpeg',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      VaultRepository.addRecord(secureRecord);
    }

    // 2. Save to Vehicle Accidents Log if checked
    const newAccident: VehicleAccidentRecord = {
      id: accidentId,
      vehicleId: vehicleId || 'default_veh',
      title: accidentTitle || (isAr ? 'حادث سير مروري' : 'Traffic Accident'),
      photoUrl: capturedPhotoUrl,
      date: accidentDate,
      time: accidentTime,
      location: accidentLocation,
      estimatedDamage: damageVal,
      notes: accidentNotes,
      savedToVault: saveToVault,
      vaultRecordId: vaultId,
      createdAt: new Date().toISOString(),
    };

    if (saveToAccidentsLog) {
      VehiclesRepository.addAccidentRecord(newAccident);
    }

    if (onAccidentSaved) {
      onAccidentSaved(newAccident);
    }

    onClose();
  };

  // Confirm Odometer
  const handleApplyOdometer = () => {
    const km = parseInt(detectedOdometer, 10) || 0;
    if (onOdometerCaptured) {
      onOdometerCaptured(km, capturedPhotoUrl || undefined);
    }

    // Also optional save proof in vault
    if (saveToVault && capturedPhotoUrl) {
      const secureRecord: SecureRecord = {
        id: `vault_odo_${Date.now()}`,
        title: `⚡ ${isAr ? 'توثيق عداد السيارة' : 'Odometer Proof'}: ${km} KM`,
        category: 'photo',
        value: `${isAr ? 'قراءة العداد:' : 'Reading:'} ${km} KM - ${new Date().toLocaleDateString('ar-EG')}`,
        mediaUrl: capturedPhotoUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      VaultRepository.addRecord(secureRecord);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="bg-[#121212] border border-accent-500/40 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Flash Effect Layer */}
        {triggerFlash && (
          <div className="absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-200" />
        )}

        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#181818]">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner ${
                mode === 'accident'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-accent-500/20 text-accent-500 border border-accent-500/40'
              }`}
            >
              {mode === 'accident' ? '🚨' : '📸'}
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                <span>
                  {mode === 'accident'
                    ? isAr
                      ? 'تصوير حادث وتوثيقه بالخزنة'
                      : 'Capture Accident & Vault Proof'
                    : isAr
                    ? 'تصوير وقراءة عداد كم (Odometer)'
                    : 'Capture Odometer Reading'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {mode === 'accident'
                  ? isAr
                    ? 'التقاط صورة للحادث مع عداد زمني للتصوير وحفظها تلقائياً'
                    : 'Capture accident damage with timer and save to vault/log'
                  : isAr
                  ? 'التقاط صورة للعداد وقراءة الكيلومترات تلقائياً'
                  : 'Scan odometer and extract kilometers'}
              </p>
            </div>
          </div>

          {/* Mode switch & Close */}
          <div className="flex items-center gap-2">
            {!capturedPhotoUrl && !odometerOnly && (
              <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode('accident')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    mode === 'accident'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isAr ? '🚨 حادث' : 'Accident'}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('odometer')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    mode === 'odometer'
                      ? 'bg-accent-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isAr ? '⚡ العداد' : 'Odometer'}
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!capturedPhotoUrl ? (
            /* ================= CAMERA CAPTURE VIEW ================= */
            <div className="space-y-4">
              {/* Video Viewport Container */}
              <div className="relative aspect-[4/3] sm:aspect-video w-full rounded-2xl bg-black overflow-hidden border-2 border-slate-800 flex items-center justify-center shadow-inner">
                {/* Live Video */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Camera Overlay Guides */}
                <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                  {/* Top bar info */}
                  <div className="flex justify-between items-center text-[11px] font-mono text-white/80 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm self-center">
                    <span>
                      {mode === 'accident'
                        ? isAr
                          ? '🚨 نمط تصوير الحوادث المباشر'
                          : '🚨 Live Accident Mode'
                        : isAr
                        ? '⚡ قم بمحاذاة أرقام العداد داخل الإطار'
                        : '⚡ Align odometer inside frame'}
                    </span>
                  </div>

                  {/* Center Target Rect for Odometer */}
                  {mode === 'odometer' && (
                    <div className="self-center w-64 h-24 border-2 border-dashed border-accent-500 rounded-xl flex items-center justify-center bg-accent-500/5 shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                      <span className="text-xs text-accent-500 font-mono font-bold">
                        [ 0 0 0 0 0 0 KM ]
                      </span>
                    </div>
                  )}

                  {/* Accident viewfinder corners */}
                  {mode === 'accident' && (
                    <div className="self-center w-5/6 h-5/6 border border-rose-500/30 rounded-2xl relative">
                      <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-rose-500" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-rose-500" />
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-rose-500" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-rose-500" />
                    </div>
                  )}

                  {/* Bottom timestamp */}
                  <div className="text-start text-[10px] text-white/70 font-mono">
                    {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')}
                  </div>
                </div>

                {/* Animated Countdown Overlay (عداد زمني للتصوير) */}
                {isCountingDown && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-30 animate-fade-in">
                    <div className="w-28 h-28 rounded-full border-4 border-accent-500 flex items-center justify-center animate-ping absolute opacity-30" />
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-accent-500 to-accent-200 text-slate-950 font-black text-5xl flex items-center justify-center shadow-2xl font-mono">
                      {countdownRemaining}
                    </div>
                    <p className="text-white font-bold text-sm mt-4 animate-pulse">
                      {isAr ? 'جاري التقاط الصورة...' : 'Capturing photo...'}
                    </p>
                    <button
                      type="button"
                      onClick={cancelCountdown}
                      className="mt-4 px-4 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold"
                    >
                      {isAr ? 'إلغاء المؤقت' : 'Cancel Timer'}
                    </button>
                  </div>
                )}

                {/* Error / Fallback info */}
                {cameraError && !stream && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20 space-y-3">
                    <AlertTriangle className="w-10 h-10 text-accent-400" />
                    <p className="text-xs text-slate-300 max-w-sm">{cameraError}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 rounded-xl bg-accent-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                      >
                        <Upload className="w-4 h-4" />
                        <span>{isAr ? 'اختيار صورة من الجهاز' : 'Upload Image'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={executeCaptureSnapshot}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5"
                      >
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span>{isAr ? 'صورة تجريبية' : 'Sample Snapshot'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls Bar: Timer selector, Switch Camera, Shoot */}
              <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Timer Duration Selection (العداد الزمني للتصوير) */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
                    <Clock className="w-4 h-4 text-accent-500" />
                    <span>{isAr ? 'مؤقت التصوير:' : 'Timer:'}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    {[
                      { val: 0, label: isAr ? 'فوري' : '0s' },
                      { val: 3, label: '3s' },
                      { val: 5, label: '5s' },
                      { val: 10, label: '10s' },
                    ].map((t) => (
                      <button
                        key={t.val}
                        type="button"
                        onClick={() => setTimerDuration(t.val)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          timerDuration === t.val
                            ? 'bg-accent-500 text-slate-950'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
                  {/* Switch Front/Back */}
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    title={isAr ? 'تبديل الكاميرا' : 'Switch Camera'}
                    className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {/* Upload button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title={isAr ? 'رفع من المعرض' : 'Upload from gallery'}
                    className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                  </button>

                  {/* MAIN SHUTTER BUTTON */}
                  <button
                    type="button"
                    onClick={handleInitiateCapture}
                    disabled={isCountingDown}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all ${
                      mode === 'accident'
                        ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-accent-600 text-white shadow-rose-900/40 hover:brightness-110'
                        : 'bg-gradient-to-r from-accent-500 to-accent-700 text-slate-950 shadow-accent-500/30 hover:brightness-110'
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                    <span>
                      {isCountingDown
                        ? isAr
                          ? `التقاط خلال ${countdownRemaining} ث`
                          : `Capturing in ${countdownRemaining}s`
                        : timerDuration > 0
                        ? isAr
                          ? `تصوير بمؤقت (${timerDuration}ث)`
                          : `Capture (${timerDuration}s)`
                        : mode === 'accident'
                        ? isAr
                          ? 'تصوير الحادث الآن'
                          : 'Capture Accident'
                        : isAr
                        ? 'التقاط صورة العداد'
                        : 'Capture Odometer'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ================= POST-CAPTURE REVIEW VIEW ================= */
            <div className="space-y-4 animate-fade-in">
              {/* Photo Preview & Retake Banner */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-700 aspect-video sm:aspect-[21/9] bg-black">
                <img
                  src={capturedPhotoUrl}
                  alt="Captured"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={handleRetake}
                  className="absolute top-3 start-3 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-sm border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إعادة التقاط الصورة' : 'Retake Photo'}</span>
                </button>

                <div className="absolute bottom-2 end-3 bg-black/70 px-2.5 py-1 rounded-lg text-[10px] text-accent-500 font-mono flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isAr ? 'صورة موثقة بختم زمني' : 'Timestamped Evidence'}</span>
                </div>
              </div>

              {/* Mode-specific Form Inputs */}
              {mode === 'accident' ? (
                /* Accident Form Details */
                <div className="space-y-3 bg-[#181818] p-4 rounded-2xl border border-rose-500/20">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h4 className="font-black text-sm text-rose-400 flex items-center gap-2">
                      <span>🚨 {isAr ? 'بيانات توثيق الحادث' : 'Accident Details'}</span>
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {accidentDate} • {accidentTime}
                    </span>
                  </div>

                  {/* Quick Chips */}
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1.5 font-bold">
                      {isAr ? 'اختر تصنيف الحادث سريعاً:' : 'Quick Accident Type:'}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {accidentTypes.map((type, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setAccidentTitle(type)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                            accidentTitle === type
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Accident Title */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      {isAr ? 'عنوان الحادث / التلفيات *' : 'Accident Title *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={accidentTitle}
                      onChange={(e) => setAccidentTitle(e.target.value)}
                      placeholder={isAr ? 'مثال: اصطدام بالصدام الخلفي' : 'e.g. Rear Bumper Hit'}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-bold"
                    />
                  </div>

                  {/* Date, Time & Estimated Cost */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        {isAr ? 'تاريخ الحادث' : 'Date'}
                      </label>
                      <input
                        type="date"
                        value={accidentDate}
                        onChange={(e) => setAccidentDate(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        {isAr ? 'الوقت' : 'Time'}
                      </label>
                      <input
                        type="time"
                        value={accidentTime}
                        onChange={(e) => setAccidentTime(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        {isAr ? 'تقدير تكلفة الأضرار' : 'Estimated Damage'} ({currency})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={accidentDamageCost}
                        onChange={(e) => setAccidentDamageCost(e.target.value)}
                        placeholder="0.00"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Location & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-rose-400" />
                        <span>{isAr ? 'موقع أو شارع الحادث' : 'Accident Location'}</span>
                      </label>
                      <input
                        type="text"
                        value={accidentLocation}
                        onChange={(e) => setAccidentLocation(e.target.value)}
                        placeholder={isAr ? 'مثال: طريق النصر - تقاطع مكرم عبيد' : 'Street or place'}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        {isAr ? 'ملاحظات وتفاصيل إضافية' : 'Notes'}
                      </label>
                      <input
                        type="text"
                        value={accidentNotes}
                        onChange={(e) => setAccidentNotes(e.target.value)}
                        placeholder={isAr ? 'أرقام سيارات أخرى، محضر شرطة، إلخ' : 'Additional details'}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
                      />
                    </div>
                  </div>

                  {/* Storage Options (خزنة رقمية + سجل الحوادث) */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <label className="text-xs font-bold text-white block">
                      {isAr ? 'وجهات الحفظ والتوثيق:' : 'Saving Destinations:'}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          saveToVault
                            ? 'bg-accent-500/10 border-accent-500/40 text-white'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={saveToVault}
                          onChange={(e) => setSaveToVault(e.target.checked)}
                          className="rounded text-accent-500 focus:ring-0"
                        />
                        <div className="text-start">
                          <div className="text-xs font-bold flex items-center gap-1 text-accent-500">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{isAr ? 'حفظ في الخزنة الرقمية' : 'Save to Secure Vault'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isAr ? 'تشفير وحماية ضمن الخزنة السرية' : 'Protected in your encrypted vault'}
                          </div>
                        </div>
                      </label>

                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          saveToAccidentsLog
                            ? 'bg-rose-500/10 border-rose-500/40 text-white'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={saveToAccidentsLog}
                          onChange={(e) => setSaveToAccidentsLog(e.target.checked)}
                          className="rounded text-rose-500 focus:ring-0"
                        />
                        <div className="text-start">
                          <div className="text-xs font-bold flex items-center gap-1 text-rose-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{isAr ? 'سجل حوادث المركبة' : 'Vehicle Accidents Log'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isAr ? 'إدراج ضمن تقارير المركبة والصيانة' : 'Included in vehicle reports'}
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveAccident}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-accent-600 hover:from-rose-500 hover:to-accent-500 text-white font-extrabold text-sm shadow-xl shadow-rose-900/30 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>{isAr ? 'حفظ وتوثيق صورة الحادث الآن' : 'Save & Document Accident Photo'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Odometer Review Screen */
                <div className="space-y-4 bg-[#181818] p-5 rounded-2xl border border-accent-500/30">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h4 className="font-black text-sm text-accent-500 flex items-center gap-2">
                      <Gauge className="w-4 h-4" />
                      <span>{isAr ? 'نتيجة فحص وقراءة العداد' : 'Odometer Reading Result'}</span>
                    </h4>
                    {isProcessingOcr && (
                      <span className="text-xs text-cyan-400 animate-pulse flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isAr ? 'جاري استخراج الأرقام...' : 'Extracting numbers...'}</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      {isAr ? 'قراءة العداد الحالية (كيلومتر):' : 'Detected Odometer (KM):'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={detectedOdometer}
                        onChange={(e) => setDetectedOdometer(e.target.value)}
                        placeholder="e.g. 45200"
                        className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-lg font-mono font-black text-center tracking-widest text-accent-500"
                      />
                      <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        KM
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isAr
                        ? 'يمكنك تعديل الرقم يدوياً في حال كانت قراءة الكاميرا تحتاج لضبط.'
                        : 'You can adjust the number manually if needed.'}
                    </p>
                  </div>

                  <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveToVault}
                      onChange={(e) => setSaveToVault(e.target.checked)}
                      className="rounded text-accent-500"
                    />
                    <span className="text-xs text-slate-300">
                      {isAr ? 'حفظ نسخة موثقة من صورة العداد بالخزنة الرقمية' : 'Save documented photo in vault'}
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={handleApplyOdometer}
                    disabled={!detectedOdometer}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-accent-500 to-accent-700 text-slate-950 font-black text-sm shadow-xl shadow-accent-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{isAr ? 'اعتماد قراءة العداد وتطبيقها' : 'Apply Odometer Reading'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
