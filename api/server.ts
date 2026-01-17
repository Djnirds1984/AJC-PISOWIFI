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
  getActiveBridges
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

// Initialize hardware and services
async function initializeServices() {
  try {
    // Initialize GPIO Manager (Physical Pin 3 = GPIO2)
    gpioManager = new GPIOManager({
      pin: 3,
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

    await gpioManager.initialize();

    // Initialize Network Manager
    networkManager = new NetworkManager();
    await networkManager.initialize();

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