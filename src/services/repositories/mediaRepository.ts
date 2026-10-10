import { MediaFolder, MediaItem } from '../../types';
import { STORAGE_KEYS } from '../storageKeys';
import { StorageAdapter } from '../storageAdapter';
import { DEFAULT_MEDIA_FOLDERS, DEFAULT_MEDIA_ITEMS } from '../seedData';

export class MediaRepository {
  // Folders
  static getFolders(): MediaFolder[] {
    return StorageAdapter.getItem<MediaFolder[]>(STORAGE_KEYS.MEDIA_FOLDERS, DEFAULT_MEDIA_FOLDERS);
  }

  static saveFolders(folders: MediaFolder[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.MEDIA_FOLDERS, folders);
  }

  // Items
  static getItems(): MediaItem[] {
    return StorageAdapter.getItem<MediaItem[]>(STORAGE_KEYS.MEDIA_ITEMS, DEFAULT_MEDIA_ITEMS);
  }

  static saveItems(items: MediaItem[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.MEDIA_ITEMS, items);
  }

  static addItem(item: MediaItem): MediaItem[] {
    const list = this.getItems();
    const updated = [item, ...list];
    this.saveItems(updated);
    return updated;
  }

  static deleteItem(id: string): MediaItem[] {
    const list = this.getItems();
    const updated = list.filter((i) => i.id !== id);
    this.saveItems(updated);
    return updated;
  }
}
