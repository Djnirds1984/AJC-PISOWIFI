import { exec } from 'child_process';
import { promisify } from 'util';
import { updateNetworkInterface, getNetworkInterfaces, createBridge, getActiveBridges } from '../database/models.js';

const execAsync = promisify(exec);

export interface NetworkInterface {
  name: string;
  type: string;
  status: 'up' | 'down' | 'unknown';
  ip_address?: string;
  mac_address?: string;
}

export interface BridgeConfig {
  name: string;
  interfaces: string[];
  status: 'active' | 'inactive';
}

export class NetworkManager {
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    try {
      // Check if we're on Windows (development environment)
      if (process.platform === 'win32') {
        console.log('Network Manager: Running on Windows - network operations disabled');
        this.isInitialized = true;
        return;
      }

      // Check if we have necessary permissions (Linux only)
      if (process.platform !== 'win32') {
        await this.checkPermissions();
      }
      
      this.isInitialized = true;
      console.log('Network Manager: Initialized');
    } catch (error) {
      console.error('Network Manager: Initialization failed:', error);
      throw error;
    }
  }

  private async checkPermissions(): Promise<void> {
    try {
      await execAsync('sudo -n true');
    } catch (error) {
      throw new Error('Network operations require sudo permissions. Please configure sudoers appropriately.');
    }
  }

  async getNetworkInterfaces(): Promise<NetworkInterface[]> {
    try {
      const { stdout } = await execAsync('ip -j addr show');
      const interfaces = JSON.parse(stdout);
      
      const networkInterfaces: NetworkInterface[] = interfaces.map((iface: any) => ({
        name: iface.ifname,
        type: this.getInterfaceType(iface.ifname),
        status: iface.operstate?.toLowerCase() || 'unknown',
        ip_address: iface.addr_info?.[0]?.local,
        mac_address: iface.address
      }));

      // Update database with current interface status
      for (const iface of networkInterfaces) {
        await updateNetworkInterface(iface.name, iface.type, iface.status, iface.ip_address);
      }

      return networkInterfaces;
    } catch (error) {
      console.error('Network Manager: Failed to get interfaces:', error);
      throw new Error(`Failed to get network interfaces: ${error}`);
    }
  }

  private getInterfaceType(name: string): string {
    if (name.startsWith('eth')) return 'ethernet';
    if (name.startsWith('wlan')) return 'wireless';
    if (name.startsWith('br')) return 'bridge';
    if (name.startsWith('lo')) return 'loopback';
    if (name.startsWith('ppp')) return 'ppp';
    return 'other';
  }

  async createBridge(bridgeName: string, interfaces: string[]): Promise<void> {
    try {
      // Create bridge interface
      await execAsync(`sudo ip link add ${bridgeName} type bridge`);
      
      // Add interfaces to bridge
      for (const iface of interfaces) {
        await execAsync(`sudo ip link set ${iface} master ${bridgeName}`);
      }
      
      // Bring up bridge interface
      await execAsync(`sudo ip link set ${bridgeName} up`);
      
      // Save to database
      await createBridge(bridgeName, interfaces);
      
      console.log(`Network Manager: Bridge ${bridgeName} created with interfaces: ${interfaces.join(', ')}`);
    } catch (error) {
      console.error('Network Manager: Failed to create bridge:', error);
      throw new Error(`Failed to create bridge: ${error}`);
    }
  }

  async deleteBridge(bridgeName: string): Promise<void> {
    try {
      // Bring down bridge interface
      await execAsync(`sudo ip link set ${bridgeName} down`);
      
      // Delete bridge interface
      await execAsync(`sudo ip link delete ${bridgeName} type bridge`);
      
      // Update database
      const bridges = await getActiveBridges();
      const bridge = bridges.find(b => b.bridge_name === bridgeName);
      if (bridge) {
        // Mark as inactive in database
        const { exec } = await import('child_process');
        const db = await import('../database/init.js');
        const stmt = db.default.prepare('UPDATE bridge_configurations SET is_active = 0 WHERE id = ?');
        stmt.run(bridge.id);
      }
      
      console.log(`Network Manager: Bridge ${bridgeName} deleted`);
    } catch (error) {
      console.error('Network Manager: Failed to delete bridge:', error);
      throw new Error(`Failed to delete bridge: ${error}`);
    }
  }

  async bringInterfaceUp(interfaceName: string): Promise<void> {
    try {
      await execAsync(`sudo ip link set ${interfaceName} up`);
      console.log(`Network Manager: Interface ${interfaceName} brought up`);
    } catch (error) {
      console.error('Network Manager: Failed to bring interface up:', error);
      throw new Error(`Failed to bring interface up: ${error}`);
    }
  }

  async bringInterfaceDown(interfaceName: string): Promise<void> {
    try {
      await execAsync(`sudo ip link set ${interfaceName} down`);
      console.log(`Network Manager: Interface ${interfaceName} brought down`);
    } catch (error) {
      console.error('Network Manager: Failed to bring interface down:', error);
      throw new Error(`Failed to bring interface down: ${error}`);
    }
  }

  // Captive Portal Functions
  async setupCaptivePortal(): Promise<void> {
    try {
      // Create iptables chains for captive portal
      await this.createCaptivePortalChains();
      
      // Redirect HTTP traffic to captive portal
      await execAsync('sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j CP_PORTAL');
      await execAsync('sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j CP_PORTAL');
      
      // Allow DNS
      await execAsync('sudo iptables -t nat -A CP_PORTAL -p udp --dport 53 -j RETURN');
      await execAsync('sudo iptables -t nat -A CP_PORTAL -p tcp --dport 53 -j RETURN');
      
      // Redirect to captive portal
      await execAsync('sudo iptables -t nat -A CP_PORTAL -j REDIRECT --to-port 8080');
      
      console.log('Network Manager: Captive portal rules set up');
    } catch (error) {
      console.error('Network Manager: Failed to setup captive portal:', error);
      throw new Error(`Failed to setup captive portal: ${error}`);
    }
  }

  private async createCaptivePortalChains(): Promise<void> {
    try {
      // Create custom chains
      await execAsync('sudo iptables -t nat -N CP_PORTAL 2>/dev/null || true');
      await execAsync('sudo iptables -t nat -N CP_ALLOWED 2>/dev/null || true');
      await execAsync('sudo iptables -N CP_AUTH 2>/dev/null || true');
    } catch (error) {
      // Ignore errors if chains already exist
    }
  }

  async whitelistMAC(macAddress: string): Promise<void> {
    try {
      // Add MAC address to allowed list
      await execAsync(`sudo iptables -t nat -I CP_ALLOWED -m mac --mac-source ${macAddress} -j RETURN`);
      await execAsync(`sudo iptables -I CP_AUTH -m mac --mac-source ${macAddress} -j ACCEPT`);
      
      console.log(`Network Manager: MAC address ${macAddress} whitelisted`);
    } catch (error) {
      console.error('Network Manager: Failed to whitelist MAC:', error);
      throw new Error(`Failed to whitelist MAC: ${error}`);
    }
  }

  async removeMACFromWhitelist(macAddress: string): Promise<void> {
    try {
      // Remove MAC address from allowed list
      await execAsync(`sudo iptables -t nat -D CP_ALLOWED -m mac --mac-source ${macAddress} -j RETURN 2>/dev/null || true`);
      await execAsync(`sudo iptables -D CP_AUTH -m mac --mac-source ${macAddress} -j ACCEPT 2>/dev/null || true`);
      
      console.log(`Network Manager: MAC address ${macAddress} removed from whitelist`);
    } catch (error) {
      console.error('Network Manager: Failed to remove MAC from whitelist:', error);
      // Ignore errors if rules don't exist
    }
  }

  async getFirewallRules(): Promise<string> {
    try {
      const { stdout } = await execAsync('sudo iptables -t nat -L -n -v');
      return stdout;
    } catch (error) {
      console.error('Network Manager: Failed to get firewall rules:', error);
      throw new Error(`Failed to get firewall rules: ${error}`);
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Skip network operations on Windows
      if (process.platform === 'win32') {
        this.isInitialized = false;
        console.log('Network Manager: Cleanup completed (Windows)');
        return;
      }

      // Remove all captive portal rules
      await this.removeCaptivePortalRules();
      
      // Clean up custom chains
      await this.deleteCustomChains();
      
      this.isInitialized = false;
      console.log('Network Manager: Cleanup completed');
    } catch (error) {
      console.error('Network Manager: Cleanup failed:', error);
    }
  }

  private async removeCaptivePortalRules(): Promise<void> {
    try {
      // Remove rules from PREROUTING chain
      await execAsync('sudo iptables -t nat -D PREROUTING -p tcp --dport 80 -j CP_PORTAL 2>/dev/null || true');
      await execAsync('sudo iptables -t nat -D PREROUTING -p tcp --dport 443 -j CP_PORTAL 2>/dev/null || true');
      
      // Flush custom chains
      await execAsync('sudo iptables -t nat -F CP_PORTAL 2>/dev/null || true');
      await execAsync('sudo iptables -t nat -F CP_ALLOWED 2>/dev/null || true');
      await execAsync('sudo iptables -F CP_AUTH 2>/dev/null || true');
    } catch (error) {
      console.warn('Network Manager: Error removing rules:', error);
    }
  }

  private async deleteCustomChains(): Promise<void> {
    try {
      // Delete custom chains
      await execAsync('sudo iptables -t nat -X CP_PORTAL 2>/dev/null || true');
      await execAsync('sudo iptables -t nat -X CP_ALLOWED 2>/dev/null || true');
      await execAsync('sudo iptables -X CP_AUTH 2>/dev/null || true');
    } catch (error) {
      console.warn('Network Manager: Error deleting chains:', error);
    }
  }

  public isReady(): boolean {
    return this.isInitialized;
  }
}

export default NetworkManager;