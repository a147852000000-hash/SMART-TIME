import React, { useState, useEffect } from 'react';
import { Wifi, BatteryMedium, MessageCircle, Bell, Shield, ShieldCheck } from 'lucide-react';
import { Language } from '../types';
import { PermissionService } from '../services/permissionService';

interface AndroidStatusBarProps {
  language: Language;
  unreadNotifications?: number;
  onOpenNotifications?: () => void;
  onOpenPermissions?: () => void;
}

export const AndroidStatusBar: React.FC<AndroidStatusBarProps> = ({
  language,
  unreadNotifications = 0,
  onOpenNotifications,
  onOpenPermissions,
}) => {
  const [time, setTime] = useState(new Date());
  const [allPermissionsGranted, setAllPermissionsGranted] = useState(() => {
    const perms = PermissionService.getPermissions();
    return perms.every((p) => p.status === 'granted');
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkPerms = () => {
      const perms = PermissionService.getPermissions();
      setAllPermissionsGranted(perms.every((p) => p.status === 'granted'));
    };
    window.addEventListener('smart_time_permissions_changed', checkPerms);
    return () => window.removeEventListener('smart_time_permissions_changed', checkPerms);
  }, []);

  // Time in hours and minutes ONLY (الساعة بالدقائق والساعات فقط)
  const isAr = language === 'ar';
  const timeFormatted = time.toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="w-full h-8 px-4 flex items-center justify-between text-[11px] font-bold text-slate-800 dark:text-slate-200 select-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0 z-50 transition-colors"
      id="android-system-status-bar"
    >
      {/* Start: Live Android Clock (HH:MM only) & Notification badges */}
      <div className="flex items-center gap-2">
        <span className="font-mono tracking-tight font-black text-slate-900 dark:text-white">
          {timeFormatted}
        </span>
        {unreadNotifications > 0 && (
          <button
            type="button"
            onClick={onOpenNotifications}
            className="flex items-center gap-1 text-[10px] text-accent-600 dark:text-accent-400 hover:text-accent-500 cursor-pointer active:scale-95 transition-transform"
            title={isAr ? 'عرض جميع الإشعارات' : 'View all notifications'}
          >
            <Bell className="w-3 h-3 animate-pulse text-accent-500" />
            <span className="font-mono font-bold">{unreadNotifications}</span>
          </button>
        )}
        {onOpenPermissions && (
          <button
            type="button"
            onClick={onOpenPermissions}
            className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 hover:opacity-80 transition"
            title={isAr ? 'صلاحيات الهاتف والأذونات' : 'Device Permissions'}
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${allPermissionsGranted ? 'text-emerald-500' : 'text-amber-500'}`} />
          </button>
        )}
        <MessageCircle className="w-3 h-3 text-slate-400 hidden xs:inline" />
      </div>

      {/* Center: Punch-hole camera aesthetic */}
      <div className="flex items-center justify-center">
        <div className="w-3.5 h-3.5 rounded-full bg-slate-950 dark:bg-black ring-2 ring-slate-800/40 dark:ring-slate-700/60 flex items-center justify-center shadow-inner">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
        </div>
      </div>

      {/* End: 5G Network, Wi-Fi, and Battery Status */}
      <div className="flex items-center gap-1.5 text-[10px] font-semibold">
        <span className="font-bold text-[9px] px-1 py-0.2 rounded bg-accent-500/15 text-accent-700 dark:text-accent-400 font-mono">
          5G
        </span>
        <Wifi className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
        <div className="flex items-center gap-0.5">
          <span className="font-mono font-bold text-[10px]">98%</span>
          <BatteryMedium className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 fill-current" />
        </div>
      </div>
    </div>
  );
};
