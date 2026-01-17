export default {
  apps: [
    {
      name: 'ajc-pisowifi',
      script: 'api/server.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx/esm',
      cwd: '/opt/ajc-pisowifi',
      env: {
        NODE_ENV: 'production',
        PORT: '8080',
        JWT_SECRET: 'ajc-pisowifi-secret-key',
        GPIO_PIN: '3',
        MOCK_MODE: 'false'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '8080',
        JWT_SECRET: 'ajc-pisowifi-secret-key',
        GPIO_PIN: '3',
        MOCK_MODE: 'false'
      },
      log_file: '/var/log/ajc-pisowifi.log',
      out_file: '/var/log/ajc-pisowifi-out.log',
      error_file: '/var/log/ajc-pisowifi-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      restart_delay: 4000,
      watch: false,
      autorestart: true,
      kill_timeout: 5000,
      listen_timeout: 8000,
      shutdown_with_message: true
    }
  ]
};