import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  PhoneCall,
  Users,
  Camera,
  Mic,
  MapPin,
  Bell,
  HardDrive,
  Bluetooth,
  SunMedium,
  Check,
  X,
  Info,
} from 'lucide-react';
import { PermissionService, PermissionId } from '../services/permissionService';
import { Language, ThemeMode } from '../types';

interface PermissionPromptModalProps {
  isOpen: boolean;
  permissionId: PermissionId;
  onGranted: () => void;
  onDenied?: () => void;
  onClose: () => void;
  language: Language;
  theme: ThemeMode;
}

export const PermissionPromptModal: React.FC<PermissionPromptModalProps> = ({
  isOpen,
  permissionId,
  onGranted,
  onDenied,
  onClose,
  language,
  theme,
}) => {
  if (!isOpen) return null;

  const isAr = language === 'ar';
  const isDark = theme === 'dark';

  const permissions = PermissionService.getPermissions();
  const current = permissions.find((p) => p.id === permissionId) || {
    id: permissionId,
    nameAr: 'صلاحية الهاتف',
    nameEn: 'Phone Permission',
    descriptionAr: 'يحتاج التطبيق لهذه الصلاحية لتشغيل هذه الميزة بسلاسة.',
    descriptionEn: 'The app needs this permission to enable this feature.',
    requiredForAr: 'تشغيل الميزة المحددة بأمان',
    requiredForEn: 'Running the selected feature securely',
    icon: 'Shield',
  };

  const handleGrant = async () => {
    await PermissionService.requestPermissionLive(permissionId);
    onGranted();
    onClose();
  };

  const handleDeny = () => {
    PermissionService.setPermissionStatus(permissionId, 'denied', 'تم الرفض من قبل المستخدم');
    if (onDenied) onDenied();
    onClose();
  };

  const renderIcon = () => {
    const cls = 'w-8 h-8 text-white';
    switch (current.icon) {
      case 'PhoneCall':
        return <PhoneCall className={cls} />;
      case 'Users':
        return <Users className={cls} />;
      case 'Camera':
        return <Camera className={cls} />;
      case 'Mic':
        return <Mic className={cls} />;
      case 'MapPin':
        return <MapPin className={cls} />;
      case 'Bell':
        return <Bell className={cls} />;
      case 'HardDrive':
        return <HardDrive className={cls} />;
      case 'Bluetooth':
        return <Bluetooth className={cls} />;
      case 'SunMedium':
        return <SunMedium className={cls} />;
      default:
        return <ShieldCheck className={cls} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
      <div
        className={`w-full max-w-sm rounded-3xl border p-5 shadow-2xl space-y-4 text-center ${
          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Animated Icon Container */}
        <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          {renderIcon()}
        </div>

        {/* Title and descriptions */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {isAr ? 'طلب إذن وصلاحية هاتف' : 'Device Permission Request'}
          </span>
          <h3 className="text-base font-black">
            {isAr ? current.nameAr : current.nameEn}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-2">
            {isAr ? current.descriptionAr : current.descriptionEn}
          </p>
        </div>

        {/* Feature Context */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2 text-start">
          <Info className="w-4 h-4 text-accent-500 shrink-0" />
          <span>
            <strong>{isAr ? 'مطلوب من أجل: ' : 'Required for: '}</strong>
            {isAr ? current.requiredForAr : current.requiredForEn}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleGrant}
            className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs rounded-2xl shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>{isAr ? 'سماح وإعطاء الصلاحية' : 'Allow & Grant'}</span>
          </button>
          <button
            type="button"
            onClick={handleDeny}
            className="py-3 px-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold text-xs rounded-2xl transition-colors"
          >
            {isAr ? 'رفض' : 'Deny'}
          </button>
        </div>
      </div>
    </div>
  );
};
