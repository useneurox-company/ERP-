import { db } from "../../db";
import { tasks, users, projects, project_stages, deals, project_items, task_comments, task_checklists, task_checklist_items, activity_logs, task_attachments, task_potential_assignees } from "@shared/schema";
import type { InsertTask, InsertTaskComment, InsertTaskChecklist, InsertTaskChecklistItem, InsertActivityLog, InsertTaskAttachment } from "@shared/schema";
import { eq, desc, and, or, asc, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

export class TasksRepository {
  // Helper to ensure dates are properly formatted
  private ensureDate(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) {
      // Check if date is valid before calling toISOString
      if (isNaN(value.getTime())) return null;
      return value.toISOString();
    }
    if (typeof value === 'number') {
      // SQLite timestamps as Unix milliseconds
      const date = new Date(value);
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    }
    return null;
  }

  // Get all tasks
  async getAllTasks(): Promise<any[]> {
    const result = await db
      .select()
      .from(tasks)
      .leftJoin(users, eq(tasks.assignee_id, users.id))
      .leftJoin(projects, eq(tasks.project_id, projects.id))
      .leftJoin(deals, eq(tasks.deal_id, deals.id))
      .leftJoin(project_items, eq(tasks.project_item_id, project_items.id))
      .orderBy(desc(tasks.created_at));

    return result.map((r: any) => ({
      ...r.tasks,
      assignee: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
        email: r.users.email,
      } : null,
      project: r.projects ? {
        id: r.projects.id,
        name: r.projects.name,
      } : null,
      deal: r.deals ? {
        id: r.deals.id,
        client_name: r.deals.client_name,
        company: r.deals.company,
        order_number: r.deals.order_number,
      } : null,
      project_item: r.project_items ? {
        id: r.project_items.id,
        name: r.project_items.name,
        article: r.project_items.article,
        quantity: r.project_items.quantity,
      } : null,
    }));
  }

  // Get tasks by assignee
  async getTasksByAssignee(assigneeId: string): Promise<any[]> {
    const result = await db
      .select()
      .from(tasks)
      .leftJoin(users, eq(tasks.assignee_id, users.id))
      .leftJoin(deals, eq(tasks.deal_id, deals.id))
      .leftJoin(projects, eq(tasks.project_id, projects.id))
      .leftJoin(project_items, eq(tasks.project_item_id, project_items.id))
      .where(eq(tasks.assignee_id, assigneeId))
      .orderBy(desc(tasks.created_at));

    return result.map((r: any) => ({
      ...r.tasks,
      assignee: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
        email: r.users.email,
      } : null,
      deal: r.deals ? {
        id: r.deals.id,
        client_name: r.deals.client_name,
        company: r.deals.company,
        order_number: r.deals.order_number,
      } : null,
      project: r.projects ? {
        id: r.projects.id,
        name: r.projects.name,
      } : null,
      project_item: r.project_items ? {
        id: r.project_items.id,
        name: r.project_items.name,
        article: r.project_items.article,
        quantity: r.project_items.quantity,
      } : null,
    }));
  }

  // Get tasks related to an entity (deal, project, etc.)
  async getTasksByEntity(entityType: string, entityId: string): Promise<any[]> {
    const result = await db
      .select()
      .from(tasks)
      .leftJoin(users, eq(tasks.assignee_id, users.id))
      .where(
        and(
          eq(tasks.related_entity_type, entityType),
          eq(tasks.related_entity_id, entityId)
        )
      )
      .orderBy(desc(tasks.created_at));

    return result.map((r: any) => ({
      ...r.tasks,
      assignee: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
        email: r.users.email,
      } : null,
    }));
  }

  // Get task by ID
  async getTaskById(taskId: string): Promise<any> {
    const result = await db
      .select()
      .from(tasks)
      .leftJoin(users, eq(tasks.assignee_id, users.id))
      .leftJoin(project_items, eq(tasks.project_item_id, project_items.id))
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const r = result[0];
    return {
      ...r.tasks,
      deadline: this.ensureDate(r.tasks.deadline),
      created_at: this.ensureDate(r.tasks.created_at),
      updated_at: this.ensureDate(r.tasks.updated_at),
      completed_at: this.ensureDate(r.tasks.completed_at),
      start_date: this.ensureDate(r.tasks.start_date),
      submitted_for_review_at: this.ensureDate(r.tasks.submitted_for_review_at),
      reviewed_at: this.ensureDate(r.tasks.reviewed_at),
      assignee: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
        email: r.users.email,
      } : null,
      project_item: r.project_items ? {
        id: r.project_items.id,
        name: r.project_items.name,
        article: r.project_items.article,
        quantity: r.project_items.quantity,
      } : null,
    };
  }

  // Create task
  async createTask(taskData: InsertTask): Promise<any> {
    const newTask = {
      id: nanoid(),
      ...taskData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insert(tasks).values(newTask);
    return this.getTaskById(newTask.id);
  }

  // Update task
  async updateTask(taskId: string, taskData: Partial<InsertTask>): Promise<any> {
    await db
      .update(tasks)
      .set({ ...taskData, updated_at: new Date().toISOString() })
      .where(eq(tasks.id, taskId));

    return this.getTaskById(taskId);
  }

  // Delete task
  async deleteTask(taskId: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, taskId));
  }

  // Task Comments
  async getTaskComments(taskId: string): Promise<any[]> {
    const result = await db
      .select()
      .from(task_comments)
      .leftJoin(users, eq(task_comments.author_id, users.id))
      .where(eq(task_comments.task_id, taskId))
      .orderBy(desc(task_comments.created_at));

    return result.map((r: any) => ({
      ...r.task_comments,
      author: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
      } : null,
    }));
  }

  async createTaskComment(commentData: InsertTaskComment): Promise<any> {
    const newComment = {
      id: nanoid(),
      ...commentData,
      created_at: new Date(),
    };

    await db.insert(task_comments).values(newComment);
    return newComment;
  }

  // Task Checklist
  async getTaskChecklist(taskId: string): Promise<any[]> {
    return db
      .select()
      .from(task_checklist_items)
      .where(eq(task_checklist_items.task_id, taskId))
      .orderBy(task_checklist_items.order);
  }

  async createChecklistItem(itemData: InsertTaskChecklistItem): Promise<any> {
    const newItem = {
      id: nanoid(),
      ...itemData,
      created_at: new Date(),
    };

    await db.insert(task_checklist_items).values(newItem);
    return newItem;
  }

  async updateChecklistItem(itemId: string, itemData: Partial<InsertTaskChecklistItem>): Promise<any> {
    await db
      .update(task_checklist_items)
      .set(itemData)
      .where(eq(task_checklist_items.id, itemId));

    return db.select().from(task_checklist_items).where(eq(task_checklist_items.id, itemId)).limit(1);
  }

  async deleteChecklistItem(itemId: string): Promise<void> {
    await db.delete(task_checklist_items).where(eq(task_checklist_items.id, itemId));
  }

  // Named Checklists (группы чеклист-элементов)
  async getTaskChecklists(taskId: string): Promise<any[]> {
    // Получаем все чеклисты задачи
    const checklists = await db
      .select()
      .from(task_checklists)
      .where(eq(task_checklists.task_id, taskId))
      .orderBy(asc(task_checklists.order));

    // Для каждого чеклиста получаем его элементы с информацией об исполнителе
    const result = await Promise.all(
      checklists.map(async (checklist: any) => {
        const itemsResult = await db
          .select()
          .from(task_checklist_items)
          .leftJoin(users, eq(task_checklist_items.assignee_id, users.id))
          .where(eq(task_checklist_items.checklist_id, checklist.id))
          .orderBy(asc(task_checklist_items.order));

        const items = itemsResult.map((r: any) => ({
          ...r.task_checklist_items,
          assignee: r.users ? {
            id: r.users.id,
            username: r.users.username,
            full_name: r.users.full_name,
          } : null,
        }));

        const completedCount = items.filter((i: any) => i.is_completed).length;
        const totalCount = items.length;

        return {
          ...checklist,
          items,
          progress: {
            completed: completedCount,
            total: totalCount,
            percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
          },
        };
      })
    );

    return result;
  }

  async createTaskChecklist(checklistData: InsertTaskChecklist): Promise<any> {
    // Получаем максимальный order для этой задачи
    const existing = await db
      .select()
      .from(task_checklists)
      .where(eq(task_checklists.task_id, checklistData.task_id))
      .orderBy(desc(task_checklists.order))
      .limit(1);

    const maxOrder = existing.length > 0 ? (existing[0].order || 0) + 1 : 0;

    const newChecklist = {
      id: nanoid(),
      ...checklistData,
      order: checklistData.order ?? maxOrder,
      hide_completed: checklistData.hide_completed ?? false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.insert(task_checklists).values(newChecklist);
    return { ...newChecklist, items: [], progress: { completed: 0, total: 0, percentage: 0 } };
  }

  async updateTaskChecklist(checklistId: string, data: Partial<InsertTaskChecklist>): Promise<any> {
    await db
      .update(task_checklists)
      .set({ ...data, updated_at: new Date() })
      .where(eq(task_checklists.id, checklistId));

    const result = await db
      .select()
      .from(task_checklists)
      .where(eq(task_checklists.id, checklistId))
      .limit(1);

    return result[0] || null;
  }

  async deleteTaskChecklist(checklistId: string): Promise<void> {
    // Элементы удалятся автоматически благодаря ON DELETE CASCADE
    await db.delete(task_checklists).where(eq(task_checklists.id, checklistId));
  }

  // Checklist Items для именованных чеклистов
  async createChecklistItemForChecklist(checklistId: string, taskId: string, itemData: { item_text: string; order?: number; deadline?: string; assignee_id?: string }): Promise<any> {
    // Получаем максимальный order для этого чеклиста
    const existing = await db
      .select()
      .from(task_checklist_items)
      .where(eq(task_checklist_items.checklist_id, checklistId))
      .orderBy(desc(task_checklist_items.order))
      .limit(1);

    const maxOrder = existing.length > 0 ? (existing[0].order || 0) + 1 : 0;

    const newItem = {
      id: nanoid(),
      checklist_id: checklistId,
      task_id: taskId,
      item_text: itemData.item_text,
      is_completed: false,
      order: itemData.order ?? maxOrder,
      deadline: itemData.deadline || null,
      assignee_id: itemData.assignee_id || null,
      created_at: new Date(),
    };

    await db.insert(task_checklist_items).values(newItem);

    // Вернём с информацией об исполнителе
    if (newItem.assignee_id) {
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, newItem.assignee_id))
        .limit(1);

      return {
        ...newItem,
        assignee: userResult[0] ? {
          id: userResult[0].id,
          username: userResult[0].username,
          full_name: userResult[0].full_name,
        } : null,
      };
    }

    return { ...newItem, assignee: null };
  }

  async updateChecklistItemWithAssignee(itemId: string, itemData: Partial<{ item_text: string; is_completed: boolean; order: number; deadline: string; assignee_id: string }>): Promise<any> {
    await db
      .update(task_checklist_items)
      .set(itemData)
      .where(eq(task_checklist_items.id, itemId));

    const result = await db
      .select()
      .from(task_checklist_items)
      .leftJoin(users, eq(task_checklist_items.assignee_id, users.id))
      .where(eq(task_checklist_items.id, itemId))
      .limit(1);

    if (result.length === 0) return null;

    return {
      ...result[0].task_checklist_items,
      assignee: result[0].users ? {
        id: result[0].users.id,
        username: result[0].users.username,
        full_name: result[0].users.full_name,
      } : null,
    };
  }

  // Task Attachments
  async getTaskAttachments(taskId: string): Promise<any[]> {
    const result = await db
      .select()
      .from(task_attachments)
      .leftJoin(users, eq(task_attachments.uploaded_by, users.id))
      .where(eq(task_attachments.task_id, taskId))
      .orderBy(desc(task_attachments.created_at));

    return result.map((r: any) => ({
      ...r.task_attachments,
      uploaded_by_user: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
      } : null,
    }));
  }

  async createTaskAttachment(attachmentData: InsertTaskAttachment): Promise<any> {
    const newAttachment = {
      id: nanoid(),
      ...attachmentData,
      created_at: new Date(),
    };

    await db.insert(task_attachments).values(newAttachment);

    // Update attachments count - get current count
    const countResult = await db
      .select()
      .from(task_attachments)
      .where(eq(task_attachments.task_id, attachmentData.task_id));

    await db
      .update(tasks)
      .set({
        attachments_count: countResult.length
      })
      .where(eq(tasks.id, attachmentData.task_id));

    return newAttachment;
  }

  async deleteTaskAttachment(attachmentId: string): Promise<void> {
    const attachment = await db
      .select()
      .from(task_attachments)
      .where(eq(task_attachments.id, attachmentId))
      .limit(1);

    if (attachment.length > 0) {
      await db.delete(task_attachments).where(eq(task_attachments.id, attachmentId));

      // Update attachments count - get current count
      const countResult = await db
        .select()
        .from(task_attachments)
        .where(eq(task_attachments.task_id, attachment[0].task_id));

      await db
        .update(tasks)
        .set({
          attachments_count: countResult.length
        })
        .where(eq(tasks.id, attachment[0].task_id));
    }
  }

  // Review/Approval Methods
  async submitTaskForReview(taskId: string, userId: string): Promise<any> {
    await db
      .update(tasks)
      .set({
        status: 'pending_review',
        submitted_for_review_at: new Date(),
        updated_at: new Date()
      })
      .where(eq(tasks.id, taskId));

    return this.getTaskById(taskId);
  }

  async approveTask(taskId: string, reviewerId: string): Promise<any> {
    await db
      .update(tasks)
      .set({
        status: 'completed',
        review_status: 'approved',
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        completed_at: new Date(),
        updated_at: new Date()
      })
      .where(eq(tasks.id, taskId));

    return this.getTaskById(taskId);
  }

  async rejectTask(taskId: string, reviewerId: string, reason: string): Promise<any> {
    await db
      .update(tasks)
      .set({
        status: 'rejected',
        review_status: 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        rejection_reason: reason,
        updated_at: new Date()
      })
      .where(eq(tasks.id, taskId));

    return this.getTaskById(taskId);
  }

  // Get tasks by entity (using direct references)
  async getTasksByDeal(dealId: string): Promise<any[]> {
    const result = await db
      .select()
      .from(tasks)
      .leftJoin(users, eq(tasks.assignee_id, users.id))
      .leftJoin(projects, eq(tasks.project_id, projects.id))
      .leftJoin(project_stages, eq(tasks.project_stage_id, project_stages.id))
      .leftJoin(deals, eq(tasks.deal_id, deals.id))
      .leftJoin(project_items, eq(tasks.project_item_id, project_items.id))
      .where(eq(tasks.deal_id, dealId))
      .orderBy(desc(tasks.created_at));

    return result.map((r: any) => ({
      ...r.tasks,
      assignee: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
        email: r.users.email,
      } : null,
      project: r.projects ? {
        id: r.projects.id,
        name: r.projects.name,
      } : null,
      stage: r.project_stages ? {
        id: r.project_stages.id,
        name: r.project_stages.name,
      } : null,
      deal: r.deals ? {
        id: r.deals.id,
        client_name: r.deals.client_name,
        company: r.deals.company,
        order_number: r.deals.order_number,
      } : null,
      project_item: r.project_items ? {
        id: r.project_items.id,
        name: r.project_items.name,
        article: r.project_items.article,
        quantity: r.project_items.quantity,
      } : null,
    }));
  }

  async getTasksByProject(projectId: string): Promise<any[]> {
    const result = await db
      .select()
      .from(tasks)
      .leftJoin(users, eq(tasks.assignee_id, users.id))
      .leftJoin(deals, eq(tasks.deal_id, deals.id))
      .leftJoin(projects, eq(tasks.project_id, projects.id))
      .leftJoin(project_items, eq(tasks.project_item_id, project_items.id))
      .where(eq(tasks.project_id, projectId))
      .orderBy(desc(tasks.created_at));

    return result.map((r: any) => ({
      ...r.tasks,
      assignee: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
        email: r.users.email,
      } : null,
      deal: r.deals ? {
        id: r.deals.id,
        client_name: r.deals.client_name,
        company: r.deals.company,
        order_number: r.deals.order_number,
      } : null,
      project: r.projects ? {
        id: r.projects.id,
        name: r.projects.name,
      } : null,
      project_item: r.project_items ? {
        id: r.project_items.id,
        name: r.project_items.name,
        article: r.project_items.article,
        quantity: r.project_items.quantity,
      } : null,
    }));
  }

  async getTasksByStage(stageId: string): Promise<any[]> {
    const result = await db
      .select()
      .from(tasks)
      .leftJoin(users, eq(tasks.assignee_id, users.id))
      .leftJoin(deals, eq(tasks.deal_id, deals.id))
      .leftJoin(projects, eq(tasks.project_id, projects.id))
      .leftJoin(project_items, eq(tasks.project_item_id, project_items.id))
      .where(eq(tasks.project_stage_id, stageId))
      .orderBy(desc(tasks.created_at));

    return result.map((r: any) => ({
      ...r.tasks,
      assignee: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
        email: r.users.email,
      } : null,
      deal: r.deals ? {
        id: r.deals.id,
        client_name: r.deals.client_name,
        company: r.deals.company,
        order_number: r.deals.order_number,
      } : null,
      project: r.projects ? {
        id: r.projects.id,
        name: r.projects.name,
      } : null,
      project_item: r.project_items ? {
        id: r.project_items.id,
        name: r.project_items.name,
        article: r.project_items.article,
        quantity: r.project_items.quantity,
      } : null,
    }));
  }

  async getTasksByProjectItem(itemId: string): Promise<any[]> {
    const result = await db
      .select()
      .from(tasks)
      .leftJoin(users, eq(tasks.assignee_id, users.id))
      .leftJoin(deals, eq(tasks.deal_id, deals.id))
      .leftJoin(projects, eq(tasks.project_id, projects.id))
      .leftJoin(project_items, eq(tasks.project_item_id, project_items.id))
      .where(eq(tasks.project_item_id, itemId))
      .orderBy(desc(tasks.created_at));

    return result.map((r: any) => ({
      ...r.tasks,
      assignee: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
        email: r.users.email,
      } : null,
      deal: r.deals ? {
        id: r.deals.id,
        client_name: r.deals.client_name,
        company: r.deals.company,
        order_number: r.deals.order_number,
      } : null,
      project: r.projects ? {
        id: r.projects.id,
        name: r.projects.name,
      } : null,
      project_item: r.project_items ? {
        id: r.project_items.id,
        name: r.project_items.name,
        article: r.project_items.article,
        quantity: r.project_items.quantity,
      } : null,
    }));
  }

  // ============================================
  // POOL METHODS (Пул исполнителей)
  // ============================================

  // Добавить потенциальных исполнителей
  async addPotentialAssignees(taskId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;

    const values = userIds.map(userId => ({
      id: nanoid(),
      task_id: taskId,
      user_id: userId,
      added_at: new Date(),
    }));

    await db.insert(task_potential_assignees).values(values);
  }

  // Удалить потенциального исполнителя
  async removePotentialAssignee(taskId: string, userId: string): Promise<void> {
    await db.delete(task_potential_assignees)
      .where(and(
        eq(task_potential_assignees.task_id, taskId),
        eq(task_potential_assignees.user_id, userId)
      ));
  }

  // Получить список потенциальных исполнителей
  async getPotentialAssignees(taskId: string): Promise<any[]> {
    const result = await db
      .select()
      .from(task_potential_assignees)
      .leftJoin(users, eq(task_potential_assignees.user_id, users.id))
      .where(eq(task_potential_assignees.task_id, taskId))
      .orderBy(desc(task_potential_assignees.added_at));

    return result.map((r: any) => ({
      id: r.task_potential_assignees.id,
      task_id: r.task_potential_assignees.task_id,
      user_id: r.task_potential_assignees.user_id,
      added_at: r.task_potential_assignees.added_at,
      user: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
        email: r.users.email,
      } : null,
    }));
  }

  // Взять задачу из пула
  async takeTask(taskId: string, userId: string): Promise<any> {
    // Проверяем, что пользователь в списке потенциальных исполнителей
    const potential = await db
      .select()
      .from(task_potential_assignees)
      .where(and(
        eq(task_potential_assignees.task_id, taskId),
        eq(task_potential_assignees.user_id, userId)
      ))
      .limit(1);

    if (potential.length === 0) {
      throw new Error('User is not in the potential assignees list');
    }

    // Устанавливаем исполнителя и время взятия
    await db
      .update(tasks)
      .set({
        assignee_id: userId,
        taken_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .where(eq(tasks.id, taskId));

    // Удаляем все записи из пула для этой задачи
    await db.delete(task_potential_assignees)
      .where(eq(task_potential_assignees.task_id, taskId));

    return this.getTaskById(taskId);
  }

  // Очистить пул исполнителей
  async clearPotentialAssignees(taskId: string): Promise<void> {
    await db.delete(task_potential_assignees)
      .where(eq(task_potential_assignees.task_id, taskId));
  }

  // Установить пул исполнителей (полная замена)
  async setPotentialAssignees(taskId: string, userIds: string[]): Promise<void> {
    // Сначала очищаем
    await this.clearPotentialAssignees(taskId);
    // Затем добавляем новых
    await this.addPotentialAssignees(taskId, userIds);
  }

  // Получить задачи из пула, доступные пользователю
  async getPoolTasksForUser(userId: string): Promise<any[]> {
    // Получаем ID задач, где пользователь в пуле
    const potentialTasks = await db
      .select({ task_id: task_potential_assignees.task_id })
      .from(task_potential_assignees)
      .where(eq(task_potential_assignees.user_id, userId));

    if (potentialTasks.length === 0) return [];

    const taskIds = potentialTasks.map(t => t.task_id);

    const result = await db
      .select()
      .from(tasks)
      .leftJoin(users, eq(tasks.assignee_id, users.id))
      .leftJoin(projects, eq(tasks.project_id, projects.id))
      .leftJoin(deals, eq(tasks.deal_id, deals.id))
      .leftJoin(project_items, eq(tasks.project_item_id, project_items.id))
      .where(and(
        inArray(tasks.id, taskIds),
        eq(tasks.assignment_type, 'pool')
      ))
      .orderBy(desc(tasks.created_at));

    return result.map((r: any) => ({
      ...r.tasks,
      assignee: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
        email: r.users.email,
      } : null,
      project: r.projects ? {
        id: r.projects.id,
        name: r.projects.name,
      } : null,
      deal: r.deals ? {
        id: r.deals.id,
        client_name: r.deals.client_name,
        company: r.deals.company,
        order_number: r.deals.order_number,
      } : null,
      project_item: r.project_items ? {
        id: r.project_items.id,
        name: r.project_items.name,
        article: r.project_items.article,
        quantity: r.project_items.quantity,
      } : null,
    }));
  }

  // Получить задачу с информацией о пуле
  async getTaskWithPool(taskId: string): Promise<any> {
    const task = await this.getTaskById(taskId);
    if (!task) return null;

    const potentialAssignees = await this.getPotentialAssignees(taskId);

    return {
      ...task,
      potential_assignees: potentialAssignees,
    };
  }
}

// Activity Logs Repository
export class ActivityLogsRepository {
  // Log an activity
  async logActivity(activityData: InsertActivityLog): Promise<any> {
    const newLog = {
      id: nanoid(),
      ...activityData,
      created_at: new Date(),
    };

    await db.insert(activity_logs).values(newLog);
    return newLog;
  }

  // Get activity logs for an entity
  async getActivityLogs(entityType: string, entityId: string, limit: number = 30): Promise<any[]> {
    const result = await db
      .select()
      .from(activity_logs)
      .leftJoin(users, eq(activity_logs.user_id, users.id))
      .where(
        and(
          eq(activity_logs.entity_type, entityType),
          eq(activity_logs.entity_id, entityId)
        )
      )
      .orderBy(desc(activity_logs.created_at))
      .limit(limit);

    return result.map((r: any) => ({
      ...r.activity_logs,
      user: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
      } : null,
    }));
  }

  // Get all activity logs for a user
  async getActivityLogsByUser(userId: string): Promise<any[]> {
    const result = await db
      .select()
      .from(activity_logs)
      .leftJoin(users, eq(activity_logs.user_id, users.id))
      .where(eq(activity_logs.user_id, userId))
      .orderBy(desc(activity_logs.created_at));

    return result.map((r: any) => ({
      ...r.activity_logs,
      user: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
      } : null,
    }));
  }
}

export const tasksRepository = new TasksRepository();
export const activityLogsRepository = new ActivityLogsRepository();
