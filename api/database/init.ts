import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import bcrypt from 'bcryptjs';

const dbDir = join(process.cwd(), 'data');
const dbPath = join(dbDir, 'pisowifi.db');

// Ensure data directory exists
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- User Sessions Table
  CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    mac_address TEXT UNIQUE NOT NULL,
    credits INTEGER DEFAULT 0,
    minutes_remaining INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE
  );

  -- Session History Table
  CREATE TABLE IF NOT EXISTS session_history (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    coins_inserted INTEGER NOT NULL,
    minutes_earned INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES user_sessions(id)
  );

  -- Rate Settings Table
  CREATE TABLE IF NOT EXISTS rate_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coin_value INTEGER NOT NULL,
    minutes INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Network Interfaces Table
  CREATE TABLE IF NOT EXISTS network_interfaces (
    name TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'unknown',
    ip_address TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Bridge Configuration Table
  CREATE TABLE IF NOT EXISTS bridge_configurations (
    id TEXT PRIMARY KEY,
    bridge_name TEXT NOT NULL,
    interface_names TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Admin Users Table
  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    session_token TEXT,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT TRUE
  );

  -- System Logs Table
  CREATE TABLE IF NOT EXISTS system_logs (
    id TEXT PRIMARY KEY,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    admin_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admin_users(id)
  );

  -- Create indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_sessions_mac ON user_sessions(mac_address);
  CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_history_session ON session_history(session_id);
  CREATE INDEX IF NOT EXISTS idx_history_timestamp ON session_history(timestamp);
  CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level);
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp);
`);

// Insert default rate settings
const defaultRates = [
  { coin_value: 1, minutes: 10 },
  { coin_value: 5, minutes: 60 },
  { coin_value: 10, minutes: 150 }
];

const insertRate = db.prepare('INSERT OR IGNORE INTO rate_settings (coin_value, minutes) VALUES (?, ?)');
defaultRates.forEach(rate => {
  insertRate.run(rate.coin_value, rate.minutes);
});

// Insert default admin user (password: admin123)
// Note: In production, this should be changed immediately
const adminPassword = bcrypt.hashSync('admin123', 10);
const insertAdmin = db.prepare(`
  INSERT OR IGNORE INTO admin_users (id, username, password_hash) 
  VALUES (?, ?, ?)
`);
insertAdmin.run('admin-uuid', 'admin', adminPassword);

console.log('Database initialized successfully!');
console.log(`Database file: ${dbPath}`);

export default db;