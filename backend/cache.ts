import { db } from './database.js';
export function getCache<T>(key:string, allowExpired=false): {value:T; expired:boolean}|null {
  const row:any = db.prepare('SELECT payload,expires_at FROM api_cache WHERE cache_key=?').get(key);
  if (!row) return null;
  const expired = Date.parse(row.expires_at) <= Date.now();
  if (expired && !allowExpired) return null;
  try { return { value: JSON.parse(row.payload), expired }; } catch { return null; }
}
export function setCache(key:string, value:unknown, ttlMs:number) {
  const now = new Date(); const expires = new Date(now.getTime()+ttlMs);
  db.prepare(`INSERT INTO api_cache(cache_key,payload,expires_at,updated_at) VALUES(?,?,?,?)
   ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at,updated_at=excluded.updated_at`)
   .run(key, JSON.stringify(value), expires.toISOString(), now.toISOString());
}
