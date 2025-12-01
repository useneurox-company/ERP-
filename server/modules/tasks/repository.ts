import { db } from "../../db";
import { tasks, users, projects, project_stages, deals, project_items, task_comments, task_checklist_items, activity_logs, task_attachments } from "@shared/schema";
import type { InsertTask, InsertTaskComment, InsertTaskChecklistItem, InsertActivityLog, InsertTaskAttachment } from "@shared/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { nanoid } from "nanoid";

export class TasksRepository {
  // Helper to ensure dates are properly formatted
  private ensureDate(value: any): string | null {
    console.log('[ensureDate] input:', value, 'type:', typeof value, 'isDate:', value instanceof Date);
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
    console.log('[ensureDate] FAILED to convert:', value);
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

    return result.map(r => ({
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

    return result.map(r => ({
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

    return result.map(r => ({
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

    return result.map(r => ({
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

  // Task Attachments
  async getTaskAttachments(taskId: string): Promise<any[]> {
    const result = await db
      .select()
      .from(task_attachments)
      .leftJoin(users, eq(task_attachments.uploaded_by, users.id))
      .where(eq(task_attachments.task_id, taskId))
      .orderBy(desc(task_attachments.created_at));

    return result.map(r => ({
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

    return result.map(r => ({
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

    return result.map(r => ({
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

    return result.map(r => ({
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

    return result.map(r => ({
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

    return result.map(r => ({
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

    return result.map(r => ({
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
