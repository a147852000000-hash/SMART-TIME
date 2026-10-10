/**
 * SMART TIME — Canonical AI / Finance SQLite schema V1.
 *
 * This module is the single DDL source of truth for the canonical
 * SMART AI runtime domains. Feature modules must not create these tables.
 */
export const SMART_AI_CANONICAL_SCHEMA_VERSION = "v1";

export const SMART_AI_CANONICAL_SCHEMA_SQL = `
-- Generic SMART AI transaction ledger.
CREATE TABLE IF NOT EXISTS ai_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  date TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_transactions_user_date
  ON ai_transactions(user_id, date);

CREATE TABLE IF NOT EXISTS ai_budgets (
  user_id TEXT PRIMARY KEY,
  monthly_limit REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EGP',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL DEFAULT 'general',
  due_date TEXT,
  due_time TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_user
  ON ai_tasks(user_id, due_date);

-- Canonical SMART Calendar.
CREATE TABLE IF NOT EXISTS ai_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT,
  timezone TEXT NOT NULL,
  location TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  all_day INTEGER NOT NULL DEFAULT 0,
  reminder_enabled INTEGER NOT NULL DEFAULT 0,
  reminder_minutes INTEGER,
  recurrence_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_events_user_start
  ON ai_events(user_id, start_at);
CREATE INDEX IF NOT EXISTS idx_ai_events_user_end
  ON ai_events(user_id, end_at);
CREATE INDEX IF NOT EXISTS idx_ai_events_reminders
  ON ai_events(user_id, reminder_enabled, start_at);

CREATE TABLE IF NOT EXISTS ai_event_reminders (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  queued_at TEXT NOT NULL,
  delivered_at TEXT,
  UNIQUE(event_id, scheduled_for)
);
CREATE INDEX IF NOT EXISTS idx_ai_event_reminders_user_pending
  ON ai_event_reminders(user_id, delivered_at, scheduled_for);

-- Specialized finance canonical tables.
-- These remain separate from ai_transactions.
CREATE TABLE IF NOT EXISTS finance_expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EGP',
  category TEXT NOT NULL,
  date TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  receipt_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_user_date
  ON finance_expenses(user_id, date);

CREATE TABLE IF NOT EXISTS finance_monthly_income (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,
  salary REAL NOT NULL DEFAULT 0,
  bonuses REAL NOT NULL DEFAULT 0,
  other_income REAL NOT NULL DEFAULT 0,
  other_income_note TEXT,
  sources_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, month)
);
CREATE INDEX IF NOT EXISTS idx_finance_income_user_month
  ON finance_monthly_income(user_id, month);

CREATE TABLE IF NOT EXISTS finance_bank_certificates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  certificate_number TEXT,
  duration TEXT NOT NULL,
  amount REAL NOT NULL,
  annual_rate REAL,
  annual_profit REAL,
  periodic_profit REAL,
  monthly_equivalent_profit REAL,
  return_type TEXT,
  issue_date TEXT NOT NULL,
  maturity_date TEXT NOT NULL,
  profit_date TEXT NOT NULL,
  profit_amount REAL NOT NULL,
  profit_frequency TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finance_certificates_user_maturity
  ON finance_bank_certificates(user_id, maturity_date);

CREATE TABLE IF NOT EXISTS finance_fuel_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  liters REAL NOT NULL,
  price_per_liter REAL NOT NULL,
  total_cost REAL NOT NULL,
  mileage REAL NOT NULL,
  date TEXT NOT NULL,
  station_name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finance_fuel_user_vehicle_date
  ON finance_fuel_records(user_id, vehicle_id, date);

CREATE TABLE IF NOT EXISTS finance_maintenance_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  system_type TEXT NOT NULL,
  title TEXT NOT NULL,
  cost REAL NOT NULL,
  current_mileage REAL NOT NULL,
  next_mileage_due REAL NOT NULL,
  date TEXT NOT NULL,
  service_center TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finance_maintenance_user_vehicle_date
  ON finance_maintenance_records(user_id, vehicle_id, date);

CREATE TABLE IF NOT EXISTS finance_education_expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finance_education_user_student_date
  ON finance_education_expenses(user_id, student_id, date);
`;
