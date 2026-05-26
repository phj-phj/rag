// pm2 进程管理配置
// 用法：pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'papier-api',
      script: './dist/app.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      // 日志
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/papier-error.log',
      out_file: './logs/papier-out.log',
      // 自动重启
      max_memory_restart: '500M',
      // 优雅关闭
      kill_timeout: 5000,
      listen_timeout: 5000,
    },
  ],
}
