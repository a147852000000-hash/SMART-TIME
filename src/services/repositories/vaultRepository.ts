import { SecureRecord } from '../../types';
import { STORAGE_KEYS } from '../storageKeys';
import { StorageAdapter } from '../storageAdapter';
import { DEFAULT_SECURE_RECORDS } from '../seedData';

export class VaultRepository {
  static getRecords(): SecureRecord[] {
    return StorageAdapter.getItem<SecureRecord[]>(STORAGE_KEYS.SECURE_RECORDS, DEFAULT_SECURE_RECORDS);
  }

  static saveRecords(records: SecureRecord[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.SECURE_RECORDS, records);
  }

  static addRecord(record: SecureRecord): SecureRecord[] {
    const list = this.getRecords();
    const updated = [record, ...list];
    this.saveRecords(updated);
    return updated;
  }

  static updateRecord(record: SecureRecord): SecureRecord[] {
    const list = this.getRecords();
    const updated = list.map((r) => (r.id === record.id ? record : r));
    this.saveRecords(updated);
    return updated;
  }

  static deleteRecord(id: string): SecureRecord[] {
    const list = this.getRecords();
    const updated = list.filter((r) => r.id !== id);
    this.saveRecords(updated);
    return updated;
  }
}
