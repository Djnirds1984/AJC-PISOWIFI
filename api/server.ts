import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';

// Type definitions
interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  session_token?: string;
  last_login?: string;
  is_active: boolean;
}

interface AuthenticatedRequest extends express.Request {
  admin?: AdminUser;
}

// Import services
import GPIOManager from './hardware/gpio-manager.js';
import NetworkManager from './services/network-manager.js';
import SystemUpdater from './services/system-updater.js';

// Import database models
import { 
  createSession, 
  getSessionByMac, 
  updateSessionCredits,
  getActiveSessions,
  getActiveRates,
  createRate,
  updateRate,
  deleteRate,
  getAdminByUsername,
  updateAdminSession,
  getAdminBySession,
  clearAdminSession,
  addSystemLog,
  getAnalytics,
  updateNetworkInterface,
  getNetworkInterfaces,
  createBridge,
  getActiveBridges,
  getWANConfiguration,
  updateWANConfiguration,
  getWLANConfiguration,
  updateWLANConfiguration,
  getHotspotConfigurations,
  createHotspotConfiguration,
  updateHotspotConfiguration,
  deleteHotspotConfiguration,
  getVLANConfigurations,
  createVLANConfiguration,
  updateVLANConfiguration,
  deleteVLANConfiguration,
  addNetworkSettingsHistory,
  getNetworkSettingsHistory
} from './database/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Initialize services
let gpioManager: GPIOManager | null = null;
let networkManager: NetworkManager | null = null;
let systemUpdater: SystemUpdater | null = null;

// GPIO Configuration - Available pins for Raspberry Pi 3B
// Pin 3 (GPIO2) - Previously I2C SDA, now available since you disabled I2C
// Pin 11 (GPIO17) - Safe general purpose pin
const GPIO_PIN = 3; // Primary pin: GPIO2 (SDA)
const GPIO_PIN_FALLBACK = 17; // Fallback pin: GPIO17

// Initialize hardware and services
async function initializeServices() {
  try {
    // Try to initialize GPIO Manager with primary pin (GPIO2)
    gpioManager = new GPIOManager({
      pin: GPIO_PIN,
      debounceTime: 50
    });

    gpioManager.on('coinPulse', async (event) => {
      console.log('Coin detected:', event);
      
      // Update session credits if active session exists
      const activeSessions = getActiveSessions();
      if (activeSessions.length > 0) {
        // For simplicity, add credits to the most recent active session
        const session = activeSessions[0];
        const updatedSession = updateSessionCredits(session.id, event.value);
        
        if (updatedSession) {
          // Emit real-time update to all connected clients
          io.emit('coinDetected', {
            sessionId: session.id,
            credits: updatedSession.credits,
            minutesRemaining: updatedSession.minutes_remaining,
            coinValue: event.value
          });
        }
      }
      
      // Log the coin detection
      addSystemLog('info', `Coin detected: ₱${event.value} (${event.totalPulses} pulses)`);
    });

    gpioManager.on('error', (error) => {
      console.error('GPIO Error:', error);
      addSystemLog('error', `GPIO Error: ${error.message}`);
    });

    console.log(`GPIO: Starting initialization with primary pin ${GPIO_PIN} (GPIO2)`);
    try {
      await gpioManager.initialize();
      console.log(`GPIO: Successfully initialized on primary pin ${GPIO_PIN}`);
      addSystemLog('info', `GPIO successfully initialized on primary pin ${GPIO_PIN}`);
    } catch (error) {
      console.error(`GPIO initialization failed on pin ${GPIO_PIN}, trying fallback pin ${GPIO_PIN_FALLBACK}:`, error);
      addSystemLog('warn', `GPIO initialization failed on pin ${GPIO_PIN}, trying fallback pin ${GPIO_PIN_FALLBACK}: ${error.message}`);
      
      // Try fallback pin
      try {
        console.log(`GPIO: Attempting fallback initialization with pin ${GPIO_PIN_FALLBACK}`);
        gpioManager = new GPIOManager({
          pin: GPIO_PIN_FALLBACK,
          debounceTime: 50
        });
        
        // Re-attach event listeners
        gpioManager.on('coinPulse', async (event) => {
          console.log('Coin detected:', event);
          
          // Update session credits if active session exists
          const activeSessions = getActiveSessions();
          if (activeSessions.length > 0) {
            const session = activeSessions[0];
            const updatedSession = updateSessionCredits(session.id, event.value);
            
            if (updatedSession) {
              io.emit('coinDetected', {
                sessionId: session.id,
                credits: updatedSession.credits,
                minutesRemaining: updatedSession.minutes_remaining,
                coinValue: event.value
              });
            }
          }
          
          addSystemLog('info', `Coin detected: ₱${event.value} (${event.totalPulses} pulses)`);
        });

        gpioManager.on('error', (error) => {
          console.error('GPIO Error:', error);
          addSystemLog('error', `GPIO Error: ${error.message}`);
        });
        
        await gpioManager.initialize();
        console.log(`GPIO successfully initialized on fallback pin ${GPIO_PIN_FALLBACK}`);
        addSystemLog('info', `GPIO successfully initialized on fallback pin ${GPIO_PIN_FALLBACK}`);
      } catch (fallbackError) {
        console.error('Fallback GPIO initialization also failed, continuing in mock mode:', fallbackError);
        addSystemLog('warn', `Fallback GPIO initialization failed, using mock mode: ${fallbackError.message}`);
        // Continue with mock mode - don't throw error to prevent service failure
      }
    }

    // Initialize Network Manager
    networkManager = new NetworkManager();
    await networkManager.initialize();

    // Setup network monitoring interval
    if (networkManager) {
      setInterval(async () => {
        try {
          const interfaces = await networkManager.getNetworkInterfaces();
          io.emit('networkInterfaces', { interfaces });
        } catch (error) {
          console.error('Network monitoring error:', error);
        }
      }, 30000); // Update every 30 seconds
    }

    // Setup captive portal only on Linux systems
    if (process.platform !== 'win32' && networkManager) {
      try {
        await networkManager.setupCaptivePortal();
      } catch (error) {
        console.error('Failed to setup captive portal:', error);
      }
    }

  console.log('All services initialized successfully');
    
    // Initialize System Updater
    systemUpdater = new SystemUpdater();
  } catch (error) {
    console.error('Failed to initialize services:', error);
    addSystemLog('error', `Service initialization failed: ${error.message}`);
  }
}

// Client API Routes
app.get('/api/rates', (req, res) => {
  try {
    const rates = getActiveRates();
    res.json({ rates });
  } catch (error) {
    console.error('Error getting rates:', error);
    res.status(500).json({ error: 'Failed to get rates' });
  }
});

app.post('/api/session', (req, res) => {
  try {
    const { mac_address, credits } = req.body;
    
    if (!mac_address || !credits || credits <= 0) {
      return res.status(400).json({ error: 'Invalid MAC address or credits' });
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(mac_address)) {
      return res.status(400).json({ error: 'Invalid MAC address format' });
    }

    let session = getSessionByMac(mac_address);
    
    if (session) {
      // Update existing session
      session = updateSessionCredits(session.id, credits);
    } else {
      // Create new session
      session = createSession(mac_address, credits);
    }

    if (session) {
      // Whitelist MAC address in firewall
      if (networkManager) {
        networkManager.whitelistMAC(mac_address).catch(error => {
          console.error('Failed to whitelist MAC:', error);
        });
      }
      
      res.json({
        session_id: session.id,
        minutes_remaining: session.minutes_remaining,
        expires_at: session.expires_at
      });
    } else {
      res.status(500).json({ error: 'Failed to create or update session' });
    }
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.get('/api/session/:mac_address', (req, res) => {
  try {
    const { mac_address } = req.params;
    const session = getSessionByMac(mac_address);
    
    if (session) {
      res.json({
        session_id: session.id,
        credits: session.credits,
        minutes_remaining: session.minutes_remaining,
        expires_at: session.expires_at,
        is_active: session.is_active
      });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Admin Authentication Middleware
function authenticateAdmin(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const admin = getAdminBySession(decoded.sessionToken);
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Admin API Routes
app.post('/api/admin/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const admin = getAdminByUsername(username);
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = bcrypt.compareSync(password, admin.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionToken = uuidv4();
    updateAdminSession(admin.id, sessionToken);
    
    const token = jwt.sign({ sessionToken }, JWT_SECRET, { expiresIn: '24h' });
    
    addSystemLog('info', `Admin login: ${username}`, admin.id);
    
    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username
      }
    });
  } catch (error) {
    console.error('Error in admin login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Frontend-compatible admin login route
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const admin = getAdminByUsername(username);
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = bcrypt.compareSync(password, admin.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionToken = uuidv4();
    updateAdminSession(admin.id, sessionToken);
    
    const token = jwt.sign({ sessionToken }, JWT_SECRET, { expiresIn: '24h' });
    
    addSystemLog('info', `Admin login: ${username}`, admin.id);
    
    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username
      }
    });
  } catch (error) {
    console.error('Error in admin login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/admin/auth/logout', authenticateAdmin, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.admin?.session_token) {
      return res.status(400).json({ error: 'No active session' });
    }
    
    clearAdminSession(req.admin.session_token);
    
    addSystemLog('info', `Admin logout: ${req.admin.username}`, req.admin.id);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error in admin logout:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.get('/api/admin/analytics', authenticateAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const analytics = getAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

app.get('/api/admin/sessions', authenticateAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const sessions = getActiveSessions();
    res.json({ sessions });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

app.get('/api/admin/rates', authenticateAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const rates = getActiveRates();
    res.json({ rates });
  } catch (error) {
    console.error('Error getting rates:', error);
    res.status(500).json({ error: 'Failed to get rates' });
  }
});

app.post('/api/admin/rates', authenticateAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { coin_value, minutes } = req.body;
    
    if (!coin_value || !minutes || coin_value <= 0 || minutes <= 0) {
      return res.status(400).json({ error: 'Invalid coin value or minutes' });
    }

    const rate = createRate(coin_value, minutes);
    
    addSystemLog('info', `Rate created: ₱${coin_value} = ${minutes} minutes`, req.admin.id);
    
    res.json({ rate });
  } catch (error) {
    console.error('Error creating rate:', error);
    res.status(500).json({ error: 'Failed to create rate' });
  }
});

app.put('/api/admin/rates/:id', authenticateAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { coin_value, minutes } = req.body;
    
    if (!coin_value || !minutes || coin_value <= 0 || minutes <= 0) {
      return res.status(400).json({ error: 'Invalid coin value or minutes' });
    }

    const success = updateRate(parseInt(id), coin_value, minutes);
    
    if (success) {
      addSystemLog('info', `Rate updated: ₱${coin_value} = ${minutes} minutes`, req.admin.id);
      res.json({ message: 'Rate updated successfully' });
    } else {
      res.status(404).json({ error: 'Rate not found' });
    }
  } catch (error) {
    console.error('Error updating rate:', error);
    res.status(500).json({ error: 'Failed to update rate' });
  }
});

app.delete('/api/admin/rates/:id', authenticateAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    
    const success = deleteRate(parseInt(id));
    
    if (success) {
      addSystemLog('info', `Rate deleted: ID ${id}`, req.admin.id);
      res.json({ message: 'Rate deleted successfully' });
    } else {
      res.status(404).json({ error: 'Rate not found' });
    }
  } catch (error) {
    console.error('Error deleting rate:', error);
    res.status(500).json({ error: 'Failed to delete rate' });
  }
});

app.get('/api/admin/network/interfaces', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // On Windows, always use database fallback
    if (process.platform === 'win32' || !networkManager) {
      // Fallback to database
      const interfaces = getNetworkInterfaces();
      res.json({ interfaces });
    } else {
      const interfaces = await networkManager.getNetworkInterfaces();
      res.json({ interfaces });
    }
  } catch (error) {
    console.error('Error getting network interfaces:', error);
    res.status(500).json({ error: 'Failed to get network interfaces' });
  }
});

app.post('/api/admin/network/bridge', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { bridge_name, interfaces } = req.body;
    
    if (!bridge_name || !interfaces || !Array.isArray(interfaces)) {
      return res.status(400).json({ error: 'Bridge name and interfaces required' });
    }

    if (networkManager) {
      await networkManager.createBridge(bridge_name, interfaces);
      
      addSystemLog('info', `Bridge created: ${bridge_name} with interfaces: ${interfaces.join(', ')}`, req.admin.id);
      
      res.json({ message: 'Bridge created successfully' });
    } else {
      res.status(503).json({ error: 'Network manager not available' });
    }
  } catch (error) {
    console.error('Error creating bridge:', error);
    res.status(500).json({ error: 'Failed to create bridge' });
  }
});

app.get('/api/admin/network/bridges', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const bridges = getActiveBridges();
    res.json({ bridges });
  } catch (error) {
    console.error('Error getting bridges:', error);
    res.status(500).json({ error: 'Failed to get bridge configurations' });
  }
});

app.delete('/api/admin/network/bridge/:id', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Bridge ID is required' });
    }

    // Find the bridge to delete
    const bridges = getActiveBridges();
    const bridge = bridges.find(b => b.id === id);
    
    if (!bridge) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    if (networkManager) {
      await networkManager.deleteBridge(bridge.bridge_name);
      
      addSystemLog('info', `Bridge deleted: ${bridge.bridge_name}`, req.admin.id);
      
      res.json({ message: 'Bridge deleted successfully' });
    } else {
      res.status(503).json({ error: 'Network manager not available' });
    }
  } catch (error) {
    console.error('Error deleting bridge:', error);
    res.status(500).json({ error: 'Failed to delete bridge' });
  }
});

// WAN Configuration Endpoints
app.get('/api/admin/network/wan-config', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const wanConfig = getWANConfiguration();
    
    if (!wanConfig) {
      return res.status(404).json({ error: 'No WAN configuration found' });
    }
    
    res.json({ config: wanConfig });
  } catch (error) {
    console.error('Error getting WAN config:', error);
    res.status(500).json({ error: 'Failed to get WAN configuration' });
  }
});

app.post('/api/admin/network/wan-config', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const config = req.body;
    
    // Validate required fields
    if (!config.interface || !config.ip_address || !config.subnet_mask || !config.gateway || !config.dns_primary) {
      return res.status(400).json({ error: 'All WAN configuration fields are required' });
    }

    // Validate IP addresses
    if (networkManager && !networkManager.validateIP(config.ip_address)) {
      return res.status(400).json({ error: 'Invalid IP address' });
    }
    
    if (networkManager && !networkManager.validateIP(config.gateway)) {
      return res.status(400).json({ error: 'Invalid gateway address' });
    }
    
    if (networkManager && !networkManager.validateDNS(config.dns_primary)) {
      return res.status(400).json({ error: 'Invalid primary DNS address' });
    }
    
    if (config.dns_secondary && networkManager && !networkManager.validateDNS(config.dns_secondary)) {
      return res.status(400).json({ error: 'Invalid secondary DNS address' });
    }

    if (networkManager) {
      // Get old configuration for history
      const oldConfig = getWANConfiguration();
      
      await networkManager.configureWAN(config);
      
      // Save to database
      updateWANConfiguration(config);
      
      // Add to history
      addNetworkSettingsHistory('wan', config.interface, oldConfig, config, req.admin.id);
      
      addSystemLog('info', `WAN configuration updated for interface: ${config.interface}`, req.admin.id);
      
      res.json({ message: 'WAN configuration updated successfully' });
    } else {
      res.status(503).json({ error: 'Network manager not available' });
    }
  } catch (error) {
    console.error('Error updating WAN config:', error);
    res.status(500).json({ error: 'Failed to update WAN configuration' });
  }
});

// WLAN Configuration Endpoints
app.get('/api/admin/network/wlan-scan', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    if (networkManager) {
      const networks = await networkManager.scanAvailableNetworks();
      res.json({ networks });
    } else {
      res.status(503).json({ error: 'Network manager not available' });
    }
  } catch (error) {
    console.error('Error scanning networks:', error);
    res.status(500).json({ error: 'Failed to scan wireless networks' });
  }
});

app.get('/api/admin/network/wlan-config', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const wlanConfig = getWLANConfiguration();
    
    if (!wlanConfig) {
      return res.status(404).json({ error: 'No WLAN configuration found' });
    }
    
    res.json({ config: wlanConfig });
  } catch (error) {
    console.error('Error getting WLAN config:', error);
    res.status(500).json({ error: 'Failed to get WLAN configuration' });
  }
});

app.post('/api/admin/network/wlan-config', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const config = req.body;
    
    // Validate required fields
    if (!config.interface || !config.ssid || !config.security_type || config.channel === undefined) {
      return res.status(400).json({ error: 'Interface, SSID, security type, and channel are required' });
    }

    // Validate SSID
    if (networkManager && !networkManager.validateSSID(config.ssid)) {
      return res.status(400).json({ error: 'Invalid SSID format' });
    }

    // Validate password if security is enabled
    if (config.security_type !== 'none' && !config.password) {
      return res.status(400).json({ error: 'Password is required for secured networks' });
    }

    if (config.password && networkManager && !networkManager.validatePassword(config.password, config.security_type)) {
      return res.status(400).json({ error: 'Invalid password format for selected security type' });
    }

    if (networkManager) {
      // Get old configuration for history
      const oldConfig = getWLANConfiguration();
      
      await networkManager.configureWLAN(config);
      
      // Save to database
      updateWLANConfiguration(config);
      
      // Add to history
      addNetworkSettingsHistory('wlan', config.interface, oldConfig, config, req.admin.id);
      
      addSystemLog('info', `WLAN configuration updated for interface: ${config.interface}`, req.admin.id);
      
      res.json({ message: 'WLAN configuration updated successfully' });
    } else {
      res.status(503).json({ error: 'Network manager not available' });
    }
  } catch (error) {
    console.error('Error updating WLAN config:', error);
    res.status(500).json({ error: 'Failed to update WLAN configuration' });
  }
});

// Hotspot Management Endpoints
app.get('/api/admin/network/hotspot', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const hotspots = getHotspotConfigurations();
    res.json({ hotspots });
  } catch (error) {
    console.error('Error getting hotspot configurations:', error);
    res.status(500).json({ error: 'Failed to get hotspot configurations' });
  }
});

app.post('/api/admin/network/hotspot', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const config = req.body;
    
    // Validate required fields
    if (!config.name || !config.interface || !config.ssid || !config.security_type || !config.password || !config.max_clients) {
      return res.status(400).json({ error: 'All hotspot configuration fields are required' });
    }

    // Validate configuration
    if (networkManager && !networkManager.validateSSID(config.ssid)) {
      return res.status(400).json({ error: 'Invalid SSID format' });
    }

    if (networkManager && !networkManager.validatePassword(config.password, config.security_type)) {
      return res.status(400).json({ error: 'Invalid password format for selected security type' });
    }

    if (networkManager) {
      await networkManager.createHotspot(config);
      
      // Save to database
      createHotspotConfiguration(config);
      
      addSystemLog('info', `Hotspot created: ${config.name} on interface: ${config.interface}`, req.admin.id);
      
      res.json({ message: 'Hotspot created successfully' });
    } else {
      res.status(503).json({ error: 'Network manager not available' });
    }
  } catch (error) {
    console.error('Error creating hotspot:', error);
    res.status(500).json({ error: 'Failed to create hotspot' });
  }
});

app.get('/api/admin/network/hotspot/:name/clients', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.params;
    
    if (networkManager) {
      const clients = await networkManager.getConnectedClients(name);
      res.json({ clients });
    } else {
      res.status(503).json({ error: 'Network manager not available' });
    }
  } catch (error) {
    console.error('Error getting hotspot clients:', error);
    res.status(500).json({ error: 'Failed to get hotspot clients' });
  }
});

// VLAN Configuration Endpoints
app.get('/api/admin/network/vlan', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const vlans = getVLANConfigurations();
    res.json({ vlans });
  } catch (error) {
    console.error('Error getting VLANs:', error);
    res.status(500).json({ error: 'Failed to get VLAN configurations' });
  }
});

app.post('/api/admin/network/vlan', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const config = req.body;
    
    // Validate required fields
    if (!config.vlan_id || !config.name || !config.interface) {
      return res.status(400).json({ error: 'VLAN ID, name, and interface are required' });
    }

    // Validate VLAN ID range
    if (config.vlan_id < 1 || config.vlan_id > 4094) {
      return res.status(400).json({ error: 'VLAN ID must be between 1 and 4094' });
    }

    if (networkManager) {
      await networkManager.createVLAN(config);
      
      // Save to database
      createVLANConfiguration(config);
      
      addSystemLog('info', `VLAN created: ${config.name} (ID: ${config.vlan_id}) on interface: ${config.interface}`, req.admin.id);
      
      res.json({ message: 'VLAN created successfully' });
    } else {
      res.status(503).json({ error: 'Network manager not available' });
    }
  } catch (error) {
    console.error('Error creating VLAN:', error);
    res.status(500).json({ error: 'Failed to create VLAN' });
  }
});

app.delete('/api/admin/network/vlan/:id', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'VLAN ID is required' });
    }

    // Find the VLAN to delete
    const vlans = getVLANConfigurations();
    const vlan = vlans.find(v => v.id === id);
    
    if (!vlan) {
      return res.status(404).json({ error: 'VLAN not found' });
    }

    if (networkManager) {
      await networkManager.deleteVLAN(vlan.vlan_id, vlan.interface);
      
      // Delete from database
      deleteVLANConfiguration(id);
      
      addSystemLog('info', `VLAN deleted: ${vlan.name} (ID: ${vlan.vlan_id})`, req.admin.id);
      
      res.json({ message: 'VLAN deleted successfully' });
    } else {
      res.status(503).json({ error: 'Network manager not available' });
    }
  } catch (error) {
    console.error('Error deleting VLAN:', error);
    res.status(500).json({ error: 'Failed to delete VLAN' });
  }
});

// Enhanced Interface Management
app.get('/api/admin/network/interface/:name/details', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.params;
    
    if (networkManager) {
      const details = await networkManager.getInterfaceDetails(name);
      res.json({ details });
    } else {
      res.status(503).json({ error: 'Network manager not available' });
    }
  } catch (error) {
    console.error('Error getting interface details:', error);
    res.status(500).json({ error: 'Failed to get interface details' });
  }
});

app.post('/api/admin/network/interface/:name/toggle', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.params;
    const { enabled } = req.body;
    
    if (networkManager) {
      if (enabled) {
        await networkManager.bringInterfaceUp(name);
        addSystemLog('info', `Interface enabled: ${name}`, req.admin.id);
      } else {
        await networkManager.bringInterfaceDown(name);
        addSystemLog('info', `Interface disabled: ${name}`, req.admin.id);
      }
      
      res.json({ message: `Interface ${enabled ? 'enabled' : 'disabled'} successfully` });
    } else {
      res.status(503).json({ error: 'Network manager not available' });
    }
  } catch (error) {
    console.error('Error toggling interface:', error);
    res.status(500).json({ error: 'Failed to toggle interface state' });
  }
});

app.post('/api/admin/system/update', authenticateAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { repository_url, branch } = req.body;
    
    if (!repository_url || !branch) {
      return res.status(400).json({ error: 'Repository URL and branch required' });
    }

    if (!systemUpdater) {
      return res.status(503).json({ error: 'System updater not available' });
    }

    if (systemUpdater.isUpdateInProgress()) {
      return res.status(409).json({ error: 'Update already in progress' });
    }

    // Start update process
    systemUpdater.update({
      repositoryUrl: repository_url,
      branch: branch,
      workingDirectory: process.cwd()
    }).then(() => {
      addSystemLog('info', `System update completed from ${repository_url}:${branch}`, req.admin.id);
    }).catch((error) => {
      console.error('System update failed:', error);
      addSystemLog('error', `System update failed: ${error.message}`, req.admin.id);
    });

    addSystemLog('info', `System update started from ${repository_url}:${branch}`, req.admin.id);
    
    res.json({ message: 'Update started successfully' });
  } catch (error) {
    console.error('Error starting system update:', error);
    res.status(500).json({ error: 'Failed to start system update' });
  }
});

app.get('/api/admin/system/update/status', authenticateAdmin, (req: AuthenticatedRequest, res) => {
  try {
    if (!systemUpdater) {
      return res.status(503).json({ error: 'System updater not available' });
    }

    res.json({
      inProgress: systemUpdater.isUpdateInProgress()
    });
  } catch (error) {
    console.error('Error getting update status:', error);
    res.status(500).json({ error: 'Failed to get update status' });
  }
});

// Serve client portal for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current rates to new client
  socket.on('getRates', () => {
    try {
      const rates = getActiveRates();
      socket.emit('rates', { rates });
    } catch (error) {
      console.error('Error sending rates:', error);
    }
  });

  // Handle coin detection requests
  socket.on('startCoinDetection', (data) => {
    console.log('Coin detection started for session:', data.sessionId);
    // Additional logic for coin detection can be added here
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// System Updater events
if (systemUpdater) {
  systemUpdater.on('progress', (progress) => {
    io.emit('updateProgress', progress);
  });

  systemUpdater.on('output', (output) => {
    io.emit('updateOutput', output);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  
  if (gpioManager) {
    gpioManager.cleanup();
  }
  
  if (networkManager) {
    await networkManager.cleanup();
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, async () => {
  console.log(`AJC PISOWIFI Server running on port ${PORT}`);
  
  // Initialize services
  await initializeServices();
});

export default app;