// PM2 process file. Build first (`pnpm build`), then `pm2 start ecosystem.config.cjs`.
// The bot loads `.env` from the repo root itself; NODE_ENV here wins over it.
module.exports = {
  apps: [
    {
      name: "lycohana-bot",
      script: "apps/bot/dist/index.js",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      // Graceful shutdown budget. The bot caps its own shutdown at 8000 ms
      // (SHUTDOWN_TIMEOUT_MS in apps/bot/src/index.ts); keep this larger.
      kill_timeout: 10000,
      // Stop via a `shutdown` IPC message (works on Windows, which has no
      // SIGINT for PM2 to send); the bot also handles SIGINT/SIGTERM.
      shutdown_with_message: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
