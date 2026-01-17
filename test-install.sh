#!/bin/bash

# Test script to verify installation readiness
# This script checks if the system is ready for AJC PISOWIFI installation

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}AJC PISOWIFI Installation Test${NC}"
echo "================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}❌ This script must be run as root or with sudo${NC}"
    exit 1
fi

# Detect OS
if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
    echo -e "${GREEN}✓ Detected OS: $OS $VERSION${NC}"
else
    echo -e "${RED}❌ Cannot detect OS version${NC}"
    exit 1
fi

# Check internet connectivity
echo -n "Testing internet connectivity... "
if ping -c 1 google.com &> /dev/null; then
    echo -e "${GREEN}✓ Connected${NC}"
else
    echo -e "${RED}❌ No internet connection${NC}"
    exit 1
fi

# Check available disk space
echo -n "Checking disk space... "
AVAILABLE_SPACE=$(df / | tail -1 | awk '{print $4}')
if [[ $AVAILABLE_SPACE -gt 1000000 ]]; then  # 1GB in KB
    echo -e "${GREEN}✓ Sufficient disk space${NC}"
else
    echo -e "${YELLOW}⚠ Low disk space (less than 1GB)${NC}"
fi

# Check if Node.js is available in repositories
echo -n "Checking Node.js availability... "
case $OS in
    ubuntu|debian)
        if apt-cache search nodejs | grep -q "nodejs"; then
            echo -e "${GREEN}✓ Node.js available in repositories${NC}"
        else
            echo -e "${YELLOW}⚠ Node.js not found in repositories, will use NodeSource${NC}"
        fi
        ;;
    centos|rhel|fedora)
        if yum list available nodejs &> /dev/null; then
            echo -e "${GREEN}✓ Node.js available in repositories${NC}"
        else
            echo -e "${YELLOW}⚠ Node.js not found in repositories, will use NodeSource${NC}"
        fi
        ;;
esac

# Check if required packages are available
echo -n "Checking essential packages... "
case $OS in
    ubuntu|debian)
        MISSING_PACKAGES=""
        for pkg in curl wget git build-essential nginx sqlite3; do
            if ! apt-cache search ^$pkg$ | grep -q "^$pkg$"; then
                MISSING_PACKAGES="$MISSING_PACKAGES $pkg"
            fi
        done
        if [[ -z "$MISSING_PACKAGES" ]]; then
            echo -e "${GREEN}✓ All essential packages available${NC}"
        else
            echo -e "${YELLOW}⚠ Missing packages:$MISSING_PACKAGES${NC}"
        fi
        ;;
esac

# Check if ports are available
echo -n "Checking port availability... "
if ! netstat -tlnp | grep -q ":80 "; then
    echo -e "${GREEN}✓ Port 80 available${NC}"
else
    echo -e "${YELLOW}⚠ Port 80 is already in use${NC}"
fi

if ! netstat -tlnp | grep -q ":8080 "; then
    echo -e "${GREEN}✓ Port 8080 available${NC}"
else
    echo -e "${YELLOW}⚠ Port 8080 is already in use${NC}"
fi

# Check GitHub connectivity
echo -n "Testing GitHub connectivity... "
if curl -s --max-time 10 https://github.com/Djnirds1984/AJC-PISOWIFI.git > /dev/null; then
    echo -e "${GREEN}✓ GitHub repository accessible${NC}"
else
    echo -e "${YELLOW}⚠ GitHub repository not accessible (timeout or network issue)${NC}"
fi

echo ""
echo -e "${YELLOW}Installation Test Complete${NC}"
echo "================================="
echo -e "${GREEN}✓ System appears ready for installation${NC}"
echo ""
echo "You can now run: sudo ./install.sh"
echo ""
echo "Note: The installation script has been updated to handle:"
echo "- Debian 13 (trixie) compatibility issues"
echo "- Node.js v22+ compatibility"
echo "- ES6 module support"
echo "- Enhanced error handling"