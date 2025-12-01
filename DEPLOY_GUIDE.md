# 🚀 ИНСТРУКЦИЯ ПО РАЗВЕРТЫВАНИЮ ВСЕХ ПРИЛОЖЕНИЙ

## 📋 АРХИТЕКТУРА СЕРВЕРА 147.45.146.149

```
ОДИН СЕРВЕР с тремя приложениями:
│
├─ emrld.ru (главный домен)
│  ├─ Порт: 3000
│  ├─ Папка: /var/www/emerald-website
│  ├─ PM2: emerald-website
│  └─ Express.js + статический сайт
│
├─ app.emrld.ru (production ERP)
│  ├─ Порт: 5000
│  ├─ Папка: /var/www/emerald-erp
│  ├─ PM2: emerald-erp (2 процесса)
│  ├─ БД: emerald_erp (REAL USERS - НЕ ТРОГАТЬ!)
│  └─ React + Express + PostgreSQL
│
└─ stage.emrld.ru (staging для тестирования)
   ├─ Порт: 5001
   ├─ Папка: /var/www/emerald-erp-staging
   ├─ PM2: emerald-erp-staging (1 процесс)
   ├─ БД: emerald_erp_staging (копия для тестов)
   └─ React + Express + PostgreSQL
```

---

# 📖 ИНСТРУКЦИЯ ДЛЯ ДРУГОГО АГЕНТА (ДЛЯ САЙТА)

## ⚠️ ВАЖНО - ПРОЧИТАЙ ПЕРВЫМ!

### Безопасность сервера:
```
✅ Подключение ТОЛЬКО через SSH ключ .ssh\deploy_key
✅ БЕЗ пароля!
✅ НЕ ТРОГАЙ существующие БД:
   - emerald_erp (production с реальными пользователями)
   - emerald_erp_staging (staging БД)
✅ Работаешь ТОЛЬКО в папке /var/www/emerald-website
```

### Структура проекта сайта:
```
ДОЛЖНО БЫТЬ:
├── server.js
├── public/
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── images/
├── package.json
├── .env (создашь ты)
└── node_modules/ (создается при npm install)
```

---

## ✅ ШАГ 1: ПОДГОТОВКА САЙТА К ДЕПЛОЮ

### Выполнить в локальной папке сайта:

```bash
# 1. Проверить что сайт работает локально
npm install
npm start
# Открыть http://localhost:3000 - должна работать страница

# 2. Остановить локальный сервер (Ctrl+C)

# 3. Создать .env файл
cat > .env << 'EOF'
PORT=3000
REPLICATE_API_TOKEN=your_token_here
NODE_ENV=production
EOF

# 4. Создать архив для загрузки (БЕЗ node_modules!)
tar --exclude=node_modules --exclude=.git --exclude=.env.local -czf emerald-website.tar.gz *

# ✅ ГОТОВО! Архив emerald-website.tar.gz готов
```

---

## 🔐 ШАГ 2: ПОДКЛЮЧЕНИЕ К СЕРВЕРУ

### Получи эту информацию:

```
SSH Ключ: .ssh\deploy_key (находится в папке проекта ERP)
Сервер: 147.45.146.149
Пользователь: root
Подключение: ТОЛЬКО через ключ, БЕЗ пароля!
```

### Проверить подключение:

```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "echo '✅ Подключение работает'"
```

Если вывод: `✅ Подключение работает` - всё OK!

---

## 🚀 ШАГ 3: ЗАГРУЗКА САЙТА НА СЕРВЕР

### Выполнить эти команды:

```bash
# 1. Загрузить архив на сервер
scp -i ".ssh\deploy_key" -o StrictHostKeyChecking=no \
  emerald-website.tar.gz root@147.45.146.149:/tmp/

# 2. Развернуть сайт на сервере
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 << 'SSH_END'

echo "📂 Развертывание сайта..."

# Создать директорию если не существует
mkdir -p /var/www/emerald-website

# Распаковать архив
cd /var/www/emerald-website
tar -xzf /tmp/emerald-website.tar.gz
rm /tmp/emerald-website.tar.gz

# Установить зависимости
npm install --production

echo "✅ Сайт развернут в /var/www/emerald-website"

SSH_END

# 3. Очистить локально
rm emerald-website.tar.gz

echo "✅ Деплой сайта завершен!"
```

---

## 🔧 ШАГ 4: КОНФИГУРАЦИЯ PM2 ДЛЯ ВСЕХ ПРИЛОЖЕНИЙ

### Выполнить на сервере:

```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 << 'SSH_END'

echo "🔧 Настройка PM2..."

# Создать единую конфигурацию для всех трёх приложений
cat > /var/www/ecosystem.config.cjs << 'PM2_CONFIG'
module.exports = {
  apps: [
    {
      name: 'emerald-website',
      script: 'server.js',
      cwd: '/var/www/emerald-website',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        REPLICATE_API_TOKEN: 'your_token_here'
      }
    },
    {
      name: 'emerald-erp',
      script: '/var/www/emerald-erp/dist/index.js',
      cwd: '/var/www/emerald-erp',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'emerald-erp-staging',
      script: '/var/www/emerald-erp-staging/dist/index.js',
      cwd: '/var/www/emerald-erp-staging',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'staging',
        PORT: 5001
      }
    }
  ]
};
PM2_CONFIG

# Остановить старые процессы
pm2 delete all 2>/dev/null || true

# Запустить все приложения
pm2 start /var/www/ecosystem.config.cjs

# Сохранить конфигурацию PM2
pm2 save

# Установить автозагрузку PM2
pm2 startup systemd -u root --hp /root

# Проверить статус
pm2 list

echo "✅ PM2 настроен для всех трёх приложений"

SSH_END
```

---

## 🌐 ШАГ 5: КОНФИГУРАЦИЯ NGINX

### Выполнить на сервере:

```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 << 'SSH_END'

echo "🌐 Настройка Nginx..."

# Создать конфигурацию Nginx для всех трёх доменов
sudo cat > /etc/nginx/sites-available/emerald.conf << 'NGINX_CONFIG'

# САЙТ - главный домен (порт 3000)
server {
    listen 80;
    listen [::]:80;
    server_name emrld.ru www.emrld.ru;

    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# PRODUCTION ERP (порт 5000)
server {
    listen 80;
    listen [::]:80;
    server_name app.emrld.ru;

    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# STAGING ERP (порт 5001)
server {
    listen 80;
    listen [::]:80;
    server_name stage.emrld.ru;

    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

NGINX_CONFIG

# Включить конфигурацию
sudo ln -sf /etc/nginx/sites-available/emerald.conf /etc/nginx/sites-enabled/

# Удалить default конфиг если есть
sudo rm -f /etc/nginx/sites-enabled/default

# Проверить синтаксис Nginx
sudo nginx -t

# Перезагрузить Nginx
sudo systemctl reload nginx

echo "✅ Nginx настроен для трёх доменов"

SSH_END
```

---

## 🔓 ШАГ 6: ОТКРЫТЬ ПОРТЫ В ФАЙРВОЛЛЕ

### Выполнить на сервере:

```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 << 'SSH_END'

echo "🔓 Открываем порты..."

# Открыть порты для трёх приложений
ufw allow 3000/tcp
ufw allow 5000/tcp
ufw allow 5001/tcp

# Порты HTTP/HTTPS уже открыты (для Nginx)
ufw allow 80/tcp
ufw allow 443/tcp

# Проверить статус
ufw status

echo "✅ Все порты открыты"

SSH_END
```

---

## 🔐 ШАГ 7: SSL СЕРТИФИКАТЫ (Let's Encrypt)

### Выполнить на сервере:

```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 << 'SSH_END'

echo "🔐 Получаем SSL сертификаты..."

# Установить Certbot
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

# Получить SSL для всех трёх доменов
sudo certbot --nginx \
  -d emrld.ru \
  -d www.emrld.ru \
  -d app.emrld.ru \
  -d stage.emrld.ru \
  --non-interactive \
  --agree-tos \
  -m admin@emrld.ru

# Проверить сертификаты
sudo certbot certificates

# Включить автообновление
sudo systemctl enable certbot.timer

echo "✅ SSL сертификаты установлены"

SSH_END
```

---

## ✅ ШАГ 8: ПРОВЕРКА И ТЕСТИРОВАНИЕ

```bash
# 1. Проверить PM2 процессы
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 list"

# 2. Проверить логи сайта
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 logs emerald-website --lines 20"

# 3. Проверить логи production ERP
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 logs emerald-erp --lines 20"

# 4. Проверить логи staging ERP
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 logs emerald-erp-staging --lines 20"

# 5. Проверить Nginx
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "sudo nginx -t"

# 6. Открыть в браузере:
# https://emrld.ru - сайт
# https://app.emrld.ru - production ERP
# https://stage.emrld.ru - staging ERP
```

---

## 🔄 ОБНОВЛЕНИЕ САЙТА ПОСЛЕ ДЕПЛОЯ

### Для быстрого обновления кода сайта:

```bash
# 1. Создать архив сайта
tar --exclude=node_modules --exclude=.git -czf emerald-website.tar.gz *

# 2. Загрузить и развернуть
scp -i ".ssh\deploy_key" -o StrictHostKeyChecking=no \
  emerald-website.tar.gz root@147.45.146.149:/tmp/

ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 << 'SSH_END'
cd /var/www/emerald-website
tar -xzf /tmp/emerald-website.tar.gz
rm /tmp/emerald-website.tar.gz
npm install --production
pm2 reload emerald-website
echo "✅ Сайт обновлен"
SSH_END

# 3. Очистить локально
rm emerald-website.tar.gz
```

---

## 🛠️ ПОЛЕЗНЫЕ КОМАНДЫ

```bash
# Проверить статус всех приложений
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 list"

# Перезагрузить сайт (zero-downtime)
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 reload emerald-website"

# Перезагрузить production ERP (zero-downtime)
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 reload emerald-erp"

# Перезагрузить staging ERP
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 restart emerald-erp-staging"

# Посмотреть логи сайта
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 logs emerald-website"

# Посмотреть логи production ERP
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 logs emerald-erp"

# Посмотреть логи staging ERP
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 logs emerald-erp-staging"
```

---

## 📊 ФИНАЛЬНАЯ СТРУКТУРА СЕРВЕРА

```
/var/www/
├── emerald-website/          ← Сайт (Express.js)
│   ├── server.js
│   ├── public/
│   ├── package.json
│   ├── .env
│   └── node_modules/
│
├── emerald-erp/              ← Production ERP
│   ├── dist/
│   ├── server/
│   ├── client/
│   ├── package.json
│   ├── .env
│   ├── EMERALDWORK.md
│   └── node_modules/
│
├── emerald-erp-staging/      ← Staging ERP (для тестирования)
│   ├── dist/
│   ├── server/
│   ├── client/
│   ├── package.json
│   ├── .env
│   └── node_modules/
│
└── ecosystem.config.cjs      ← Конфиг PM2 для всех трёх приложений
```

---

## 📍 ДОСТУП К ПРИЛОЖЕНИЯМ

```
Сайт:           https://emrld.ru
Production ERP: https://app.emrld.ru
Staging ERP:    https://stage.emrld.ru

(доступны через 15-30 минут после настройки DNS)
```

---

## ⚠️ КРИТИЧЕСКИЕ ПРАВИЛА

### ✅ МОЖНО:
- Работать с сайтом в /var/www/emerald-website
- Тестировать на stage.emrld.ru
- Обновлять код и перезагружать приложения

### ❌ НЕЛЬЗЯ:
- **Трогать БД emerald_erp (production) - там работают пользователи!**
- **Удалять production файлы**
- **Менять конфиг production ERP без разрешения**
- **Использовать `restart` на production (только `reload`)**

---

# 🌍 НАСТРОЙКА DNS НА REG.RU

## Что нужно настроить в админпанели reg.ru:

### 1. Основной домен (emrld.ru)
```
Тип записи: A
Имя: @ (или emrld.ru)
IP адрес: 147.45.146.149
TTL: 3600

Тип записи: A
Имя: www
IP адрес: 147.45.146.149
TTL: 3600
```

### 2. Поддомен app (для production ERP)
```
Тип записи: A
Имя: app
IP адрес: 147.45.146.149
TTL: 3600
```

### 3. Поддомен stage (для staging ERP)
```
Тип записи: A
Имя: stage
IP адрес: 147.45.146.149
TTL: 3600
```

### Итого в reg.ru должно быть:
```
@ (или emrld.ru)  →  A  →  147.45.146.149
www                →  A  →  147.45.146.149
app                →  A  →  147.45.146.149
stage              →  A  →  147.45.146.149
```

⏳ **Время распространения DNS:** 15-30 минут (иногда до 4 часов)

---

## ✅ ПОСЛЕ ВСЕХ ШАГОВ:

```
✅ Сайт работает на https://emrld.ru
✅ Production ERP работает на https://app.emrld.ru
✅ Staging ERP работает на https://stage.emrld.ru
✅ Все три приложения на одном сервере 147.45.146.149
✅ Production БД защищена и в полной безопасности
✅ Staging БД используется для тестирования
✅ SSL сертификаты для всех доменов
```

---

**Готово! Все три приложения работают с правильными доменами! 🎉**
