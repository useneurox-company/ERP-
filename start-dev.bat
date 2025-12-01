@echo off
chcp 65001 >nul
set NODE_ENV=development
set PORT=5000
cd /d "%~dp0"
npm run dev


