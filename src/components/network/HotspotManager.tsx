import React, { useState, useEffect } from 'react';
import { Radio, Users, Wifi, Settings, Plus, Trash2, Edit, RefreshCw, Save, X, AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import { NetworkValidation } from '@/lib/network-utils';

interface HotspotClient {
  mac: string;
  ip: string;
  signal: number;
  connected_at?: string;
  hostname?: string;
}

interface HotspotConfig {
  id?: string;
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

interface HotspotManagerProps {
  hotspots: any[];
  onHotspotsChange: (hotspots: any[]) => void;
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

const HotspotManager: React.FC<HotspotManagerProps> = ({
  hotspots,
  onHotspotsChange,
  onError,
  onSuccess
}) => {
  const [clients, setClients] = useState<Record<string, HotspotClient[]>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingHotspot, setEditingHotspot] = useState<HotspotConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingClients, setIsRefreshingClients] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const [hotspotForm, setHotspotForm] = useState<HotspotConfig>({
    name: '',
    interface: 'wlan0',
    ssid: '',
    security_type: 'wpa2',
    password: '',
    max_clients: 10,
    bandwidth_limit_up: 0,
    bandwidth_limit_down: 0,
    is_enabled: false
  });

  const availableInterfaces = ['wlan0', 'wlan1', 'wlp2s0', 'wlp3s0'];

  useEffect(() => {
    loadHotspots();
  }, []);

  const loadHotspots = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/admin/network/hotspot', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to load hotspot configurations');
      }

      const data = await response.json();
      onHotspotsChange(data.hotspots || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load hotspot configurations';
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClients = async (hotspotName: string) => {
    try {
      setIsRefreshingClients(prev => ({ ...prev, [hotspotName]: true }));
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/admin/network/hotspot/${hotspotName}/clients`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to load hotspot clients');
      }

      const data = await response.json();
      setClients(prev => ({ ...prev, [hotspotName]: data.clients || [] }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load hotspot clients';
      onError(errorMessage);
    } finally {
      setIsRefreshingClients(prev => ({ ...prev, [hotspotName]: false }));
    }
  };

  const validateForm = (): boolean => {
    const validation = NetworkValidation.validateNetworkConfig(hotspotForm, 'hotspot');
    setErrors(validation.errors);
    return validation.valid;
  };

  const handleInputChange = (field: keyof HotspotConfig, value: string | number | boolean) => {
    const newForm = { ...hotspotForm, [field]: value };
    setHotspotForm(newForm);

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSave = async () => {
    try {
      if (!validateForm()) {
        onError('Please fix the validation errors before saving');
        return;
      }

      setIsSaving(true);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/admin/network/hotspot', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(hotspotForm)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to save hotspot configuration');
      }

      const data = await response.json();
      onSuccess(data.message || 'Hotspot configuration saved successfully');
      
      // Reload hotspots to get updated list
      await loadHotspots();
      
      // Reset form
      setShowForm(false);
      setEditingHotspot(null);
      setHotspotForm({
        name: '',
        interface: 'wlan0',
        ssid: '',
        security_type: 'wpa2',
        password: '',
        max_clients: 10,
        bandwidth_limit_up: 0,
        bandwidth_limit_down: 0,
        is_enabled: false
      });
      setErrors({});
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save hotspot configuration';
      onError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (hotspot: any) => {
    const config: HotspotConfig = {
      id: hotspot.id,
      name: hotspot.name,
      interface: hotspot.interface,
      ssid: hotspot.ssid,
      security_type: hotspot.security_type,
      password: hotspot.password,
      max_clients: hotspot.max_clients,
      bandwidth_limit_up: hotspot.bandwidth_limit_up || 0,
      bandwidth_limit_down: hotspot.bandwidth_limit_down || 0,
      is_enabled: hotspot.is_enabled
    };
    setEditingHotspot(config);
    setHotspotForm(config);
    setShowForm(true);
  };

  const getFieldError = (field: keyof HotspotConfig) => {
    return errors[field] || '';
  };

  const hasErrors = () => {
    return Object.values(errors).some(error => error.length > 0);
  };

  const getSecurityColor = (security: string) => {
    switch (security) {
      case 'none':
        return 'text-red-600';
      case 'wpa2':
        return 'text-blue-600';
      case 'wpa3':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  const getSignalStrengthInfo = (rssi: number) => {
    return NetworkValidation.interpretSignalStrength(rssi);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Loading hotspot configurations...</span>
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
              <Radio className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Hotspot Management</h2>
            </div>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingHotspot(null);
                setHotspotForm({
                  name: '',
                  interface: 'wlan0',
                  ssid: '',
                  security_type: 'wpa2',
                  password: '',
                  max_clients: 10,
                  bandwidth_limit_up: 0,
                  bandwidth_limit_down: 0,
                  is_enabled: false
                });
                setErrors({});
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Hotspot
            </button>
          </div>
        </div>

        <div className="p-6">
          {hotspots.length === 0 ? (
            <div className="text-center py-8">
              <Radio className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 mb-4">No hotspots configured</p>
              <button
                onClick={() => {
                  setShowForm(true);
                  setEditingHotspot(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create First Hotspot
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {hotspots.map((hotspot) => (
                <div key={hotspot.id} className="border border-gray-200 rounded-lg">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-full ${
                          hotspot.is_enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                          <Wifi className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{hotspot.name}</h3>
                          <p className="text-sm text-gray-500">{hotspot.ssid}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded ${getSecurityColor(hotspot.security_type)}`}>
                              {hotspot.security_type.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500">
                              {hotspot.interface}
                            </span>
                            <span className="text-xs text-gray-500">
                              Max: {hotspot.max_clients} clients
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => loadClients(hotspot.name)}
                          disabled={isRefreshingClients[hotspot.name]}
                          className="flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                          <Users className="w-4 h-4 mr-1" />
                          Clients
                          {isRefreshingClients[hotspot.name] && (
                            <RefreshCw className="w-3 h-3 ml-1 animate-spin" />
                          )}
                        </button>
                        <button
                          onClick={() => startEdit(hotspot)}
                          className="flex items-center px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </button>
                      </div>
                    </div>
                    
                    {/* Clients List */}
                    {clients[hotspot.name] && clients[hotspot.name].length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                          Connected Clients ({clients[hotspot.name].length})
                        </h4>
                        <div className="space-y-2">
                          {clients[hotspot.name].map((client, index) => {
                            const signalInfo = getSignalStrengthInfo(client.signal);
                            return (
                              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center space-x-1">
                                    {[...Array(4)].map((_, i) => (
                                      <div
                                        key={i}
                                        className={`w-1 h-3 ${
                                          i < signalInfo.bars ? signalInfo.color.replace('text-', 'bg-') : 'bg-gray-200'
                                        } rounded`}
                                      />
                                    ))}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{client.mac}</p>
                                    <p className="text-xs text-gray-500">{client.ip}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className={`text-xs font-medium ${signalInfo.color}`}>
                                    {signalInfo.quality}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {client.signal} dBm
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingHotspot ? 'Edit Hotspot' : 'Create New Hotspot'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingHotspot(null);
                  setErrors({});
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hotspot Name *
                </label>
                <input
                  type="text"
                  value={hotspotForm.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter hotspot name"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    getFieldError('name') ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {getFieldError('name') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('name')}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interface *
                  </label>
                  <select
                    value={hotspotForm.interface}
                    onChange={(e) => handleInputChange('interface', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      getFieldError('interface') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    {availableInterfaces.map((iface) => (
                      <option key={iface} value={iface}>{iface}</option>
                    ))}
                  </select>
                  {getFieldError('interface') && (
                    <p className="mt-1 text-sm text-red-600">{getFieldError('interface')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Clients *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="255"
                    value={hotspotForm.max_clients}
                    onChange={(e) => handleInputChange('max_clients', parseInt(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      getFieldError('max_clients') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {getFieldError('max_clients') && (
                    <p className="mt-1 text-sm text-red-600">{getFieldError('max_clients')}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Network Name (SSID) *
                </label>
                <input
                  type="text"
                  value={hotspotForm.ssid}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Security Type *
                  </label>
                  <select
                    value={hotspotForm.security_type}
                    onChange={(e) => handleInputChange('security_type', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      getFieldError('security_type') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="none">Open (No Security)</option>
                    <option value="wpa2">WPA2 (Recommended)</option>
                    <option value="wpa3">WPA3 (Latest)</option>
                  </select>
                  {getFieldError('security_type') && (
                    <p className="mt-1 text-sm text-red-600">{getFieldError('security_type')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={hotspotForm.password}
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
                        <X className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Shield className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {getFieldError('password') && (
                    <p className="mt-1 text-sm text-red-600">{getFieldError('password')}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Bandwidth Limit (kbps)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={hotspotForm.bandwidth_limit_up}
                    onChange={(e) => handleInputChange('bandwidth_limit_up', parseInt(e.target.value) || 0)}
                    placeholder="0 (unlimited)"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      getFieldError('bandwidth_limit_up') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {getFieldError('bandwidth_limit_up') && (
                    <p className="mt-1 text-sm text-red-600">{getFieldError('bandwidth_limit_up')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Download Bandwidth Limit (kbps)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={hotspotForm.bandwidth_limit_down}
                    onChange={(e) => handleInputChange('bandwidth_limit_down', parseInt(e.target.value) || 0)}
                    placeholder="0 (unlimited)"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      getFieldError('bandwidth_limit_down') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {getFieldError('bandwidth_limit_down') && (
                    <p className="mt-1 text-sm text-red-600">{getFieldError('bandwidth_limit_down')}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Enable Hotspot</h4>
                  <p className="text-xs text-gray-500">Start the hotspot service immediately</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hotspotForm.is_enabled}
                    onChange={(e) => handleInputChange('is_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSave}
                disabled={isSaving || hasErrors()}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : (editingHotspot ? 'Update Hotspot' : 'Create Hotspot')}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingHotspot(null);
                  setErrors({});
                }}
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

export default HotspotManager;