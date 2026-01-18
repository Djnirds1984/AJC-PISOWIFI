import React, { useState, useEffect } from 'react';
import { Wifi, Search, Signal, Lock, Unlock, RefreshCw, Save, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { NetworkValidation } from '@/lib/network-utils';

interface NetworkScanResult {
  ssid: string;
  signal_strength: number;
  security: string;
  channel: number;
  bssid: string;
}

interface WLANConfig {
  interface: string;
  ssid: string;
  security_type: 'none' | 'wep' | 'wpa' | 'wpa2' | 'wpa3';
  password?: string;
  channel: number;
  signal_strength?: number;
  is_enabled: boolean;
}

interface WLANConfigSectionProps {
  config?: WLANConfig;
  onConfigChange: (config: WLANConfig) => void;
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

const WLANConfigSection: React.FC<WLANConfigSectionProps> = ({
  config,
  onConfigChange,
  onError,
  onSuccess
}) => {
  const [wlanConfig, setWlanConfig] = useState<WLANConfig>({
    interface: 'wlan0',
    ssid: '',
    security_type: 'wpa2',
    password: '',
    channel: 6,
    is_enabled: false
  });
  const [availableNetworks, setAvailableNetworks] = useState<NetworkScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (config) {
      setWlanConfig(config);
    } else {
      loadWLANConfig();
    }
  }, [config]);

  const loadWLANConfig = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/admin/network/wlan-config', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to load WLAN configuration');
      }

      const data = await response.json();
      if (data.config) {
        setWlanConfig(data.config);
        onConfigChange(data.config);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load WLAN configuration';
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const scanNetworks = async () => {
    try {
      setIsScanning(true);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/admin/network/wlan-scan', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to scan networks');
      }

      const data = await response.json();
      setAvailableNetworks(data.networks || []);
      onSuccess(`Found ${data.networks?.length || 0} networks`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to scan networks';
      onError(errorMessage);
    } finally {
      setIsScanning(false);
    }
  };

  const validateConfig = (): boolean => {
    const validation = NetworkValidation.validateNetworkConfig(wlanConfig, 'wlan');
    setErrors(validation.errors);
    return validation.valid;
  };

  const handleInputChange = (field: keyof WLANConfig, value: string | boolean) => {
    const newConfig = { ...wlanConfig, [field]: value };
    setWlanConfig(newConfig);
    onConfigChange(newConfig);

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSave = async () => {
    try {
      if (!validateConfig()) {
        onError('Please fix the validation errors before saving');
        return;
      }

      setIsSaving(true);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/admin/network/wlan-config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(wlanConfig)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to save WLAN configuration');
      }

      const data = await response.json();
      onSuccess(data.message || 'WLAN configuration saved successfully');
      
      // Reload configuration to get any system-updated values
      await loadWLANConfig();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save WLAN configuration';
      onError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const selectNetwork = (network: NetworkScanResult) => {
    handleInputChange('ssid', network.ssid);
    handleInputChange('channel', network.channel.toString());
    handleInputChange('security_type', network.security.toLowerCase() as any);
  };

  const getFieldError = (field: keyof WLANConfig) => {
    return errors[field] || '';
  };

  const hasErrors = () => {
    return Object.values(errors).some(error => error.length > 0);
  };

  const getSignalStrengthInfo = (rssi: number) => {
    return NetworkValidation.interpretSignalStrength(rssi);
  };

  const getSecurityIcon = (security: string) => {
    if (security.toLowerCase() === 'open' || security.toLowerCase() === 'none') {
      return <Unlock className="w-4 h-4 text-green-500" />;
    }
    return <Lock className="w-4 h-4 text-blue-500" />;
  };

  const getSecurityColor = (security: string) => {
    switch (security.toLowerCase()) {
      case 'open':
      case 'none':
        return 'text-green-600';
      case 'wep':
        return 'text-yellow-600';
      case 'wpa':
      case 'wpa2':
        return 'text-blue-600';
      case 'wpa3':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Loading WLAN configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Wifi className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Wireless Configuration</h2>
            </div>
            <div className="flex items-center space-x-2">
              {hasErrors() && (
                <div className="flex items-center text-red-600">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  <span className="text-sm">Validation errors</span>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving || hasErrors()}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Interface Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Wireless Interface
            </label>
            <select
              value={wlanConfig.interface}
              onChange={(e) => handleInputChange('interface', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                getFieldError('interface') ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="wlan0">wlan0 (Primary Wireless)</option>
              <option value="wlan1">wlan1 (Secondary Wireless)</option>
              <option value="wlp2s0">wlp2s0 (PCIe Wireless)</option>
            </select>
            {getFieldError('interface') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('interface')}</p>
            )}
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Wireless Interface</h3>
              <p className="text-sm text-gray-500">
                Enable wireless network interface
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={wlanConfig.is_enabled}
                onChange={(e) => handleInputChange('is_enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Network Scanner */}
          <div className="border border-gray-200 rounded-lg">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <h3 className="text-sm font-medium text-gray-900">Available Networks</h3>
              <button
                onClick={scanNetworks}
                disabled={isScanning}
                className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
              >
                <Search className="w-4 h-4 mr-1" />
                {isScanning ? 'Scanning...' : 'Scan Networks'}
              </button>
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              {availableNetworks.length === 0 && !isScanning ? (
                <div className="p-8 text-center text-gray-500">
                  <Signal className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No networks found. Click "Scan Networks" to search.</p>
                </div>
              ) : isScanning ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-8 h-8 mx-auto mb-3 text-blue-600 animate-spin" />
                  <p className="text-gray-600">Scanning for wireless networks...</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {availableNetworks.map((network, index) => {
                    const signalInfo = getSignalStrengthInfo(network.signal_strength);
                    return (
                      <div
                        key={index}
                        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => selectNetwork(network)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getSecurityIcon(network.security)}
                            <div>
                              <p className="font-medium text-gray-900">{network.ssid}</p>
                              <div className="flex items-center space-x-2 text-sm text-gray-500">
                                <span className={signalInfo.color}>{signalInfo.quality}</span>
                                <span>•</span>
                                <span>Channel {network.channel}</span>
                                <span>•</span>
                                <span className={getSecurityColor(network.security)}>
                                  {network.security}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            {[...Array(4)].map((_, i) => (
                              <div
                                key={i}
                                className={`w-1 h-4 ${
                                  i < signalInfo.bars ? signalInfo.color.replace('text-', 'bg-') : 'bg-gray-200'
                                } rounded`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Manual Configuration */}
          <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900">Manual Configuration</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Network Name (SSID) *
              </label>
              <input
                type="text"
                value={wlanConfig.ssid}
                onChange={(e) => handleInputChange('ssid', e.target.value)}
                placeholder="Enter network name"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  getFieldError('ssid') ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {getFieldError('ssid') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('ssid')}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Security Type *
                </label>
                <select
                  value={wlanConfig.security_type}
                  onChange={(e) => handleInputChange('security_type', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    getFieldError('security_type') ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="none">Open (No Security)</option>
                  <option value="wep">WEP (Legacy)</option>
                  <option value="wpa">WPA</option>
                  <option value="wpa2">WPA2 (Recommended)</option>
                  <option value="wpa3">WPA3 (Latest)</option>
                </select>
                {getFieldError('security_type') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('security_type')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Channel *
                </label>
                <select
                  value={wlanConfig.channel}
                  onChange={(e) => handleInputChange('channel', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    getFieldError('channel') ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  {[...Array(14)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Channel {i + 1}
                    </option>
                  ))}
                </select>
                {getFieldError('channel') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('channel')}</p>
                )}
              </div>
            </div>

            {wlanConfig.security_type !== 'none' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={wlanConfig.password || ''}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Enter network password"
                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      getFieldError('password') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {getFieldError('password') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('password')}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  {wlanConfig.security_type === 'wep' && 'WEP password must be 13 or 26 characters'}
                  {(wlanConfig.security_type === 'wpa' || wlanConfig.security_type === 'wpa2' || wlanConfig.security_type === 'wpa3') && 
                    'Password must be 8-63 characters for WPA/WPA2/WPA3'}
                </p>
              </div>
            )}
          </div>

          {/* Configuration Info */}
          <div className="flex items-start p-4 bg-blue-50 rounded-lg">
            <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Configuration Notes:</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Click on a network in the scan results to auto-fill configuration</li>
                <li>WPA2 is recommended for best security and compatibility</li>
                <li>Channel selection can help avoid interference with other networks</li>
                <li>Changes will be applied to the wireless interface immediately</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WLANConfigSection;