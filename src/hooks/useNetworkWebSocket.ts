import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface NetworkUpdate {
  interfaces?: any[];
  timestamp: string;
}

interface UseNetworkWebSocketProps {
  onNetworkUpdate?: (update: NetworkUpdate) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
}

export const useNetworkWebSocket = ({
  onNetworkUpdate,
  onConnect,
  onDisconnect,
  onError
}: UseNetworkWebSocketProps = {}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<NetworkUpdate | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  useEffect(() => {
    // Create socket connection
    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Network WebSocket connected');
      setIsConnected(true);
      setConnectionStatus('connected');
      onConnect?.();
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Network WebSocket disconnected:', reason);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      onDisconnect?.();
    });

    newSocket.on('connect_error', (error) => {
      console.error('Network WebSocket connection error:', error);
      setConnectionStatus('error');
      onError?.('Failed to connect to network monitoring service');
    });

    newSocket.on('error', (error) => {
      console.error('Network WebSocket error:', error);
      onError?.('Network monitoring service error');
    });

    // Network-specific event handlers
    newSocket.on('networkInterfaces', (data: { interfaces: any[] }) => {
      const update: NetworkUpdate = {
        interfaces: data.interfaces,
        timestamp: new Date().toISOString()
      };
      
      setLastUpdate(update);
      onNetworkUpdate?.(update);
    });

    newSocket.on('networkStatus', (data: any) => {
      console.log('Network status update:', data);
    });

    newSocket.on('interfaceStatusChange', (data: { interface: string; status: string }) => {
      console.log('Interface status changed:', data);
    });

    // Cleanup function
    return () => {
      if (newSocket) {
        newSocket.disconnect();
        newSocket.removeAllListeners();
      }
    };
  }, [onNetworkUpdate, onConnect, onDisconnect, onError]);

  // Method to manually request network update
  const requestNetworkUpdate = () => {
    if (socket && isConnected) {
      socket.emit('requestNetworkUpdate');
    }
  };

  // Method to subscribe to specific interface updates
  const subscribeToInterface = (interfaceName: string) => {
    if (socket && isConnected) {
      socket.emit('subscribeToInterface', { interfaceName });
    }
  };

  // Method to unsubscribe from interface updates
  const unsubscribeFromInterface = (interfaceName: string) => {
    if (socket && isConnected) {
      socket.emit('unsubscribeFromInterface', { interfaceName });
    }
  };

  return {
    socket,
    isConnected,
    connectionStatus,
    lastUpdate,
    requestNetworkUpdate,
    subscribeToInterface,
    unsubscribeFromInterface
  };
};

// Hook for managing network alerts and notifications
export const useNetworkAlerts = () => {
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
    interface?: string;
  }>>([]);

  const addAlert = (alert: {
    type: 'info' | 'warning' | 'error';
    message: string;
    interface?: string;
  }) => {
    const newAlert = {
      ...alert,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    };
    
    setAlerts(prev => [newAlert, ...prev].slice(0, 10)); // Keep only last 10 alerts
  };

  const clearAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  return {
    alerts,
    addAlert,
    clearAlert,
    clearAllAlerts
  };
};

// Hook for network performance monitoring
export const useNetworkPerformance = () => {
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    interfaceName: string;
    rxBytes: number;
    txBytes: number;
    rxPackets: number;
    txPackets: number;
    errors: number;
    drops: number;
    timestamp: string;
  }[]>([]);

  const updatePerformanceMetrics = (interfaceName: string, metrics: {
    rxBytes: number;
    txBytes: number;
    rxPackets: number;
    txPackets: number;
    errors: number;
    drops: number;
  }) => {
    setPerformanceMetrics(prev => {
      const filtered = prev.filter(m => m.interfaceName !== interfaceName);
      return [...filtered, {
        interfaceName,
        ...metrics,
        timestamp: new Date().toISOString()
      }];
    });
  };

  const getInterfaceMetrics = (interfaceName: string) => {
    return performanceMetrics.find(m => m.interfaceName === interfaceName);
  };

  const clearMetrics = () => {
    setPerformanceMetrics([]);
  };

  return {
    performanceMetrics,
    updatePerformanceMetrics,
    getInterfaceMetrics,
    clearMetrics
  };
};