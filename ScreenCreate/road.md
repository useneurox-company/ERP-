# ScreenCreate - План развития

## Текущая версия: 1.0.0 (базовая)

### Реализовано

- [x] Express сервер на порту 3500
- [x] Puppeteer-core с системным Chrome
- [x] GET /health - проверка статуса
- [x] GET /screenshot - создание скриншота

### API параметры

| Параметр | Тип | По умолчанию | Диапазон |
|----------|-----|--------------|----------|
| url | string | required | - |
| width | number | 1920 | 100-3840 |
| height | number | 1080 | 100-2160 |
| fullPage | boolean | false | - |
| format | string | png | png, jpeg, webp |
| quality | number | 80 | 1-100 |

### Примеры использования

```bash
# Базовый скриншот
curl "http://localhost:3500/screenshot?url=https://example.com" > screenshot.png

# С параметрами
curl "http://localhost:3500/screenshot?url=https://google.com&width=800&height=600&format=jpeg&quality=90" > screenshot.jpeg

# Полная страница
curl "http://localhost:3500/screenshot?url=https://example.com&fullPage=true" > full.png
```

---

## Roadmap

### v1.1 - Улучшения производительности
- [ ] Пул браузеров (переиспользование)
- [ ] Кеширование скриншотов по URL
- [ ] Таймауты и retry логика

### v1.2 - Дополнительные параметры
- [ ] delay - задержка перед скриншотом
- [ ] selector - скриншот конкретного элемента
- [ ] deviceScaleFactor - retina скриншоты
- [ ] dark mode эмуляция

### v1.3 - Блокировка контента
- [ ] Блокировка рекламы (uBlock списки)
- [ ] Блокировка cookie баннеров
- [ ] Кастомный CSS injection
- [ ] Кастомный JS injection

### v1.4 - Безопасность
- [ ] API ключи
- [ ] Rate limiting
- [ ] Whitelist/blacklist доменов
- [ ] Логирование запросов

### v1.5 - Хранение
- [ ] Сохранение на диск с уникальным именем
- [ ] Загрузка в S3/MinIO
- [ ] Webhook уведомления
- [ ] Очередь запросов (Redis + Bull)

### v2.0 - Интеграция с Creatix WebStudio
- [ ] Подключение к основному серверу
- [ ] UI для настроек
- [ ] Предпросмотр скриншотов
- [ ] Batch обработка

---

## Структура проекта

```
ScreenCreate/
├── package.json
├── server.js
├── road.md
├── routes/
│   └── screenshot.js
├── services/
│   └── browser.js
└── screenshots/
    └── (сохраненные скриншоты)
```

## Запуск

```bash
cd ScreenCreate
npm install
npm start
```

Сервер: http://localhost:3500
