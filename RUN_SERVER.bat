@echo off
chcp 65001 >nul
title Emerald ERP Server - Port 5000

cd /d "%~dp0"

echo.
echo ==========================================
echo   EMERALD ERP DEVELOPMENT SERVER
echo ==========================================
echo.
echo Starting server on port 5000...
echo.

set NODE_ENV=development
set PORT=5000

call npm run dev

if errorlevel 1 (
    echo.
    echo ERROR: Server failed to start
    echo Check the error messages above
    pause
)

