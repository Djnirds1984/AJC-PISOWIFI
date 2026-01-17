import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import db from './init.js';

// Types
export interface UserSession {
  id: string;
  mac_address: string;
  credits: number;
  minutes_remaining: number;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface SessionHistory {
  id: string;
  session_id: string;
  coins_inserted: number;
  minutes_earned: number;
  timestamp: string;
}

export interface RateSetting {
  id: number;
  coin_value: number;
  minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface NetworkInterface {
  name: string;
  type: string;
  status: string;
  ip_address: string | null;
  last_updated: string;
}

export interface BridgeConfiguration {
  id: string;
  bridge_name: string;
  interface_names: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  session_token: string | null;
  last_login: string | null;
  is_active: boolean;
}

export interface SystemLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  admin_id: string | null;
  timestamp: string;
}

// User Session Operations
export const createSession = (macAddress: string, credits: number): UserSession => {
  const id = uuidv4();
  const minutes = getMinutesFromCredits(credits);
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO user_sessions (id, mac_address, credits, minutes_remaining, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, macAddress, credits, minutes, expiresAt);
  
  return {
    id,
    mac_address: macAddress,
    credits,
    minutes_remaining: minutes,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
    is_active: true
  };
};

export const getSessionByMac = (macAddress: string): UserSession | null => {
  const stmt = db.prepare('SELECT * FROM user_sessions WHERE mac_address = ? AND is_active = 1');
  return stmt.get(macAddress) as UserSession | null;
};

export const updateSessionCredits = (sessionId: string, additionalCredits: number): UserSession | null => {
  const session = getSessionById(sessionId);
  if (!session) return null;
  
  const newCredits = session.credits + additionalCredits;
  const additionalMinutes = getMinutesFromCredits(additionalCredits);
  const newMinutes = session.minutes_remaining + additionalMinutes;
  const newExpiresAt = new Date(Date.now() + newMinutes * 60 * 1000).toISOString();
  
  const stmt = db.prepare(`
    UPDATE user_sessions 
    SET credits = ?, minutes_remaining = ?, expires_at = ?
    WHERE id = ?
  `);
  
  stmt.run(newCredits, newMinutes, newExpiresAt, sessionId);
  
  // Add to session history
  addSessionHistory(sessionId, additionalCredits, additionalMinutes);
  
  return getSessionById(sessionId);
};

export const getSessionById = (id: string): UserSession | null => {
  const stmt = db.prepare('SELECT * FROM user_sessions WHERE id = ?');
  return stmt.get(id) as UserSession | null;
};

export const expireSession = (sessionId: string): void => {
  const stmt = db.prepare('UPDATE user_sessions SET is_active = 0 WHERE id = ?');
  stmt.run(sessionId);
};

export const getActiveSessions = (): UserSession[] => {
  const stmt = db.prepare(`
    SELECT * FROM user_sessions 
    WHERE is_active = 1 AND expires_at > datetime('now')
  `);
  return stmt.all() as UserSession[];
};

// Session History Operations
export const addSessionHistory = (sessionId: string, coinsInserted: number, minutesEarned: number): void => {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO session_history (id, session_id, coins_inserted, minutes_earned)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, sessionId, coinsInserted, minutesEarned);
};

export const getSessionHistory = (sessionId: string): SessionHistory[] => {
  const stmt = db.prepare('SELECT * FROM session_history WHERE session_id = ? ORDER BY timestamp DESC');
  return stmt.all(sessionId) as SessionHistory[];
};

// Rate Settings Operations
export const getActiveRates = (): RateSetting[] => {
  const stmt = db.prepare('SELECT * FROM rate_settings WHERE is_active = 1 ORDER BY coin_value');
  return stmt.all() as RateSetting[];
};

export const createRate = (coinValue: number, minutes: number): RateSetting => {
  const stmt = db.prepare('INSERT INTO rate_settings (coin_value, minutes) VALUES (?, ?)');
  const result = stmt.run(coinValue, minutes);
  return {
    id: result.lastInsertRowid as number,
    coin_value: coinValue,
    minutes,
    is_active: true,
    created_at: new Date().toISOString()
  };
};

export const updateRate = (id: number, coinValue: number, minutes: number): boolean => {
  const stmt = db.prepare('UPDATE rate_settings SET coin_value = ?, minutes = ? WHERE id = ?');
  const result = stmt.run(coinValue, minutes, id);
  return result.changes > 0;
};

export const deleteRate = (id: number): boolean => {
  const stmt = db.prepare('UPDATE rate_settings SET is_active = 0 WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};

// Admin User Operations
export const getAdminByUsername = (username: string): AdminUser | null => {
  const stmt = db.prepare('SELECT * FROM admin_users WHERE username = ? AND is_active = 1');
  return stmt.get(username) as AdminUser | null;
};

export const updateAdminSession = (adminId: string, sessionToken: string): void => {
  const stmt = db.prepare('UPDATE admin_users SET session_token = ?, last_login = ? WHERE id = ?');
  stmt.run(sessionToken, new Date().toISOString(), adminId);
};

export const clearAdminSession = (sessionToken: string): void => {
  const stmt = db.prepare('UPDATE admin_users SET session_token = NULL WHERE session_token = ?');
  stmt.run(sessionToken);
};

export const getAdminBySession = (sessionToken: string): AdminUser | null => {
  const stmt = db.prepare('SELECT * FROM admin_users WHERE session_token = ? AND is_active = 1');
  return stmt.get(sessionToken) as AdminUser | null;
};

// System Logs Operations
export const addSystemLog = (level: 'info' | 'warn' | 'error', message: string, adminId?: string): void => {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO system_logs (id, level, message, admin_id)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, level, message, adminId || null);
};

export const getSystemLogs = (limit = 100): SystemLog[] => {
  const stmt = db.prepare('SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT ?');
  return stmt.all(limit) as SystemLog[];
};

// Network Interface Operations
export const updateNetworkInterface = (name: string, type: string, status: string, ipAddress?: string): void => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO network_interfaces (name, type, status, ip_address, last_updated)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(name, type, status, ipAddress || null, new Date().toISOString());
};

export const getNetworkInterfaces = (): NetworkInterface[] => {
  const stmt = db.prepare('SELECT * FROM network_interfaces ORDER BY name');
  return stmt.all() as NetworkInterface[];
};

// Bridge Configuration Operations
export const createBridge = (bridgeName: string, interfaceNames: string[]): BridgeConfiguration => {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO bridge_configurations (id, bridge_name, interface_names)
    VALUES (?, ?, ?)
  `);
  stmt.run(id, bridgeName, JSON.stringify(interfaceNames));
  
  return {
    id,
    bridge_name: bridgeName,
    interface_names: JSON.stringify(interfaceNames),
    is_active: true,
    created_at: new Date().toISOString()
  };
};

export const getActiveBridges = (): BridgeConfiguration[] => {
  const stmt = db.prepare('SELECT * FROM bridge_configurations WHERE is_active = 1');
  return stmt.all() as BridgeConfiguration[];
};

// Utility Functions
function getMinutesFromCredits(credits: number): number {
  const rates = getActiveRates();
  let totalMinutes = 0;
  let remainingCredits = credits;
  
  // Sort rates by coin value descending to prioritize larger coins
  rates.sort((a, b) => b.coin_value - a.coin_value);
  
  for (const rate of rates) {
    const coins = Math.floor(remainingCredits / rate.coin_value);
    if (coins > 0) {
      totalMinutes += coins * rate.minutes;
      remainingCredits -= coins * rate.coin_value;
    }
  }
  
  return totalMinutes;
}

// Analytics Functions
export const getAnalytics = () => {
  const activeUsers = getActiveSessions().length;
  
  // Get daily earnings (last 24 hours)
  const dailyEarningsStmt = db.prepare(`
    SELECT SUM(coins_inserted) as total_coins
    FROM session_history 
    WHERE timestamp >= datetime('now', '-1 day')
  `);
  const dailyResult = dailyEarningsStmt.get() as { total_coins: number | null };
  const dailyEarnings = dailyResult.total_coins || 0;
  
  // Get monthly earnings (last 30 days)
  const monthlyEarningsStmt = db.prepare(`
    SELECT SUM(coins_inserted) as total_coins
    FROM session_history 
    WHERE timestamp >= datetime('now', '-30 days')
  `);
  const monthlyResult = monthlyEarningsStmt.get() as { total_coins: number | null };
  const monthlyEarnings = monthlyResult.total_coins || 0;
  
  // Get system uptime (simplified - using first admin login as reference)
  const uptimeStmt = db.prepare('SELECT MIN(last_login) as first_login FROM admin_users');
  const uptimeResult = uptimeStmt.get() as { first_login: string | null };
  
  return {
    active_users: activeUsers,
    daily_earnings: dailyEarnings,
    monthly_earnings: monthlyEarnings,
    system_uptime: uptimeResult.first_login ? calculateUptime(uptimeResult.first_login) : '00:00:00'
  };
};

function calculateUptime(firstLogin: string): string {
  const start = new Date(firstLogin);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default {
  createSession,
  getSessionByMac,
  updateSessionCredits,
  getSessionById,
  expireSession,
  getActiveSessions,
  addSessionHistory,
  getSessionHistory,
  getActiveRates,
  createRate,
  updateRate,
  deleteRate,
  getAdminByUsername,
  updateAdminSession,
  clearAdminSession,
  getAdminBySession,
  addSystemLog,
  getSystemLogs,
  updateNetworkInterface,
  getNetworkInterfaces,
  createBridge,
  getActiveBridges,
  getAnalytics
};