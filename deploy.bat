@echo off
echo ============================================
echo   Emerald ERP - Deploy to Production
echo ============================================
echo.

REM 1. Создание архива (исключая node_modules, .local, .git)
echo [1/6] Creating deployment archive...
tar --exclude=node_modules --exclude=.local --exclude=.git --exclude=dist --exclude=*.log -czf deploy.tar.gz *

if errorlevel 1 (
    echo ERROR: Failed to create archive
    exit /b 1
)
echo [OK] Archive created

REM 2. Копирование на сервер
echo.
echo [2/6] Uploading to server...
scp -i ".ssh\deploy_key" -o StrictHostKeyChecking=no deploy.tar.gz root@147.45.146.149:/tmp/

if errorlevel 1 (
    echo ERROR: Failed to upload to server
    del deploy.tar.gz
    exit /b 1
)
echo [OK] Uploaded

REM 3. Создание резервной копии базы данных
echo.
echo [3/7] Creating database backup...
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "bash /var/www/emerald-erp/backup-database.sh 2>/dev/null || echo 'Backup script not found, skipping backup'"

REM 4. Извлечение и установка на сервере
echo.
echo [4/7] Extracting files on server...
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "cd /var/www/emerald-erp && tar -xzf /tmp/deploy.tar.gz && rm /tmp/deploy.tar.gz"

if errorlevel 1 (
    echo ERROR: Failed to extract files
    del deploy.tar.gz
    exit /b 1
)
echo [OK] Files extracted

REM 5. Установка зависимостей
echo.
echo [5/7] Installing dependencies...
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "cd /var/www/emerald-erp && npm install --omit=dev"

if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    del deploy.tar.gz
    exit /b 1
)
echo [OK] Dependencies installed

REM 6. Сборка проекта
echo.
echo [6/7] Building project...
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "cd /var/www/emerald-erp && npm install && npm run build"

if errorlevel 1 (
    echo ERROR: Failed to build project
    del deploy.tar.gz
    exit /b 1
)
echo [OK] Project built

REM 7. Перезапуск PM2
echo.
echo [7/7] Restarting application...
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "cd /var/www/emerald-erp && pm2 restart all"

if errorlevel 1 (
    echo ERROR: Failed to restart application
    del deploy.tar.gz
    exit /b 1
)
echo [OK] Application restarted

REM Очистка
del deploy.tar.gz

echo.
echo ============================================
echo   Deployment completed successfully!
echo ============================================
echo   URL: http://emrfd.ru
echo   Database: PostgreSQL (preserved)
echo   Login: Admin / Bereg2025
echo ============================================
echo.