#!/bin/bash
set -e

echo "====================================="
echo "  Emerald ERP Production Deployment"
echo "====================================="

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода статуса
log_status() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Обновление системы
echo -e "\n${YELLOW}[1/12]${NC} Обновление системы..."
apt-get update -qq
apt-get upgrade -y -qq
log_status "Система обновлена"

# 2. Установка базовых утилит
echo -e "\n${YELLOW}[2/12]${NC} Установка базовых утилит..."
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx \
    postgresql postgresql-contrib build-essential ufw fail2ban
log_status "Базовые утилиты установлены"

# 3. Установка Node.js 20
echo -e "\n${YELLOW}[3/12]${NC} Установка Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    log_status "Node.js $(node -v) установлен"
else
    log_status "Node.js уже установлен: $(node -v)"
fi

# 4. Установка PM2
echo -e "\n${YELLOW}[4/12]${NC} Установка PM2..."
npm install -g pm2 --quiet
log_status "PM2 установлен"

# 5. Настройка PostgreSQL
echo -e "\n${YELLOW}[5/12]${NC} Настройка PostgreSQL..."

# Генерация случайного пароля
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
echo "DB_PASSWORD=$DB_PASSWORD" > /root/.emerald_db_credentials

# Создание базы данных и пользователя
sudo -u postgres psql << EOF
-- Проверка и создание базы данных
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'emerald_erp') THEN
        CREATE DATABASE emerald_erp;
    END IF;
END
\$\$;

-- Проверка и создание пользователя
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'emerald_user') THEN
        CREATE USER emerald_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- Предоставление прав
GRANT ALL PRIVILEGES ON DATABASE emerald_erp TO emerald_user;
\c emerald_erp
GRANT ALL ON SCHEMA public TO emerald_user;
EOF

log_status "PostgreSQL настроен (пароль сохранен в /root/.emerald_db_credentials)"

# 6. Создание директории проекта
echo -e "\n${YELLOW}[6/12]${NC} Подготовка директории проекта..."
mkdir -p /var/www/emerald-erp
cd /var/www/emerald-erp

# 7. Клонирование репозитория
echo -e "\n${YELLOW}[7/12]${NC} Клонирование репозитория..."
if [ ! -d ".git" ]; then
    git clone https://github.com/NX-company/Emerald-ERP-.git .
    log_status "Репозиторий клонирован"
else
    git pull origin main
    log_status "Репозиторий обновлен"
fi

# 8. Создание .env файла
echo -e "\n${YELLOW}[8/12]${NC} Создание конфигурации..."
SESSION_SECRET=$(openssl rand -hex 32)
cat > .env << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://emerald_user:${DB_PASSWORD}@localhost:5432/emerald_erp
SESSION_SECRET=${SESSION_SECRET}
ALLOWED_ORIGINS=http://147.45.146.149,https://147.45.146.149
UPLOAD_DIR=/var/www/emerald-erp/attached_assets
LOG_LEVEL=info
EOF

# Создание директории для загруженных файлов
mkdir -p /var/www/emerald-erp/attached_assets
chown -R www-data:www-data /var/www/emerald-erp/attached_assets

log_status "Конфигурация создана"

# 9. Установка зависимостей и сборка
echo -e "\n${YELLOW}[9/12]${NC} Установка зависимостей..."
npm install --production=false --quiet
log_status "Зависимости установлены"

echo -e "\n${YELLOW}[10/12]${NC} Сборка приложения..."
npm run build
log_status "Приложение собрано"

# 10. Запуск миграций
echo -e "\n${YELLOW}[11/12]${NC} Миграция базы данных..."
npm run db:push || log_warning "Миграция может требовать ручной настройки"

# 11. Создание администратора через seed
echo -e "\n${YELLOW}[12/12]${NC} Создание администратора..."
npm run seed || log_warning "Создание администратора может требовать ручной настройки"

# 12. Настройка Nginx
echo -e "\n${YELLOW}Настройка Nginx...${NC}"
cat > /etc/nginx/sites-available/emerald-erp << 'NGINX_CONF'
upstream emerald_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Максимальный размер загружаемых файлов
    client_max_body_size 500M;

    # Логи
    access_log /var/log/nginx/emerald-erp-access.log;
    error_log /var/log/nginx/emerald-erp-error.log;

    # Статические файлы
    location /attached_assets/ {
        alias /var/www/emerald-erp/attached_assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API с ограничением частоты запросов
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://emerald_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Основное приложение
    location / {
        proxy_pass http://emerald_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Безопасность
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
NGINX_CONF

# Удаление default конфига если есть
rm -f /etc/nginx/sites-enabled/default

# Активация конфигурации
ln -sf /etc/nginx/sites-available/emerald-erp /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
log_status "Nginx настроен"

# 13. Запуск приложения через PM2
echo -e "\n${YELLOW}Запуск приложения...${NC}"
pm2 delete emerald-erp 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root
log_status "Приложение запущено через PM2"

# 14. Настройка файрвола
echo -e "\n${YELLOW}Настройка файрвола...${NC}"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
log_status "Файрвол настроен"

# 15. Настройка fail2ban
echo -e "\n${YELLOW}Настройка fail2ban...${NC}"
systemctl enable fail2ban
systemctl start fail2ban
log_status "Fail2ban активирован"

# 16. Создание скрипта резервного копирования
echo -e "\n${YELLOW}Настройка резервного копирования...${NC}"
cat > /root/backup-emerald.sh << 'BACKUP_SCRIPT'
#!/bin/bash
BACKUP_DIR="/var/backups/emerald-erp"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Чтение пароля из файла
source /root/.emerald_db_credentials

# Бэкап PostgreSQL
PGPASSWORD=$DB_PASSWORD pg_dump -U emerald_user -h localhost emerald_erp | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Бэкап файлов
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /var/www/emerald-erp/attached_assets/

# Удаление старых бэкапов (старше 30 дней)
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
BACKUP_SCRIPT

chmod +x /root/backup-emerald.sh

# Добавление в crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup-emerald.sh >> /var/log/emerald-backup.log 2>&1") | crontab -
log_status "Резервное копирование настроено"

# Финальная информация
echo -e "\n${GREEN}====================================="
echo "  Развертывание завершено успешно!"
echo "=====================================${NC}"
echo ""
echo "📊 Информация о системе:"
echo "------------------------"
echo "🌐 URL: http://147.45.146.149"
echo "📂 Директория: /var/www/emerald-erp"
echo "🔐 Пароль БД сохранен в: /root/.emerald_db_credentials"
echo ""
echo "👤 Администратор системы:"
echo "  Логин: beregovoy"
echo "  Имя: Береговой Максим"
echo "  Пароль: будет установлен при первом seed"
echo ""
echo "📝 Полезные команды:"
echo "  pm2 status           - статус приложения"
echo "  pm2 logs             - логи приложения"
echo "  pm2 restart all      - перезапуск"
echo "  pm2 monit            - мониторинг"
echo "  /root/backup-emerald.sh - ручной бэкап"
echo ""
echo -e "${YELLOW}⚠ ВАЖНО:${NC}"
echo "1. Смените SSH пароль командой: passwd"
echo "2. Настройте SSH ключи для безопасности"
echo "3. Обновите пароль администратора в системе"
echo "4. При наличии домена настройте SSL через:"
echo "   certbot --nginx -d your-domain.com"
echo ""
echo -e "${GREEN}✅ Система готова к работе!${NC}"