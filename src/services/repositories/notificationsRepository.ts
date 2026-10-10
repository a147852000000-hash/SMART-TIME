import { AppNotification } from '../../types';
import { STORAGE_KEYS } from '../storageKeys';
import { StorageAdapter } from '../storageAdapter';
import { DEFAULT_NOTIFICATIONS } from '../seedData';
import { NotificationSoundService } from '../notificationSoundService';

export class NotificationsRepository {
  static getNotifications(): AppNotification[] {
    return StorageAdapter.getItem<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, DEFAULT_NOTIFICATIONS);
  }

  static saveNotifications(notifications: AppNotification[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }

  static markAllAsRead(): AppNotification[] {
    const list = this.getNotifications();
    const updated = list.map((n) => ({ ...n, isRead: true }));
    this.saveNotifications(updated);
    return updated;
  }

  static markAsRead(id: string): AppNotification[] {
    const list = this.getNotifications();
    const updated = list.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    this.saveNotifications(updated);
    return updated;
  }

  static deleteNotification(id: string): AppNotification[] {
    const list = this.getNotifications();
    const updated = list.filter((n) => n.id !== id);
    this.saveNotifications(updated);
    return updated;
  }

  static clearAll(): AppNotification[] {
    this.saveNotifications([]);
    return [];
  }

  static addNotification(notification: AppNotification): AppNotification[] {
    const list = this.getNotifications();
    const updated = [notification, ...list];
    this.saveNotifications(updated);
    NotificationSoundService.play();
    return updated;
  }
}
