/**
 * ChatCRM - LocalDB Adapter
 * Адаптер для работы с локальной PostgreSQL базой данных через Drizzle ORM
 *
 * Этот адаптер связан с текущей ERP системой.
 * При выносе ChatCRM как отдельного сервиса - используйте другие адаптеры (AmoCRM, Bitrix24)
 */

import {
  CRMAdapter,
  UnifiedDeal,
  UnifiedClient,
  UnifiedStage,
  UnifiedManager,
  UnifiedProduct,
  UnifiedTask,
  SearchResult,
  SearchFilters,
  TaskFilter,
  CreateTaskData,
  TasksNeedingAttention
} from './types';
import { db } from '../../../db';
import { deals, users, dealStages, warehouse_items, tasks } from '../../../../shared/schema';
import { eq, or, like, sql, desc, and, lt, gt, lte, gte, inArray, isNull, not } from 'drizzle-orm';

export class LocalDBAdapter implements CRMAdapter {
  private PAGE_SIZE = 5;

  getName(): string {
    return 'ChatCRM-LocalDB';
  }

  async testConnection(): Promise<boolean> {
    try {
      await db.select({ count: sql`1` }).from(deals).limit(1);
      return true;
    } catch (error) {
      console.error('[LocalDBAdapter] Connection test failed:', error);
      return false;
    }
  }

  // ========== СДЕЛКИ ==========

  async searchDeals(query: string, page: number = 0, filters?: SearchFilters): Promise<SearchResult<UnifiedDeal>> {
    const offset = page * this.PAGE_SIZE;

    // Если query пустой - возвращаем последние сделки
    if (!query || query.trim() === '') {
      const results = await db
        .select({
          id: deals.id,
          order_number: deals.order_number,
          client_name: deals.client_name,
          contact_phone: deals.contact_phone,
          contact_email: deals.contact_email,
          company: deals.company,
          amount: deals.amount,
          stage: deals.stage,
          manager_id: deals.manager_id,
          deadline: deals.deadline,
          tags: deals.tags,
          production_days_count: deals.production_days_count,
          created_at: deals.created_at,
          updated_at: deals.updated_at,
        })
        .from(deals)
        .orderBy(desc(deals.created_at))
        .limit(this.PAGE_SIZE)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(deals);

      const total = Number(countResult[0]?.count || 0);
      const items = await Promise.all(results.map(d => this.mapDealToUnified(d)));

      return {
        items,
        total,
        page,
        pageSize: this.PAGE_SIZE,
        hasMore: offset + results.length < total
      };
    }

    // Базовые условия поиска
    let conditions: any[] = [];

    // Поиск по номеру заказа
    if (/^\d+$/.test(query) || /^#?\d+$/.test(query)) {
      const orderNum = query.replace('#', '');
      conditions.push(like(deals.order_number, `%${orderNum}%`));
    } else {
      // Поиск по имени клиента, телефону, компании
      conditions.push(
        like(deals.client_name, `%${query}%`),
        like(deals.contact_phone, `%${query}%`),
        like(deals.company, `%${query}%`)
      );
    }

    // Добавляем фильтры
    let whereClause = or(...conditions);
    if (filters?.managerId) {
      whereClause = and(whereClause, eq(deals.manager_id, filters.managerId));
    }
    if (filters?.stage) {
      whereClause = and(whereClause, eq(deals.stage, filters.stage));
    }

    // Основной запрос
    const results = await db
      .select({
        id: deals.id,
        order_number: deals.order_number,
        client_name: deals.client_name,
        contact_phone: deals.contact_phone,
        contact_email: deals.contact_email,
        company: deals.company,
        amount: deals.amount,
        stage: deals.stage,
        manager_id: deals.manager_id,
        deadline: deals.deadline,
        tags: deals.tags,
        production_days_count: deals.production_days_count,
        created_at: deals.created_at,
        updated_at: deals.updated_at,
      })
      .from(deals)
      .where(whereClause!)
      .orderBy(desc(deals.created_at))
      .limit(this.PAGE_SIZE)
      .offset(offset);

    // Подсчёт общего количества
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(deals)
      .where(whereClause!);

    const total = Number(countResult[0]?.count || 0);
    const items = await Promise.all(results.map(d => this.mapDealToUnified(d)));

    return {
      items,
      total,
      page,
      pageSize: this.PAGE_SIZE,
      hasMore: offset + results.length < total
    };
  }

  async getDealById(id: string): Promise<UnifiedDeal | null> {
    const result = await db
      .select({
        id: deals.id,
        order_number: deals.order_number,
        client_name: deals.client_name,
        contact_phone: deals.contact_phone,
        contact_email: deals.contact_email,
        company: deals.company,
        amount: deals.amount,
        stage: deals.stage,
        manager_id: deals.manager_id,
        deadline: deals.deadline,
        tags: deals.tags,
        production_days_count: deals.production_days_count,
        created_at: deals.created_at,
        updated_at: deals.updated_at,
      })
      .from(deals)
      .where(eq(deals.id, id))
      .limit(1);

    if (result.length === 0) return null;

    return this.mapDealToUnified(result[0]);
  }

  async createDeal(data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const newDeal = await db
      .insert(deals)
      .values({
        client_name: data.clientName || '',
        contact_phone: data.clientPhone,
        contact_email: data.clientEmail,
        company: data.company,
        amount: data.amount ? String(data.amount) : null,
        stage: data.stage || 'new',
        manager_id: data.managerId,
        deadline: data.deadline,
        tags: data.tags,
        production_days_count: data.productionDaysCount,
      })
      .returning();

    return this.mapDealToUnified(newDeal[0]);
  }

  async updateDeal(id: string, data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    // Преобразуем UnifiedDeal поля в поля БД
    const updateData: any = {
      updated_at: new Date(),
    };

    if (data.clientName !== undefined) updateData.client_name = data.clientName;
    if (data.clientPhone !== undefined) updateData.contact_phone = data.clientPhone;
    if (data.clientEmail !== undefined) updateData.contact_email = data.clientEmail;
    if (data.company !== undefined) updateData.company = data.company;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.stage !== undefined) updateData.stage = data.stage;
    if (data.managerId !== undefined) updateData.manager_id = data.managerId;
    if (data.deadline !== undefined) updateData.deadline = data.deadline;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.productionDaysCount !== undefined) updateData.production_days_count = data.productionDaysCount;

    const updated = await db
      .update(deals)
      .set(updateData)
      .where(eq(deals.id, id))
      .returning();

    return this.mapDealToUnified(updated[0]);
  }

  // ========== КЛИЕНТЫ ==========
  // В этой ERP нет отдельной таблицы клиентов - они хранятся в сделках
  // Поэтому ищем уникальных клиентов по сделкам

  async searchClients(query: string): Promise<UnifiedClient[]> {
    // Ищем уникальных клиентов из сделок
    const results = await db
      .select({
        client_name: deals.client_name,
        contact_phone: deals.contact_phone,
        contact_email: deals.contact_email,
        company: deals.company,
      })
      .from(deals)
      .where(
        or(
          like(deals.client_name, `%${query}%`),
          like(deals.contact_phone, `%${query}%`),
          like(deals.contact_email, `%${query}%`),
          like(deals.company, `%${query}%`)
        )
      )
      .limit(10);

    // Создаём уникальных клиентов из результатов
    const seen = new Set<string>();
    return results.filter(c => {
      const key = `${c.client_name}-${c.contact_phone}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((c, i) => ({
      id: `client-${i}`,
      name: c.client_name || '',
      phone: c.contact_phone || undefined,
      email: c.contact_email || undefined,
      company: c.company || undefined,
    }));
  }

  async getClientById(id: string): Promise<UnifiedClient | null> {
    // Клиенты не хранятся отдельно в этой ERP
    return null;
  }

  // ========== СПРАВОЧНИКИ ==========

  async getStages(): Promise<UnifiedStage[]> {
    const results = await db
      .select({
        id: dealStages.id,
        key: dealStages.key,
        name: dealStages.name,
        color: dealStages.color,
        order: dealStages.order,
      })
      .from(dealStages)
      .orderBy(dealStages.order);

    return results.map(s => ({
      id: s.key || s.id,
      name: s.name,
      color: s.color || undefined,
      order: s.order || undefined,
    }));
  }

  async getManagers(): Promise<UnifiedManager[]> {
    const results = await db
      .select({
        id: users.id,
        full_name: users.full_name,
        email: users.email,
      })
      .from(users)
      .limit(50);

    return results.map(u => ({
      id: u.id,
      name: u.full_name || 'Unknown',
      email: u.email || undefined,
    }));
  }

  // ========== ПРОДУКТЫ ==========
  // В этой ERP продукты = warehouse_items

  async searchProducts(query: string): Promise<UnifiedProduct[]> {
    const results = await db
      .select({
        id: warehouse_items.id,
        name: warehouse_items.name,
        sku: warehouse_items.sku,
        price: warehouse_items.price,
        unit: warehouse_items.unit,
      })
      .from(warehouse_items)
      .where(
        or(
          like(warehouse_items.name, `%${query}%`),
          like(warehouse_items.sku, `%${query}%`)
        )
      )
      .limit(10);

    return results.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku || undefined,
      price: p.price ? Number(p.price) : undefined,
      unit: p.unit || undefined,
    }));
  }

  async getProductById(id: string): Promise<UnifiedProduct | null> {
    const result = await db
      .select({
        id: warehouse_items.id,
        name: warehouse_items.name,
        sku: warehouse_items.sku,
        price: warehouse_items.price,
        unit: warehouse_items.unit,
      })
      .from(warehouse_items)
      .where(eq(warehouse_items.id, id))
      .limit(1);

    if (result.length === 0) return null;

    const p = result[0];
    return {
      id: p.id,
      name: p.name,
      sku: p.sku || undefined,
      price: p.price ? Number(p.price) : undefined,
      unit: p.unit || undefined,
    };
  }

  // ========== ЗАДАЧИ ==========

  async getMyTasks(userId: string, filter?: TaskFilter): Promise<UnifiedTask[]> {
    let conditions: any[] = [eq(tasks.assignee_id, userId)];

    // Фильтр по статусу
    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        conditions.push(inArray(tasks.status, filter.status));
      } else {
        conditions.push(eq(tasks.status, filter.status));
      }
    } else {
      // По умолчанию - не завершённые и не отменённые
      conditions.push(not(inArray(tasks.status, ['completed', 'cancelled', 'rejected'])));
    }

    // Фильтр по приоритету
    if (filter?.priority) {
      if (Array.isArray(filter.priority)) {
        conditions.push(inArray(tasks.priority, filter.priority));
      } else {
        conditions.push(eq(tasks.priority, filter.priority));
      }
    }

    // Фильтр по дедлайну
    if (filter?.deadlineFrom) {
      conditions.push(gte(tasks.deadline, filter.deadlineFrom));
    }
    if (filter?.deadlineTo) {
      conditions.push(lte(tasks.deadline, filter.deadlineTo));
    }

    const results = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.priority), tasks.deadline)
      .limit(50);

    return Promise.all(results.map(t => this.mapTaskToUnified(t)));
  }

  async getTodayTasks(userId: string): Promise<UnifiedTask[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const results = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.assignee_id, userId),
        not(inArray(tasks.status, ['completed', 'cancelled', 'rejected'])),
        or(
          and(gte(tasks.deadline, today), lt(tasks.deadline, tomorrow)),
          eq(tasks.priority, 'urgent'),
          and(
            lte(tasks.start_date, today),
            or(isNull(tasks.deadline), gte(tasks.deadline, today))
          )
        )
      ))
      .orderBy(desc(tasks.priority), tasks.deadline);

    return Promise.all(results.map(t => this.mapTaskToUnified(t)));
  }

  async getUrgentTasks(userId: string): Promise<UnifiedTask[]> {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const results = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.assignee_id, userId),
        not(inArray(tasks.status, ['completed', 'cancelled', 'rejected'])),
        or(
          eq(tasks.priority, 'urgent'),
          and(not(isNull(tasks.deadline)), lte(tasks.deadline, in24Hours))
        )
      ))
      .orderBy(tasks.deadline, desc(tasks.priority));

    return Promise.all(results.map(t => this.mapTaskToUnified(t)));
  }

  async getUpcomingDeadlines(userId: string, days: number): Promise<UnifiedTask[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const results = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.assignee_id, userId),
        not(inArray(tasks.status, ['completed', 'cancelled', 'rejected'])),
        not(isNull(tasks.deadline)),
        lte(tasks.deadline, futureDate),
        gte(tasks.deadline, now)
      ))
      .orderBy(tasks.deadline);

    return Promise.all(results.map(t => this.mapTaskToUnified(t)));
  }

  async getTasksNeedingAttention(userId: string): Promise<TasksNeedingAttention> {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Получаем все активные задачи пользователя
    const allTasks = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.assignee_id, userId),
        not(inArray(tasks.status, ['completed', 'cancelled', 'rejected']))
      ))
      .orderBy(tasks.deadline, desc(tasks.priority));

    const mappedTasks = await Promise.all(allTasks.map(t => this.mapTaskToUnified(t)));

    // Сортируем по категориям
    const urgent: UnifiedTask[] = [];
    const soon: UnifiedTask[] = [];
    const longRunning: UnifiedTask[] = [];
    const overdue: UnifiedTask[] = [];

    for (const task of mappedTasks) {
      // Просроченные
      if (task.deadline && new Date(task.deadline) < now) {
        overdue.push(task);
        continue;
      }

      // Срочные (priority=urgent ИЛИ дедлайн < 24ч)
      if (task.priority === 'urgent' || (task.deadline && new Date(task.deadline) < in24Hours)) {
        urgent.push(task);
        continue;
      }

      // Скоро (дедлайн < 3 дней)
      if (task.deadline && new Date(task.deadline) < in3Days) {
        soon.push(task);
        continue;
      }

      // Длинные задачи (> 8 часов и не начаты)
      if (task.estimatedHours && task.estimatedHours > 8 && task.status === 'new') {
        // Если есть дедлайн - проверяем что времени осталось мало
        if (task.deadline) {
          const daysNeeded = task.estimatedHours / 8;
          const daysLeft = (new Date(task.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (daysLeft < daysNeeded * 1.5) {
            longRunning.push(task);
          }
        } else {
          // Если нет дедлайна - всё равно напоминаем о длинных задачах
          longRunning.push(task);
        }
      }
    }

    return { urgent, soon, longRunning, overdue };
  }

  async getTaskById(id: string): Promise<UnifiedTask | null> {
    const result = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapTaskToUnified(result[0]);
  }

  async createTask(data: CreateTaskData, createdById?: string): Promise<UnifiedTask> {
    const newTask = await db
      .insert(tasks)
      .values({
        title: data.title,
        description: data.description,
        priority: data.priority || 'normal',
        deadline: data.deadline,
        start_date: data.startDate,
        estimated_hours: data.estimatedHours,
        assignee_id: data.assigneeId,
        created_by: createdById,
        deal_id: data.dealId,
        project_id: data.projectId,
        status: 'new',
      })
      .returning();

    return this.mapTaskToUnified(newTask[0]);
  }

  async updateTask(id: string, data: Partial<UnifiedTask>): Promise<UnifiedTask> {
    const updateData: any = {
      updated_at: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.deadline !== undefined) updateData.deadline = data.deadline;
    if (data.startDate !== undefined) updateData.start_date = data.startDate;
    if (data.estimatedHours !== undefined) updateData.estimated_hours = data.estimatedHours;
    if (data.actualHours !== undefined) updateData.actual_hours = data.actualHours;
    if (data.assigneeId !== undefined) updateData.assignee_id = data.assigneeId;
    if (data.dealId !== undefined) updateData.deal_id = data.dealId;
    if (data.projectId !== undefined) updateData.project_id = data.projectId;

    const updated = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();

    return this.mapTaskToUnified(updated[0]);
  }

  async completeTask(id: string): Promise<UnifiedTask> {
    const updated = await db
      .update(tasks)
      .set({
        status: 'completed',
        updated_at: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();

    return this.mapTaskToUnified(updated[0]);
  }

  async searchTasks(query: string, userId?: string): Promise<UnifiedTask[]> {
    let conditions: any[] = [
      or(
        like(tasks.title, `%${query}%`),
        like(tasks.description, `%${query}%`)
      )
    ];

    if (userId) {
      conditions.push(eq(tasks.assignee_id, userId));
    }

    // Исключаем завершённые
    conditions.push(not(inArray(tasks.status, ['completed', 'cancelled', 'rejected'])));

    const results = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.priority), tasks.deadline)
      .limit(10);

    return Promise.all(results.map(t => this.mapTaskToUnified(t)));
  }

  // ========== ПРИВАТНЫЕ МЕТОДЫ ==========

  private async mapTaskToUnified(task: any): Promise<UnifiedTask> {
    // Получаем имя исполнителя
    let assigneeName: string | undefined;
    if (task.assignee_id) {
      try {
        const assigneeInfo = await db
          .select({ full_name: users.full_name })
          .from(users)
          .where(eq(users.id, task.assignee_id))
          .limit(1);
        if (assigneeInfo.length > 0) {
          assigneeName = assigneeInfo[0].full_name || undefined;
        }
      } catch {}
    }

    // Получаем имя создателя
    let createdByName: string | undefined;
    if (task.created_by) {
      try {
        const creatorInfo = await db
          .select({ full_name: users.full_name })
          .from(users)
          .where(eq(users.id, task.created_by))
          .limit(1);
        if (creatorInfo.length > 0) {
          createdByName = creatorInfo[0].full_name || undefined;
        }
      } catch {}
    }

    // Получаем информацию о сделке
    let dealInfo: { clientName: string; orderNumber?: string; amount?: number } | undefined;
    if (task.deal_id) {
      try {
        const dealData = await db
          .select({
            client_name: deals.client_name,
            order_number: deals.order_number,
            amount: deals.amount,
          })
          .from(deals)
          .where(eq(deals.id, task.deal_id))
          .limit(1);
        if (dealData.length > 0) {
          dealInfo = {
            clientName: dealData[0].client_name || '',
            orderNumber: dealData[0].order_number || undefined,
            amount: dealData[0].amount ? Number(dealData[0].amount) : undefined,
          };
        }
      } catch {}
    }

    // Вычисляем score для приоритизации
    const score = this.calculateTaskScore(task);

    // Проверяем просрочен ли дедлайн
    const now = new Date();
    const isOverdue = task.deadline ? new Date(task.deadline) < now : false;

    // Считаем оставшиеся часы
    let hoursLeft: number | undefined;
    if (task.deadline) {
      hoursLeft = Math.max(0, (new Date(task.deadline).getTime() - now.getTime()) / (1000 * 60 * 60));
    }

    return {
      id: task.id,
      title: task.title || '',
      description: task.description || undefined,
      status: task.status || 'new',
      priority: task.priority || 'normal',
      deadline: task.deadline || undefined,
      startDate: task.start_date || undefined,
      estimatedHours: task.estimated_hours || undefined,
      actualHours: task.actual_hours || undefined,
      assigneeId: task.assignee_id || undefined,
      assigneeName,
      createdById: task.created_by || undefined,
      createdByName,
      dealId: task.deal_id || undefined,
      dealInfo,
      projectId: task.project_id || undefined,
      createdAt: task.created_at || new Date(),
      updatedAt: task.updated_at || undefined,
      score,
      isOverdue,
      hoursLeft,
    };
  }

  private calculateTaskScore(task: any): number {
    let score = 0;

    // Приоритет (базовый)
    const priorityScores: { [key: string]: number } = { urgent: 1000, high: 500, normal: 100, low: 10 };
    score += priorityScores[task.priority] || 100;

    // Дедлайн (чем ближе - тем выше)
    if (task.deadline) {
      const hoursLeft = (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursLeft < 0) score += 2000;       // Просрочена!
      else if (hoursLeft < 24) score += 1500; // < 24ч
      else if (hoursLeft < 72) score += 800;  // < 3 дней
      else if (hoursLeft < 168) score += 300; // < недели
    }

    // Длинные задачи - напоминать заранее
    if (task.estimated_hours && task.estimated_hours > 8) {
      const daysNeeded = task.estimated_hours / 8;
      if (task.deadline) {
        const daysLeft = (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysLeft < daysNeeded * 1.5) score += 600;
      }
    }

    return score;
  }

  private async mapDealToUnified(deal: any): Promise<UnifiedDeal> {
    // Получаем имя этапа
    let stageName = deal.stage;
    if (deal.stage) {
      try {
        const stageInfo = await db
          .select({ name: dealStages.name })
          .from(dealStages)
          .where(eq(dealStages.key, deal.stage))
          .limit(1);
        if (stageInfo.length > 0) {
          stageName = stageInfo[0].name;
        }
      } catch {}
    }

    // Получаем имя менеджера
    let managerName: string | undefined;
    if (deal.manager_id) {
      try {
        const managerInfo = await db
          .select({ full_name: users.full_name })
          .from(users)
          .where(eq(users.id, deal.manager_id))
          .limit(1);
        if (managerInfo.length > 0) {
          managerName = managerInfo[0].full_name || undefined;
        }
      } catch {}
    }

    // Парсим теги
    let tags: string[] = [];
    if (deal.tags) {
      try {
        tags = typeof deal.tags === 'string' ? JSON.parse(deal.tags) : deal.tags;
      } catch {}
    }

    return {
      id: deal.id,
      orderNumber: deal.order_number,
      clientName: deal.client_name || '',
      clientPhone: deal.contact_phone || undefined,
      clientEmail: deal.contact_email || undefined,
      company: deal.company || undefined,
      amount: deal.amount ? Number(deal.amount) : undefined,
      stage: deal.stage || 'new',
      stageName,
      managerId: deal.manager_id || undefined,
      managerName,
      deadline: deal.deadline || undefined,
      tags,
      productionDaysCount: deal.production_days_count || undefined,
      createdAt: deal.created_at || new Date(),
      updatedAt: deal.updated_at || undefined,
      _raw: deal,
    };
  }
}
