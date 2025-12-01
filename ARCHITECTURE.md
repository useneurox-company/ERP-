# Emerald ERP - Архитектура проекта

## Технологии
- **Frontend**: React + TypeScript + Vite + TanStack Query + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Database**: SQLite (local) + Drizzle ORM
- **Deployment**: Единый сервер (dev mode с Vite integration)

## Порты
- **Production/Development**: `PORT=9000` (один порт для всего)
- Backend API и Frontend served через один Express server

## Структура проекта

```
c:\NX\Emerald ERP\
├── client/                    # Frontend (React)
│   └── src/
│       ├── components/        # React компоненты
│       ├── pages/            # Страницы приложения
│       ├── lib/              # Утилиты (queryClient, etc)
│       └── hooks/            # Custom hooks
├── server/                    # Backend (Express)
│   ├── modules/              # Модули по функциям
│   │   ├── users/           # Пользователи
│   │   ├── sales/           # Сделки (deals)
│   │   ├── tasks/           # Задачи + Activity Logs
│   │   └── projects/        # Проекты
│   ├── middleware/          # Middleware (permissions, etc)
│   ├── db.ts               # Database connection
│   └── index.ts            # Главный файл сервера
├── shared/                   # Shared types
│   └── schema.ts            # Drizzle schema + Zod types
└── .local/                  # Local data
    └── emerald_erp.db      # SQLite database

```

## Система прав (Permissions)

### Текущая реализация (ПРОСТАЯ):
- Admin пользователь (`username === 'admin'`) получает ВСЕ права напрямую
- Права добавляются в ответ API `/api/users/:id`
- Права проверяются на фронтенде через `currentUser?.can_create_deals`, etc.

### Список прав:
```typescript
can_create_deals: boolean
can_edit_deals: boolean
can_delete_deals: boolean
can_view_deals: boolean
can_create_projects: boolean
can_edit_projects: boolean
can_delete_projects: boolean
can_view_projects: boolean
```

### Где проверяются права:
- **Frontend**: `client/src/pages/Sales.tsx` - проверка `currentUser?.can_create_deals`
- **Backend**: `server/middleware/permissions.ts` - middleware `checkPermission()`

## Activity Logs (События)

### Назначение:
Отслеживание ВСЕХ изменений в сделках и проектах с информацией о пользователе

### Таблица: `activity_logs`
```typescript
{
  id: string
  entity_type: 'deal' | 'project'  // Тип сущности
  entity_id: string                 // ID сделки/проекта
  action_type: string               // 'created', 'updated', 'deleted', etc
  user_id: string                   // Кто сделал изменение
  field_changed: string | null      // Какое поле изменилось
  old_value: string | null          // Старое значение
  new_value: string | null          // Новое значение
  description: string               // Описание на русском
  created_at: Date
}
```

### API endpoints:
- `GET /api/activity-logs/:entityType/:entityId` - получить все события для сущности

### Где создаются логи:
- `server/modules/sales/routes.ts` - PUT `/api/deals/:id` - логирует все изменения полей
- `server/modules/tasks/repository.ts` - методы создания логов

### Frontend отображение:
- `client/src/components/DealCardModal.tsx` - вкладка "События"
- Query: `queryKey: ['/api/activity-logs', 'deal', dealId]`
- **ВАЖНО**: `staleTime: 0, gcTime: 0, refetchOnMount: 'always'` для избежания кеширования

## Запуск проекта

### Development (рекомендуется):
```bash
# Один сервер на порту 9000
npm run dev
```
Откройте: http://localhost:9000

### Что происходит:
1. Express сервер стартует на `PORT` из `.env`
2. В dev режиме автоматически инициализируется Vite
3. Vite служит frontend, Express - API
4. Всё работает на одном порту

## Общие правила

### Backend:
1. **Всегда используй Drizzle ORM** - никаких raw SQL
2. **Модульная структура** - каждый модуль в `server/modules/[name]/`
3. **Repository pattern** - бизнес-логика в `repository.ts`, routes только для HTTP
4. **Типы из shared** - импортируй из `@shared/schema`

### Frontend:
1. **TanStack Query** для всех API запросов
2. **queryClient.invalidateQueries()** после мутаций
3. **Не используй прямой fetch** - только через `apiRequest()` из `@/lib/queryClient`
4. **Shadcn/ui компоненты** - используй готовые из `@/components/ui`

### Activity Logs:
1. **Логируй ВСЕ изменения** в сделках/проектах
2. **Всегда указывай user_id** - кто сделал изменение
3. **Описание на русском** - понятное для пользователя
4. **Invalidate queries** после создания логов

## Частые проблемы и решения

### Проблема: Кнопки не отображаются
**Причина**: Права пользователя не загружаются
**Решение**: Проверь что `/api/users/:id` возвращает права (`can_create_deals`, etc.)

### Проблема: События не отображаются
**Причина**: React Query кеширует пустой массив
**Решение**: Добавь `staleTime: 0, gcTime: 0, refetchOnMount: 'always'` в useQuery

### Проблема: 403 Forbidden при создании/редактировании
**Причина**: Middleware проверяет права, но их нет у пользователя
**Решение**: Убедись что admin пользователь получает права в `/api/users/:id`

### Проблема: Изменения в коде не применяются
**Причина**: Кеш браузера или React Query
**Решение**: Hard refresh (Ctrl+Shift+R) или очисти кеш

## Environment Variables (.env)

```env
NODE_ENV=development
PORT=9000
SESSION_SECRET=emerald-erp-dev-secret-key-change-in-production
```

## Следующие шаги для оптимизации

1. ✅ Упростить систему прав (сделано - admin получает всё)
2. ✅ Единый порт для frontend+backend (сделано - 9000)
3. ✅ Activity logs работают (сделано)
4. ⏳ Добавить TypeScript strict mode
5. ⏳ Добавить ESLint правила
6. ⏳ Написать тесты для критических функций
