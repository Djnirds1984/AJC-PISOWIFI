import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { 
  getAnalytics, 
  getActiveRates, 
  createRate, 
  updateRate, 
  deleteRate,
  getActiveSessions,
  getNetworkInterfaces,
  getAdminBySession
} from '../database/models.js';
import NetworkManager from '../services/network-manager.js';
import SystemUpdater from '../services/system-updater.js';

const router = Router();

// Middleware to verify admin token
const authenticateAdmin = async (req: Request, res: Response, next: Function): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const admin = getAdminBySession(token);
    if (!admin) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    (req as any).admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Analytics endpoints
router.get('/analytics', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const analytics = getAnalytics();
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Rate management endpoints
router.get('/rates', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const rates = getActiveRates();
    res.json({ rates });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

router.post('/rates', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { coin_value, minutes } = req.body;
    
    if (!coin_value || !minutes) {
      res.status(400).json({ error: 'Coin value and minutes are required' });
      return;
    }

    const rate = createRate(parseInt(coin_value), parseInt(minutes));
    res.json(rate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create rate' });
  }
});

router.put('/rates/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { coin_value, minutes } = req.body;
    
    if (!coin_value || !minutes) {
      res.status(400).json({ error: 'Coin value and minutes are required' });
      return;
    }

    const success = updateRate(parseInt(id), parseInt(coin_value), parseInt(minutes));
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Rate not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update rate' });
  }
});

router.delete('/rates/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const success = deleteRate(parseInt(id));
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Rate not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete rate' });
  }
});

// Session management endpoints
router.get('/sessions', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const sessions = getActiveSessions();
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Network management endpoints
router.get('/network/interfaces', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    // Return mock data for Windows development environment
    if (process.platform === 'win32') {
      const mockInterfaces = [
        {
          name: 'eth0',
          type: 'ethernet',
          status: 'up',
          ip_address: '192.168.1.100',
          last_updated: new Date().toISOString()
        },
        {
          name: 'wlan0',
          type: 'wireless',
          status: 'up',
          ip_address: '192.168.1.101',
          last_updated: new Date().toISOString()
        },
        {
          name: 'lo',
          type: 'loopback',
          status: 'up',
          ip_address: '127.0.0.1',
          last_updated: new Date().toISOString()
        }
      ];
      res.json({ interfaces: mockInterfaces });
      return;
    }

    const networkManager = new NetworkManager();
    await networkManager.initialize();
    
    const interfaces = await networkManager.getNetworkInterfaces();
    res.json({ interfaces });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch network interfaces' });
  }
});

// System updater endpoints
router.get('/system/update/status', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const updater = new SystemUpdater();
    res.json({ 
      inProgress: updater.isUpdateInProgress(),
      progress: null 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check update status' });
  }
});

router.post('/system/update', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { repository_url, branch } = req.body;
    
    if (!repository_url || !branch) {
      res.status(400).json({ error: 'Repository URL and branch are required' });
      return;
    }

    const updater = new SystemUpdater();
    
    // Set up progress listener
    updater.on('progress', (progress) => {
      // In a real implementation, you'd use WebSocket or Server-Sent Events
      // For now, we'll just log the progress
      console.log('Update progress:', progress);
    });

    updater.on('output', (output) => {
      console.log('Update output:', output);
    });

    // Start update in background
    updater.update({
      repositoryUrl: repository_url,
      branch: branch,
      workingDirectory: process.cwd()
    }).then(() => {
      console.log('Update completed successfully');
    }).catch((error) => {
      console.error('Update failed:', error);
    });

    res.json({ success: true, message: 'Update started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start update' });
  }
});

export default router;