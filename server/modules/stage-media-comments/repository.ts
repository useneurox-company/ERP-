import { db } from "../../db";
import { stage_media_comments, users, type InsertStageMediaComment, type StageMediaComment } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export const stageMediaCommentsRepository = {
  // Get all comments for a specific media file with user info
  async getCommentsByMediaId(mediaId: string) {
    return await db
      .select({
        id: stage_media_comments.id,
        stage_id: stage_media_comments.stage_id,
        media_id: stage_media_comments.media_id,
        user_id: stage_media_comments.user_id,
        comment: stage_media_comments.comment,
        created_at: stage_media_comments.created_at,
        user_name: users.full_name,
        username: users.username,
      })
      .from(stage_media_comments)
      .leftJoin(users, eq(stage_media_comments.user_id, users.id))
      .where(eq(stage_media_comments.media_id, mediaId))
      .orderBy(desc(stage_media_comments.created_at));
  },

  // Get all comments for a stage
  async getCommentsByStageId(stageId: string): Promise<StageMediaComment[]> {
    return await db
      .select()
      .from(stage_media_comments)
      .where(eq(stage_media_comments.stage_id, stageId))
      .orderBy(desc(stage_media_comments.created_at));
  },

  // Create a new comment
  async createComment(data: InsertStageMediaComment): Promise<StageMediaComment> {
    const result = await db.insert(stage_media_comments).values(data).returning();
    return result[0];
  },

  // Update a comment
  async updateComment(id: string, comment: string): Promise<StageMediaComment | null> {
    const result = await db
      .update(stage_media_comments)
      .set({ comment })
      .where(eq(stage_media_comments.id, id))
      .returning();

    return result[0] || null;
  },

  // Delete a comment
  async deleteComment(id: string): Promise<boolean> {
    const result = await db
      .delete(stage_media_comments)
      .where(eq(stage_media_comments.id, id))
      .returning();

    return result.length > 0;
  },

  // Upsert comment (create or update)
  async upsertComment(data: InsertStageMediaComment): Promise<StageMediaComment> {
    // Check if comment already exists for this media
    const existing = await this.getCommentByMediaId(data.media_id);

    if (existing) {
      // Update existing comment
      return await this.updateComment(existing.id, data.comment) as StageMediaComment;
    } else {
      // Create new comment
      return await this.createComment(data);
    }
  }
};
