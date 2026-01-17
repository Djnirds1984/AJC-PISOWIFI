#!/bin/bash

# =============================================================================
# AJC PISOWIFI - Comprehensive Installation Script
# =============================================================================
# This script performs a complete installation of the AJC PISOWIFI system
# including system dependencies, Nginx, PM2, and project deployment
# =============================================================================

set -euo pipefail

# Configuration Variables
PROJECT_NAME="ajc-pisowifi"
PROJECT_USER="pisowifi"
PROJECT_DIR="/opt/$PROJECT_NAME"
GITHUB_REPO="https://github.com/Djnirds1984/AJC-PISOWIFI.git"
NODE_VERSION="22.x"
NGINX_PORT=80
APP_PORT=8080
LOG_DIR="/var/log/$PROJECT_NAME"
BACKUP_DIR="/opt/$PROJECT_NAME-backup"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root or with sudo"
        exit 1
    fi
}

# Detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        error "Cannot detect OS version"
        exit 1
    fi
    log "Detected OS: $OS $VERSION"
}

# Create project user
create_user() {
    log "Creating project user: $PROJECT_USER"
    if ! id "$PROJECT_USER" &>/dev/null; then
        useradd -r -s /bin/bash -d "$PROJECT_DIR" -m "$PROJECT_USER"
        success "User $PROJECT_USER created successfully"
    else
        warning "User $PROJECT_USER already exists"
    fi
}

# System update and essential packages
setup_system() {
    log "Updating system packages..."
    
    case $OS in
        ubuntu|debian)
            apt-get update -y
            apt-get upgrade -y
            apt-get install -y \
                curl wget git build-essential python3 python3-pip \
                software-properties-common apt-transport-https ca-certificates \
                gnupg lsb-release nginx sqlite3 libsqlite3-dev \
                ufw fail2ban logrotate cron
            ;;
        centos|rhel|fedora)
            yum update -y
            yum groupinstall -y "Development Tools"
            yum install -y \
                curl wget git python3 python3-pip \
                nginx sqlite sqlite-devel \
                firewalld fail2ban logrotate cronie
            ;;
        *)
            error "Unsupported OS: $OS"
            exit 1
            ;;
    esac
    
    success "System packages updated and essential tools installed"
}

# Install Node.js
install_nodejs() {
    log "Installing Node.js $NODE_VERSION..."
    
    case $OS in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION | bash -
            apt-get install -y nodejs
            ;;
        centos|rhel|fedora)
            curl -fsSL https://rpm.nodesource.com/setup_$NODE_VERSION | bash -
            yum install -y nodejs
            ;;
    esac
    
    # Install global npm packages
    npm install -g npm@latest pm2 tsx
    
    success "Node.js and PM2 installed successfully"
}

# Install and configure Nginx
setup_nginx() {
    log "Configuring Nginx..."
    
    # Create Nginx configuration directories
    mkdir -p /etc/nginx/sites-available
    mkdir -p /etc/nginx/sites-enabled
    mkdir -p /var/log/nginx/$PROJECT_NAME
    
    # Backup original nginx.conf
    if [[ -f /etc/nginx/nginx.conf ]]; then
        cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    fi
    
    # Create optimized nginx.conf
    cat > /etc/nginx/nginx.conf << 'EOF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Performance
    client_max_body_size 16M;
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;

    # Gzip Settings
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Virtual Host Configs
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF

    # Create Nginx site configuration
    cat > /etc/nginx/sites-available/$PROJECT_NAME << EOF
server {
    listen $NGINX_PORT;
    listen [::]:$NGINX_PORT;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logging
    access_log /var/log/nginx/$PROJECT_NAME/access.log;
    error_log /var/log/nginx/$PROJECT_NAME/error.log;

    # Client Max Body Size
    client_max_body_size 16M;

    # Proxy settings
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    # Timeout settings
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";

    # Main application
    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_buffering off;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

    # Enable the site
    ln -sf /etc/nginx/sites-available/$PROJECT_NAME /etc/nginx/sites-enabled/
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    success "Nginx configured successfully"
}

# Setup PM2
setup_pm2() {
    log "Setting up PM2..."
    
    # Create PM2 ecosystem file
    cat > "$PROJECT_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [{
    name: 'ajc-pisowifi',
    script: 'api/server.js',
    cwd: '/opt/ajc-pisowifi',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: '/var/log/ajc-pisowifi/err.log',
    out_file: '/var/log/ajc-pisowifi/out.log',
    log_file: '/var/log/ajc-pisowifi/combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    listen_timeout: 8000,
    kill_timeout: 5000,
    restart_delay: 4000
  }]
};
EOF

    # Setup PM2 startup
    pm2 startup systemd -u $PROJECT_USER --hp "$PROJECT_DIR" > /tmp/pm2-startup.sh
    bash /tmp/pm2-startup.sh
    rm /tmp/pm2-startup.sh
    
    success "PM2 configured successfully"
}

# Deploy project
deploy_project() {
    log "Deploying AJC PISOWIFI project..."
    
    # Create project directory
    mkdir -p "$PROJECT_DIR"
    chown $PROJECT_USER:$PROJECT_USER "$PROJECT_DIR"
    
    # Clone or update repository
    if [[ -d "$PROJECT_DIR/.git" ]]; then
        log "Updating existing repository..."
        cd "$PROJECT_DIR"
        sudo -u $PROJECT_USER git pull origin main
    else
        log "Cloning repository..."
        sudo -u $PROJECT_USER git clone "$GITHUB_REPO" "$PROJECT_DIR"
        cd "$PROJECT_DIR"
    fi
    
    # Create backup if directory exists
    if [[ -d "$PROJECT_DIR" ]] && [[ -n "$(ls -A "$PROJECT_DIR" 2>/dev/null)" ]]; then
        log "Creating backup of existing installation..."
        mv "$PROJECT_DIR" "$BACKUP_DIR-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$PROJECT_DIR"
        chown $PROJECT_USER:$PROJECT_USER "$PROJECT_DIR"
    fi
    
    # Clone repository
    log "Cloning repository from $GITHUB_REPO..."
    sudo -u $PROJECT_USER git clone "$GITHUB_REPO" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    
    # Install Node.js dependencies
    log "Installing Node.js dependencies..."
    sudo -u $PROJECT_USER npm install --production
    
    # Build the project
    log "Building the project..."
    sudo -u $PROJECT_USER npm run build || warning "Build script not found or failed"
    
    # Initialize database
    log "Initializing database..."
    sudo -u $PROJECT_USER npm run init:db || warning "Database initialization script not found"
    
    # Create environment file
    cat > "$PROJECT_DIR/.env" << EOF
NODE_ENV=production
PORT=$APP_PORT
JWT_SECRET=$(openssl rand -base64 32)
LOG_LEVEL=info
EOF
    
    chown $PROJECT_USER:$PROJECT_USER "$PROJECT_DIR/.env"
    chmod 600 "$PROJECT_DIR/.env"
    
    success "Project deployed successfully"
}

# Setup logging
setup_logging() {
    log "Setting up logging..."
    
    # Create log directories
    mkdir -p "$LOG_DIR"
    mkdir -p "$LOG_DIR/pm2"
    mkdir -p "$LOG_DIR/nginx"
    
    chown -R $PROJECT_USER:$PROJECT_USER "$LOG_DIR"
    
    # Configure logrotate
    cat > /etc/logrotate.d/$PROJECT_NAME << EOF
$LOG_DIR/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $PROJECT_USER $PROJECT_USER
    postrotate
        pm2 reloadLogs
        systemctl reload nginx
    endscript
}
EOF

    # Configure nginx logrotate
    cat > /etc/logrotate.d/nginx-pisowifi << EOF
/var/log/nginx/$PROJECT_NAME/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}
EOF

    success "Logging configured successfully"
}

# Setup firewall
setup_firewall() {
    log "Configuring firewall..."
    
    case $OS in
        ubuntu|debian)
            ufw allow $NGINX_PORT/tcp
            ufw allow $APP_PORT/tcp
            ufw --force enable
            ;;
        centos|rhel|fedora)
            systemctl enable firewalld
            systemctl start firewalld
            firewall-cmd --permanent --add-port=$NGINX_PORT/tcp
            firewall-cmd --permanent --add-port=$APP_PORT/tcp
            firewall-cmd --reload
            ;;
    esac
    
    success "Firewall configured successfully"
}

# Health checks
health_check() {
    log "Performing health checks..."
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        success "Node.js is installed: $NODE_VERSION"
    else
        error "Node.js is not installed"
        return 1
    fi
    
    # Check PM2
    if command -v pm2 &> /dev/null; then
        success "PM2 is installed"
    else
        error "PM2 is not installed"
        return 1
    fi
    
    # Check Nginx
    if command -v nginx &> /dev/null; then
        success "Nginx is installed"
    else
        error "Nginx is not installed"
        return 1
    fi
    
    # Test Nginx configuration
    if nginx -t &> /dev/null; then
        success "Nginx configuration is valid"
    else
        error "Nginx configuration test failed"
        nginx -t
        return 1
    fi
    
    # Check project directory
    if [[ -d "$PROJECT_DIR" ]]; then
        success "Project directory exists"
    else
        error "Project directory does not exist"
        return 1
    fi
    
    success "All health checks passed"
}

# Start services
start_services() {
    log "Starting services..."
    
    # Start Nginx
    systemctl enable nginx
    systemctl start nginx
    
    # Start PM2 application
    cd "$PROJECT_DIR"
    sudo -u $PROJECT_USER pm2 start ecosystem.config.js
    sudo -u $PROJECT_USER pm2 save
    
    success "Services started successfully"
}

# Generate installation report
generate_report() {
    log "Generating installation report..."
    
    cat > "$LOG_DIR/installation-report.txt" << EOF
AJC PISOWIFI Installation Report
Generated on: $(date)
=====================================

System Information:
- OS: $OS $VERSION
- Project Directory: $PROJECT_DIR
- Project User: $PROJECT_USER
- Node.js Version: $(node --version)
- Nginx Port: $NGINX_PORT
- Application Port: $APP_PORT

Installed Services:
- Nginx: $(systemctl is-active nginx)
- PM2: $(systemctl is-active pm2-$PROJECT_USER)

Access Information:
- Client Portal: http://$(hostname -I | awk '{print $1}')
- Admin Dashboard: http://$(hostname -I | awk '{print $1}')/admin
- Default Admin Credentials: admin / admin123

Log Locations:
- Application Logs: $LOG_DIR
- Nginx Logs: /var/log/nginx/$PROJECT_NAME
- PM2 Logs: $LOG_DIR/pm2

Health Status: $(health_check && echo "HEALTHY" || echo "UNHEALTHY")

Next Steps:
1. Verify the application is accessible via web browser
2. Test GPIO functionality (if hardware is connected)
3. Configure network interfaces in the admin dashboard
4. Set up rates and pricing rules
5. Test coin insertion and session management

For support, check the logs or run: systemctl status nginx
EOF

    success "Installation report generated: $LOG_DIR/installation-report.txt"
}

# Cleanup function
cleanup() {
    log "Performing cleanup..."
    
    # Remove temporary files
    rm -f /tmp/pm2-startup.sh
    
    # Clear package cache
    case $OS in
        ubuntu|debian)
            apt-get autoremove -y
            apt-get autoclean
            ;;
        centos|rhel|fedora)
            yum autoremove -y
            yum clean all
            ;;
    esac
    
    success "Cleanup completed"
}

# Main installation function
main() {
    log "Starting AJC PISOWIFI installation..."
    
    # Check prerequisites
    check_root
    detect_os
    
    # Create backup of existing installation
    if [[ -d "$PROJECT_DIR" ]]; then
        warning "Existing installation found. Creating backup..."
        mv "$PROJECT_DIR" "$BACKUP_DIR-$(date +%Y%m%d-%H%M%S)"
    fi
    
    # Execute installation steps
    create_user
    setup_system
    install_nodejs
    setup_nginx
    setup_logging
    deploy_project
    setup_pm2
    setup_firewall
    
    # Final steps
    health_check
    start_services
    generate_report
    cleanup
    
    success "AJC PISOWIFI installation completed successfully!"
    success "Check the installation report at: $LOG_DIR/installation-report.txt"
    success "Access your application at: http://$(hostname -I | awk '{print $1}')"
}

# Error handling
trap 'error "Installation failed on line $LINENO. Check logs for details."' ERR

# Execute main function
main "$@"