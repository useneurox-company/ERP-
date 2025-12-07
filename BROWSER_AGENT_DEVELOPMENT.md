# AI Browser Agent - Пошаговая Разработка

## ВАЖНО ДЛЯ CLAUDE: ЕСЛИ ПОТЕРЯЛ КОНТЕКСТ - ПРОЧИТАЙ ЭТОТ ФАЙЛ!

Этот проект: **Emerald ERP** - система управления мебельным производством.
Мы создаём **AI Browser Agent** - агент который может автономно управлять ERP через браузер.

Текущий стек:
- Frontend: React + TypeScript + Vite + TailwindCSS + Radix UI
- Backend: Express + TypeScript + Drizzle ORM + PostgreSQL
- AI: OpenRouter (Gemini), планируется добавить Claude Vision

---

## ФАЗЫ РАЗРАБОТКИ

### ФАЗА 1: Базовый Backend Service ✅ [ГОТОВО]
**Цель:** Создать сервис который может запускать браузер и делать скриншоты

**Файлы:**
- `server/modules/browser-agent/service.ts` - основной сервис (использует ScreenCreate API)
- `server/modules/browser-agent/routes.ts` - API endpoints
- `server/modules/browser-agent/index.ts` - экспорт модуля

**Что сделано:**
- ✅ Сервис BrowserAgentService с агент-циклом
- ✅ Интеграция с ScreenCreate (localhost:3500) для скриншотов
- ✅ Claude Vision через fetch API (без SDK)
- ✅ API endpoints: start, stop, status, sessions, health
- ✅ Подключено к Express серверу

**Тест:**
```bash
# 1. Проверка здоровья
curl http://localhost:5000/api/browser-agent/health
# Ответ: {"status":"ok","service":"browser-agent","hasAnthropicKey":false}

# 2. Запуск агента (требует ScreenCreate на порту 3500)
curl -X POST http://localhost:5000/api/browser-agent/start -H "Content-Type: application/json" -d '{"task":"test"}'
# Должен вернуть { status: "started", sessionId: "..." }
```

**Статус:** [x] Готово

---

### ФАЗА 2: WebSocket для Real-time ✅ [ГОТОВО]
**Цель:** Добавить WebSocket для передачи скриншотов и действий в реальном времени

**Файлы:**
- `server/modules/browser-agent/websocket.ts` - WebSocket handler ✅
- `server/index.ts` - подключен WebSocket к серверу ✅

**События:**
- `agent:screenshot` - новый скриншот (base64)
- `agent:action` - текущее действие
- `agent:thinking` - мысли агента
- `agent:status` - статус (running/stopped/error)

**Что сделано:**
- ✅ WebSocketServer на /ws/browser-agent
- ✅ Подписка на сессии (subscribe/unsubscribe)
- ✅ Broadcast событий клиентам
- ✅ Интеграция с BrowserAgentService callbacks
- ✅ Подключено к server/index.ts

**Тест:**
```javascript
// В консоли браузера:
const ws = new WebSocket('ws://localhost:5000/ws/browser-agent');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onopen = () => ws.send(JSON.stringify({type: 'start', task: 'Тест'}));
```

**Статус:** [x] Готово

---

### ФАЗА 3: Claude Vision интеграция ✅ [ГОТОВО]
**Цель:** Интегрировать Claude API для анализа скриншотов

**Файлы:**
- `server/modules/browser-agent/service.ts` - Claude Vision интегрирован через fetch API ✅
- `.env` - ANTHROPIC_API_KEY (опционально, fallback режим работает)

**Что сделано:**
- ✅ Метод analyzeWithClaude() в service.ts
- ✅ Отправка скриншота как base64 image
- ✅ Системный промпт на русском языке
- ✅ Парсинг JSON ответа с действием
- ✅ Fallback режим если нет API ключа

**Тест:**
```bash
# Запустить агента (использует Claude если есть ключ)
curl -X POST localhost:5000/api/browser-agent/start -d '{"task":"test"}'
```

**Статус:** [x] Готово

---

### ФАЗА 4: Agent Loop ✅ [ГОТОВО]
**Цель:** Создать цикл агента (скриншот → анализ → действие → повтор)

**Файлы:**
- `server/modules/browser-agent/service.ts` - основной цикл runAgentLoop() ✅

**Действия (через ScreenCreate API):**
- `click` - клик по тексту или селектору ✅
- `type` - ввод текста ✅
- `scroll` - прокрутка ✅
- `wait` - ожидание ✅
- `navigate` - переход по URL ✅
- `complete` - задача выполнена ✅

**Что сделано:**
- ✅ Метод runAgentLoop() с MAX_ITERATIONS=50
- ✅ Метод executeAction() для выполнения действий
- ✅ Интеграция с ScreenCreate API (localhost:3500)
- ✅ Обработка ошибок и recovery
- ✅ Callbacks для WebSocket уведомлений

**Тест:**
```bash
curl -X POST localhost:5000/api/browser-agent/start \
  -H "Content-Type: application/json" \
  -d '{"task":"Открой страницу проектов"}'
```

**Статус:** [x] Готово

---

### ФАЗА 5: Frontend Overlay ✅ [ГОТОВО]
**Цель:** Создать UI overlay для отображения работы агента

**Файлы:**
- `client/src/components/AgentOverlay.tsx` - основной overlay ✅
- `client/src/hooks/useBrowserAgent.ts` - React hook для WebSocket ✅

**Что сделано:**
- ✅ useBrowserAgent hook с WebSocket подключением
- ✅ AgentOverlay компонент с затемнением
- ✅ Live скриншот браузера агента
- ✅ Лог действий с иконками
- ✅ Кнопка СТОП
- ✅ Индикатор "Агент думает..."
- ✅ Статус подключения (Подключен/Отключен)

**Тест:**
1. Открыть Ассистента
2. Нажать на иконку монитора (Agent Mode)
3. Ввести задачу и нажать "Запустить"

**Статус:** [x] Готово

---

### ФАЗА 6: Интеграция в AssistantPanel ✅ [ГОТОВО]
**Цель:** Добавить кнопку "Agent Mode" в существующий чат

**Файлы:**
- `client/src/components/AssistantPanel.tsx` - добавлена кнопка и overlay ✅

**Что сделано:**
- ✅ Кнопка Agent Mode (иконка Monitor) в header панели
- ✅ Tooltip "AI Agent Mode" при наведении
- ✅ State isAgentOverlayOpen для управления overlay
- ✅ AgentOverlay интегрирован в компонент
- ✅ Кнопка открывает полноэкранный overlay

**Тест:**
1. Открыть Ассистента (боковая панель)
2. Нажать на иконку монитора в header
3. Откроется AgentOverlay
4. Ввести задачу и нажать "Запустить"

**Статус:** [x] Готово

---

### ФАЗА 7: Улучшения и оптимизация
**Цель:** Добавить улучшения UX

**Фичи:**
- [ ] Подсветка кликов на скриншоте (красная точка)
- [ ] История сессий
- [ ] Retry при ошибках
- [ ] Кэширование скриншотов
- [ ] Timeout на действия

**Статус:** [ ] Не начато

---

## ЗАВИСИМОСТИ

```bash
# Установить перед началом:
npm install playwright @anthropic-ai/sdk ws @types/ws
npx playwright install chromium
```

## КОНФИГУРАЦИЯ

```env
# Добавить в .env:
ANTHROPIC_API_KEY=sk-ant-...
```

---

## ТЕКУЩИЙ ПРОГРЕСС

| Фаза | Описание | Статус |
|------|----------|--------|
| 1 | Backend Service | ✅ Готово |
| 2 | WebSocket | ✅ Готово |
| 3 | Claude Vision | ✅ Готово (fetch API) |
| 4 | Agent Loop | ✅ Готово (в service.ts) |
| 5 | Frontend Overlay | ✅ Готово |
| 6 | AssistantPanel | ✅ Готово |
| 7 | Улучшения | ⏳ Ожидает |

---

## ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ
Дата: 2025-12-07
Фаза: 6 - Интеграция в AssistantPanel (ЗАВЕРШЕНО)

**Что готово:**
- ✅ Backend сервис работает (ScreenCreate API)
- ✅ API endpoints доступны (/api/browser-agent/*)
- ✅ Claude Vision интегрирован (fetch API)
- ✅ Agent Loop реализован
- ✅ WebSocket для real-time обновлений
- ✅ Frontend Overlay (AgentOverlay.tsx)
- ✅ React Hook (useBrowserAgent.ts)
- ✅ Интеграция в AssistantPanel

**СЛЕДУЮЩИЙ ШАГ: Тестирование полного цикла работы агента!**
