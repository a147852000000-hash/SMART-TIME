import { db } from './database.js';

export type ServiceState = 'LIVE' | 'OFFLINE' | 'FALLBACK' | 'NOT_CONFIGURED';
export type ServiceStatus = { service:string; status:ServiceState; source?:string; message?:string; updatedAt:string };

export function setServiceStatus(service:string, status:ServiceState, source?:string, message?:string) {
  const updatedAt = new Date().toISOString();
  db.prepare(`INSERT INTO service_status(service,status,source,message,updated_at)
    VALUES(?,?,?,?,?) ON CONFLICT(service) DO UPDATE SET status=excluded.status,source=excluded.source,message=excluded.message,updated_at=excluded.updated_at`)
    .run(service,status,source ?? null,message ?? null,updatedAt);
  return { service,status,source,message,updatedAt };
}
export function getServiceStatuses(): ServiceStatus[] {
  return db.prepare('SELECT service,status,source,message,updated_at as updatedAt FROM service_status ORDER BY service').all() as ServiceStatus[];
}
export function seedServiceStatuses() {
  const defaults:[string,ServiceState,string,string][] = [
    ['database','LIVE','sqlite','Persistent local database ready'],
    ['chat','NOT_CONFIGURED','websocket','Real-time gateway reserved for V10'],
    ['accounts','NOT_CONFIGURED','auth','Authentication endpoints reserved for V9'],
    ['maps','NOT_CONFIGURED','maps','Provider not configured yet'],
    ['uber','NOT_CONFIGURED','transport','Official fare integration not configured'],
    ['careem','NOT_CONFIGURED','transport','Official fare integration not configured'],
    ['indrive','NOT_CONFIGURED','transport','Official fare integration not configured'],
    ['didi','NOT_CONFIGURED','transport','Official fare integration not configured'],
  ];
  for (const row of defaults) if (!db.prepare('SELECT 1 FROM service_status WHERE service=?').get(row[0])) setServiceStatus(...row);
}
