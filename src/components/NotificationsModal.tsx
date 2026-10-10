import React, { useState, useMemo } from 'react';
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  ExternalLink,
  MessageSquare,
  Car,
  Navigation,
  DollarSign,
  FileText,
  GraduationCap,
  Utensils,
  ShieldCheck,
  Cloud,
  X,
  BookOpen,
} from 'lucide-react';
import { AppNotification, Language, NotificationCategory } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAll: () => void;
  onNavigateToSection: (tab: string) => void;
  language: Language;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAll,
  onNavigateToSection,
  language,
}) => {
  const [activeFilter, setActiveFilter] = useState<NotificationCategory>('all');
  const isAr = language === 'ar';

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter((n) => n.category === activeFilter);
  }, [notifications, activeFilter]);

  if (!isOpen) return null;

  const getCategoryMeta = (cat: AppNotification['category']) => {
    switch (cat) {
      case 'chat':
        return {
          label: isAr ? 'المحادثات' : 'Chat',
          icon: MessageSquare,
          color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        };
      case 'vehicles':
        return {
          label: isAr ? 'السيارات' : 'Vehicles',
          icon: Car,
          color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        };
      case 'trips':
        return {
          label: isAr ? 'المشاوير' : 'Trips',
          icon: Navigation,
          color: 'text-accent-500 bg-accent-500/10 border-accent-500/20',
        };
      case 'expenses':
        return {
          label: isAr ? 'المصاريف' : 'Expenses',
          icon: DollarSign,
          color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        };
      case 'notes':
        return {
          label: isAr ? 'الملاحظات' : 'Notes',
          icon: FileText,
          color: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
        };
      case 'religious':
        return {
          label: isAr ? 'العبادات' : 'Religion',
          icon: BookOpen,
          color: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
        };
      case 'education':
        return {
          label: isAr ? 'التعليم' : 'Education',
          icon: GraduationCap,
          color: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
        };
      case 'food':
        return {
          label: isAr ? 'المطبخ' : 'Kitchen',
          icon: Utensils,
          color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        };
      case 'security':
        return {
          label: isAr ? 'الخزنة والأمان' : 'Security',
          icon: ShieldCheck,
          color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
        };
      case 'backup':
      case 'system':
      default:
        return {
          label: isAr ? 'النظام' : 'System',
          icon: Cloud,
          color: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
        };
    }
  };

  const filterTabs: { id: NotificationCategory; label: string; count: number }[] = [
    { id: 'all', label: isAr ? 'الكل' : 'All', count: notifications.length },
    {
      id: 'chat',
      label: isAr ? 'المحادثات' : 'Chat',
      count: notifications.filter((n) => n.category === 'chat').length,
    },
    {
      id: 'vehicles',
      label: isAr ? 'السيارات' : 'Vehicles',
      count: notifications.filter((n) => n.category === 'vehicles').length,
    },
    {
      id: 'trips',
      label: isAr ? 'المشاوير' : 'Trips',
      count: notifications.filter((n) => n.category === 'trips').length,
    },
    {
      id: 'expenses',
      label: isAr ? 'المصاريف' : 'Expenses',
      count: notifications.filter((n) => n.category === 'expenses').length,
    },
    {
      id: 'notes',
      label: isAr ? 'الملاحظات' : 'Notes',
      count: notifications.filter((n) => n.category === 'notes').length,
    },
    {
      id: 'religious',
      label: isAr ? 'العبادات' : 'Religion',
      count: notifications.filter((n) => n.category === 'religious').length,
    },
    {
      id: 'education',
      label: isAr ? 'التعليم' : 'Education',
      count: notifications.filter((n) => n.category === 'education').length,
    },
    {
      id: 'food',
      label: isAr ? 'المطبخ' : 'Kitchen',
      count: notifications.filter((n) => n.category === 'food').length,
    },
    {
      id: 'security',
      label: isAr ? 'الخزنة' : 'Vault',
      count: notifications.filter((n) => n.category === 'security').length,
    },
    {
      id: 'backup',
      label: isAr ? 'النسخ الاحتياطي' : 'Backup',
      count: notifications.filter((n) => n.category === 'backup').length,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-h-[85vh] h-[85vh] sm:h-auto flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        id="all-sections-notifications-sheet"
      >
        {/* Android Sheet Top Drag Handle (Mobile) */}
        <div className="w-full pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-accent-500/10 border border-accent-500/20 text-accent-600 flex items-center justify-center">
              <Bell className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>{isAr ? 'مركز الإشعارات الشامل' : 'Notifications Hub'}</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white font-mono">
                    {unreadCount}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isAr ? 'تنبيهات ومتابعات جميع أقسام التطبيق' : 'All sections updates & alerts'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={isAr ? 'تحديد الكل كمقروء' : 'Mark all read'}
              >
                <CheckCheck className="w-4 h-4 text-emerald-500" />
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                title={isAr ? 'مسح جميع الإشعارات' : 'Clear all'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Categories Horizontal Scrolling Filter Chips */}
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200/60 dark:border-slate-800/60 overflow-x-auto no-scrollbar flex items-center gap-1.5">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 ${
                  isActive
                    ? 'bg-accent-500 text-slate-950 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`px-1 py-0.2 rounded-md text-[10px] font-mono ${
                      isActive
                        ? 'bg-slate-950 text-accent-400'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notifications List Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredNotifications.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center p-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-2">
                <BellOff className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr ? 'لا توجد إشعارات في هذا القسم حاليًا' : 'No notifications in this category'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {isAr ? 'ستظهر هنا التنبيهات فور وصولها من أي قسم' : 'New notifications will appear here'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const meta = getCategoryMeta(notif.category);
              const IconComp = meta.icon;
              return (
                <div
                  key={notif.id}
                  onClick={() => onMarkAsRead(notif.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer relative group ${
                    notif.isRead
                      ? 'bg-white dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 opacity-80 hover:opacity-100'
                      : 'bg-accent-50/40 dark:bg-accent-950/20 border-accent-200 dark:border-accent-900/40 shadow-xs'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Category Icon Badge */}
                    <div
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.color}`}
                    >
                      <IconComp className="w-4.5 h-4.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[10px] font-bold text-accent-600 dark:text-accent-400 px-1.5 py-0.2 rounded-md bg-accent-500/10">
                          {meta.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {notif.date}
                        </span>
                      </div>

                      <h3
                        className={`text-xs font-bold leading-snug ${
                          notif.isRead
                            ? 'text-slate-800 dark:text-slate-200'
                            : 'text-slate-950 dark:text-white'
                        }`}
                      >
                        {notif.title}
                      </h3>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                        {notif.body}
                      </p>

                      {/* Action Bar */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        {notif.actionTab ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkAsRead(notif.id);
                              onNavigateToSection(notif.actionTab!);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-600 dark:text-accent-400 hover:underline active:scale-95"
                          >
                            <span>{isAr ? 'فتح القسم ومتابعة الإشعار' : 'Open Section'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          <span />
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNotification(notif.id);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title={isAr ? 'حذف الإشعار' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Unread indicator point */}
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-accent-500 shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
