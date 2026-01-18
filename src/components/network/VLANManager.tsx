import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, RefreshCw, Save, X, AlertTriangle, CheckCircle, Info, Network } from 'lucide-react';
import { NetworkValidation } from '@/lib/network-utils';

interface VLANConfig {
  id?: string;
  vlan_id: number;
  name: string;
  interface: string;
  tagged: boolean;
  priority?: number;
  is_enabled: boolean;
}

interface VLANManagerProps {
  vlans: any[];
  interfaces: NetworkInterface[];
  onVlansChange: (vlans: any[]) => void;
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

const VLANManager: React.FC<VLANManagerProps> = ({
  vlans,
  interfaces,
  onVlansChange,
  onError,
  onSuccess
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingVLAN, setEditingVLAN] = useState<VLANConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [vlanForm, setVLANForm] = useState<VLANConfig>({
    vlan_id: 10,
    name: '',
    interface: '',
    tagged: true,
    priority: 0,
    is_enabled: false
  });

  const availableInterfaces = interfaces.filter(iface => 
    iface.type === 'ethernet' && iface.status === 'up'
  );

  useEffect(() => {
    loadVLANs();
  }, []);

  const loadVLANs = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/admin/network/vlan', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to load VLAN configurations');
      }

      const data = await response.json();
      onVlansChange(data.vlans || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load VLAN configurations';
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate VLAN ID
    const vlanIdValidation = NetworkValidation.validateVLANId(vlanForm.vlan_id);
    if (!vlanIdValidation.valid) {
      newErrors.vlan_id = vlanIdValidation.error!;
    }

    // Check for duplicate VLAN ID
    const existingVLAN = vlans.find(v => 
      v.vlan_id === vlanForm.vlan_id && v.id !== editingVLAN?.id
    );
    if (existingVLAN) {
      newErrors.vlan_id = 'VLAN ID already exists';
    }

    if (!vlanForm.name.trim()) {
      newErrors.name = 'VLAN name is required';
    }

    if (!vlanForm.interface) {
      newErrors.interface = 'Interface is required';
    }

    if (vlanForm.priority !== undefined) {
      if (vlanForm.priority < 0 || vlanForm.priority > 7) {
        newErrors.priority = 'Priority must be between 0 and 7';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof VLANConfig, value: any) => {
    const newForm = { ...vlanForm, [field]: value };
    setVLANForm(newForm);

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

      const response = await fetch('/api/admin/network/vlan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(vlanForm)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to save VLAN configuration');
      }

      const data = await response.json();
      onSuccess(data.message || 'VLAN configuration saved successfully');
      
      // Reload VLANs to get updated list
      await loadVLANs();
      
      // Reset form
      setShowForm(false);
      setEditingVLAN(null);
      setVLANForm({
        vlan_id: 10,
        name: '',
        interface: '',
        tagged: true,
        priority: 0,
        is_enabled: false
      });
      setErrors({});
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save VLAN configuration';
      onError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteVLAN = async (vlanId: string) => {
    if (!confirm('Are you sure you want to delete this VLAN? This will remove the VLAN configuration from the interface.')) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/admin/network/vlan/${vlanId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to delete VLAN');
      }

      const data = await response.json();
      onSuccess(data.message || 'VLAN deleted successfully');
      
      // Reload VLANs to get updated list
      await loadVLANs();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete VLAN';
      onError(errorMessage);
    }
  };

  const startEdit = (vlan: any) => {
    const config: VLANConfig = {
      id: vlan.id,
      vlan_id: vlan.vlan_id,
      name: vlan.name,
      interface: vlan.interface,
      tagged: vlan.tagged,
      priority: vlan.priority,
      is_enabled: vlan.is_enabled
    };
    setEditingVLAN(config);
    setVLANForm(config);
    setShowForm(true);
  };

  const getFieldError = (field: keyof VLANConfig) => {
    return errors[field] || '';
  };

  const hasErrors = () => {
    return Object.values(errors).some(error => error.length > 0);
  };

  const getInterfaceName = (interfaceName: string): string => {
    const iface = interfaces.find(i => i.name === interfaceName);
    return iface ? `${iface.name} (${iface.type})` : interfaceName;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Loading VLAN configurations...</span>
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
              <Shield className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">VLAN Management</h2>
            </div>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingVLAN(null);
                setVLANForm({
                  vlan_id: 10,
                  name: '',
                  interface: availableInterfaces.length > 0 ? availableInterfaces[0].name : '',
                  tagged: true,
                  priority: 0,
                  is_enabled: false
                });
                setErrors({});
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create VLAN
            </button>
          </div>
        </div>

        <div className="p-6">
          {vlans.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 mb-4">No VLANs configured</p>
              <button
                onClick={() => {
                  setShowForm(true);
                  setEditingVLAN(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create First VLAN
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {vlans.map((vlan) => (
                <div key={vlan.id} className="border border-gray-200 rounded-lg">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-full ${
                          vlan.is_enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                          <Shield className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{vlan.name}</h3>
                          <p className="text-sm text-gray-500">VLAN ID: {vlan.vlan_id}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded ${
                              vlan.is_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {vlan.is_enabled ? 'Enabled' : 'Disabled'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {getInterfaceName(vlan.interface)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {vlan.tagged ? 'Tagged' : 'Untagged'}
                            </span>
                            {vlan.priority !== undefined && vlan.priority > 0 && (
                              <span className="text-xs text-gray-500">
                                Priority: {vlan.priority}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => startEdit(vlan)}
                          className="flex items-center px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteVLAN(vlan.id)}
                          className="flex items-center px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingVLAN ? 'Edit VLAN' : 'Create New VLAN'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingVLAN(null);
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
                  VLAN ID *
                </label>
                <input
                  type="number"
                  min="1"
                  max="4094"
                  value={vlanForm.vlan_id}
                  onChange={(e) => handleInputChange('vlan_id', parseInt(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    getFieldError('vlan_id') ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {getFieldError('vlan_id') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('vlan_id')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VLAN Name *
                </label>
                <input
                  type="text"
                  value={vlanForm.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter VLAN name"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    getFieldError('name') ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {getFieldError('name') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('name')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interface *
                </label>
                <select
                  value={vlanForm.interface}
                  onChange={(e) => handleInputChange('interface', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    getFieldError('interface') ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select an interface</option>
                  {availableInterfaces.map((iface) => (
                    <option key={iface.name} value={iface.name}>
                      {iface.name} ({iface.type})
                    </option>
                  ))}
                </select>
                {getFieldError('interface') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('interface')}</p>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Tagged VLAN</h4>
                  <p className="text-xs text-gray-500">Enable 802.1Q tagging</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vlanForm.tagged}
                    onChange={(e) => handleInputChange('tagged', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority (0-7)
                </label>
                <input
                  type="number"
                  min="0"
                  max="7"
                  value={vlanForm.priority || 0}
                  onChange={(e) => handleInputChange('priority', parseInt(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    getFieldError('priority') ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {getFieldError('priority') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('priority')}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Higher values have higher priority</p>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Enable VLAN</h4>
                  <p className="text-xs text-gray-500">Activate the VLAN immediately</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vlanForm.is_enabled}
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
                {isSaving ? 'Saving...' : (editingVLAN ? 'Update VLAN' : 'Create VLAN')}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingVLAN(null);
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

export default VLANManager;