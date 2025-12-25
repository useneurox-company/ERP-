import { db } from "../../db";
import {
  boards,
  board_columns,
  board_cards,
  board_labels,
  board_card_labels,
  board_card_attachments,
  board_members,
  board_card_checklists,
  board_card_checklist_items,
  board_card_members,
  board_card_potential_assignees,
  users
} from "@shared/schema";
import { eq, asc, and, inArray, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

const genId = () => nanoid();

export const boardRepository = {
  // ============ BOARDS ============

  async getAllBoards() {
    const result = await db
      .select()
      .from(boards)
      .leftJoin(users, eq(boards.created_by, users.id))
      .where(eq(boards.is_active, true))
      .orderBy(asc(boards.created_at));

    return result.map(r => ({
      ...r.boards,
      creator: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
      } : null,
    }));
  },

  async getBoardById(id: string) {
    const result = await db
      .select()
      .from(boards)
      .where(eq(boards.id, id))
      .limit(1);

    return result[0] || null;
  },

  async getBoardWithData(boardId: string) {
    // Get board
    const board = await this.getBoardById(boardId);
    if (!board) return null;

    // Get columns
    const columns = await db
      .select()
      .from(board_columns)
      .where(eq(board_columns.board_id, boardId))
      .orderBy(asc(board_columns.order));

    // Get cards for all columns
    const columnIds = columns.map(c => c.id);
    let cards: any[] = [];
    if (columnIds.length > 0) {
      cards = await db
        .select()
        .from(board_cards)
        .leftJoin(users, eq(board_cards.assigned_to, users.id))
        .where(inArray(board_cards.column_id, columnIds))
        .orderBy(asc(board_cards.order));
    }

    // Get labels
    const labels = await db
      .select()
      .from(board_labels)
      .where(eq(board_labels.board_id, boardId));

    // Get card-label relations
    const cardIds = cards.map(c => c.board_cards.id);
    let cardLabels: any[] = [];
    let cardAttachments: any[] = [];
    if (cardIds.length > 0) {
      cardLabels = await db
        .select()
        .from(board_card_labels)
        .where(inArray(board_card_labels.card_id, cardIds));

      // Get attachments for all cards
      cardAttachments = await db
        .select()
        .from(board_card_attachments)
        .where(inArray(board_card_attachments.card_id, cardIds));
    }

    // Build response with cards organized by column
    const columnsWithCards = columns.map(col => ({
      ...col,
      cards: cards
        .filter(c => c.board_cards.column_id === col.id)
        .map(c => ({
          ...c.board_cards,
          assignee: c.users ? {
            id: c.users.id,
            username: c.users.username,
            full_name: c.users.full_name,
          } : null,
          labels: cardLabels
            .filter(cl => cl.card_id === c.board_cards.id)
            .map(cl => labels.find(l => l.id === cl.label_id))
            .filter(Boolean),
          attachments: cardAttachments
            .filter(a => a.card_id === c.board_cards.id),
        })),
    }));

    return {
      ...board,
      columns: columnsWithCards,
      labels,
    };
  },

  async createBoard(data: any) {
    const id = genId();
    const now = new Date();

    await db.insert(boards).values({
      id,
      name: data.name,
      description: data.description || null,
      created_by: data.created_by || null,
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    // Create default columns
    const defaultColumns = [
      { title: 'Сделать', color: '#6366f1', order: 0 },
      { title: 'В работе', color: '#f59e0b', order: 1 },
      { title: 'Готово', color: '#22c55e', order: 2 },
    ];

    for (const col of defaultColumns) {
      await db.insert(board_columns).values({
        id: genId(),
        board_id: id,
        title: col.title,
        color: col.color,
        order: col.order,
        created_at: now,
      });
    }

    return this.getBoardWithData(id);
  },

  async updateBoard(id: string, data: any) {
    await db.update(boards)
      .set({
        name: data.name,
        description: data.description,
        updated_at: new Date(),
      })
      .where(eq(boards.id, id));

    return this.getBoardById(id);
  },

  async deleteBoard(id: string) {
    await db.update(boards)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(boards.id, id));
  },

  // ============ COLUMNS ============

  async createColumn(boardId: string, data: any) {
    const id = genId();

    // Get max order
    const existing = await db
      .select()
      .from(board_columns)
      .where(eq(board_columns.board_id, boardId))
      .orderBy(asc(board_columns.order));

    const maxOrder = existing.length > 0 ? Math.max(...existing.map(c => c.order)) + 1 : 0;

    await db.insert(board_columns).values({
      id,
      board_id: boardId,
      title: data.title,
      color: data.color || '#6366f1',
      order: data.order ?? maxOrder,
      created_at: new Date(),
    });

    return this.getColumnById(id);
  },

  async getColumnById(id: string) {
    const result = await db
      .select()
      .from(board_columns)
      .where(eq(board_columns.id, id))
      .limit(1);
    return result[0] || null;
  },

  async updateColumn(id: string, data: any) {
    await db.update(board_columns)
      .set({
        title: data.title,
        color: data.color,
      })
      .where(eq(board_columns.id, id));

    return this.getColumnById(id);
  },

  async deleteColumn(id: string) {
    await db.delete(board_columns).where(eq(board_columns.id, id));
  },

  async reorderColumns(boardId: string, columnOrders: { id: string; order: number }[]) {
    for (const { id, order } of columnOrders) {
      await db.update(board_columns)
        .set({ order })
        .where(and(eq(board_columns.id, id), eq(board_columns.board_id, boardId)));
    }
  },

  // ============ CARDS ============

  async createCard(columnId: string, data: any) {
    const id = genId();
    const now = new Date();

    // Get max order in column
    const existing = await db
      .select()
      .from(board_cards)
      .where(eq(board_cards.column_id, columnId))
      .orderBy(asc(board_cards.order));

    const maxOrder = existing.length > 0 ? Math.max(...existing.map(c => c.order)) + 1 : 0;

    await db.insert(board_cards).values({
      id,
      column_id: columnId,
      title: data.title,
      description: data.description || null,
      order: data.order ?? maxOrder,
      assigned_to: data.assigned_to || null,
      priority: data.priority || 'normal',
      due_date: data.due_date ? new Date(data.due_date) : null,
      created_by: data.created_by || null,
      created_at: now,
      updated_at: now,
    });

    return this.getCardById(id);
  },

  async getCardById(id: string) {
    const result = await db
      .select()
      .from(board_cards)
      .leftJoin(users, eq(board_cards.assigned_to, users.id))
      .where(eq(board_cards.id, id))
      .limit(1);

    if (!result[0]) return null;

    const labels = await db
      .select()
      .from(board_card_labels)
      .leftJoin(board_labels, eq(board_card_labels.label_id, board_labels.id))
      .where(eq(board_card_labels.card_id, id));

    const attachments = await db
      .select()
      .from(board_card_attachments)
      .where(eq(board_card_attachments.card_id, id));

    return {
      ...result[0].board_cards,
      assignee: result[0].users ? {
        id: result[0].users.id,
        username: result[0].users.username,
        full_name: result[0].users.full_name,
      } : null,
      labels: labels.map(l => l.board_labels).filter(Boolean),
      attachments,
    };
  },

  async updateCard(id: string, data: any) {
    const updateData: any = { updated_at: new Date() };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.assigned_to !== undefined) updateData.assigned_to = data.assigned_to;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.due_date !== undefined) updateData.due_date = data.due_date ? new Date(data.due_date) : null;
    if (data.is_completed !== undefined) updateData.is_completed = data.is_completed;
    if (data.assignment_type !== undefined) updateData.assignment_type = data.assignment_type;
    if (data.taken_at !== undefined) updateData.taken_at = data.taken_at;

    await db.update(board_cards)
      .set(updateData)
      .where(eq(board_cards.id, id));

    return this.getCardById(id);
  },

  async deleteCard(id: string) {
    await db.delete(board_cards).where(eq(board_cards.id, id));
  },

  async moveCard(cardId: string, newColumnId: string, newOrder: number) {
    // Get current card
    const card = await db
      .select()
      .from(board_cards)
      .where(eq(board_cards.id, cardId))
      .limit(1);

    if (!card[0]) return null;

    const oldColumnId = card[0].column_id;
    const oldOrder = card[0].order;

    // Update orders in old column (shift down)
    if (oldColumnId !== newColumnId) {
      await db.execute(`
        UPDATE board_cards
        SET "order" = "order" - 1
        WHERE column_id = '${oldColumnId}' AND "order" > ${oldOrder}
      `);
    }

    // Update orders in new column (shift up)
    await db.execute(`
      UPDATE board_cards
      SET "order" = "order" + 1
      WHERE column_id = '${newColumnId}' AND "order" >= ${newOrder}
      ${oldColumnId === newColumnId ? `AND id != '${cardId}'` : ''}
    `);

    // Move card
    await db.update(board_cards)
      .set({
        column_id: newColumnId,
        order: newOrder,
        updated_at: new Date(),
      })
      .where(eq(board_cards.id, cardId));

    return this.getCardById(cardId);
  },

  // ============ LABELS ============

  async createLabel(boardId: string, data: any) {
    const id = genId();

    await db.insert(board_labels).values({
      id,
      board_id: boardId,
      name: data.name,
      color: data.color,
      created_at: new Date(),
    });

    return this.getLabelById(id);
  },

  async getLabelById(id: string) {
    const result = await db
      .select()
      .from(board_labels)
      .where(eq(board_labels.id, id))
      .limit(1);
    return result[0] || null;
  },

  async updateLabel(id: string, data: any) {
    await db.update(board_labels)
      .set({ name: data.name, color: data.color })
      .where(eq(board_labels.id, id));
    return this.getLabelById(id);
  },

  async deleteLabel(id: string) {
    await db.delete(board_labels).where(eq(board_labels.id, id));
  },

  async addLabelToCard(cardId: string, labelId: string) {
    await db.insert(board_card_labels).values({
      id: genId(),
      card_id: cardId,
      label_id: labelId,
    });
  },

  async removeLabelFromCard(cardId: string, labelId: string) {
    await db.delete(board_card_labels)
      .where(and(
        eq(board_card_labels.card_id, cardId),
        eq(board_card_labels.label_id, labelId)
      ));
  },

  // ============ ATTACHMENTS ============

  async createAttachment(cardId: string, data: any) {
    const id = genId();

    await db.insert(board_card_attachments).values({
      id,
      card_id: cardId,
      file_name: data.file_name,
      file_path: data.file_path,
      file_size: data.file_size || null,
      mime_type: data.mime_type || null,
      uploaded_by: data.uploaded_by || null,
      created_at: new Date(),
    });

    return this.getAttachmentById(id);
  },

  async getAttachmentById(id: string) {
    const result = await db
      .select()
      .from(board_card_attachments)
      .where(eq(board_card_attachments.id, id))
      .limit(1);
    return result[0] || null;
  },

  async deleteAttachment(id: string) {
    const attachment = await this.getAttachmentById(id);
    await db.delete(board_card_attachments).where(eq(board_card_attachments.id, id));
    return attachment;
  },

  // ============ MEMBERS ============

  async addMember(boardId: string, userId: string, role: string = 'member') {
    await db.insert(board_members).values({
      id: genId(),
      board_id: boardId,
      user_id: userId,
      role,
      added_at: new Date(),
    });
  },

  async removeMember(boardId: string, userId: string) {
    await db.delete(board_members)
      .where(and(
        eq(board_members.board_id, boardId),
        eq(board_members.user_id, userId)
      ));
  },

  async getBoardMembers(boardId: string) {
    const result = await db
      .select()
      .from(board_members)
      .leftJoin(users, eq(board_members.user_id, users.id))
      .where(eq(board_members.board_id, boardId));

    return result.map(r => ({
      ...r.board_members,
      user: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
      } : null,
    }));
  },

  // ============ CARD CHECKLISTS ============

  async getCardChecklists(cardId: string) {
    // Get all checklists for card
    const checklists = await db
      .select()
      .from(board_card_checklists)
      .where(eq(board_card_checklists.card_id, cardId))
      .orderBy(asc(board_card_checklists.order));

    // For each checklist get items with assignee info
    const result = await Promise.all(
      checklists.map(async (checklist) => {
        const itemsResult = await db
          .select()
          .from(board_card_checklist_items)
          .leftJoin(users, eq(board_card_checklist_items.assignee_id, users.id))
          .where(eq(board_card_checklist_items.checklist_id, checklist.id))
          .orderBy(asc(board_card_checklist_items.order));

        const items = itemsResult.map(r => ({
          ...r.board_card_checklist_items,
          assignee: r.users ? {
            id: r.users.id,
            username: r.users.username,
            full_name: r.users.full_name,
          } : null,
        }));

        const completedCount = items.filter(i => i.is_completed).length;
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
  },

  async createCardChecklist(cardId: string, data: { name: string; order?: number }) {
    // Get max order
    const existing = await db
      .select()
      .from(board_card_checklists)
      .where(eq(board_card_checklists.card_id, cardId))
      .orderBy(desc(board_card_checklists.order))
      .limit(1);

    const maxOrder = existing.length > 0 ? (existing[0].order || 0) + 1 : 0;

    const newChecklist = {
      id: genId(),
      card_id: cardId,
      name: data.name,
      order: data.order ?? maxOrder,
      hide_completed: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.insert(board_card_checklists).values(newChecklist);
    return { ...newChecklist, items: [], progress: { completed: 0, total: 0, percentage: 0 } };
  },

  async updateCardChecklist(checklistId: string, data: { name?: string; hide_completed?: boolean }) {
    await db
      .update(board_card_checklists)
      .set({ ...data, updated_at: new Date() })
      .where(eq(board_card_checklists.id, checklistId));

    const result = await db
      .select()
      .from(board_card_checklists)
      .where(eq(board_card_checklists.id, checklistId))
      .limit(1);

    return result[0] || null;
  },

  async deleteCardChecklist(checklistId: string) {
    await db.delete(board_card_checklists).where(eq(board_card_checklists.id, checklistId));
  },

  async createChecklistItem(checklistId: string, cardId: string, data: { item_text: string; order?: number; deadline?: string; assignee_id?: string }) {
    // Get max order
    const existing = await db
      .select()
      .from(board_card_checklist_items)
      .where(eq(board_card_checklist_items.checklist_id, checklistId))
      .orderBy(desc(board_card_checklist_items.order))
      .limit(1);

    const maxOrder = existing.length > 0 ? (existing[0].order || 0) + 1 : 0;

    const newItem = {
      id: genId(),
      checklist_id: checklistId,
      card_id: cardId,
      item_text: data.item_text,
      is_completed: false,
      order: data.order ?? maxOrder,
      deadline: data.deadline || null,
      assignee_id: data.assignee_id || null,
      created_at: new Date(),
    };

    await db.insert(board_card_checklist_items).values(newItem);

    // Return with assignee if set
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
  },

  async updateChecklistItem(itemId: string, data: { item_text?: string; is_completed?: boolean; order?: number; deadline?: string; assignee_id?: string }) {
    await db
      .update(board_card_checklist_items)
      .set(data)
      .where(eq(board_card_checklist_items.id, itemId));

    const result = await db
      .select()
      .from(board_card_checklist_items)
      .leftJoin(users, eq(board_card_checklist_items.assignee_id, users.id))
      .where(eq(board_card_checklist_items.id, itemId))
      .limit(1);

    if (result.length === 0) return null;

    return {
      ...result[0].board_card_checklist_items,
      assignee: result[0].users ? {
        id: result[0].users.id,
        username: result[0].users.username,
        full_name: result[0].users.full_name,
      } : null,
    };
  },

  async deleteChecklistItem(itemId: string) {
    await db.delete(board_card_checklist_items).where(eq(board_card_checklist_items.id, itemId));
  },

  // ============ CARD MEMBERS ============

  async getCardMembers(cardId: string) {
    const result = await db
      .select()
      .from(board_card_members)
      .leftJoin(users, eq(board_card_members.user_id, users.id))
      .where(eq(board_card_members.card_id, cardId));

    return result.map(r => ({
      ...r.board_card_members,
      user: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
      } : null,
    }));
  },

  async addCardMember(cardId: string, userId: string) {
    // Check if already exists
    const existing = await db
      .select()
      .from(board_card_members)
      .where(and(
        eq(board_card_members.card_id, cardId),
        eq(board_card_members.user_id, userId)
      ))
      .limit(1);

    if (existing.length > 0) return existing[0];

    const newMember = {
      id: genId(),
      card_id: cardId,
      user_id: userId,
      added_at: new Date(),
    };

    await db.insert(board_card_members).values(newMember);
    return newMember;
  },

  async removeCardMember(cardId: string, userId: string) {
    await db.delete(board_card_members)
      .where(and(
        eq(board_card_members.card_id, cardId),
        eq(board_card_members.user_id, userId)
      ));
  },

  // ============ CARD POOL (Пул исполнителей) ============

  async addCardPotentialAssignees(cardId: string, userIds: string[]) {
    if (userIds.length === 0) return;

    const values = userIds.map(userId => ({
      id: genId(),
      card_id: cardId,
      user_id: userId,
      added_at: new Date(),
    }));

    await db.insert(board_card_potential_assignees).values(values);
  },

  async removeCardPotentialAssignee(cardId: string, userId: string) {
    await db.delete(board_card_potential_assignees)
      .where(and(
        eq(board_card_potential_assignees.card_id, cardId),
        eq(board_card_potential_assignees.user_id, userId)
      ));
  },

  async getCardPotentialAssignees(cardId: string) {
    const result = await db
      .select()
      .from(board_card_potential_assignees)
      .leftJoin(users, eq(board_card_potential_assignees.user_id, users.id))
      .where(eq(board_card_potential_assignees.card_id, cardId))
      .orderBy(desc(board_card_potential_assignees.added_at));

    return result.map(r => ({
      id: r.board_card_potential_assignees.id,
      card_id: r.board_card_potential_assignees.card_id,
      user_id: r.board_card_potential_assignees.user_id,
      added_at: r.board_card_potential_assignees.added_at,
      user: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
        email: r.users.email,
      } : null,
    }));
  },

  async takeCard(cardId: string, userId: string) {
    // Check user is in pool
    const potential = await db
      .select()
      .from(board_card_potential_assignees)
      .where(and(
        eq(board_card_potential_assignees.card_id, cardId),
        eq(board_card_potential_assignees.user_id, userId)
      ))
      .limit(1);

    if (potential.length === 0) {
      throw new Error('User is not in the potential assignees list');
    }

    // Set assignee and taken_at
    await db
      .update(board_cards)
      .set({
        assigned_to: userId,
        taken_at: new Date().toISOString(),
        updated_at: new Date(),
      })
      .where(eq(board_cards.id, cardId));

    // Clear pool
    await db.delete(board_card_potential_assignees)
      .where(eq(board_card_potential_assignees.card_id, cardId));

    return this.getCardById(cardId);
  },

  async clearCardPotentialAssignees(cardId: string) {
    await db.delete(board_card_potential_assignees)
      .where(eq(board_card_potential_assignees.card_id, cardId));
  },

  async setCardPotentialAssignees(cardId: string, userIds: string[]) {
    await this.clearCardPotentialAssignees(cardId);
    await this.addCardPotentialAssignees(cardId, userIds);
  },

  async getCardWithPool(cardId: string) {
    const card = await this.getCardById(cardId);
    if (!card) return null;

    const potentialAssignees = await this.getCardPotentialAssignees(cardId);

    return {
      ...card,
      potential_assignees: potentialAssignees,
    };
  },

  async getPoolCardsForUser(userId: string) {
    // Get card IDs where user is in pool
    const potentialCards = await db
      .select({ card_id: board_card_potential_assignees.card_id })
      .from(board_card_potential_assignees)
      .where(eq(board_card_potential_assignees.user_id, userId));

    if (potentialCards.length === 0) return [];

    const cardIds = potentialCards.map(c => c.card_id);

    const result = await db
      .select()
      .from(board_cards)
      .leftJoin(users, eq(board_cards.assigned_to, users.id))
      .where(and(
        inArray(board_cards.id, cardIds),
        eq(board_cards.assignment_type, 'pool')
      ))
      .orderBy(desc(board_cards.created_at));

    return result.map(r => ({
      ...r.board_cards,
      assignee: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
      } : null,
    }));
  },
};
