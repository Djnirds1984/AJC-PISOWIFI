import React from 'react';
import { Wifi, Globe, Network, Activity, CheckCircle, XCircle, AlertCircle, WifiOff } from 'lucide-react';

interface NetworkStatusIndicatorProps {
  config: {
    wan?: any;
    wlan?: any;
    interfaces?: any[];
    hotspots?: any[];
  };
  isWebSocketConnected?: boolean;
}

const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({ config, isWebSocketConnected }) => {
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'up':
      case 'active':
      case 'connected':
        return 'text-green-500';
      case 'down':
      case 'inactive':
      case 'disconnected':
        return 'text-red-500';
      default:
        return 'text-yellow-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'up':
      case 'active':
      case 'connected':
        return <CheckCircle className="w-5 h-5" />;
      case 'down':
      case 'inactive':
      case 'disconnected':
        return <XCircle className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const activeInterfaces = config.interfaces?.filter((iface: any) => iface.status === 'up').length || 0;
  const totalInterfaces = config.interfaces?.length || 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Network Status</h3>
        <div className="flex items-center space-x-2">
          {isWebSocketConnected !== undefined && (
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="text-xs text-gray-500">
                {isWebSocketConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          )}
          <Activity className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* WAN Status */}
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <Globe className={`w-6 h-6 ${getStatusColor(config.wan?.dhcp_enabled ? 'active' : 'inactive')}`} />
          <div>
            <p className="text-sm font-medium text-gray-900">WAN</p>
            <p className="text-xs text-gray-500">
              {config.wan?.dhcp_enabled ? 'DHCP' : 'Static'}
            </p>
          </div>
        </div>

        {/* WLAN Status */}
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <Wifi className={`w-6 h-6 ${getStatusColor(config.wlan?.is_enabled ? 'connected' : 'disconnected')}`} />
          <div>
            <p className="text-sm font-medium text-gray-900">WiFi</p>
            <p className="text-xs text-gray-500">
              {config.wlan?.is_enabled ? config.wlan.ssid : 'Disabled'}
            </p>
          </div>
        </div>

        {/* Interfaces Status */}
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <Network className={`w-6 h-6 ${activeInterfaces > 0 ? 'text-green-500' : 'text-red-500'}`} />
          <div>
            <p className="text-sm font-medium text-gray-900">Interfaces</p>
            <p className="text-xs text-gray-500">
              {activeInterfaces}/{totalInterfaces} Active
            </p>
          </div>
        </div>

        {/* Hotspot Status */}
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <div className={`${config.hotspots?.length > 0 ? 'text-green-500' : 'text-gray-400'}`}>
            {getStatusIcon(config.hotspots?.length > 0 ? 'active' : 'inactive')}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Hotspots</p>
            <p className="text-xs text-gray-500">
              {config.hotspots?.length || 0} Configured
            </p>
          </div>
        </div>
      </div>

      {/* Interface Details */}
      {config.interfaces && config.interfaces.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Interface Status</h4>
          <div className="space-y-2">
            {config.interfaces.slice(0, 3).map((iface: any, index: number) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{iface.name}</span>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    iface.status === 'up' 
                      ? 'bg-green-100 text-green-800' 
                      : iface.status === 'down'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {iface.status}
                  </span>
                  {iface.ip_address && (
                    <span className="text-gray-500 text-xs">{iface.ip_address}</span>
                  )}
                </div>
              </div>
            ))}
            {config.interfaces.length > 3 && (
              <p className="text-xs text-gray-500 text-center">
                +{config.interfaces.length - 3} more interfaces
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkStatusIndicator;