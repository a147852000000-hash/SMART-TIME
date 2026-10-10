import { db } from "./database.ts";

const result = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
if (result.integrity_check !== "ok") {
  throw new Error(`PHASE 2 DB BOOT GATE: integrity_check=${result.integrity_check}`);
}

const tables = db.prepare(`
  SELECT name
  FROM sqlite_master
  WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`).all() as Array<{ name: string }>;

console.log(JSON.stringify({
  integrity_check: result.integrity_check,
  table_count: tables.length,
  tables: tables.map((row) => row.name),
}));
db.close();
