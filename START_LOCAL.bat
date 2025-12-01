@echo off
chcp 65001 >nul
title Emerald ERP - Local Server

echo.
echo ==========================================
echo   EMERALD ERP - LOCAL SERVER
echo ==========================================
echo.
echo Starting server on http://localhost:5000
echo.
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0"
set NODE_ENV=development
set PORT=5000

npm run dev


