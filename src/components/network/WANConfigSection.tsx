import React, { useState, useEffect } from 'react';
import { Globe, Save, RefreshCw, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { NetworkValidation } from '@/lib/network-utils';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorMessage from '@/components/shared/ErrorMessage';
import SuccessMessage from '@/components/shared/SuccessMessage';

interface WANConfig {
  interface: string;
  ip_address: string;
  subnet_mask: string;
  gateway: string;
  dns_primary: string;
  dns_secondary?: string;
  dhcp_enabled: boolean;
}

interface WANConfigSectionProps {
  config?: WANConfig;
  onConfigChange: (config: WANConfig) => void;
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

const WANConfigSection: React.FC<WANConfigSectionProps> = ({
  config,
  onConfigChange,
  onError,
  onSuccess
}) => {
  const [wanConfig, setWanConfig] = useState<WANConfig>({
    interface: 'eth0',
    ip_address: '',
    subnet_mask: '',
    gateway: '',
    dns_primary: '8.8.8.8',
    dns_secondary: '',
    dhcp_enabled: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (config) {
      setWanConfig(config);
    } else {
      loadWANConfig();
    }
  }, [config]);

  const loadWANConfig = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/admin/network/wan-config', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to load WAN configuration');
      }

      const data = await response.json();
      if (data.config) {
        setWanConfig(data.config);
        onConfigChange(data.config);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load WAN configuration';
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const validateConfig = (): boolean => {
    const validation = NetworkValidation.validateNetworkConfig(wanConfig, 'wan');
    setErrors(validation.errors);
    return validation.valid;
  };

  const handleInputChange = (field: keyof WANConfig, value: string | boolean) => {
    const newConfig = { ...wanConfig, [field]: value };
    setWanConfig(newConfig);
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

      const response = await fetch('/api/admin/network/wan-config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(wanConfig)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to save WAN configuration');
      }

      const data = await response.json();
      onSuccess(data.message || 'WAN configuration saved successfully');
      
      // Reload configuration to get any system-updated values
      await loadWANConfig();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save WAN configuration';
      onError(errorMessage);
    } finally {
      setIsSaving(false);
      setShowConfirmation(false);
    }
  };

  const handleDHCPChange = (enabled: boolean) => {
    handleInputChange('dhcp_enabled', enabled);
  };

  const getFieldError = (field: keyof WANConfig) => {
    return errors[field] || '';
  };

  const hasErrors = () => {
    return Object.values(errors).some(error => error.length > 0);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading WAN configuration...</span>
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
              <Globe className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">WAN Configuration</h2>
            </div>
            <div className="flex items-center space-x-2">
              {hasErrors() && (
                <div className="flex items-center text-red-600">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  <span className="text-sm">Validation errors</span>
                </div>
              )}
              <button
                onClick={() => setShowConfirmation(true)}
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
          {/* DHCP Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-lg space-y-3 sm:space-y-0">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900">DHCP Configuration</h3>
              <p className="text-sm text-gray-500">
                Enable to automatically obtain IP configuration from DHCP server
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={wanConfig.dhcp_enabled}
                onChange={(e) => handleDHCPChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Interface Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Network Interface
            </label>
            <select
              value={wanConfig.interface}
              onChange={(e) => handleInputChange('interface', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                getFieldError('interface') ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="eth0">eth0 (Ethernet)</option>
              <option value="eth1">eth1 (Ethernet)</option>
              <option value="wlan0">wlan0 (Wireless)</option>
              <option value="ppp0">ppp0 (PPP)</option>
            </select>
            {getFieldError('interface') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('interface')}</p>
            )}
          </div>

          {/* Static IP Configuration - Only show if DHCP is disabled */}
          {!wanConfig.dhcp_enabled && (
            <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900">Static IP Configuration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IP Address *
                  </label>
                  <input
                    type="text"
                    value={wanConfig.ip_address}
                    onChange={(e) => handleInputChange('ip_address', e.target.value)}
                    placeholder="192.168.1.100"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      getFieldError('ip_address') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {getFieldError('ip_address') && (
                    <p className="mt-1 text-sm text-red-600">{getFieldError('ip_address')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subnet Mask *
                  </label>
                  <input
                    type="text"
                    value={wanConfig.subnet_mask}
                    onChange={(e) => handleInputChange('subnet_mask', e.target.value)}
                    placeholder="255.255.255.0"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      getFieldError('subnet_mask') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {getFieldError('subnet_mask') && (
                    <p className="mt-1 text-sm text-red-600">{getFieldError('subnet_mask')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gateway *
                  </label>
                  <input
                    type="text"
                    value={wanConfig.gateway}
                    onChange={(e) => handleInputChange('gateway', e.target.value)}
                    placeholder="192.168.1.1"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      getFieldError('gateway') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {getFieldError('gateway') && (
                    <p className="mt-1 text-sm text-red-600">{getFieldError('gateway')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary DNS *
                  </label>
                  <input
                    type="text"
                    value={wanConfig.dns_primary}
                    onChange={(e) => handleInputChange('dns_primary', e.target.value)}
                    placeholder="8.8.8.8"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      getFieldError('dns_primary') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {getFieldError('dns_primary') && (
                    <p className="mt-1 text-sm text-red-600">{getFieldError('dns_primary')}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary DNS
                </label>
                <input
                  type="text"
                  value={wanConfig.dns_secondary}
                  onChange={(e) => handleInputChange('dns_secondary', e.target.value)}
                  placeholder="8.8.4.4 (optional)"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    getFieldError('dns_secondary') ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {getFieldError('dns_secondary') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('dns_secondary')}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  Optional secondary DNS server for redundancy
                </p>
              </div>
            </div>
          )}

          {/* Configuration Info */}
          <div className="flex items-start p-4 bg-blue-50 rounded-lg">
            <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Configuration Notes:</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Changes will be applied immediately to the network interface</li>
                <li>Ensure you have alternative access before changing network settings</li>
                <li>DHCP will automatically obtain IP configuration from your router</li>
                <li>Static IP requires manual configuration of all network parameters</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Confirm Network Changes</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to apply these WAN configuration changes? This may affect network connectivity.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isSaving ? 'Applying...' : 'Apply Changes'}
              </button>
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={isSaving}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 disabled:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WANConfigSection;