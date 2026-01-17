# AJC PISOWIFI - Comprehensive Coin-Operated WiFi System

A complete coin-operated WiFi hotspot management system built with Node.js, Express, Socket.io, and SQLite. Features hardware integration with GPIO for coin detection, real-time WebSocket updates, and a comprehensive admin dashboard.

## 🚀 Features

### Client Portal
- **Mobile-first design** - Optimized for smartphone users
- **Real-time coin detection** - WebSocket-powered live updates
- **60-second countdown modal** - Coin insertion interface with timer
- **Session management** - Automatic MAC address tracking
- **Responsive rates display** - Clear pricing information

### Admin Dashboard
- **Analytics overview** - Active users, earnings, system uptime
- **Rates management** - CRUD interface for pricing rules
- **Network configuration** - Interface status and bridge creation
- **System updater** - GitHub-based updates with real-time output
- **Session monitoring** - Real-time user session tracking

### Hardware Integration
- **GPIO abstraction layer** - Supports Raspberry Pi and Orange Pi
- **Multi-coin slot support** - 1 pulse = ₱1, 5 pulses = ₱5, 10 pulses = ₱10
- **Automatic board detection** - Detects hardware platform automatically
- **Mock mode** - Development mode with keyboard simulation
- **Pulse debouncing** - Prevents false coin detections

### Network Management
- **Captive portal engine** - iptables-based traffic interception
- **MAC address whitelisting** - Automatic access control
- **Bridge configuration** - Linux networking command integration
- **Interface monitoring** - Real-time network status

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js, Socket.io
- **Database**: SQLite3 with better-sqlite3 driver
- **Frontend**: React, TypeScript, Tailwind CSS
- **Hardware**: GPIO libraries (onoff, orange-pi-gpio)
- **Charts**: Recharts for analytics visualization
- **Icons**: Lucide React icons

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Linux environment (for GPIO and networking features)
- sudo permissions (for network configuration)

### Quick Start

1. **Clone and install dependencies**
```bash
git clone https://github.com/Djnirds1984/AJC-PISOWIFI.git
cd ajc-pisowifi
npm install
```

2. **Initialize the database**
```bash
npm run init:db
```

3. **Start development server**
```bash
npm run dev
```

4. **Access the application**
- Client Portal: http://localhost:8080
- Admin Dashboard: http://localhost:8080/admin
- Default admin credentials: `admin` / `admin123`

### Production Setup

1. **Build the application**
```bash
npm run build
```

2. **Start production server**
```bash
npm start
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=8080
JWT_SECRET=your-secret-key-here
NODE_ENV=production
```

### GPIO Configuration

The system automatically detects the hardware platform (Raspberry Pi or Orange Pi) and initializes GPIO on **Physical Pin 3** (GPIO2).

For development without hardware, the system runs in mock mode where you can simulate coin insertions using keyboard:
- Press `1` for ₱1 coin
- Press `5` for ₱5 coin  
- Press `0` for ₱10 coin
- Press any other key for random pulse

### Network Configuration

The system requires sudo permissions for network operations:

```bash
# Add your user to sudoers for specific commands
sudo visudo
# Add line: yourusername ALL=(ALL) NOPASSWD: /sbin/ip, /sbin/iptables, /usr/bin/brctl
```

## 📱 Usage Guide

### Client Portal

1. **Connect to WiFi** - Users connect to the WiFi network
2. **View rates** - Pricing information is displayed
3. **Insert coins** - Click "Insert Coin" button
4. **Coin detection** - Insert coins within 60 seconds
5. **Access granted** - MAC address is automatically whitelisted

### Admin Dashboard

1. **Login** - Access admin panel with credentials
2. **Analytics** - View system statistics and earnings
3. **Manage rates** - Add, edit, or delete pricing rules
4. **Network config** - Monitor interfaces and create bridges
5. **System updates** - Update from GitHub repositories

## 🏗️ Architecture

### Database Schema

- **user_sessions** - Active user sessions with MAC addresses
- **session_history** - Historical session data
- **rate_settings** - WiFi pricing configuration
- **network_interfaces** - Network interface status
- **bridge_configurations** - Network bridge settings
- **admin_users** - Admin user accounts
- **system_logs** - System activity logs

### API Endpoints

#### Client API
- `GET /api/rates` - Get current pricing rates
- `POST /api/session` - Create or update user session
- `GET /api/session/:mac_address` - Get session status

#### Admin API
- `POST /api/admin/auth/login` - Admin authentication
- `GET /api/admin/analytics` - System analytics
- `GET /api/admin/rates` - Get all rates
- `POST /api/admin/rates` - Create new rate
- `PUT /api/admin/rates/:id` - Update rate
- `DELETE /api/admin/rates/:id` - Delete rate
- `GET /api/admin/network/interfaces` - Network interfaces
- `POST /api/admin/network/bridge` - Create bridge
- `POST /api/admin/system/update` - Start system update

### WebSocket Events

#### Client Events
- `coinDetected` - Real-time coin detection updates
- `rates` - Rate information updates

#### Admin Events
- `updateProgress` - System update progress
- `updateOutput` - Real-time update terminal output

## 🔒 Security Features

- **JWT authentication** - Secure admin sessions
- **MAC address validation** - Input sanitization
- **Command injection prevention** - All system commands escaped
- **Rate limiting** - API endpoint protection
- **Session management** - Automatic session cleanup

## 🚨 Troubleshooting

### Common Issues

1. **GPIO not working**
   - Check hardware compatibility
   - Verify pin connections
   - Run in mock mode for testing

2. **Network permissions**
   - Ensure sudo permissions are configured
   - Check iptables rules
   - Verify network interface names

3. **Database errors**
   - Run `npm run init:db` to initialize
   - Check file permissions
   - Verify SQLite installation

4. **WebSocket connection issues**
   - Check firewall settings
   - Verify port availability
   - Review CORS configuration

### Development Mode

For development without hardware:
- GPIO runs in mock mode automatically
- Use keyboard to simulate coin insertions
- All network operations are simulated

## 📊 Monitoring

The system provides comprehensive monitoring:
- **Real-time analytics** - Active users, earnings
- **System logs** - Detailed activity tracking
- **Network status** - Interface monitoring
- **Update tracking** - System update progress

## 🔄 Updates

System updates can be performed through the admin dashboard:
1. Navigate to Updater tab
2. Enter GitHub repository URL
3. Specify branch name (default: main)
4. Monitor real-time update progress

## 📞 Support

For support and questions:
- Check the troubleshooting section
- Review system logs in admin dashboard
- Ensure all prerequisites are met
- Verify hardware connections

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**AJC PISOWIFI** - Transform your internet connection into a profitable WiFi hotspot with comprehensive management and real-time monitoring capabilities.