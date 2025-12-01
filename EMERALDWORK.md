# EMERALD ERP - РАБОЧИЙ ПРОЦЕСС И ПРАВИЛА

## ⚠️ КРИТИЧЕСКИ ВАЖНО

### 🛡️ PRODUCTION БАЗА ДАННЫХ - НЕ ТРОГАТЬ!
- **НИКОГДА не удалять, не перезаписывать, не изменять production базу `emerald_erp`**
- **В production работают РЕАЛЬНЫЕ ПОЛЬЗОВАТЕЛИ**
- **База должна быть в ПОЛНОЙ БЕЗОПАСНОСТИ**
- Любые действия с production БД ТОЛЬКО после явного разрешения клиента

---

## 🏗️ АРХИТЕКТУРА ОКРУЖЕНИЙ

### Production (НЕ ТРОГАТЬ без разрешения!)
```
URL: https://emrld.ru
Сервер: 147.45.146.149
Папка: /var/www/emerald-erp
БД: emerald_erp (PostgreSQL)
PM2: emerald-erp (ID 0, 1)
Порт: 5000
Статус: РАБОЧИЙ - там работают пользователи!
```

### Staging (для тестирования)
```
URL: http://147.45.146.149:5001
Сервер: 147.45.146.149
Папка: /var/www/emerald-erp-staging
БД: emerald_erp_staging (PostgreSQL - копия данных)
PM2: emerald-erp-staging (ID 2)
Порт: 5001
Статус: Тестовое окружение
```

### Local (разработка)
```
Папка: c:\NX\Emerald ERP
БД: SQLite (.local/emerald_erp.db)
Порт: 5000 (development)
```

---

## 📋 ПРОЦЕСС РАЗРАБОТКИ И ДЕПЛОЯ

### 1️⃣ Локальная разработка (БЫСТРО)
```
1. Работаешь локально в c:\NX\Emerald ERP
2. Тестируешь изменения локально
3. Проверяешь что всё работает
```

### 2️⃣ Деплой на Staging (ТЕСТИРОВАНИЕ)
```
1. Загружаешь изменения на staging
2. Тестируешь на реальных данных (копия production)
3. Проверяешь что нет ошибок
4. Исправляешь баги если есть
```

### 3️⃣ Деплой на Production (ТОЛЬКО ПРОВЕРЕННЫЙ КОД!)
```
1. ТОЛЬКО после успешного тестирования на staging
2. Убедись что пользователи не пострадают
3. Сделай backup если нужно
4. Деплой на production
```

---

## 🔐 ПОДКЛЮЧЕНИЕ К СЕРВЕРУ

### SSH Ключ (ИСПОЛЬЗУЕМ ВСЕГДА!)
```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149
```

**ВАЖНО:**
- Подключение ТОЛЬКО через SSH ключ `.ssh\deploy_key`
- НЕ используем пароль
- Ключ находится в `.ssh\deploy_key` (локально)

### SCP для загрузки файлов
```bash
scp -i ".ssh\deploy_key" -o StrictHostKeyChecking=no file.tar.gz root@147.45.146.149:/path/
```

---

## 🗄️ БАЗЫ ДАННЫХ

### Production БД (emerald_erp)
```
⛔ НЕ ТРОГАТЬ! ТАМ РАБОТАЮТ ПОЛЬЗОВАТЕЛИ!
⛔ НЕ УДАЛЯТЬ!
⛔ НЕ ПЕРЕЗАПИСЫВАТЬ!
⛔ НЕ ИЗМЕНЯТЬ БЕЗ РАЗРЕШЕНИЯ!

Пользователь: emerald_user
Пароль: EmeraldSecure2025!
База: emerald_erp
Хост: localhost:5432
```

### Staging БД (emerald_erp_staging)
```
✅ Можно использовать для тестов
✅ Копия production данных
✅ Безопасное окружение для экспериментов

Пользователь: emerald_user
Пароль: EmeraldSecure2025!
База: emerald_erp_staging
Хост: localhost:5432
```

---

## 🚀 СКРИПТЫ ДЕПЛОЯ

### Деплой на Staging
```bash
# 1. Создать архив
tar --exclude=node_modules --exclude=.local --exclude=.git --exclude=dist --exclude=*.log -czf deploy.tar.gz *

# 2. Загрузить на сервер
scp -i ".ssh\deploy_key" -o StrictHostKeyChecking=no deploy.tar.gz root@147.45.146.149:/tmp/

# 3. Развернуть на staging
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "
  cd /var/www/emerald-erp-staging &&
  tar -xzf /tmp/deploy.tar.gz &&
  rm /tmp/deploy.tar.gz &&
  npm install --omit=dev &&
  npm run build &&
  pm2 restart emerald-erp-staging
"

# 4. Почистить локально
rm deploy.tar.gz
```

### Деплой на Production (ОСТОРОЖНО!)
```bash
# ⚠️ ТОЛЬКО ПОСЛЕ УСПЕШНОГО ТЕСТИРОВАНИЯ НА STAGING!
# ⚠️ УБЕДИСЬ ЧТО КОД ПРОВЕРЕН И БЕЗ ОШИБОК!

# 1. Создать архив
tar --exclude=node_modules --exclude=.local --exclude=.git --exclude=dist --exclude=*.log -czf deploy.tar.gz *

# 2. Загрузить на сервер
scp -i ".ssh\deploy_key" -o StrictHostKeyChecking=no deploy.tar.gz root@147.45.146.149:/tmp/

# 3. Развернуть на production
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "
  cd /var/www/emerald-erp &&
  tar -xzf /tmp/deploy.tar.gz &&
  rm /tmp/deploy.tar.gz &&
  npm install --omit=dev &&
  npm run build &&
  pm2 reload emerald-erp
"

# 4. Почистить локально
rm deploy.tar.gz
```

**ВАЖНО:** На production используем `pm2 reload` вместо `restart` для zero-downtime deployment!

---

## 📦 PM2 УПРАВЛЕНИЕ

### Проверить статус
```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 list"
```

### Перезапустить Staging
```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 restart emerald-erp-staging"
```

### Перезапустить Production (БЕЗ ДАУНТАЙМА)
```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 reload emerald-erp"
```

### Посмотреть логи
```bash
# Staging
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 logs emerald-erp-staging --lines 50"

# Production
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "pm2 logs emerald-erp --lines 50"
```

---

## 🔄 СИНХРОНИЗАЦИЯ STAGING С PRODUCTION

### Обновить код staging из production
```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "
  rsync -av --delete \
    --exclude=node_modules \
    --exclude=.local \
    --exclude=dist \
    /var/www/emerald-erp/ \
    /var/www/emerald-erp-staging/
"
```

### Обновить БД staging из production
```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "
  sudo -u postgres pg_dump emerald_erp | sudo -u postgres psql emerald_erp_staging
"
```

---

## ⚠️ ПРАВИЛА БЕЗОПАСНОСТИ

### ✅ МОЖНО:
- Работать локально без ограничений
- Тестировать на staging сколько угодно
- Перезапускать staging процессы
- Изменять staging базу данных
- Экспериментировать на staging

### ❌ НЕЛЬЗЯ:
- **Удалять production базу `emerald_erp`**
- **Перезаписывать production базу**
- **Изменять production БД без разрешения**
- **Останавливать production процессы без причины**
- **Деплоить непроверенный код на production**
- **Использовать `pm2 restart` на production (только `pm2 reload`)**

---

## 📝 ЧЕКЛИСТ ПЕРЕД ДЕПЛОЕМ НА PRODUCTION

- [ ] ✅ Код протестирован локально
- [ ] ✅ Код задеплоен на staging
- [ ] ✅ Протестирован на staging без ошибок
- [ ] ✅ API работают корректно на staging
- [ ] ✅ База данных staging в порядке
- [ ] ✅ Нет критических ошибок в логах staging
- [ ] ✅ Получено разрешение от клиента (если нужно)
- [ ] ✅ Создан backup production БД (если нужно)
- [ ] ⚠️ ТОЛЬКО ТОГДА деплой на production!

---

## 🛠️ ТЕХНИЧЕСКИЙ СТЕК

### Backend
- Node.js 20
- Express.js
- Drizzle ORM
- PostgreSQL (production/staging)
- SQLite (development)

### Frontend
- React + TypeScript
- Vite
- TailwindCSS

### Инфраструктура
- PM2 (process manager)
- Nginx (reverse proxy)
- UFW (firewall)
- Ubuntu Server

---

## 📞 КОНТАКТЫ

**Сервер:** 147.45.146.149
**SSH Ключ:** `.ssh\deploy_key`
**Production URL:** https://emrld.ru
**Staging URL:** http://147.45.146.149:5001

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ

### Проверить production БД
```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "
  sudo -u postgres psql emerald_erp -c 'SELECT count(*) FROM deals;'
"
```

### Проверить staging БД
```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "
  sudo -u postgres psql emerald_erp_staging -c 'SELECT count(*) FROM deals;'
"
```

### Backup production БД
```bash
ssh -i ".ssh\deploy_key" -o StrictHostKeyChecking=no root@147.45.146.149 "
  sudo -u postgres pg_dump emerald_erp | gzip > /var/backups/emerald_erp_$(date +%Y%m%d_%H%M%S).sql.gz
"
```

---

**ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ:** 14 ноября 2025

**ПОМНИ:** Production база - это священная корова! Не трогай её без крайней необходимости! 🐄
