#!/bin/bash
set -e

echo "🔧 Исправление timestamp полей для PostgreSQL..."

# Изменить все timestamp поля с TEXT на TIMESTAMP
psql postgresql://emerald_user:EmeraldSecure2025!@localhost:5432/emerald_erp << 'EOSQL'
-- Изменить тип всех timestamp колонок
-- Конвертируем unix timestamp (секунды) в TIMESTAMP

ALTER TABLE roles ALTER COLUMN created_at TYPE TIMESTAMP USING to_timestamp(CAST(created_at AS BIGINT));
ALTER TABLE roles ALTER COLUMN updated_at TYPE TIMESTAMP USING to_timestamp(CAST(updated_at AS BIGINT));

ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMP USING to_timestamp(CAST(created_at AS BIGINT));
ALTER TABLE users ALTER COLUMN updated_at TYPE TIMESTAMP USING to_timestamp(CAST(updated_at AS BIGINT));

ALTER TABLE role_permissions ALTER COLUMN created_at TYPE TIMESTAMP USING to_timestamp(CAST(created_at AS BIGINT));
ALTER TABLE role_permissions ALTER COLUMN updated_at TYPE TIMESTAMP USING to_timestamp(CAST(updated_at AS BIGINT));

ALTER TABLE sales_pipelines ALTER COLUMN created_at TYPE TIMESTAMP USING to_timestamp(CAST(created_at AS BIGINT));
ALTER TABLE sales_pipelines ALTER COLUMN updated_at TYPE TIMESTAMP USING to_timestamp(CAST(updated_at AS BIGINT));

ALTER TABLE deal_stages ALTER COLUMN created_at TYPE TIMESTAMP USING to_timestamp(CAST(created_at AS BIGINT));

ALTER TABLE deals ALTER COLUMN created_at TYPE TIMESTAMP USING to_timestamp(CAST(created_at AS BIGINT));
ALTER TABLE deals ALTER COLUMN updated_at TYPE TIMESTAMP USING to_timestamp(CAST(updated_at AS BIGINT));
ALTER TABLE deals ALTER COLUMN deadline TYPE TIMESTAMP USING CASE WHEN deadline IS NOT NULL THEN to_timestamp(CAST(deadline AS BIGINT)) ELSE NULL END;

ALTER TABLE projects ALTER COLUMN created_at TYPE TIMESTAMP USING to_timestamp(CAST(created_at AS BIGINT));
ALTER TABLE projects ALTER COLUMN updated_at TYPE TIMESTAMP USING to_timestamp(CAST(updated_at AS BIGINT));
ALTER TABLE projects ALTER COLUMN started_at TYPE TIMESTAMP USING CASE WHEN started_at IS NOT NULL THEN to_timestamp(CAST(started_at AS BIGINT)) ELSE NULL END;

ALTER TABLE project_items ALTER COLUMN created_at TYPE TIMESTAMP USING to_timestamp(CAST(created_at AS BIGINT));
ALTER TABLE project_items ALTER COLUMN updated_at TYPE TIMESTAMP USING to_timestamp(CAST(updated_at AS BIGINT));

ALTER TABLE warehouse_items ALTER COLUMN created_at TYPE TIMESTAMP USING to_timestamp(CAST(created_at AS BIGINT));
ALTER TABLE warehouse_items ALTER COLUMN updated_at TYPE TIMESTAMP USING to_timestamp(CAST(updated_at AS BIGINT));

-- Добавить defaults для новых записей
ALTER TABLE roles ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE roles ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE projects ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE projects ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE warehouse_items ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE warehouse_items ALTER COLUMN updated_at SET DEFAULT NOW();

EOSQL

echo "✅ Timestamp поля исправлены!"
echo "Теперь PostgreSQL правильно обрабатывает даты"
