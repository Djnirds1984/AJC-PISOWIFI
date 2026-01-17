import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, DollarSign, Clock, Wifi, Settings, Plus, Edit, Trash2, Network, RefreshCw, LogOut } from 'lucide-react';

interface Analytics {
  active_users: number;
  daily_earnings: number;
  monthly_earnings: number;
  system_uptime: string;
}

interface Rate {
  id: number;
  coin_value: number;
  minutes: number;
  is_active: boolean;
  created_at: string;
}

interface NetworkInterface {
  name: string;
  type: string;
  status: string;
  ip_address: string | null;
  last_updated: string;
}

interface Session {
  id: string;
  mac_address: string;
  credits: number;
  minutes_remaining: number;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('analytics');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [rates, setRates] = useState<Rate[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [networkInterfaces, setNetworkInterfaces] = useState<NetworkInterface[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddRate, setShowAddRate] = useState(false);
  const [showEditRate, setShowEditRate] = useState<Rate | null>(null);
  const [newRate, setNewRate] = useState({ coin_value: '', minutes: '' });
  const [updateStatus, setUpdateStatus] = useState({ inProgress: false, progress: null });
  const [updateOutput, setUpdateOutput] = useState('');

  useEffect(() => {
    fetchAnalytics();
    fetchRates();
    fetchSessions();
    fetchNetworkInterfaces();
    checkUpdateStatus();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/analytics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchRates = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/rates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRates(data.rates);
      }
    } catch (error) {
      console.error('Error fetching rates:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const fetchNetworkInterfaces = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/network/interfaces', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNetworkInterfaces(data.interfaces);
      }
    } catch (error) {
      console.error('Error fetching network interfaces:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkUpdateStatus = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/system/update/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUpdateStatus({ inProgress: data.inProgress, progress: null });
      }
    } catch (error) {
      console.error('Error checking update status:', error);
    }
  };

  const handleAddRate = async () => {
    if (!newRate.coin_value || !newRate.minutes) return;
    
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          coin_value: parseInt(newRate.coin_value),
          minutes: parseInt(newRate.minutes)
        })
      });
      
      if (response.ok) {
        setNewRate({ coin_value: '', minutes: '' });
        setShowAddRate(false);
        fetchRates();
      }
    } catch (error) {
      console.error('Error adding rate:', error);
    }
  };

  const handleEditRate = async () => {
    if (!showEditRate) return;
    
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/rates/${showEditRate.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          coin_value: showEditRate.coin_value,
          minutes: showEditRate.minutes
        })
      });
      
      if (response.ok) {
        setShowEditRate(null);
        fetchRates();
      }
    } catch (error) {
      console.error('Error editing rate:', error);
    }
  };

  const handleDeleteRate = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rate?')) return;
    
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/rates/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        fetchRates();
      }
    } catch (error) {
      console.error('Error deleting rate:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin';
  };

  const chartData = [
    { name: 'Mon', earnings: 120 },
    { name: 'Tue', earnings: 85 },
    { name: 'Wed', earnings: 150 },
    { name: 'Thu', earnings: 95 },
    { name: 'Fri', earnings: 200 },
    { name: 'Sat', earnings: 175 },
    { name: 'Sun', earnings: 140 }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Wifi className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">AJC PISOWIFI Admin</h1>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'analytics', label: 'Analytics', icon: Users },
              { id: 'rates', label: 'Rates', icon: DollarSign },
              { id: 'network', label: 'Network', icon: Network },
              { id: 'updater', label: 'Updater', icon: RefreshCw }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
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
        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Users</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics?.active_users || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Daily Earnings</p>
                    <p className="text-2xl font-bold text-gray-900">₱{analytics?.daily_earnings || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Monthly Earnings</p>
                    <p className="text-2xl font-bold text-gray-900">₱{analytics?.monthly_earnings || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">System Uptime</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics?.system_uptime || '00:00:00'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Earnings</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="earnings" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Sessions</h3>
                <div className="space-y-3">
                  {sessions.slice(0, 5).map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{session.mac_address}</p>
                        <p className="text-sm text-gray-600">₱{session.credits} • {session.minutes_remaining}min</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-gray-600">Active</span>
                      </div>
                    </div>
                  ))}
                  {sessions.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No active sessions</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rates Tab */}
        {activeTab === 'rates' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">WiFi Rates</h2>
              <button
                onClick={() => setShowAddRate(true)}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Rate</span>
              </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coin Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Minutes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rates.map((rate) => (
                    <tr key={rate.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">₱{rate.coin_value}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rate.minutes}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₱{(rate.coin_value/rate.minutes).toFixed(2)}/min</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setShowEditRate(rate)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRate(rate.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add/Edit Rate Modal */}
            {(showAddRate || showEditRate) && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {showEditRate ? 'Edit Rate' : 'Add Rate'}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Coin Value (₱)</label>
                      <input
                        type="number"
                        value={showEditRate ? showEditRate.coin_value : newRate.coin_value}
                        onChange={(e) => showEditRate 
                          ? setShowEditRate({...showEditRate, coin_value: parseInt(e.target.value)})
                          : setNewRate({...newRate, coin_value: e.target.value})
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Minutes</label>
                      <input
                        type="number"
                        value={showEditRate ? showEditRate.minutes : newRate.minutes}
                        onChange={(e) => showEditRate
                          ? setShowEditRate({...showEditRate, minutes: parseInt(e.target.value)})
                          : setNewRate({...newRate, minutes: e.target.value})
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={showEditRate ? handleEditRate : handleAddRate}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                    >
                      {showEditRate ? 'Update' : 'Add'}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddRate(false);
                        setShowEditRate(null);
                      }}
                      className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Network Tab */}
        {activeTab === 'network' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Network Interfaces</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {networkInterfaces.map((iface) => (
                <div key={iface.name} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{iface.name}</h3>
                    <div className={`w-3 h-3 rounded-full ${
                      iface.status === 'up' ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium">{iface.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium">{iface.status}</span>
                    </div>
                    {iface.ip_address && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">IP:</span>
                        <span className="font-medium">{iface.ip_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Updater Tab */}
        {activeTab === 'updater' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">System Updater</h2>
            
            <div className="bg-white rounded-lg shadow p-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const repositoryUrl = formData.get('repository_url') as string;
                  const branch = formData.get('branch') as string;
                  
                  try {
                    const token = localStorage.getItem('adminToken');
                    const response = await fetch('/api/admin/system/update', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ repository_url: repositoryUrl, branch })
                    });
                    
                    if (response.ok) {
                      setUpdateStatus({ inProgress: true, progress: null });
                    }
                  } catch (error) {
                    console.error('Error starting update:', error);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GitHub Repository URL
                  </label>
                  <input
                    name="repository_url"
                    type="url"
                    defaultValue="https://github.com/yourusername/ajc-pisowifi"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Branch Name
                  </label>
                  <input
                    name="branch"
                    type="text"
                    defaultValue="main"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={updateStatus.inProgress}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {updateStatus.inProgress ? 'Updating...' : 'Start Update'}
                </button>
              </form>
              
              {updateStatus.inProgress && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-blue-800">Update in progress...</span>
                  </div>
                  {updateOutput && (
                    <pre className="text-sm text-gray-700 bg-gray-100 p-3 rounded overflow-auto max-h-64">
                      {updateOutput}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;