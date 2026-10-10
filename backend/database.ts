import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { SMART_AI_CANONICAL_SCHEMA_SQL } from './database/canonicalSchema.js';

const defaultDataDir = path.join(process.cwd(), 'data');
const railwayVolumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
const configuredDbPath = process.env.SMART_TIME_DB_PATH?.trim();
const dataDir = railwayVolumePath ? path.resolve(railwayVolumePath) : defaultDataDir;
const dbPath = configuredDbPath ? path.resolve(configuredDbPath) : path.join(dataDir, 'smart-time.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// When Railway first attaches a persistent volume, preserve the legacy SQLite
// database if it is still visible and the persistent target has not been created.
// Copy WAL/SHM sidecars too so committed transactions can be recovered by SQLite.
if ((railwayVolumePath || configuredDbPath) && !fs.existsSync(dbPath)) {
  const legacyDbPath = path.join(defaultDataDir, 'smart-time.db');
  if (path.resolve(legacyDbPath) !== path.resolve(dbPath) && fs.existsSync(legacyDbPath)) {
    fs.copyFileSync(legacyDbPath, dbPath);
    for (const suffix of ['-wal', '-shm']) {
      const source = `${legacyDbPath}${suffix}`;
      if (fs.existsSync(source)) fs.copyFileSync(source, `${dbPath}${suffix}`);
    }
  }
}

export const db = new DatabaseSync(dbPath);
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS service_status (
  service TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  source TEXT,
  message TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS api_cache (
  cache_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_id TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);
CREATE TABLE IF NOT EXISTS user_app_data (
  user_id TEXT NOT NULL,
  data_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, data_key)
);
CREATE INDEX IF NOT EXISTS idx_user_app_data_user ON user_app_data(user_id);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar TEXT,
  created_at TEXT NOT NULL,
  phone TEXT,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  activation_status TEXT NOT NULL DEFAULT 'pending',
  role TEXT NOT NULL DEFAULT 'user',
  activated_by TEXT,
  activated_at TEXT,
  trip_free_searches INTEGER NOT NULL DEFAULT 0,
  trip_gift_claimed_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS trip_gift_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_hash TEXT,
  ip_hash TEXT NOT NULL,
  phone_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'group',
  avatar TEXT,
  background TEXT,
  background_url TEXT,
  creator_id TEXT,
  pinned INTEGER DEFAULT 0,
  settings_json TEXT,
  permissions_json TEXT,
  admin_permissions_json TEXT,
  moderator_permissions_json TEXT,
  last_message TEXT,
  last_message_time TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  muted INTEGER DEFAULT 0,
  banned INTEGER DEFAULT 0,
  PRIMARY KEY(conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  sender_avatar TEXT,
  body TEXT NOT NULL,
  media_url TEXT,
  type TEXT NOT NULL DEFAULT 'text',
  status TEXT NOT NULL DEFAULT 'sent',
  is_pinned INTEGER NOT NULL DEFAULT 0,
  pinned_by TEXT,
  pinned_at TEXT,
  is_edited INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  extra_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS saved_messages (
  user_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  PRIMARY KEY(user_id, message_id)
);
CREATE TABLE IF NOT EXISTS message_reads (
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at TEXT NOT NULL,
  PRIMARY KEY(message_id, user_id)
);
CREATE TABLE IF NOT EXISTS ride_requests (
  id TEXT PRIMARY KEY,
  pickup_json TEXT NOT NULL,
  destination_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ride_quotes (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  amount REAL,
  currency TEXT,
  eta_minutes INTEGER,
  duration_minutes INTEGER,
  status TEXT NOT NULL,
  raw_json TEXT,
  created_at TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS voice_dna_profiles (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  language TEXT NOT NULL,
  locale TEXT NOT NULL,
  dialect TEXT NOT NULL,
  speaking_style TEXT NOT NULL,
  engine_status TEXT NOT NULL DEFAULT 'pending_local_engine',
  owner_confirmed INTEGER NOT NULL DEFAULT 0,
  guardian_confirmed INTEGER NOT NULL DEFAULT 0,
  consent_recorded_at TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS voice_dna_public_keys (
  user_id TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL,
  public_jwk_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  rotated_at TEXT
);
CREATE TABLE IF NOT EXISTS voice_dna_sync_packages (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  share_id TEXT NOT NULL,
  wrapped_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS voice_dna_recovery_envelopes (
  user_id TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL,
  kdf TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  salt TEXT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  public_jwk_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  rotated_at TEXT
);
CREATE TABLE IF NOT EXISTS voice_dna_recovery_samples (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  salt TEXT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  rotated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_dna_recovery_sample_profile ON voice_dna_recovery_samples(user_id, profile_id);
CREATE TABLE IF NOT EXISTS voice_dna_shares (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  UNIQUE(profile_id, recipient_user_id)
);
`);

// Canonical AI / finance schema is owned by backend/database/canonicalSchema.ts.
db.exec(SMART_AI_CANONICAL_SCHEMA_SQL);

try { db.exec('ALTER TABLE users ADD COLUMN username TEXT'); } catch {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN phone TEXT'); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN activation_status TEXT NOT NULL DEFAULT 'pending'"); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN activated_by TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN activated_at TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN avatar TEXT'); } catch {}
try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL`); } catch {}
try { db.exec(`CREATE TABLE IF NOT EXISTS phone_otps (phone TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`); } catch {}
// Support remote OTP providers (e.g. Message Central) that generate/validate the code themselves
// instead of us hashing a locally-generated code.
try { db.exec('ALTER TABLE phone_otps ADD COLUMN remote_provider TEXT'); } catch {}
try { db.exec('ALTER TABLE phone_otps ADD COLUMN remote_verification_id TEXT'); } catch {}
try { db.exec(`CREATE TABLE IF NOT EXISTS password_resets (email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN trip_free_searches INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN trip_gift_claimed_at TEXT'); } catch {}
try { db.exec('ALTER TABLE trip_gift_claims ADD COLUMN phone_hash TEXT'); } catch {}

// Safe migrations for conversations
try { db.exec('ALTER TABLE conversations ADD COLUMN title TEXT'); } catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN description TEXT'); } catch {}
try { db.exec("ALTER TABLE conversations ADD COLUMN type TEXT NOT NULL DEFAULT 'group'"); } catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN avatar TEXT'); } catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN background TEXT'); } catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN background_url TEXT'); } catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN creator_id TEXT'); } catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN pinned INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN settings_json TEXT'); } catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN permissions_json TEXT'); } catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN admin_permissions_json TEXT'); } catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN moderator_permissions_json TEXT'); } catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN last_message TEXT'); } catch {}
try { db.exec('ALTER TABLE conversations ADD COLUMN last_message_time TEXT'); } catch {}
try { db.exec("ALTER TABLE conversations ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''"); } catch {}

// Safe migrations for session role isolation
try { db.exec("ALTER TABLE sessions ADD COLUMN session_role TEXT NOT NULL DEFAULT 'user'"); } catch {}
// Safe migrations for conversation_members
try { db.exec("ALTER TABLE conversation_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'"); } catch {}
try { db.exec("ALTER TABLE conversation_members ADD COLUMN joined_at TEXT NOT NULL DEFAULT ''"); } catch {}
try { db.exec('ALTER TABLE conversation_members ADD COLUMN muted INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE conversation_members ADD COLUMN banned INTEGER DEFAULT 0'); } catch {}

// Safe migrations for messages
try { db.exec('ALTER TABLE messages ADD COLUMN sender_name TEXT'); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN sender_avatar TEXT'); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN media_url TEXT'); } catch {}
try { db.exec("ALTER TABLE messages ADD COLUMN type TEXT NOT NULL DEFAULT 'text'"); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN pinned_by TEXT'); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN pinned_at TEXT'); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN is_edited INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN extra_json TEXT'); } catch {}
try { db.exec("ALTER TABLE messages ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''"); } catch {}

try { db.exec('ALTER TABLE users ADD COLUMN wallet_balance REAL NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN trip_free_searches INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_trip_gift_claims_ip ON trip_gift_claims(ip_hash)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_trip_gift_claims_device ON trip_gift_claims(device_hash)'); } catch {}
try {
  db.exec(`CREATE TABLE IF NOT EXISTS wallet_topups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL
  )`);
} catch {}
try {
  db.exec(`CREATE TABLE IF NOT EXISTS wallet_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    reference TEXT,
    balance_after REAL NOT NULL,
    created_at TEXT NOT NULL
  )`);
} catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_wallet_topups_user ON wallet_topups(user_id, status)`); } catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id, created_at)`); } catch {}
try { db.exec('ALTER TABLE wallet_topups ADD COLUMN review_note TEXT'); } catch {}
try {
  db.exec(`CREATE TABLE IF NOT EXISTS wallet_admin_actions (
    id TEXT PRIMARY KEY,
    topup_id TEXT,
    user_id TEXT,
    action TEXT NOT NULL,
    amount REAL,
    note TEXT,
    actor_id TEXT,
    actor_email TEXT,
    created_at TEXT NOT NULL
  )`);
} catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_wallet_admin_actions_created ON wallet_admin_actions(created_at)`); } catch {}

try { db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at)`); } catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`); } catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id)`); } catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_saved_messages_user ON saved_messages(user_id)`); } catch {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_message_reads_user ON message_reads(user_id, message_id)`); } catch {}

// Seed default public community channels if none exist
export function seedDefaultChatRooms() {
  try {
    const row = db.prepare("SELECT COUNT(*) as count FROM conversations").get() as any;
    if (row && row.count > 0) return;

    const now = new Date().toISOString();
    const defaultRooms = [
      {
        id: 'room_gold_council',
        title: 'مجلس SMART TIME الذهبي 👑',
        description: 'المجلس الرسمي لمجتمع ومستخدمي سمارت تايم الذهبي لنقاش الأفكار والمستجدات.',
        type: 'public',
        avatar: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=120&auto=format&fit=crop&q=80',
        creator_id: 'system',
        pinned: 1,
        last_message: 'مرحبًا بجميع الأعضاء الكرام في مجلس SMART TIME الذهبي!',
        last_message_time: 'الآن',
      },
      {
        id: 'room_trading_gold',
        title: 'غرفة التداول والذهب 📈',
        description: 'نقاشات أسعار الذهب والفضة والعملات والتحليلات اليومية.',
        type: 'public',
        avatar: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=120&auto=format&fit=crop&q=80',
        creator_id: 'system',
        pinned: 0,
        last_message: 'سعر أوقية الذهب يشهد استقراراً مع بداية تداولات اليوم.',
        last_message_time: 'منذ قليل',
      },
      {
        id: 'room_tech_ai',
        title: 'مجتمع التقنية والذكاء الاصطناعي 🤖',
        description: 'كل ما يخص الذكاء الاصطناعي، التطوير، وأحدث التحديثات التقنية.',
        type: 'public',
        avatar: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=120&auto=format&fit=crop&q=80',
        creator_id: 'system',
        pinned: 0,
        last_message: 'تحديثات جديدة في المساعد الذكي وخدمات الوقت.',
        last_message_time: '10:00 ص',
      },
      {
        id: 'room_support',
        title: 'الدعم الفني واستفسارات الأعضاء 💬',
        description: 'مساعدة الأعضاء وتلقي الاقتراحات والاستفسارات الفنية مباشرة.',
        type: 'public',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        creator_id: 'system',
        pinned: 0,
        last_message: 'فريق الدعم في خدمتكم على مدار الساعة.',
        last_message_time: 'أمس',
      },
    ];

    const defaultSettings = JSON.stringify({
      disappearing: 'off',
      muted: false,
      readReceipts: true,
      typingIndicator: true,
      linkPreviews: true,
      mediaAutoSave: false,
      enterToSend: true,
      slowModeSeconds: 0,
      approvalRequired: false,
    });

    const defaultPerms = JSON.stringify({
      sendMessages: true,
      sendMedia: true,
      addMembers: true,
      pinMessages: false,
      editRoom: false,
      deleteMessages: false,
      startCalls: true,
      mentionEveryone: false,
    });

    for (const r of defaultRooms) {
      db.prepare(`
        INSERT INTO conversations (id, title, description, type, avatar, creator_id, pinned, settings_json, permissions_json, last_message, last_message_time, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r.id, r.title, r.description, r.type, r.avatar, r.creator_id, r.pinned, defaultSettings, defaultPerms, r.last_message, r.last_message_time, now, now);

      // Add a welcome message in each room
      const msgId = `msg_welcome_${r.id}`;
      db.prepare(`
        INSERT INTO messages (id, conversation_id, sender_id, sender_name, sender_avatar, body, type, status, is_pinned, is_edited, is_deleted, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        msgId,
        r.id,
        'system',
        'نظام SMART TIME',
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=120&auto=format&fit=crop&q=80',
        r.last_message,
        'text',
        'read',
        1,
        0,
        0,
        now,
        now
      );
    }
  } catch (err) {
    console.warn('Error seeding default chat rooms:', err);
  }
}


try { db.exec('ALTER TABLE voice_dna_profiles ADD COLUMN revoked_at TEXT'); } catch {}
try { db.exec('ALTER TABLE voice_dna_shares ADD COLUMN accepted_at TEXT'); } catch {}
try { db.exec('ALTER TABLE voice_dna_shares ADD COLUMN revoked_at TEXT'); } catch {}

try { db.exec('ALTER TABLE voice_dna_profiles ADD COLUMN owner_confirmed INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE voice_dna_profiles ADD COLUMN guardian_confirmed INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE voice_dna_profiles ADD COLUMN consent_recorded_at TEXT'); } catch {}

try { db.exec('CREATE INDEX IF NOT EXISTS idx_voice_dna_sync_recipient ON voice_dna_sync_packages(recipient_user_id, created_at)'); } catch {}
