#!/bin/bash
set -e

echo "🚀 Emerald ERP - Автоматическое исправление"
echo "=========================================="

cd /var/www/emerald-erp

# 1. Создать воронку продаж если её нет
echo "📊 Создание воронки продаж..."
psql postgresql://emerald_user:EmeraldSecure2025!@localhost:5432/emerald_erp << 'EOSQL'
-- Создать воронку
INSERT INTO sales_pipelines (id, name, description, is_default, "order", created_at, updated_at)
VALUES ('default_pipeline', 'Основная воронка', 'Воронка продаж по умолчанию', true, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Создать этапы
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

echo "✅ Воронка создана!"

# 2. Переименовать конфиг PM2 если нужно
if [ -f ecosystem.config.js ]; then
    echo "🔧 Исправление конфига PM2..."
    mv ecosystem.config.js ecosystem.config.cjs
    echo "✅ Конфиг исправлен!"
fi

# 3. Перезапустить приложение
echo "🔄 Перезапуск приложения..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "✅ Всё исправлено!"
echo ""
echo "Откройте http://147.45.146.149 в режиме инкогнито"
echo "Логин: Admin"
echo "Пароль: Bereg2025"
echo ""
echo "Проверяем логи..."
sleep 3
pm2 logs --lines 20 --nostream
