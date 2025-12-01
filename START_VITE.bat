@echo off
chcp 65001 >nul
title Emerald ERP - Vite Frontend

echo.
echo ==========================================
echo   EMERALD ERP - VITE DEV SERVER
echo ==========================================
echo.
echo Starting Vite on http://localhost:5173
echo.
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0"
npx vite

pause
