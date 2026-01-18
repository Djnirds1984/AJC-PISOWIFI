import React, { useState, useEffect } from 'react';
import { Network, Wifi, Globe, Radio, Settings, Activity, Shield, Users, ArrowLeft, Save, RefreshCw, AlertTriangle, CheckCircle, XCircle, WifiOff } from 'lucide-react';
import WANConfigSection from '@/components/network/WANConfigSection';
import WLANConfigSection from '@/components/network/WLANConfigSection';
import InterfaceManager from '@/components/network/InterfaceManager';
import HotspotManager from '@/components/network/HotspotManager';
import BridgeManager from '@/components/network/BridgeManager';
import VLANManager from '@/components/network/VLANManager';
import NetworkStatusIndicator from '@/components/network/NetworkStatusIndicator';
import { NetworkValidation } from '@/lib/network-utils';
import { useNetworkWebSocket, useNetworkAlerts, useNetworkPerformance } from '@/hooks/useNetworkWebSocket';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorMessage from '@/components/shared/ErrorMessage';
import SuccessMessage from '@/components/shared/SuccessMessage';

interface NetworkConfig {
  wan?: any;
  wlan?: any;
  interfaces?: any[];
  hotspots?: any[];
  bridges?: any[];
  vlans?: any[];
}

interface NetworkConfigPageProps {
  onBack?: () => void;
}

const NetworkConfigPage: React.FC<NetworkConfigPageProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // WebSocket integration
  const { isConnected, connectionStatus, lastUpdate } = useNetworkWebSocket({
    onNetworkUpdate: (update) => {
      if (update.interfaces) {
        setNetworkConfig(prev => ({ ...prev, interfaces: update.interfaces }));
      }
    },
    onConnect: () => {
      setSuccess('Connected to network monitoring service');
      setTimeout(() => setSuccess(null), 3000);
    },
    onDisconnect: () => {
      setError('Disconnected from network monitoring service');
    },
    onError: (error) => {
      setError(`Network monitoring error: ${error}`);
    }
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'wan', label: 'WAN Configuration', icon: Globe },
    { id: 'wlan', label: 'Wireless Networks', icon: Wifi },
    { id: 'interfaces', label: 'Interfaces', icon: Network },
    { id: 'hotspot', label: 'Hotspot Server', icon: Radio },
    { id: 'bridge', label: 'Bridge Configuration', icon: Settings },
    { id: 'vlan', label: 'VLAN Management', icon: Shield },
  ];

  useEffect(() => {
    loadNetworkData();
  }, []);

  const loadNetworkData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Load all network configurations in parallel
      const [
        wanResponse,
        wlanResponse,
        interfacesResponse,
        hotspotsResponse,
        bridgesResponse,
        vlansResponse
      ] = await Promise.all([
        fetch('/api/admin/network/wan-config', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/network/wlan-config', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/network/interfaces', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/network/hotspot', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/network/bridges', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/network/vlan', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const config: NetworkConfig = {};

      if (wanResponse.ok) {
        const wanData = await wanResponse.json();
        config.wan = wanData.config;
      }

      if (wlanResponse.ok) {
        const wlanData = await wlanResponse.json();
        config.wlan = wlanData.config;
      }

      if (interfacesResponse.ok) {
        const interfacesData = await interfacesResponse.json();
        config.interfaces = interfacesData.interfaces;
      }

      if (hotspotsResponse.ok) {
        const hotspotsData = await hotspotsResponse.json();
        config.hotspots = hotspotsData.hotspots;
      }

      if (bridgesResponse.ok) {
        const bridgesData = await bridgesResponse.json();
        config.bridges = bridgesData.bridges;
      }

      if (vlansResponse.ok) {
        const vlansData = await vlansResponse.json();
        config.vlans = vlansData.vlans;
      }

      setNetworkConfig(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load network data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNetworkData();
    setIsRefreshing(false);
    setSuccess('Network data refreshed successfully');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setError(null);
    setSuccess(null);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <NetworkStatusIndicator config={networkConfig} isWebSocketConnected={isConnected} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">WAN Status</h3>
                  <Globe className="w-6 h-6 text-blue-600" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Interface:</span>
                    <span className="font-medium">{networkConfig.wan?.interface || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">IP Address:</span>
                    <span className="font-medium">{networkConfig.wan?.ip_address || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">DHCP:</span>
                    <span className="font-medium">{networkConfig.wan?.dhcp_enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Wireless Status</h3>
                  <Wifi className="w-6 h-6 text-green-600" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">SSID:</span>
                    <span className="font-medium">{networkConfig.wlan?.ssid || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Security:</span>
                    <span className="font-medium">{networkConfig.wlan?.security_type || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className="font-medium">{networkConfig.wlan?.is_enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Network Summary</h3>
                  <Network className="w-6 h-6 text-purple-600" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Interfaces:</span>
                    <span className="font-medium">{networkConfig.interfaces?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Hotspots:</span>
                    <span className="font-medium">{networkConfig.hotspots?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">VLANs:</span>
                    <span className="font-medium">{networkConfig.vlans?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <ErrorMessage 
                message={error} 
                type="error" 
                onClose={() => setError(null)}
              />
            )}

            {success && (
              <SuccessMessage 
                message={success} 
                onClose={() => setSuccess(null)}
              />
            )}
          </div>
        );

      case 'wan':
        return (
          <WANConfigSection
            config={networkConfig.wan}
            onConfigChange={(newConfig) => setNetworkConfig(prev => ({ ...prev, wan: newConfig }))}
            onError={setError}
            onSuccess={setSuccess}
          />
        );

      case 'wlan':
        return (
          <WLANConfigSection
            config={networkConfig.wlan}
            onConfigChange={(newConfig) => setNetworkConfig(prev => ({ ...prev, wlan: newConfig }))}
            onError={setError}
            onSuccess={setSuccess}
          />
        );

      case 'interfaces':
        return (
          <InterfaceManager
            interfaces={networkConfig.interfaces || []}
            onInterfacesChange={(interfaces) => setNetworkConfig(prev => ({ ...prev, interfaces }))}
            onError={setError}
            onSuccess={setSuccess}
          />
        );

      case 'hotspot':
        return (
          <HotspotManager
            hotspots={networkConfig.hotspots || []}
            onHotspotsChange={(hotspots) => setNetworkConfig(prev => ({ ...prev, hotspots }))}
            onError={setError}
            onSuccess={setSuccess}
          />
        );

      case 'bridge':
        return (
          <BridgeManager
            bridges={networkConfig.bridges || []}
            interfaces={networkConfig.interfaces || []}
            onBridgesChange={(bridges) => setNetworkConfig(prev => ({ ...prev, bridges }))}
            onError={setError}
            onSuccess={setSuccess}
          />
        );

      case 'vlan':
        return (
          <VLANManager
            vlans={networkConfig.vlans || []}
            interfaces={networkConfig.interfaces || []}
            onVlansChange={(vlans) => setNetworkConfig(prev => ({ ...prev, vlans }))}
            onError={setError}
            onSuccess={setSuccess}
          />
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading network configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 space-y-4 sm:space-y-0">
            <div className="flex items-center">
              <button
                onClick={() => window.location.href = '/admin/dashboard'}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </button>
              <Network className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Network Configuration</h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* WebSocket Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm text-gray-600 hidden sm:inline">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile dropdown for navigation */}
          <div className="md:hidden">
            <select
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {tabs.map(({ id, label }) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
          
          {/* Desktop navigation */}
          <div className="hidden md:flex space-x-1 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`flex items-center space-x-2 py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </main>
    </div>
  );
};

export default NetworkConfigPage;