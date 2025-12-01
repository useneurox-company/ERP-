@echo off
chcp 65001 >nul
cd /d "%USERPROFILE%\Desktop\Emerald ERP"

echo ========================================
echo  Emerald ERP - Quick Start
echo ========================================
echo.

REM Check if .env file exists
if not exist .env (
    echo WARNING: .env file not found
    echo.
    echo Creating temporary .env file...
    echo DATABASE_URL=postgresql://user:password@localhost:5432/emerald_erp > .env
    echo NODE_ENV=development >> .env
    echo PORT=5000 >> .env
    echo SESSION_SECRET=dev-secret-key >> .env
    echo.
    echo NOTE: You need to set a valid DATABASE_URL in .env file
    echo See SETUP_INSTRUCTIONS.txt for details
    echo.
    echo Attempting to start with placeholder DATABASE_URL...
    timeout /t 3 /nobreak >nul
)

set NODE_ENV=development
set PORT=5000
echo Starting server on port 5000...
echo Open: http://localhost:5000
echo.
call npm run dev

