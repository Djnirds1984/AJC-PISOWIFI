# AJC PISOWIFI - Complete Installation Guide

## 🚀 Quick Start

This guide provides comprehensive instructions for deploying the AJC PISOWIFI system on both Linux and Windows environments.

## 📋 Prerequisites

### System Requirements
- **Operating System**: Ubuntu 20.04+, Debian 11+, CentOS 8+, Windows 10/11, Windows Server 2019+
- **RAM**: Minimum 2GB (4GB recommended)
- **Storage**: Minimum 10GB free space
- **Network**: Stable internet connection for installation
- **Privileges**: Administrator/Sudo access required

### Hardware Requirements (for GPIO functionality)
- **Raspberry Pi** (any model with GPIO pins) OR **Orange Pi**
- **Coin Slot Machine** with pulse output
- **GPIO Connection**: Physical Pin 3 (GPIO2) for coin detection

## 🐧 Linux Installation

### Automated Installation (Recommended)

1. **Download and run the installation script:**
```bash
# Download the installation script
wget https://raw.githubusercontent.com/Djnirds1984/AJC-PISOWIFI/main/install.sh

# Make it executable
chmod +x install.sh

# Run as root or with sudo
sudo ./install.sh
```

2. **The script will automatically:**
   - Update system packages
   - Install Node.js 22.x
   - Install and configure Nginx
   - Install PM2 process manager
   - Clone the repository
   - Install dependencies
   - Build the project
   - Initialize the database
   - Configure firewall
   - Start all services

3. **Access your application:**
   - Client Portal: `http://your-server-ip`
   - Admin Dashboard: `http://your-server-ip/admin`
   - Default credentials: `admin` / `admin123`

### Manual Installation (Advanced)

If you prefer manual installation or need custom configuration:

#### 1. System Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git build-essential python3 nginx sqlite3
```

#### 2. Install Node.js
```bash
# Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

#### 3. Clone and Setup Project
```bash
# Create project directory
sudo mkdir -p /opt/ajc-pisowifi
sudo useradd -r -s /bin/bash -d /opt/ajc-pisowifi -m pisowifi

# Clone repository
cd /opt/ajc-pisowifi
sudo -u pisowifi git clone https://github.com/Djnirds1984/AJC-PISOWIFI.git .

# Install dependencies
sudo -u pisowifi npm install

# Build project
sudo -u pisowifi npm run build

# Initialize database
sudo -u pisowifi npm run init:db
```

#### 4. Configure Nginx
```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/ajc-pisowifi > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/ajc-pisowifi /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. Setup PM2
```bash
# Create PM2 ecosystem file
cd /opt/ajc-pisowifi
sudo -u pisowifi tee ecosystem.config.js > /dev/null <<EOF
module.exports = {
  apps: [{
    name: 'ajc-pisowifi',
    script: 'api/server.js',
    cwd: '/opt/ajc-pisowifi',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: '/var/log/ajc-pisowifi/err.log',
    out_file: '/var/log/ajc-pisowifi/out.log',
    log_file: '/var/log/ajc-pisowifi/combined.log',
    autorestart: true,
    max_restarts: 10
  }]
};
EOF

# Start application with PM2
sudo -u pisowifi pm2 start ecosystem.config.js
sudo -u pisowifi pm2 save
sudo pm2 startup systemd -u pisowifi --hp /opt/ajc-pisowifi
```

## 🪟 Windows Installation

### Automated Installation (Recommended)

1. **Download and run the installation script:**
   - Download `install-windows.bat` from the repository
   - Right-click and select "Run as Administrator"
   - Follow the on-screen instructions

2. **The script will automatically:**
   - Install Chocolatey package manager
   - Install Node.js 22.x
   - Install PM2 process manager
   - Install Git and SQLite
   - Clone the repository
   - Install dependencies
   - Build the project
   - Initialize the database
   - Configure Windows Firewall
   - Start the application

3. **Access your application:**
   - Client Portal: `http://localhost:8080`
   - Admin Dashboard: `http://localhost:8080/admin`
   - Default credentials: `admin` / `admin123`

### Manual Windows Installation

#### 1. Install Prerequisites
- **Node.js 22.x**: Download from [nodejs.org](https://nodejs.org/)
- **Git**: Download from [git-scm.com](https://git-scm.com/)
- **SQLite**: Download from [sqlite.org](https://www.sqlite.org/)

#### 2. Setup Project
```cmd
# Create project directory
mkdir "C:\Program Files\ajc-pisowifi"
cd "C:\Program Files\ajc-pisowifi"

# Clone repository
git clone https://github.com/Djnirds1984/AJC-PISOWIFI.git .

# Install dependencies
npm install

# Build project
npm run build

# Initialize database
npm run init:db
```

#### 3. Setup PM2
```cmd
# Install PM2 globally
npm install -g pm2

# Create PM2 configuration
echo module.exports = { apps: [{ name: 'ajc-pisowifi', script: 'api/server.js', cwd: 'C:\\Program Files\\ajc-pisowifi', env: { NODE_ENV: 'production', PORT: 8080 }, autorestart: true }] }; > ecosystem.config.js

# Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 4. Configure Windows Firewall
```cmd
# Allow application port
netsh advfirewall firewall add rule name="AJC PISOWIFI" dir=in action=allow protocol=TCP localport=8080
```

## 🔧 GPIO Hardware Setup

### Raspberry Pi Configuration

1. **Physical Connection:**
   - Connect coin slot pulse output to **Physical Pin 3** (GPIO2)
   - Connect ground to any GND pin
   - Use appropriate pull-up/pull-down resistors as needed

2. **System Permissions:**
```bash
# Add user to gpio group
sudo usermod -a -G gpio pisowifi

# Set up GPIO permissions
sudo chmod 666 /dev/gpiomem
```

3. **Install GPIO Libraries:**
```bash
# Install onoff for Raspberry Pi
sudo -u pisowifi npm install onoff
```

### Orange Pi Configuration

1. **Install Orange Pi GPIO Library:**
```bash
# Install orange-pi-gpio
sudo -u pisowifi npm install orange-pi-gpio
```

2. **Configure GPIO Access:**
```bash
# Add user to appropriate groups
sudo usermod -a -G gpio pisowifi
```

### Coin Slot Configuration

The system supports multi-coin slots with the following pulse logic:
- **1 pulse** = ₱1 coin
- **5 pulses** = ₱5 coin
- **10 pulses** = ₱10 coin

Configure your coin slot machine to output pulses on the connected GPIO pin.

## 🔐 Security Configuration

### Firewall Setup

#### Ubuntu/Debian (UFW)
```bash
# Allow HTTP traffic
sudo ufw allow 80/tcp
sudo ufw allow 8080/tcp

# Enable firewall
sudo ufw --force enable
```

#### CentOS/RHEL (Firewalld)
```bash
# Allow HTTP traffic
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

### SSL/TLS Configuration (Optional)

For production deployment, configure SSL:

1. **Install Certbot:**
```bash
sudo apt install certbot python3-certbot-nginx
```

2. **Obtain SSL Certificate:**
```bash
sudo certbot --nginx -d your-domain.com
```

3. **Auto-renewal:**
```bash
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Monitoring and Maintenance

### Log Locations
- **Application Logs**: `/var/log/ajc-pisowifi/` (Linux) or `%ProgramData%\ajc-pisowifi\logs\` (Windows)
- **Nginx Logs**: `/var/log/nginx/ajc-pisowifi/` (Linux)
- **PM2 Logs**: Same as application logs

### Service Management

#### Linux (systemd)
```bash
# Check service status
sudo systemctl status nginx
sudo -u pisowifi pm2 status

# Restart services
sudo systemctl restart nginx
sudo -u pisowifi pm2 restart ajc-pisowifi

# View logs
sudo -u pisowifi pm2 logs ajc-pisowifi
```

#### Windows
```cmd
# Check PM2 status
pm2 status

# Restart application
pm2 restart ajc-pisowifi

# View logs
pm2 logs ajc-pisowifi
```

### Backup and Recovery

#### Database Backup
```bash
# Linux
sudo -u pisowifi sqlite3 /opt/ajc-pisowifi/database.sqlite ".backup backup-$(date +%Y%m%d).db"

# Windows
cd "C:\Program Files\ajc-pisowifi"
sqlite3 database.sqlite ".backup backup-%date:~-4,4%%date:~-10,2%%date:~-7,2%.db"
```

#### Application Backup
```bash
# Create backup of entire application
sudo tar -czf ajc-pisowifi-backup-$(date +%Y%m%d).tar.gz /opt/ajc-pisowifi
```

## 🚨 Troubleshooting

### Common Issues

#### 1. GPIO Not Working
- **Check permissions**: Ensure user is in `gpio` group
- **Verify wiring**: Check physical connections
- **Test with mock mode**: Set `MOCK_GPIO=true` in environment

#### 2. Database Connection Errors
- **Check file permissions**: Ensure SQLite file is writable
- **Verify database initialization**: Run `npm run init:db`
- **Check disk space**: Ensure sufficient storage available

#### 3. Port Already in Use
- **Check port usage**: `sudo netstat -tlnp | grep :8080`
- **Change port**: Modify `PORT` in environment variables
- **Kill process**: `sudo kill -9 <PID>`

#### 4. Nginx Configuration Errors
- **Test configuration**: `sudo nginx -t`
- **Check syntax**: Review configuration file
- **Check logs**: `/var/log/nginx/error.log`

#### 5. PM2 Application Won't Start
- **Check logs**: `pm2 logs ajc-pisowifi`
- **Verify script path**: Ensure `api/server.js` exists
- **Check environment**: Verify `.env` file configuration

### Performance Optimization

#### Node.js Optimization
```bash
# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=1024"

# Enable clustering (if applicable)
pm2 start ecosystem.config.js -i max
```

#### Nginx Optimization
```nginx
# Add to nginx.conf
worker_processes auto;
worker_connections 1024;
use epoll;
multi_accept on;
```

## 📞 Support

### Getting Help
1. **Check logs**: Review application and system logs
2. **Health check**: Visit `http://your-server/health`
3. **Documentation**: Review this guide and README.md
4. **GitHub Issues**: Report problems at [GitHub Issues](https://github.com/Djnirds1984/AJC-PISOWIFI/issues)

### System Information
- **Installation Report**: Check `/var/log/ajc-pisowifi/installation-report.txt` (Linux) or `%ProgramData%\ajc-pisowifi\logs\installation-report.txt` (Windows)
- **Service Status**: Use system monitoring commands
- **Resource Usage**: Monitor CPU, memory, and disk usage

## 🔄 Updates

### System Updates
Updates can be performed through the admin dashboard:
1. Navigate to Admin Dashboard → Updater tab
2. Enter repository URL and branch
3. Monitor real-time update progress

### Manual Updates
```bash
# Linux
cd /opt/ajc-pisowifi
sudo -u pisowifi git pull origin main
sudo -u pisowifi npm install
sudo -u pisowifi npm run build
sudo -u pisowifi pm2 restart ajc-pisowifi

# Windows
cd "C:\Program Files\ajc-pisowifi"
git pull origin main
npm install
npm run build
pm2 restart ajc-pisowifi
```

---

**Congratulations!** Your AJC PISOWIFI system should now be fully operational. For additional support or customization, refer to the documentation or contact support.