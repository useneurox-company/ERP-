@echo off
echo ================================================
echo      EMERALD ERP - QUICK DEPLOYMENT
echo ================================================
echo.
echo Сейчас начнется автоматический деплой на сервер.
echo.
echo Выполняю подключение к серверу и деплой...
echo.

powershell -Command "ssh root@147.45.146.149 'cd /root && wget -q https://raw.githubusercontent.com/NX-company/Emerald-ERP-/main/deploy-initial.sh && chmod +x deploy-initial.sh && ./deploy-initial.sh'"

echo.
echo ================================================
echo ДЕПЛОЙ ЗАВЕРШЕН!
echo ================================================
echo.
echo Приложение доступно: http://147.45.146.149
echo.
echo Логин: Admin
echo Пароль: Bereg2025
echo.
pause