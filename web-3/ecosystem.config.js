module.exports = {
  apps: [
    {
      name: 'tokyo-apartment-finder',
      script: 'npm',
      args: 'start',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      max_memory_restart: '1G',
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000,
      // Health check
      min_uptime: '10s',
      max_restarts: 10,
      // Monitoring
      instances_var: 'INSTANCE_ID',
      merge_logs: true,
      // Auto restart on file changes (disable in production)
      watch: false,
      ignore_watch: ['node_modules', '.next', 'logs', '.git'],
      // Environment specific settings
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
      },
    },
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/tokyo-apartment-finder.git',
      path: '/var/www/tokyo-apartment-finder',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
  },
};