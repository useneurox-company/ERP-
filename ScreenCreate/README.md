# ScreenCreate - Browser Automation & Screenshot Service

Автономный микросервис для автоматизации браузера с Puppeteer.
**Можно скопировать в любой проект и использовать.**

## Возможности

- **Скриншоты** - снимки любых веб-страниц
- **Crawler** - обход сайтов и сбор данных
- **Test API** - автоматизация браузера (как Puppeteer MCP)
- **Visible Mode** - реальное окно Chrome на экране
- **Visual Indicators** - визуальные индикаторы кликов и ввода
- **Live View** - наблюдение за тестами в реальном времени

---

## Быстрый старт

```bash
# Установить зависимости
npm install

# Запустить сервер
npm start

# Сервер доступен на http://localhost:3500
```

---

## API Endpoints

### Health Check
```bash
GET /health
# Response: {"status":"ok","service":"ScreenCreate","port":3500}
```

### Screenshot API
```bash
POST /screenshot/capture
{
  "url": "https://example.com",
  "width": 1920,
  "height": 1080,
  "fullPage": false
}
```

### HTML Fetch API
```bash
POST /html/fetch
{
  "url": "https://example.com"
}
```

### Crawler API
```bash
POST /crawl/start
{
  "url": "https://example.com",
  "depth": 2
}
```

---

## Test API - Browser Automation

Полноценная автоматизация браузера для тестирования.

### Запуск сессии

```bash
# Обычный режим (headless)
curl -X POST http://localhost:3500/test/start

# VISIBLE MODE - открывает реальное окно Chrome!
curl -X POST http://localhost:3500/test/start \
  -H "Content-Type: application/json" \
  -d '{"visible": true}'
```

### Навигация

```bash
curl -X POST http://localhost:3500/test/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Клик по элементу

```bash
# По CSS селектору
curl -X POST http://localhost:3500/test/click \
  -H "Content-Type: application/json" \
  -d '{"selector": "button.submit"}'

# По тексту
curl -X POST http://localhost:3500/test/click \
  -H "Content-Type: application/json" \
  -d '{"text": "Войти"}'
```

### Ввод текста

```bash
curl -X POST http://localhost:3500/test/type \
  -H "Content-Type: application/json" \
  -d '{"selector": "input[name=email]", "text": "user@example.com"}'

# С очисткой поля
curl -X POST http://localhost:3500/test/type \
  -H "Content-Type: application/json" \
  -d '{"selector": "input[name=email]", "text": "new@example.com", "clear": true}'
```

### Получение контента

```bash
# Весь текст страницы
curl -X POST http://localhost:3500/test/content

# Текст конкретного элемента
curl -X POST http://localhost:3500/test/content \
  -H "Content-Type: application/json" \
  -d '{"selector": ".main-content"}'
```

### Проверка элементов

```bash
# Существует ли элемент
curl -X POST http://localhost:3500/test/exists \
  -H "Content-Type: application/json" \
  -d '{"selector": ".success-message"}'

# Ожидание элемента
curl -X POST http://localhost:3500/test/wait \
  -H "Content-Type: application/json" \
  -d '{"selector": ".loading", "timeout": 5000}'
```

### Скриншот

```bash
curl -X POST http://localhost:3500/test/screenshot

# Сохранить в файл
curl -X POST http://localhost:3500/test/save-screenshot \
  -H "Content-Type: application/json" \
  -d '{"filename": "my-test.png", "fullPage": true}'
```

### Получить все элементы

```bash
curl -X POST http://localhost:3500/test/elements
# Возвращает: buttons, links, inputs, selects, modals, forms
```

### Завершение сессии

```bash
curl -X POST http://localhost:3500/test/end
```

### Quick Test - всё в одном запросе

```bash
curl -X POST http://localhost:3500/test/quick \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "checkText": "Welcome",
    "checkSelector": ".header"
  }'
```

---

## Visible Mode - Видимый браузер

Когда `visible: true`, открывается **реальное окно Chrome** на вашем экране.
Вы видите все действия в реальном времени - как телевизор!

### Визуальные индикаторы

При `visible: true` автоматически показываются:

- **CLICK** - красный пульсирующий круг + обводка элемента
- **TYPING** - синяя метка над полем ввода + обводка

Это помогает видеть что именно делает автоматизация.

---

## Live View - Наблюдение за тестами

Альтернатива visible mode - наблюдение через браузер.

1. Откройте: `http://localhost:3500/live-view.html`
2. Запустите тест обычным способом
3. Наблюдайте за действиями в реальном времени (обновление каждые 500мс)

Live View показывает:
- Статус сессии (LIVE / Нет активной сессии)
- Текущий URL
- Последнее действие
- Скриншот страницы

---

## Полный список команд Test API

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/test/start` | POST | Начать сессию |
| `/test/end` | POST | Завершить сессию |
| `/test/navigate` | POST | Перейти на URL |
| `/test/click` | POST | Клик по элементу |
| `/test/type` | POST | Ввод текста |
| `/test/wait` | POST | Ждать элемент |
| `/test/exists` | POST | Проверить наличие |
| `/test/content` | POST | Получить текст |
| `/test/screenshot` | POST | Сделать скриншот |
| `/test/save-screenshot` | POST | Сохранить скриншот |
| `/test/elements` | POST | Список элементов |
| `/test/evaluate` | POST | Выполнить JS |
| `/test/select` | POST | Выбрать в dropdown |
| `/test/scroll` | POST | Прокрутка |
| `/test/hover` | POST | Навести курсор |
| `/test/press` | POST | Нажать клавишу |
| `/test/clear` | POST | Очистить поле |
| `/test/state` | POST | Состояние страницы |
| `/test/count` | POST | Количество элементов |
| `/test/get-attribute` | POST | Получить атрибут |
| `/test/wait-network` | POST | Ждать сеть |
| `/test/quick` | POST | Быстрый тест |
| `/test/live-frame` | GET | Кадр для Live View |

---

## Структура файлов

```
ScreenCreate/
├── server.js           # Точка входа
├── package.json        # Зависимости
├── routes/
│   ├── screenshot.js   # Скриншоты
│   ├── html.js         # HTML fetch
│   ├── crawl.js        # Crawler
│   └── test.js         # Test API (автоматизация)
├── services/
│   └── browser.js      # Puppeteer wrapper
├── public/
│   ├── index.html      # UI скриншотов
│   ├── crawler.html    # UI crawler
│   └── live-view.html  # Live View для тестов
├── screenshots/        # Сохранённые скриншоты
└── README.md           # Эта документация
```

---

## Конфигурация

### Путь к Chrome (автоопределение)

Путь к Chrome определяется автоматически для Windows, macOS и Linux.

Если нужно указать вручную, используйте переменную окружения:
```bash
# Windows
set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# Linux/macOS
export CHROME_PATH=/usr/bin/google-chrome
```

Поддерживаемые пути автоопределения:
- **Windows**: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- **macOS**: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- **Linux**: `/usr/bin/google-chrome`, `/usr/bin/chromium-browser`

### Порт

В `server.js`:
```javascript
const PORT = 3500;
```

---

## Интеграция в другой проект

### Как отдельный сервис

1. Скопируйте папку `ScreenCreate` в проект
2. `cd ScreenCreate && npm install`
3. `npm start`
4. Используйте через HTTP API

### Как модуль Express

```javascript
const screenshotRoutes = require('./ScreenCreate/routes/screenshot');
const testRoutes = require('./ScreenCreate/routes/test');

app.use('/screenshot', screenshotRoutes);
app.use('/test', testRoutes);
```

---

## Требования

- Node.js 18+
- Google Chrome установлен
- Windows / macOS / Linux

---

## Примеры использования

### Тест логина

```bash
# Запустить видимую сессию
curl -X POST localhost:3500/test/start -H "Content-Type: application/json" -d '{"visible":true}'

# Перейти на страницу
curl -X POST localhost:3500/test/navigate -H "Content-Type: application/json" -d '{"url":"http://localhost:7000"}'

# Ввести логин
curl -X POST localhost:3500/test/type -H "Content-Type: application/json" -d '{"selector":"input[name=login]","text":"admin"}'

# Ввести пароль
curl -X POST localhost:3500/test/type -H "Content-Type: application/json" -d '{"selector":"input[name=password]","text":"admin123"}'

# Нажать войти
curl -X POST localhost:3500/test/click -H "Content-Type: application/json" -d '{"selector":"button[type=submit]"}'

# Проверить что вошли
curl -X POST localhost:3500/test/content

# Завершить
curl -X POST localhost:3500/test/end
```

### Автоматизация для Claude Code

ScreenCreate идеально подходит для автономной работы Claude Code:
- Тестирование интерфейса после изменений
- Проверка что функционал работает
- Снятие скриншотов для анализа
- Visible mode для наблюдения пользователем

---

## Лицензия

MIT - используйте свободно в любых проектах.
