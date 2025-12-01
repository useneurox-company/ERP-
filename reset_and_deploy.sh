#!/bin/bash
set -e

echo "🚀 Полная переустановка Emerald ERP"
echo "====================================="

cd /var/www/emerald-erp

# 1. Получить последний код
echo "📥 Обновление кода..."
git pull origin main

# 2. Пересоздать базу данных
echo "🗑️  Удаление старой базы..."
psql postgresql://emerald_user:EmeraldSecure2025!@localhost:5432/emerald_erp -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. Создать таблицы заново
echo "📊 Создание таблиц..."
node create_tables.mjs

# 4. Заполнить начальные данные
echo "🌱 Заполнение данных..."
node --import tsx server/seed.ts

# 5. Создать воронку продаж
echo "📈 Создание воронки продаж..."
psql postgresql://emerald_user:EmeraldSecure2025!@localhost:5432/emerald_erp << 'EOSQL'
INSERT INTO sales_pipelines (id, name, description, is_default, "order", created_at, updated_at)
VALUES ('default_pipeline', 'Основная воронка', 'Воронка продаж по умолчанию', true, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO deal_stages (id, pipeline_id, name, key, color, "order", created_at) VALUES
('stage_new', 'default_pipeline', 'Новые', 'new', '#6366f1', 1, NOW()),
('stage_contact', 'default_pipeline', 'Первичный контакт', 'contact', '#8b5cf6', 2, NOW()),
('stage_measurement', 'default_pipeline', 'Замер', 'measurement', '#ec4899', 3, NOW()),
('stage_calculation', 'default_pipeline', 'Расчет', 'calculation', '#f59e0b', 4, NOW()),
('stage_agreement', 'default_pipeline', 'Согласование', 'agreement', '#10b981', 5, NOW()),
('stage_production', 'default_pipeline', 'Производство', 'production', '#3b82f6', 6, NOW()),
('stage_completed', 'default_pipeline', 'Завершено', 'completed', '#22c55e', 7, NOW())
ON CONFLICT (id) DO NOTHING;
EOSQL

# 6. Исправить конфиг PM2
if [ -f ecosystem.config.js ]; then
    mv ecosystem.config.js ecosystem.config.cjs
fi

# 7. Перезапустить приложение
echo "🔄 Перезапуск приложения..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "✅ Установка завершена успешно!"
echo ""
echo "🌐 Откройте: http://147.45.146.149"
echo "👤 Логин: Admin"
echo "🔑 Пароль: Bereg2025"
echo ""
echo "📋 Проверка логов..."
sleep 3
pm2 logs --lines 20 --nostream
