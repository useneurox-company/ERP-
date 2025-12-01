module.exports = {
  apps: [{
    name: 'emerald-erp',
    script: './dist/index.js',
    instances: 2, // Фиксированное количество инстансов (стабильнее чем 'max')
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/emerald-erp-error.log',
    out_file: '/var/log/pm2/emerald-erp-out.log',
    log_file: '/var/log/pm2/emerald-erp-combined.log',
    time: true,
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
    max_restarts: 3, // Уменьшено до 3 (если падает 3 раза - проблема серьезная)
    min_uptime: '10s',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Health check таймауты
    listen_timeout: 10000, // Ждать 10 секунд пока приложение запустится
    kill_timeout: 5000 // Ждать 5 секунд для graceful shutdown
  }]
};