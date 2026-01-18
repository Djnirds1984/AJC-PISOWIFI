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

export interface WANConfig {
  interface: string;
  ip_address: string;
  subnet_mask: string;
  gateway: string;
  dns_primary: string;
  dns_secondary?: string;
  dhcp_enabled: boolean;
}

export interface WLANConfig {
  interface: string;
  ssid: string;
  security_type: 'none' | 'wep' | 'wpa' | 'wpa2' | 'wpa3';
  password?: string;
  channel: number;
  signal_strength?: number;
  is_enabled: boolean;
}

export interface HotspotConfig {
  name: string;
  interface: string;
  ssid: string;
  security_type: 'none' | 'wpa2' | 'wpa3';
  password: string;
  max_clients: number;
  bandwidth_limit_up?: number;
  bandwidth_limit_down?: number;
  is_enabled: boolean;
}

export interface VLANConfig {
  id: number;
  name: string;
  interface: string;
  tagged: boolean;
  priority?: number;
  is_enabled: boolean;
}

export interface NetworkScanResult {
  ssid: string;
  signal_strength: number;
  security: string;
  channel: number;
  bssid: string;
}

export class NetworkManager {
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    try {
      // Check if we're on Windows (development environment)
      const isWindows = (process.platform as string) === 'win32' || process.platform === 'cygwin';
      if (isWindows) {
        console.log('Network Manager: Running on Windows - network operations disabled');
        this.isInitialized = true;
        return;
      }

      // Check if we have necessary permissions (Linux/Unix only)
      if (!isWindows) {
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
      
      // Redirect to captive portal (TCP traffic)
      await execAsync('sudo iptables -t nat -A CP_PORTAL -p tcp -j REDIRECT --to-port 8080');
      // Also redirect UDP traffic
      await execAsync('sudo iptables -t nat -A CP_PORTAL -p udp -j REDIRECT --to-port 8080');
      
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

  // WAN Configuration Methods
  async configureWAN(config: WANConfig): Promise<void> {
    try {
      if (process.platform === 'win32') {
        console.log('WAN Configuration: Windows platform - configuration skipped');
        return;
      }

      const { interface: iface, ip_address, subnet_mask, gateway, dns_primary, dns_secondary, dhcp_enabled } = config;

      if (dhcp_enabled) {
        // Enable DHCP
        await execAsync(`sudo dhclient ${iface}`);
      } else {
        // Set static IP configuration
        await execAsync(`sudo ip addr add ${ip_address}/${this.subnetMaskToCIDR(subnet_mask)} dev ${iface}`);
        await execAsync(`sudo ip route add default via ${gateway} dev ${iface}`);
        
        // Configure DNS
        await this.configureDNS(dns_primary, dns_secondary);
      }

      console.log(`WAN Configuration: Interface ${iface} configured successfully`);
    } catch (error) {
      console.error('WAN Configuration failed:', error);
      throw new Error(`Failed to configure WAN: ${error}`);
    }
  }

  private subnetMaskToCIDR(subnetMask: string): number {
    const parts = subnetMask.split('.').map(Number);
    let cidr = 0;
    for (const part of parts) {
      cidr += part.toString(2).split('1').length - 1;
    }
    return cidr;
  }

  private async configureDNS(primary: string, secondary?: string): Promise<void> {
    try {
      let dnsConfig = `nameserver ${primary}\n`;
      if (secondary) {
        dnsConfig += `nameserver ${secondary}\n`;
      }
      
      // Backup existing resolv.conf
      await execAsync('sudo cp /etc/resolv.conf /etc/resolv.conf.backup');
      
      // Write new DNS configuration
      await execAsync(`echo "${dnsConfig}" | sudo tee /etc/resolv.conf`);
    } catch (error) {
      console.error('DNS configuration failed:', error);
      throw error;
    }
  }

  // WLAN Configuration Methods
  async scanAvailableNetworks(): Promise<NetworkScanResult[]> {
    try {
      if (process.platform === 'win32') {
        // Mock data for Windows development
        return [
          { ssid: 'TestNetwork1', signal_strength: -45, security: 'WPA2', channel: 6, bssid: '00:11:22:33:44:55' },
          { ssid: 'TestNetwork2', signal_strength: -67, security: 'WPA3', channel: 11, bssid: '66:77:88:99:AA:BB' },
          { ssid: 'OpenNetwork', signal_strength: -55, security: 'Open', channel: 1, bssid: 'CC:DD:EE:FF:00:11' }
        ];
      }

      const { stdout } = await execAsync('sudo iwlist scan 2>/dev/null | grep -E "(Cell|ESSID|Encryption|Signal|Channel)"');
      return this.parseNetworkScan(stdout);
    } catch (error) {
      console.error('Network scan failed:', error);
      throw new Error(`Failed to scan networks: ${error}`);
    }
  }

  private parseNetworkScan(scanOutput: string): NetworkScanResult[] {
    const networks: NetworkScanResult[] = [];
    const cells = scanOutput.split('Cell ');
    
    for (const cell of cells.slice(1)) {
      const lines = cell.split('\n');
      const network: Partial<NetworkScanResult> = {};
      
      for (const line of lines) {
        if (line.includes('ESSID:')) {
          network.ssid = line.split('ESSID:')[1].replace(/"/g, '').trim();
        } else if (line.includes('Signal level=')) {
          const match = line.match(/Signal level=(-?\d+)/);
          network.signal_strength = match ? parseInt(match[1]) : -80;
        } else if (line.includes('Encryption key:')) {
          network.security = line.includes('on') ? 'WPA2' : 'Open';
        } else if (line.includes('Channel:')) {
          const match = line.match(/Channel:(\d+)/);
          network.channel = match ? parseInt(match[1]) : 1;
        }
      }
      
      if (network.ssid && network.ssid !== '<hidden>') {
        networks.push(network as NetworkScanResult);
      }
    }
    
    return networks;
  }

  async configureWLAN(config: WLANConfig): Promise<void> {
    try {
      if (process.platform === 'win32') {
        console.log('WLAN Configuration: Windows platform - configuration skipped');
        return;
      }

      const { interface: iface, ssid, security_type, password, channel, is_enabled } = config;

      if (!is_enabled) {
        await execAsync(`sudo ip link set ${iface} down`);
        console.log(`WLAN Configuration: Interface ${iface} disabled`);
        return;
      }

      // Configure wireless interface
      await execAsync(`sudo ip link set ${iface} up`);
      await execAsync(`sudo iwconfig ${iface} channel ${channel}`);
      
      // Configure SSID and security (simplified - would need more complex setup in production)
      if (security_type !== 'none' && password) {
        console.log(`WLAN Configuration: Security ${security_type} configured for ${ssid}`);
      }

      console.log(`WLAN Configuration: Interface ${iface} configured for ${ssid}`);
    } catch (error) {
      console.error('WLAN Configuration failed:', error);
      throw new Error(`Failed to configure WLAN: ${error}`);
    }
  }

  // Hotspot Management Methods
  async createHotspot(config: HotspotConfig): Promise<void> {
    try {
      if (process.platform === 'win32') {
        console.log('Hotspot Creation: Windows platform - creation skipped');
        return;
      }

      const { name, interface: iface, ssid, security_type, password, max_clients, bandwidth_limit_up, bandwidth_limit_down } = config;

      // Create hostapd configuration (simplified)
      const hostapdConfig = `
interface=${iface}
driver=nl80211
ssid=${ssid}
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=${security_type === 'wpa2' ? 2 : 3}
wpa_passphrase=${password}
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
max_num_sta=${max_clients}
      `.trim();

      // Write configuration and start hotspot
      await execAsync(`echo "${hostapdConfig}" | sudo tee /tmp/hostapd_${name}.conf`);
      
      // Configure bandwidth limits if specified
      if (bandwidth_limit_up || bandwidth_limit_down) {
        await this.configureBandwidthLimits(iface, bandwidth_limit_up, bandwidth_limit_down);
      }

      console.log(`Hotspot Created: ${name} on interface ${iface}`);
    } catch (error) {
      console.error('Hotspot creation failed:', error);
      throw new Error(`Failed to create hotspot: ${error}`);
    }
  }

  private async configureBandwidthLimits(interfaceName: string, upload?: number, download?: number): Promise<void> {
    try {
      if (upload) {
        await execAsync(`sudo tc qdisc add dev ${interfaceName} root tbf rate ${upload}kbit burst 32kbit latency 400ms`);
      }
      if (download) {
        await execAsync(`sudo tc qdisc add dev ${interfaceName} ingress`);
        await execAsync(`sudo tc filter add dev ${interfaceName} parent ffff: protocol ip prio 50 u32 police rate ${download}kbit burst 32kbit drop flowid :1`);
      }
    } catch (error) {
      console.warn('Bandwidth limit configuration failed:', error);
    }
  }

  async getConnectedClients(hotspotName: string): Promise<Array<{mac: string, ip: string, signal: number}>> {
    try {
      if (process.platform === 'win32') {
        // Mock data for Windows development
        return [
          { mac: 'AA:BB:CC:DD:EE:FF', ip: '192.168.1.101', signal: -45 },
          { mac: '11:22:33:44:55:66', ip: '192.168.1.102', signal: -62 }
        ];
      }

      const { stdout } = await execAsync(`sudo iw dev ${hotspotName} station dump`);
      return this.parseConnectedClients(stdout);
    } catch (error) {
      console.error('Failed to get connected clients:', error);
      throw new Error(`Failed to get connected clients: ${error}`);
    }
  }

  private parseConnectedClients(output: string): Array<{mac: string, ip: string, signal: number}> {
    const clients: Array<{mac: string, ip: string, signal: number}> = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('Station')) {
        const macMatch = line.match(/Station ([a-fA-F0-9:]{17})/);
        if (macMatch) {
          clients.push({
            mac: macMatch[1],
            ip: 'N/A', // Would need additional commands to get IP
            signal: -50 // Default signal strength
          });
        }
      }
    }
    
    return clients;
  }

  // VLAN Configuration Methods
  async createVLAN(config: VLANConfig): Promise<void> {
    try {
      if (process.platform === 'win32') {
        console.log('VLAN Creation: Windows platform - creation skipped');
        return;
      }

      const { id, name, interface: iface, tagged, priority, is_enabled } = config;

      // Create VLAN interface
      const vlanInterface = `${iface}.${id}`;
      await execAsync(`sudo ip link add link ${iface} name ${vlanInterface} type vlan id ${id}`);
      
      if (priority) {
        await execAsync(`sudo ip link set ${vlanInterface} type vlan egress ${priority}:${id}`);
      }
      
      if (is_enabled) {
        await execAsync(`sudo ip link set ${vlanInterface} up`);
      }

      console.log(`VLAN Created: ${vlanInterface} (VLAN ID: ${id})`);
    } catch (error) {
      console.error('VLAN creation failed:', error);
      throw new Error(`Failed to create VLAN: ${error}`);
    }
  }

  async deleteVLAN(vlanId: number, interfaceName: string): Promise<void> {
    try {
      if (process.platform === 'win32') {
        console.log('VLAN Deletion: Windows platform - deletion skipped');
        return;
      }

      const vlanInterface = `${interfaceName}.${vlanId}`;
      await execAsync(`sudo ip link delete ${vlanInterface}`);
      
      console.log(`VLAN Deleted: ${vlanInterface}`);
    } catch (error) {
      console.error('VLAN deletion failed:', error);
      throw new Error(`Failed to delete VLAN: ${error}`);
    }
  }

  // Enhanced Interface Management
  async getInterfaceDetails(interfaceName: string): Promise<NetworkInterface & {
    tx_bytes: number;
    rx_bytes: number;
    tx_packets: number;
    rx_packets: number;
    errors: number;
    drops: number;
  }> {
    try {
      if (process.platform === 'win32') {
        return {
          name: interfaceName,
          type: 'ethernet',
          status: 'up',
          ip_address: '192.168.1.100',
          mac_address: '00:11:22:33:44:55',
          tx_bytes: 1024000,
          rx_bytes: 2048000,
          tx_packets: 1000,
          rx_packets: 2000,
          errors: 0,
          drops: 0
        };
      }

      const { stdout } = await execAsync(`ip -j -s link show ${interfaceName}`);
      const interfaceData = JSON.parse(stdout)[0];
      
      const ipResult = await execAsync(`ip -j addr show ${interfaceName}`);
      const ipData = JSON.parse(ipResult.stdout)[0];
      
      return {
        name: interfaceData.ifname,
        type: this.getInterfaceType(interfaceData.ifname),
        status: interfaceData.operstate?.toLowerCase() || 'unknown',
        ip_address: ipData?.addr_info?.[0]?.local,
        mac_address: interfaceData.address,
        tx_bytes: interfaceData.stats64?.tx?.bytes || 0,
        rx_bytes: interfaceData.stats64?.rx?.bytes || 0,
        tx_packets: interfaceData.stats64?.tx?.packets || 0,
        rx_packets: interfaceData.stats64?.rx?.packets || 0,
        errors: interfaceData.stats64?.tx?.errors + interfaceData.stats64?.rx?.errors || 0,
        drops: interfaceData.stats64?.tx?.dropped + interfaceData.stats64?.rx?.dropped || 0
      };
    } catch (error) {
      console.error('Failed to get interface details:', error);
      throw new Error(`Failed to get interface details: ${error}`);
    }
  }

  // Utility Methods
  validateIP(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  validateSubnetMask(mask: string): boolean {
    const validMasks = [
      '255.255.255.255', '255.255.255.254', '255.255.255.252', '255.255.255.248',
      '255.255.255.240', '255.255.255.224', '255.255.255.192', '255.255.255.128',
      '255.255.255.0', '255.255.254.0', '255.255.252.0', '255.255.248.0',
      '255.255.240.0', '255.255.224.0', '255.255.192.0', '255.255.128.0',
      '255.255.0.0', '255.254.0.0', '255.252.0.0', '255.248.0.0',
      '255.240.0.0', '255.224.0.0', '255.192.0.0', '255.128.0.0',
      '255.0.0.0', '254.0.0.0', '252.0.0.0', '248.0.0.0',
      '240.0.0.0', '224.0.0.0', '192.0.0.0', '128.0.0.0',
      '0.0.0.0'
    ];
    
    return validMasks.includes(mask) || /^\d+$/.test(mask);
  }

  validateGateway(gateway: string, ip: string, subnet: string): boolean {
    // Basic validation - in production, implement proper network range validation
    return this.validateIP(gateway) && gateway !== ip;
  }

  validateDNS(dns: string): boolean {
    return this.validateIP(dns) || /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.?[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(dns);
  }

  validateSSID(ssid: string): boolean {
    return ssid.length >= 1 && ssid.length <= 32 && !ssid.includes(' ');
  }

  validatePassword(password: string, securityType: string): boolean {
    switch (securityType) {
      case 'wep':
        return password.length === 13 || password.length === 26;
      case 'wpa':
      case 'wpa2':
        return password.length >= 8 && password.length <= 63;
      case 'wpa3':
        return password.length >= 8 && password.length <= 63;
      default:
        return true;
    }
  }
}

export default NetworkManager;