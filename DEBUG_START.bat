@echo off
chcp 65001 >nul

cd /d "%~dp0"

set NODE_ENV=development
set PORT=5000

echo ========================================
echo DEBUG: Running server with full output
echo ========================================
echo.

node node_modules\tsx\dist\cli.mjs server/index.ts 2>&1

echo.
echo ========================================
echo Server stopped - Exit code: %ERRORLEVEL%
echo ========================================
pause

