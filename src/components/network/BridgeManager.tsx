import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, RefreshCw, Network, AlertTriangle, CheckCircle, Info, Link } from 'lucide-react';

interface BridgeConfig {
  id?: string;
  name: string;
  interfaces: string[];
  stp_enabled: boolean;
  stp_priority?: number;
  stp_forward_delay?: number;
  stp_hello_time?: number;
  stp_max_age?: number;
  is_enabled: boolean;
  status?: 'active' | 'inactive';
}

interface BridgeManagerProps {
  bridges: any[];
  interfaces: NetworkInterface[];
  onBridgesChange: (bridges: any[]) => void;
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

interface NetworkInterface {
  name: string;
  type: string;
  status: 'up' | 'down' | 'unknown';
  ip_address?: string;
  mac_address?: string;
}

const BridgeManager: React.FC<BridgeManagerProps> = ({
  bridges,
  interfaces,
  onBridgesChange,
  onError,
  onSuccess
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingBridge, setEditingBridge] = useState<BridgeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [bridgeForm, setBridgeForm] = useState<BridgeConfig>({
    name: '',
    interfaces: [],
    stp_enabled: true,
    stp_priority: 32768,
    stp_forward_delay: 15,
    stp_hello_time: 2,
    stp_max_age: 20,
    is_enabled: false
  });

  const availableInterfaces = interfaces.filter(iface => 
    iface.type === 'ethernet' && iface.status === 'up' && !isInterfaceInBridge(iface.name)
  );

  useEffect(() => {
    loadBridges();
  }, []);

  const loadBridges = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/admin/network/bridges', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to load bridge configurations');
      }

      const data = await response.json();
      onBridgesChange(data.bridges || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load bridge configurations';
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const isInterfaceInBridge = (interfaceName: string): boolean => {
    return bridges.some(bridge => 
      bridge.interfaces && bridge.interfaces.includes(interfaceName)
    );
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!bridgeForm.name.trim()) {
      newErrors.name = 'Bridge name is required';
    } else if (!bridgeForm.name.match(/^[a-zA-Z0-9_-]+$/)) {
      newErrors.name = 'Bridge name can only contain letters, numbers, hyphens, and underscores';
    }

    if (bridgeForm.interfaces.length === 0) {
      newErrors.interfaces = 'At least one interface must be selected';
    }

    if (bridgeForm.stp_enabled) {
      if (bridgeForm.stp_priority !== undefined && (bridgeForm.stp_priority < 0 || bridgeForm.stp_priority > 65535)) {
        newErrors.stp_priority = 'STP priority must be between 0 and 65535';
      }
      
      if (bridgeForm.stp_forward_delay !== undefined && (bridgeForm.stp_forward_delay < 4 || bridgeForm.stp_forward_delay > 30)) {
        newErrors.stp_forward_delay = 'STP forward delay must be between 4 and 30 seconds';
      }
      
      if (bridgeForm.stp_hello_time !== undefined && (bridgeForm.stp_hello_time < 1 || bridgeForm.stp_hello_time > 10)) {
        newErrors.stp_hello_time = 'STP hello time must be between 1 and 10 seconds';
      }
      
      if (bridgeForm.stp_max_age !== undefined && (bridgeForm.stp_max_age < 6 || bridgeForm.stp_max_age > 40)) {
        newErrors.stp_max_age = 'STP max age must be between 6 and 40 seconds';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof BridgeConfig, value: any) => {
    const newForm = { ...bridgeForm, [field]: value };
    setBridgeForm(newForm);

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleInterfaceToggle = (interfaceName: string) => {
    const newInterfaces = bridgeForm.interfaces.includes(interfaceName)
      ? bridgeForm.interfaces.filter(iface => iface !== interfaceName)
      : [...bridgeForm.interfaces, interfaceName];
    
    handleInputChange('interfaces', newInterfaces);
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

      const response = await fetch('/api/admin/network/bridge', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bridge_name: bridgeForm.name,
          interfaces: bridgeForm.interfaces,
          stp_enabled: bridgeForm.stp_enabled,
          stp_priority: bridgeForm.stp_priority,
          stp_forward_delay: bridgeForm.stp_forward_delay,
          stp_hello_time: bridgeForm.stp_hello_time,
          stp_max_age: bridgeForm.stp_max_age
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to create bridge');
      }

      const data = await response.json();
      onSuccess(data.message || 'Bridge created successfully');
      
      // Reload bridges to get updated list
      await loadBridges();
      
      // Reset form
      setShowForm(false);
      setEditingBridge(null);
      setBridgeForm({
        name: '',
        interfaces: [],
        stp_enabled: true,
        stp_priority: 32768,
        stp_forward_delay: 15,
        stp_hello_time: 2,
        stp_max_age: 20,
        is_enabled: false
      });
      setErrors({});
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save bridge configuration';
      onError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteBridge = async (bridgeId: string) => {
    if (!confirm('Are you sure you want to delete this bridge? This will remove all interfaces from the bridge.')) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/admin/network/bridge/${bridgeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to delete bridge');
      }

      const data = await response.json();
      onSuccess(data.message || 'Bridge deleted successfully');
      
      // Reload bridges to get updated list
      await loadBridges();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete bridge';
      onError(errorMessage);
    }
  };

  const getFieldError = (field: keyof BridgeConfig) => {
    return errors[field] || '';
  };

  const hasErrors = () => {
    return Object.values(errors).some(error => error.length > 0);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Loading bridge configurations...</span>
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
              <Settings className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Bridge Configuration</h2>
            </div>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingBridge(null);
                setBridgeForm({
                  name: '',
                  interfaces: [],
                  stp_enabled: true,
                  stp_priority: 32768,
                  stp_forward_delay: 15,
                  stp_hello_time: 2,
                  stp_max_age: 20,
                  is_enabled: false
                });
                setErrors({});
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Bridge
            </button>
          </div>
        </div>

        <div className="p-6">
          {bridges.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 mb-4">No bridges configured</p>
              <button
                onClick={() => {
                  setShowForm(true);
                  setEditingBridge(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create First Bridge
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {bridges.map((bridge) => (
                <div key={bridge.id} className="border border-gray-200 rounded-lg">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-full ${
                          bridge.is_enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                          <Link className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{bridge.bridge_name}</h3>
                          <p className="text-sm text-gray-500">
                            {bridge.interfaces?.length || 0} interfaces, STP: {bridge.stp_enabled ? 'Enabled' : 'Disabled'}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded ${
                              bridge.is_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {bridge.is_enabled ? 'Active' : 'Inactive'}
                            </span>
                            <span className="text-xs text-gray-500">
                              Priority: {bridge.stp_priority || 32768}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => deleteBridge(bridge.id)}
                          className="flex items-center px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    {/* Bridge Interfaces */}
                    {bridge.interfaces && bridge.interfaces.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Member Interfaces</h4>
                        <div className="flex flex-wrap gap-2">
                          {bridge.interfaces.map((iface: string, index: number) => (
                            <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Network className="w-3 h-3 mr-1" />
                              {iface}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* STP Configuration */}
                    {bridge.stp_enabled && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">STP Configuration</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Priority:</span>
                            <span className="ml-2 font-medium">{bridge.stp_priority || 32768}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Forward Delay:</span>
                            <span className="ml-2 font-medium">{bridge.stp_forward_delay || 15}s</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Hello Time:</span>
                            <span className="ml-2 font-medium">{bridge.stp_hello_time || 2}s</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Max Age:</span>
                            <span className="ml-2 font-medium">{bridge.stp_max_age || 20}s</span>
                          </div>
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
                {editingBridge ? 'Edit Bridge' : 'Create New Bridge'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingBridge(null);
                  setErrors({});
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bridge Name *
                </label>
                <input
                  type="text"
                  value={bridgeForm.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="br0"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    getFieldError('name') ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {getFieldError('name') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('name')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Member Interfaces *
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {availableInterfaces.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No available interfaces. Ensure interfaces are up and not already in a bridge.
                    </p>
                  ) : (
                    availableInterfaces.map((iface) => (
                      <label key={iface.name} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={bridgeForm.interfaces.includes(iface.name)}
                          onChange={() => handleInterfaceToggle(iface.name)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{iface.name}</span>
                          <span className="text-xs text-gray-500 ml-2">({iface.type})</span>
                        </div>
                        <div className={`text-xs px-2 py-1 rounded ${
                          iface.status === 'up' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {iface.status}
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {getFieldError('interfaces') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('interfaces')}</p>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Spanning Tree Protocol (STP)</h4>
                  <p className="text-xs text-gray-500">Enable to prevent network loops</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bridgeForm.stp_enabled}
                    onChange={(e) => handleInputChange('stp_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {bridgeForm.stp_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg">
                  <h4 className="md:col-span-2 text-sm font-medium text-gray-900 mb-2">STP Configuration</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bridge Priority
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="65535"
                      step="4096"
                      value={bridgeForm.stp_priority || 32768}
                      onChange={(e) => handleInputChange('stp_priority', parseInt(e.target.value))}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        getFieldError('stp_priority') ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {getFieldError('stp_priority') && (
                      <p className="mt-1 text-sm text-red-600">{getFieldError('stp_priority')}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">Lower values have higher priority</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Forward Delay (seconds)
                    </label>
                    <input
                      type="number"
                      min="4"
                      max="30"
                      value={bridgeForm.stp_forward_delay || 15}
                      onChange={(e) => handleInputChange('stp_forward_delay', parseInt(e.target.value))}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        getFieldError('stp_forward_delay') ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {getFieldError('stp_forward_delay') && (
                      <p className="mt-1 text-sm text-red-600">{getFieldError('stp_forward_delay')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hello Time (seconds)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={bridgeForm.stp_hello_time || 2}
                      onChange={(e) => handleInputChange('stp_hello_time', parseInt(e.target.value))}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        getFieldError('stp_hello_time') ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {getFieldError('stp_hello_time') && (
                      <p className="mt-1 text-sm text-red-600">{getFieldError('stp_hello_time')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Age (seconds)
                    </label>
                    <input
                      type="number"
                      min="6"
                      max="40"
                      value={bridgeForm.stp_max_age || 20}
                      onChange={(e) => handleInputChange('stp_max_age', parseInt(e.target.value))}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        getFieldError('stp_max_age') ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {getFieldError('stp_max_age') && (
                      <p className="mt-1 text-sm text-red-600">{getFieldError('stp_max_age')}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Enable Bridge</h4>
                  <p className="text-xs text-gray-500">Activate the bridge immediately</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bridgeForm.is_enabled}
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
                {isSaving ? 'Creating...' : (editingBridge ? 'Update Bridge' : 'Create Bridge')}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingBridge(null);
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

export default BridgeManager;