// Network validation utilities
export class NetworkValidation {
  // IP Address Validation
  static validateIP(ip: string): { valid: boolean; error?: string } {
    if (!ip) {
      return { valid: false, error: 'IP address is required' };
    }

    // IPv4 validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // IPv6 validation (simplified)
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    
    if (ipv4Regex.test(ip)) {
      return { valid: true };
    }
    
    if (ipv6Regex.test(ip)) {
      return { valid: true };
    }
    
    return { valid: false, error: 'Invalid IP address format' };
  }

  // Subnet Mask Validation
  static validateSubnetMask(mask: string): { valid: boolean; error?: string } {
    if (!mask) {
      return { valid: false, error: 'Subnet mask is required' };
    }

    // Check if it's CIDR notation (e.g., /24)
    if (mask.startsWith('/')) {
      const cidr = parseInt(mask.substring(1));
      if (cidr >= 0 && cidr <= 32) {
        return { valid: true };
      }
      return { valid: false, error: 'CIDR notation must be between /0 and /32' };
    }

    // Check if it's dotted decimal notation
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
    
    if (validMasks.includes(mask)) {
      return { valid: true };
    }
    
    return { valid: false, error: 'Invalid subnet mask' };
  }

  // Gateway Validation
  static validateGateway(gateway: string, ip: string, subnet: string): { valid: boolean; error?: string } {
    if (!gateway) {
      return { valid: false, error: 'Gateway address is required' };
    }

    // Validate gateway IP format
    const ipValidation = this.validateIP(gateway);
    if (!ipValidation.valid) {
      return ipValidation;
    }

    // Check if gateway is different from IP
    if (gateway === ip) {
      return { valid: false, error: 'Gateway cannot be the same as IP address' };
    }

    // Additional validation: check if gateway is in same subnet (simplified)
    // In a real implementation, you'd calculate network ranges
    const gatewayParts = gateway.split('.');
    const ipParts = ip.split('.');
    
    // Simple check: first 3 octets should match for typical /24 networks
    if (subnet === '255.255.255.0' || subnet === '/24') {
      if (gatewayParts[0] !== ipParts[0] || gatewayParts[1] !== ipParts[1] || gatewayParts[2] !== ipParts[2]) {
        return { valid: false, error: 'Gateway should be in the same network as IP address' };
      }
    }

    return { valid: true };
  }

  // DNS Validation
  static validateDNS(dns: string): { valid: boolean; error?: string } {
    if (!dns) {
      return { valid: false, error: 'DNS server is required' };
    }

    // Check if it's a valid IP address
    const ipValidation = this.validateIP(dns);
    if (ipValidation.valid) {
      return { valid: true };
    }

    // Check if it's a valid hostname
    const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.?[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/;
    if (hostnameRegex.test(dns)) {
      return { valid: true };
    }

    return { valid: false, error: 'Invalid DNS server address' };
  }

  // SSID Validation
  static validateSSID(ssid: string): { valid: boolean; error?: string } {
    if (!ssid) {
      return { valid: false, error: 'SSID is required' };
    }

    if (ssid.length < 1 || ssid.length > 32) {
      return { valid: false, error: 'SSID must be between 1 and 32 characters' };
    }

    if (ssid.includes(' ')) {
      return { valid: false, error: 'SSID cannot contain spaces' };
    }

    return { valid: true };
  }

  // Wireless Password Validation
  static validatePassword(password: string, securityType: string): { valid: boolean; error?: string } {
    if (!password && securityType !== 'none') {
      return { valid: false, error: 'Password is required for secured networks' };
    }

    if (securityType === 'none') {
      return { valid: true };
    }

    switch (securityType) {
      case 'wep':
        if (password.length !== 13 && password.length !== 26) {
          return { valid: false, error: 'WEP password must be 13 or 26 characters' };
        }
        break;
      case 'wpa':
      case 'wpa2':
      case 'wpa3':
        if (password.length < 8 || password.length > 63) {
          return { valid: false, error: 'WPA password must be between 8 and 63 characters' };
        }
        break;
      default:
        return { valid: false, error: 'Invalid security type' };
    }

    return { valid: true };
  }

  // VLAN ID Validation
  static validateVLANId(vlanId: number): { valid: boolean; error?: string } {
    if (vlanId < 1 || vlanId > 4094) {
      return { valid: false, error: 'VLAN ID must be between 1 and 4094' };
    }

    return { valid: true };
  }

  // Interface Name Validation
  static validateInterfaceName(name: string): { valid: boolean; error?: string } {
    if (!name) {
      return { valid: false, error: 'Interface name is required' };
    }

    // Common interface name patterns
    const validPatterns = [
      /^eth\d+$/,      // eth0, eth1, etc.
      /^wlan\d+$/,     // wlan0, wlan1, etc.
      /^br\d+$/,       // br0, br1, etc.
      /^lo$/,          // loopback
      /^ppp\d+$/,      // ppp0, ppp1, etc.
      /^en[ops]\d+s\d+$/, // Predictable network interface names (systemd)
    ];

    const isValid = validPatterns.some(pattern => pattern.test(name));
    
    if (!isValid) {
      return { valid: false, error: 'Invalid interface name format' };
    }

    return { valid: true };
  }

  // MAC Address Validation
  static validateMAC(mac: string): { valid: boolean; error?: string } {
    if (!mac) {
      return { valid: false, error: 'MAC address is required' };
    }

    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    
    if (!macRegex.test(mac)) {
      return { valid: false, error: 'Invalid MAC address format' };
    }

    return { valid: true };
  }

  // Port Number Validation
  static validatePort(port: number): { valid: boolean; error?: string } {
    if (port < 1 || port > 65535) {
      return { valid: false, error: 'Port number must be between 1 and 65535' };
    }

    return { valid: true };
  }

  // Bandwidth Limit Validation
  static validateBandwidthLimit(limit: number): { valid: boolean; error?: string } {
    if (limit < 0) {
      return { valid: false, error: 'Bandwidth limit cannot be negative' };
    }

    if (limit > 1000000) { // 1 Gbps limit
      return { valid: false, error: 'Bandwidth limit cannot exceed 1 Gbps' };
    }

    return { valid: true };
  }

  // Channel Validation for WiFi
  static validateWiFiChannel(channel: number, band: '2.4' | '5' = '2.4'): { valid: boolean; error?: string } {
    if (band === '2.4') {
      if (channel < 1 || channel > 14) {
        return { valid: false, error: '2.4GHz channel must be between 1 and 14' };
      }
    } else if (band === '5') {
      if (channel < 36 || channel > 165) {
        return { valid: false, error: '5GHz channel must be between 36 and 165' };
      }
    }

    return { valid: true };
  }

  // Signal Strength Interpretation
  static interpretSignalStrength(rssi: number): { quality: string; color: string; bars: number } {
    if (rssi >= -50) {
      return { quality: 'Excellent', color: 'text-green-500', bars: 4 };
    } else if (rssi >= -60) {
      return { quality: 'Good', color: 'text-green-400', bars: 3 };
    } else if (rssi >= -70) {
      return { quality: 'Fair', color: 'text-yellow-500', bars: 2 };
    } else if (rssi >= -80) {
      return { quality: 'Poor', color: 'text-orange-500', bars: 1 };
    } else {
      return { quality: 'Very Poor', color: 'text-red-500', bars: 0 };
    }
  }

  // Network Configuration Validation
  static validateNetworkConfig(config: any, type: 'wan' | 'wlan' | 'hotspot' | 'vlan'): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    switch (type) {
      case 'wan':
        // WAN configuration validation
        if (!config.interface) errors.interface = 'Interface is required';
        
        if (!config.dhcp_enabled) {
          const ipValidation = this.validateIP(config.ip_address);
          if (!ipValidation.valid) errors.ip_address = ipValidation.error!;
          
          const subnetValidation = this.validateSubnetMask(config.subnet_mask);
          if (!subnetValidation.valid) errors.subnet_mask = subnetValidation.error!;
          
          const gatewayValidation = this.validateGateway(config.gateway, config.ip_address, config.subnet_mask);
          if (!gatewayValidation.valid) errors.gateway = gatewayValidation.error!;
        }
        
        const dnsValidation = this.validateDNS(config.dns_primary);
        if (!dnsValidation.valid) errors.dns_primary = dnsValidation.error!;
        
        if (config.dns_secondary) {
          const secondaryDnsValidation = this.validateDNS(config.dns_secondary);
          if (!secondaryDnsValidation.valid) errors.dns_secondary = secondaryDnsValidation.error!;
        }
        break;

      case 'wlan':
        // WLAN configuration validation
        if (!config.interface) errors.interface = 'Interface is required';
        
        const ssidValidation = this.validateSSID(config.ssid);
        if (!ssidValidation.valid) errors.ssid = ssidValidation.error!;
        
        if (config.security_type !== 'none') {
          const passwordValidation = this.validatePassword(config.password, config.security_type);
          if (!passwordValidation.valid) errors.password = passwordValidation.error!;
        }
        
        const channelValidation = this.validateWiFiChannel(config.channel);
        if (!channelValidation.valid) errors.channel = channelValidation.error!;
        break;

      case 'hotspot':
        // Hotspot configuration validation
        if (!config.name) errors.name = 'Hotspot name is required';
        if (!config.interface) errors.interface = 'Interface is required';
        
        const hotspotSsidValidation = this.validateSSID(config.ssid);
        if (!hotspotSsidValidation.valid) errors.ssid = hotspotSsidValidation.error!;
        
        const hotspotPasswordValidation = this.validatePassword(config.password, config.security_type);
        if (!hotspotPasswordValidation.valid) errors.password = hotspotPasswordValidation.error!;
        
        if (config.max_clients < 1 || config.max_clients > 255) {
          errors.max_clients = 'Max clients must be between 1 and 255';
        }
        
        if (config.bandwidth_limit_up) {
          const uploadValidation = this.validateBandwidthLimit(config.bandwidth_limit_up);
          if (!uploadValidation.valid) errors.bandwidth_limit_up = uploadValidation.error!;
        }
        
        if (config.bandwidth_limit_down) {
          const downloadValidation = this.validateBandwidthLimit(config.bandwidth_limit_down);
          if (!downloadValidation.valid) errors.bandwidth_limit_down = downloadValidation.error!;
        }
        break;

      case 'vlan':
        // VLAN configuration validation
        const vlanIdValidation = this.validateVLANId(config.vlan_id);
        if (!vlanIdValidation.valid) errors.vlan_id = vlanIdValidation.error!;
        
        if (!config.name) errors.name = 'VLAN name is required';
        if (!config.interface) errors.interface = 'Interface is required';
        break;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }
}