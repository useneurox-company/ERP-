@echo off
chcp 65001 >nul
title Stop Emerald ERP Server

echo.
echo ==========================================
echo   STOPPING EMERALD ERP SERVER
echo ==========================================
echo.

FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5000') DO (
    echo Stopping process %%P on port 5000...
    taskkill /F /PID %%P >nul 2>&1
)

echo.
echo Server stopped.
echo.
timeout /t 3 >nul


