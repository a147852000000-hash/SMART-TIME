import { StorageAdapter } from '../storageAdapter';
import { STORAGE_KEYS } from '../storageKeys';

/**
 * مرآة المصروفات القديمة (smart_time_expenses).
 *
 * المفتاح الوحيد المسموح لكتابته خارج canonical Finance API، وبالاسترجاع من
 * النسخ الاحتياطية فقط: القارئ لهذا المفتاح هو معاينة الترحيل المالي قبل
 * الهجرة إلى المخزن القانوني — فاسترجاع النسخة الاحتياطية لازم يعيد نفس
 * المفتاح حتى تبقى المعاينة متسقة (انظر التعليق داخل backupRepository.ts).
 *
 * راجع scripts/verify-phase5-no-duplicate-writes.mjs — الاستثناء الموثق.
 */
export function restoreLegacyExpensesMirror(raw: unknown): void {
  StorageAdapter.setItem(STORAGE_KEYS.EXPENSES, raw);
}
