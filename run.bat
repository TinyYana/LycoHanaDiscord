@echo off
rem Usage: run.bat          build, then start the bot (no PM2)
rem        run.bat update   git pull + install + build, then start the bot
if /I "%~1"=="update" (call pnpm bot:update || exit /b 1) else (call pnpm build || exit /b 1)
call pnpm --filter @lycohana/bot start
