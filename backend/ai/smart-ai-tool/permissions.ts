import { db } from "../../database.js";

export type Permission = "expenses" | "trips" | "fuel" | "reports" | "cad" | "voice" | "microphone" | "all";

// SQLite is the source of truth. localStorage is intentionally not read here.
db.exec(`
CREATE TABLE IF NOT EXISTS ai_permissions (
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  granted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, permission)
);
CREATE INDEX IF NOT EXISTS idx_ai_permissions_user ON ai_permissions(user_id);
`);

export async function checkPermission(userId: string, permission: Permission): Promise<boolean> {
  if (!userId) return false;
  const all = db.prepare("SELECT granted FROM ai_permissions WHERE user_id=? AND permission='all'").get(userId) as { granted?: number } | undefined;
  if (Number(all?.granted) === 1) return true;
  const row = db.prepare("SELECT granted FROM ai_permissions WHERE user_id=? AND permission=?").get(userId, permission) as { granted?: number } | undefined;
  return Number(row?.granted) === 1;
}

export async function setPermission(userId: string, permission: Permission, granted: boolean): Promise<boolean> {
  if (!userId) throw new Error("userId is required");
  db.prepare(`INSERT INTO ai_permissions(user_id,permission,granted,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(user_id,permission) DO UPDATE SET granted=excluded.granted, updated_at=excluded.updated_at`)
    .run(userId, permission, granted ? 1 : 0, new Date().toISOString());
  return granted;
}

export function listPermissions(userId: string): Record<Permission, boolean> {
  const rows = db.prepare("SELECT permission, granted FROM ai_permissions WHERE user_id=?").all(userId) as Array<{ permission: Permission; granted: number }>;
  const result = {} as Record<Permission, boolean>;
  for (const permission of ["expenses","trips","fuel","reports","cad","voice","microphone","all"] as Permission[]) result[permission] = false;
  for (const row of rows) if (row.permission in result) result[row.permission] = Number(row.granted) === 1;
  return result;
}
