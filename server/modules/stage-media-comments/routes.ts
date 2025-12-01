import { Router } from "express";
import { stageMediaCommentsRepository } from "./repository";
import { insertStageMediaCommentSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

const router = Router();

// GET /api/stages/:stageId/media/:mediaId/comments - Get all comments for specific media
router.get('/api/stages/:stageId/media/:mediaId/comments', async (req, res) => {
  try {
    const { mediaId } = req.params;
    const comments = await stageMediaCommentsRepository.getCommentsByMediaId(mediaId);
    res.json(comments);
  } catch (error) {
    console.error('Error fetching media comments:', error);
    res.status(500).json({ error: 'Failed to fetch media comments' });
  }
});

// GET /api/stages/:stageId/comments - Get all comments for a stage
router.get('/api/stages/:stageId/comments', async (req, res) => {
  try {
    const { stageId } = req.params;
    const comments = await stageMediaCommentsRepository.getCommentsByStageId(stageId);
    res.json(comments);
  } catch (error) {
    console.error('Error fetching stage comments:', error);
    res.status(500).json({ error: 'Failed to fetch stage comments' });
  }
});

// POST /api/stages/:stageId/media/:mediaId/comment - Create new comment
router.post('/api/stages/:stageId/media/:mediaId/comment', async (req, res) => {
  try {
    const { stageId, mediaId } = req.params;

    const validationResult = insertStageMediaCommentSchema.safeParse({
      ...req.body,
      stage_id: stageId,
      media_id: mediaId,
    });

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const comment = await stageMediaCommentsRepository.createComment(validationResult.data);
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating media comment:', error);
    res.status(500).json({ error: 'Failed to create media comment' });
  }
});

// PUT /api/stage-media-comments/:id - Update comment
router.put('/api/stage-media-comments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment) {
      res.status(400).json({ error: 'Comment text is required' });
      return;
    }

    const updatedComment = await stageMediaCommentsRepository.updateComment(id, comment);

    if (!updatedComment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    res.json(updatedComment);
  } catch (error) {
    console.error('Error updating media comment:', error);
    res.status(500).json({ error: 'Failed to update media comment' });
  }
});

// DELETE /api/stage-media-comments/:id - Delete comment
router.delete('/api/stage-media-comments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await stageMediaCommentsRepository.deleteComment(id);

    if (!deleted) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting media comment:', error);
    res.status(500).json({ error: 'Failed to delete media comment' });
  }
});

export default router;
