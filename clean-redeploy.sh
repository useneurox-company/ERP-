#!/bin/bash
set -e

echo "🔥 ПОЛНАЯ ОЧИСТКА И ПЕРЕУСТАНОВКА EMERALD ERP"
echo "================================================"

# Stop PM2
echo "⏹️  Останавливаем PM2..."
pm2 stop emerald-erp || true
pm2 delete emerald-erp || true

# Backup .env
echo "💾 Бэкап .env файла..."
cp .env .env.backup

# Clean EVERYTHING
echo "🗑️  Удаляем все старые файлы..."
rm -rf dist/
rm -rf node_modules/
rm -rf .vite/
rm -rf client/.vite/
rm -rf client/node_modules/

# Fresh install
echo "📦 Свежая установка зависимостей..."
npm ci

# Clean build
echo "🔨 Чистая сборка приложения..."
NODE_ENV=production npm run build

# Check build result
echo "✅ Проверка результата сборки..."
ls -lh dist/public/assets/*.js
echo ""
cat dist/public/index.html | grep script

# Start PM2
echo "🚀 Запуск PM2..."
pm2 start ecosystem.config.js
pm2 save

# Wait
echo "⏳ Ждём 10 секунд..."
sleep 10

# Health check
echo "🏥 Проверка здоровья..."
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "✅ Приложение работает!"
  pm2 status
else
  echo "❌ Приложение не запустилось!"
  pm2 logs --lines 20
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ПЕРЕУСТАНОВКА ЗАВЕРШЕНА!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
