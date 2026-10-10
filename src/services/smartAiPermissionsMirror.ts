import { StorageAdapter } from './storageAdapter';
export type SmartAiPermissionStatus = "granted" | "denied" | "prompt";
export type SmartAiPermissionsMirror = Record<string, SmartAiPermissionStatus>;

const STORAGE_KEY = "smart_ai_permissions";

export function readSmartAiPermissionsMirror(): SmartAiPermissionsMirror {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SmartAiPermissionsMirror) : {};
  } catch {
    return {};
  }
}

export function writeSmartAiPermissionsMirror(
  permissions: SmartAiPermissionsMirror,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    StorageAdapter.setItem(STORAGE_KEY, JSON.stringify(permissions));
  } catch {
    // Mirror is best-effort and must never block the application.
  }
}
