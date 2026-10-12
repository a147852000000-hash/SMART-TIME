const DB_NAME = 'smart-time-religious';
const STORE_NAME = 'assets';
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB غير متاح في هذا المتصفح.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('تعذر فتح التخزين المحلي.'));
  });
}

export async function saveOfflineAsset(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('تعذر حفظ البيانات.'));
      tx.onabort = () => reject(tx.error ?? new Error('تم إلغاء الحفظ.'));
    });
  } finally {
    db.close();
  }
}

export async function getOfflineAsset<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error ?? new Error('تعذر قراءة البيانات المحلية.'));
    });
  } finally {
    db.close();
  }
}

export async function hasOfflineAsset(key: string): Promise<boolean> {
  return (await getOfflineAsset(key)) !== undefined;
}
