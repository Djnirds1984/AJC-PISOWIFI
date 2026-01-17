import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Coins, Wifi, Clock, DollarSign } from 'lucide-react';

interface Rate {
  coin: number;
  minutes: number;
}

interface Session {
  session_id: string;
  credits: number;
  minutes_remaining: number;
  expires_at: string;
  is_active: boolean;
}

const ClientPortal: React.FC = () => {
  const [rates, setRates] = useState<Rate[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [macAddress, setMacAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get MAC address (in a real implementation, this would come from network detection)
    const mockMacAddress = 'aa:bb:cc:dd:ee:ff';
    setMacAddress(mockMacAddress);

    // Initialize Socket.io connection
    const socketInstance = io(window.location.origin);
    setSocket(socketInstance);

    // Fetch rates and session
    fetchRates();
    fetchSession(mockMacAddress);

    // Socket event listeners
    socketInstance.on('coinDetected', (data) => {
      if (session && data.sessionId === session.session_id) {
        setSession(prev => prev ? {
          ...prev,
          credits: data.credits,
          minutes_remaining: data.minutesRemaining
        } : null);
      }
    });

    socketInstance.on('rates', (data) => {
      setRates(data.rates);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (showCoinModal && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setShowCoinModal(false);
      setCountdown(60);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showCoinModal, countdown]);

  const fetchRates = async () => {
    try {
      const response = await fetch('/api/rates');
      const data = await response.json();
      setRates(data.rates);
    } catch (error) {
      console.error('Error fetching rates:', error);
    }
  };

  const fetchSession = async (mac: string) => {
    try {
      const response = await fetch(`/api/session/${mac}`);
      if (response.ok) {
        const data = await response.json();
        setSession(data);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching session:', error);
      setIsLoading(false);
    }
  };

  const handleInsertCoin = () => {
    setShowCoinModal(true);
    setCountdown(60);
    
    // Start coin detection on server
    if (socket) {
      socket.emit('startCoinDetection', { sessionId: session?.session_id });
    }
  };

  const handleCreateSession = async () => {
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mac_address: macAddress,
          credits: 0
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSession(data);
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / (1000 * 60));
    return formatTime(minutes);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white">
      {/* Header */}
      <div className="bg-black bg-opacity-30 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Wifi className="w-8 h-8 text-blue-400" />
              <h1 className="text-2xl font-bold">AJC PISOWIFI</h1>
            </div>
            <div className="text-sm opacity-75">
              {session ? (
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>{formatExpiry(session.expires_at)}</span>
                </div>
              ) : (
                <span>Not connected</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Status Card */}
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 mb-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">WiFi Status</h2>
            {session ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400">Connected</span>
                </div>
                <div className="text-sm opacity-75">
                  Credits: ₱{session.credits} | Time: {formatTime(session.minutes_remaining)}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-red-400">Not Connected</span>
                </div>
                <button
                  onClick={handleCreateSession}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Start Session
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Rates Section */}
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-center">WiFi Rates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {rates.map((rate, index) => (
              <div key={index} className="bg-white bg-opacity-5 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <DollarSign className="w-6 h-6 text-yellow-400" />
                </div>
                <div className="text-2xl font-bold mb-1">₱{rate.coin}</div>
                <div className="text-sm opacity-75">{rate.minutes} minutes</div>
              </div>
            ))}
          </div>
        </div>

        {/* Insert Coin Button */}
        <div className="text-center">
          <button
            onClick={handleInsertCoin}
            className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-4 px-8 rounded-full text-lg shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center space-x-3 mx-auto"
          >
            <Coins className="w-6 h-6" />
            <span>Insert Coin</span>
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center text-sm opacity-75">
          <p>Insert coins to get WiFi access time</p>
          <p className="mt-1">Press the button above and insert coins within 60 seconds</p>
        </div>
      </div>

      {/* Coin Modal */}
      {showCoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded-xl p-8 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="mb-4">
                <Coins className="w-16 h-16 text-yellow-500 mx-auto" />
              </div>
              <h3 className="text-xl font-bold mb-2">Insert Coin</h3>
              <p className="text-gray-600 mb-6">Insert coins now to add credits</p>
              
              {/* Countdown */}
              <div className="mb-6">
                <div className="text-3xl font-bold text-blue-600">{countdown}</div>
                <div className="text-sm text-gray-500">seconds remaining</div>
                
                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(countdown / 60) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Current Credits */}
              {session && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600">Current Credits</div>
                  <div className="text-2xl font-bold text-blue-600">₱{session.credits}</div>
                  <div className="text-sm text-gray-600">{formatTime(session.minutes_remaining)} remaining</div>
                </div>
              )}

              <button
                onClick={() => {
                  setShowCoinModal(false);
                  setCountdown(60);
                }}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
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

export default ClientPortal;