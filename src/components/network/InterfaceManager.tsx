import React, { useState, useEffect } from 'react';
import { Network, Power, PowerOff, RefreshCw, Activity, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

interface NetworkInterface {
  name: string;
  type: string;
  status: 'up' | 'down' | 'unknown';
  ip_address?: string;
  mac_address?: string;
  tx_bytes?: number;
  rx_bytes?: number;
  tx_packets?: number;
  rx_packets?: number;
  errors?: number;
  drops?: number;
}

interface InterfaceManagerProps {
  interfaces: NetworkInterface[];
  onInterfacesChange: (interfaces: NetworkInterface[]) => void;
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

const InterfaceManager: React.FC<InterfaceManagerProps> = ({
  interfaces,
  onInterfacesChange,
  onError,
  onSuccess
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedInterface, setSelectedInterface] = useState<string | null>(null);
  const [interfaceDetails, setInterfaceDetails] = useState<Record<string, NetworkInterface>>({});

  useEffect(() => {
    loadInterfaceDetails();
  }, [interfaces]);

  const loadInterfaceDetails = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Load detailed information for each interface
      const details: Record<string, NetworkInterface> = {};
      
      for (const iface of interfaces) {
        try {
          const response = await fetch(`/api/admin/network/interface/${iface.name}/details`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            details[iface.name] = data.details;
          } else {
            // Fallback to basic info if detailed info not available
            details[iface.name] = iface;
          }
        } catch (error) {
          console.warn(`Failed to load details for ${iface.name}:`, error);
          details[iface.name] = iface;
        }
      }

      setInterfaceDetails(details);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load interface details';
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshInterfaces = async () => {
    try {
      setIsRefreshing(true);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/admin/network/interfaces', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to refresh interfaces');
      }

      const data = await response.json();
      if (data.interfaces) {
        onInterfacesChange(data.interfaces);
        onSuccess('Network interfaces refreshed successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh interfaces';
      onError(errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleInterface = async (interfaceName: string, enable: boolean) => {
    try {
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/admin/network/interface/${interfaceName}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: enable })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to ${enable ? 'enable' : 'disable'} interface`);
      }

      const data = await response.json();
      onSuccess(data.message);
      
      // Refresh interfaces to get updated status
      await refreshInterfaces();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to toggle interface';
      onError(errorMessage);
    }
  };

  const getInterfaceIcon = (type: string) => {
    switch (type) {
      case 'ethernet':
        return <Network className="w-5 h-5" />;
      case 'wireless':
        return <Activity className="w-5 h-5" />;
      case 'bridge':
        return <Network className="w-5 h-5" />;
      case 'loopback':
        return <Info className="w-5 h-5" />;
      default:
        return <Network className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up':
        return 'text-green-600 bg-green-100';
      case 'down':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
        return <CheckCircle className="w-4 h-4" />;
      case 'down':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatPackets = (packets: number): string => {
    if (packets === 0) return '0';
    if (packets < 1000) return packets.toString();
    if (packets < 1000000) return (packets / 1000).toFixed(1) + 'K';
    return (packets / 1000000).toFixed(1) + 'M';
  };

  const shouldHideInterface = (iface: NetworkInterface): boolean => {
    // Hide loopback interface as requested
    return iface.name === 'lo' || iface.type === 'loopback';
  };

  const visibleInterfaces = interfaces.filter(iface => !shouldHideInterface(iface));

  if (isLoading && visibleInterfaces.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Loading network interfaces...</span>
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
              <Network className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Network Interfaces</h2>
            </div>
            <button
              onClick={refreshInterfaces}
              disabled={isRefreshing}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="p-6">
          {visibleInterfaces.length === 0 ? (
            <div className="text-center py-8">
              <Network className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No network interfaces found</p>
              <button
                onClick={refreshInterfaces}
                disabled={isRefreshing}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                Refresh Interfaces
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleInterfaces.map((iface) => {
                const details = interfaceDetails[iface.name] || iface;
                const isSelected = selectedInterface === iface.name;
                
                return (
                  <div key={iface.name} className="border border-gray-200 rounded-lg">
                    <div className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-full ${getStatusColor(iface.status)}`}>
                            {getInterfaceIcon(iface.type)}
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">{iface.name}</h3>
                            <p className="text-sm text-gray-500 capitalize">{iface.type}</p>
                          </div>
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(iface.status)}`}>
                            {getStatusIcon(iface.status)}
                            <span className="ml-1 capitalize">{iface.status}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                          {iface.ip_address && (
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">IP:</span> {iface.ip_address}
                            </div>
                          )}
                          
                          <button
                            onClick={() => toggleInterface(iface.name, iface.status !== 'up')}
                            className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${
                              iface.status === 'up'
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {iface.status === 'up' ? (
                              <><PowerOff className="w-4 h-4 mr-1" /> Disable</>
                            ) : (
                              <><Power className="w-4 h-4 mr-1" /> Enable</>
                            )}
                          </button>
                          
                          <button
                            onClick={() => setSelectedInterface(isSelected ? null : iface.name)}
                            className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
                          >
                            {isSelected ? 'Hide Details' : 'Show Details'}
                          </button>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <h4 className="text-sm font-medium text-gray-900 mb-2">MAC Address</h4>
                              <p className="text-sm text-gray-600 font-mono">
                                {details.mac_address || 'N/A'}
                              </p>
                            </div>
                            
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <h4 className="text-sm font-medium text-gray-900 mb-2">Traffic Statistics</h4>
                              <div className="space-y-1 text-sm text-gray-600">
                                <div>TX: {formatBytes(details.tx_bytes || 0)}</div>
                                <div>RX: {formatBytes(details.rx_bytes || 0)}</div>
                              </div>
                            </div>
                            
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <h4 className="text-sm font-medium text-gray-900 mb-2">Packet Statistics</h4>
                              <div className="space-y-1 text-sm text-gray-600">
                                <div>TX Packets: {formatPackets(details.tx_packets || 0)}</div>
                                <div>RX Packets: {formatPackets(details.rx_packets || 0)}</div>
                              </div>
                            </div>
                            
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <h4 className="text-sm font-medium text-gray-900 mb-2">Error Statistics</h4>
                              <div className="space-y-1 text-sm text-gray-600">
                                <div>Errors: {details.errors || 0}</div>
                                <div>Drops: {details.drops || 0}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Interface Statistics Summary */}
      {visibleInterfaces.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Interface Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{visibleInterfaces.length}</div>
              <div className="text-sm text-gray-500">Total Interfaces</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {visibleInterfaces.filter(i => i.status === 'up').length}
              </div>
              <div className="text-sm text-gray-500">Active Interfaces</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {visibleInterfaces.filter(i => i.status === 'down').length}
              </div>
              <div className="text-sm text-gray-500">Inactive Interfaces</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {visibleInterfaces.filter(i => i.ip_address).length}
              </div>
              <div className="text-sm text-gray-500">Interfaces with IP</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterfaceManager;