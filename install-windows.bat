@echo off
REM =============================================================================
REM AJC PISOWIFI - Windows Installation Script
REM =============================================================================
REM This script performs installation of the AJC PISOWIFI system on Windows
REM =============================================================================

setlocal enabledelayedexpansion

REM Configuration Variables
set PROJECT_NAME=ajc-pisowifi
set PROJECT_DIR=%ProgramFiles%\%PROJECT_NAME%
set GITHUB_REPO=https://github.com/Djnirds1984/AJC-PISOWIFI.git
set NODE_VERSION=22.x
set APP_PORT=8080
set LOG_DIR=%ProgramData%\%PROJECT_NAME%\logs

REM Colors (using ANSI escape codes where supported)
set RED=[31m
set GREEN=[32m
set YELLOW=[33m
set BLUE=[34m
set NC=[0m

REM Logging function
:log
echo %BLUE%[%date% %time%]%NC% %~1
goto :eof

:error
echo %RED%[ERROR]%NC% %~1 >&2
goto :eof

:success
echo %GREEN%[SUCCESS]%NC% %~1
goto :eof

:warning
echo %YELLOW%[WARNING]%NC% %~1
goto :eof

REM Check if running as administrator
:check_admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    call :error "This script must be run as Administrator"
    exit /b 1
)
goto :eof

REM Install Chocolatey (if not present)
:install_chocolatey
where choco >nul 2>&1
if %errorlevel% neq 0 (
    call :log "Installing Chocolatey..."
    powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))"
    if %errorlevel% equ 0 (
        call :success "Chocolatey installed successfully"
    ) else (
        call :error "Failed to install Chocolatey"
        exit /b 1
    )
) else (
    call :log "Chocolatey is already installed"
)
goto :eof

REM Install Node.js
:install_nodejs
call :log "Installing Node.js..."
choco install nodejs --version=%NODE_VERSION% -y
if %errorlevel% equ 0 (
    call :success "Node.js installed successfully"
) else (
    call :error "Failed to install Node.js"
    exit /b 1
)
goto :eof

REM Install PM2 globally
:install_pm2
call :log "Installing PM2..."
call npm install -g pm2 tsx
if %errorlevel% equ 0 (
    call :success "PM2 installed successfully"
) else (
    call :error "Failed to install PM2"
    exit /b 1
)
goto :eof

REM Install Git
:install_git
call :log "Installing Git..."
choco install git -y
if %errorlevel% equ 0 (
    call :success "Git installed successfully"
) else (
    call :warning "Git installation failed or already exists"
)
goto :eof

REM Install SQLite
:install_sqlite
call :log "Installing SQLite..."
choco install sqlite -y
if %errorlevel% equ 0 (
    call :success "SQLite installed successfully"
) else (
    call :warning "SQLite installation failed or already exists"
)
goto :eof

REM Create project directory
:create_project_dir
call :log "Creating project directory..."
if not exist "%PROJECT_DIR%" (
    mkdir "%PROJECT_DIR%"
    if %errorlevel% equ 0 (
        call :success "Project directory created: %PROJECT_DIR%"
    ) else (
        call :error "Failed to create project directory"
        exit /b 1
    )
) else (
    call :warning "Project directory already exists: %PROJECT_DIR%"
)
goto :eof

REM Clone or update repository
:clone_repository
call :log "Cloning repository..."
cd /d "%PROJECT_DIR%"
if exist ".git" (
    call :log "Updating existing repository..."
    git pull origin main
) else (
    git clone "%GITHUB_REPO%" .
)
if %errorlevel% equ 0 (
    call :success "Repository cloned/updated successfully"
) else (
    call :error "Failed to clone/update repository"
    exit /b 1
)
goto :eof

REM Install Node.js dependencies
:install_dependencies
call :log "Installing Node.js dependencies..."
call npm install
if %errorlevel% equ 0 (
    call :success "Dependencies installed successfully"
) else (
    call :error "Failed to install dependencies"
    exit /b 1
)
goto :eof

REM Build the project
:build_project
call :log "Building the project..."
call npm run build
if %errorlevel% equ 0 (
    call :success "Project built successfully"
) else (
    call :warning "Build script not found or failed"
)
goto :eof

REM Initialize database
:init_database
call :log "Initializing database..."
call npm run init:db
if %errorlevel% equ 0 (
    call :success "Database initialized successfully"
) else (
    call :warning "Database initialization script not found or failed"
)
goto :eof

REM Create environment file
:create_env_file
call :log "Creating environment file..."
(
echo NODE_ENV=production
echo PORT=%APP_PORT%
echo JWT_SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%
echo LOG_LEVEL=info
) > .env
call :success "Environment file created"
goto :eof

REM Create PM2 ecosystem file
:create_pm2_config
call :log "Creating PM2 configuration..."
(
echo module.exports = {
echo   apps: [{
echo     name: 'ajc-pisowifi',
echo     script: 'api/server.js',
echo     cwd: '%PROJECT_DIR%',
echo     instances: 1,
echo     exec_mode: 'fork',
echo     watch: false,
echo     max_memory_restart: '500M',
echo     env: {
echo       NODE_ENV: 'production',
echo       PORT: %APP_PORT%
echo     },
echo     error_file: '%LOG_DIR%\\err.log',
echo     out_file: '%LOG_DIR%\\out.log',
echo     log_file: '%LOG_DIR%\\combined.log',
echo     time: true,
echo     autorestart: true,
echo     max_restarts: 10,
echo     min_uptime: '10s',
echo     listen_timeout: 8000,
echo     kill_timeout: 5000,
echo     restart_delay: 4000
echo   }]
echo };
) > ecosystem.config.js
call :success "PM2 configuration created"
goto :eof

REM Create log directories
:create_log_dirs
call :log "Creating log directories..."
if not exist "%LOG_DIR%" (
    mkdir "%LOG_DIR%"
    mkdir "%LOG_DIR%\\pm2"
    call :success "Log directories created"
) else (
    call :warning "Log directories already exist"
)
goto :eof

REM Start PM2 application
:start_pm2
call :log "Starting PM2 application..."
call pm2 start ecosystem.config.js
if %errorlevel% equ 0 (
    call pm2 save
    call :success "PM2 application started successfully"
) else (
    call :error "Failed to start PM2 application"
    exit /b 1
)
goto :eof

REM Setup PM2 startup
:setup_pm2_startup
call :log "Setting up PM2 startup..."
call pm2 startup
if %errorlevel% equ 0 (
    call :success "PM2 startup configured successfully"
) else (
    call :warning "PM2 startup configuration failed"
)
goto :eof

REM Configure Windows Firewall
:configure_firewall
call :log "Configuring Windows Firewall..."
netsh advfirewall firewall add rule name="AJC PISOWIFI HTTP" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="AJC PISOWIFI App" dir=in action=allow protocol=TCP localport=%APP_PORT%
if %errorlevel% equ 0 (
    call :success "Windows Firewall configured successfully"
) else (
    call :warning "Windows Firewall configuration failed or rules already exist"
)
goto :eof

REM Health check
:health_check
call :log "Performing health checks..."

REM Check Node.js
where node >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    call :success "Node.js is installed: !NODE_VERSION!"
) else (
    call :error "Node.js is not installed"
    exit /b 1
)

REM Check PM2
where pm2 >nul 2>&1
if %errorlevel% equ 0 (
    call :success "PM2 is installed"
) else (
    call :error "PM2 is not installed"
    exit /b 1
)

REM Check Git
where git >nul 2>&1
if %errorlevel% equ 0 (
    call :success "Git is installed"
) else (
    call :warning "Git is not installed"
)

REM Check project directory
if exist "%PROJECT_DIR%" (
    call :success "Project directory exists"
) else (
    call :error "Project directory does not exist"
    exit /b 1
)

call :success "All health checks passed"
goto :eof

REM Generate installation report
:generate_report
call :log "Generating installation report..."

for /f "tokens=*" %%i in ('hostname') do set HOSTNAME=%%i
for /f "tokens=*" %%i in ('ipconfig ^| findstr /R "IPv4.*[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*"') do (
    for /f "tokens=14" %%j in ("%%i") do set IP_ADDRESS=%%j
    goto :break_ip
)
:break_ip

(
echo AJC PISOWIFI Windows Installation Report
echo Generated on: %date% %time%
echo =====================================
echo.
echo System Information:
echo - Hostname: %HOSTNAME%
echo - Project Directory: %PROJECT_DIR%
echo - Node.js Version: %NODE_VERSION%
echo - Application Port: %APP_PORT%
echo.
echo Access Information:
echo - Client Portal: http://%IP_ADDRESS%:%APP_PORT%
echo - Admin Dashboard: http://%IP_ADDRESS%:%APP_PORT%/admin
echo - Default Admin Credentials: admin / admin123
echo.
echo Log Locations:
echo - Application Logs: %LOG_DIR%
echo - PM2 Logs: %LOG_DIR%\pm2
echo.
echo Next Steps:
echo 1. Verify the application is accessible via web browser
echo 2. Test GPIO functionality (if hardware is connected)
echo 3. Configure network interfaces in the admin dashboard
echo 4. Set up rates and pricing rules
echo 5. Test coin insertion and session management
echo.
echo For support, check the logs or run: pm2 status
echo.
echo Note: GPIO functionality is limited on Windows.
echo For full hardware integration, use Linux deployment.
) > "%LOG_DIR%\installation-report.txt"

call :success "Installation report generated: %LOG_DIR%\installation-report.txt"
goto :eof

REM Cleanup
:cleanup
call :log "Performing cleanup..."
call :success "Cleanup completed"
goto :eof

REM Main installation function
:main
call :log "Starting AJC PISOWIFI Windows installation..."

REM Execute installation steps
call :check_admin
call :install_chocolatey
call :install_nodejs
call :install_pm2
call :install_git
call :install_sqlite
call :create_project_dir
call :clone_repository
call :install_dependencies
call :build_project
call :init_database
call :create_env_file
call :create_pm2_config
call :create_log_dirs
call :start_pm2
call :setup_pm2_startup
call :configure_firewall
call :health_check
call :generate_report
call :cleanup

call :success "AJC PISOWIFI Windows installation completed successfully!"
call :success "Check the installation report at: %LOG_DIR%\installation-report.txt"
call :success "Access your application at: http://%IP_ADDRESS%:%APP_PORT%"
goto :eof

REM Execute main function
call :main

endlocal