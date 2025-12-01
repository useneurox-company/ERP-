@echo off
chcp 65001 >nul

cd /d "%~dp0"

set NODE_ENV=development
set PORT=5000

echo Starting server... >> server_log.txt
echo %DATE% %TIME% >> server_log.txt

call npm run dev 2>&1 >> server_log.txt

echo Server stopped >> server_log.txt

