import express from 'express';
import { stageDocumentsRepository } from './repository';
import type { InsertStageDocument } from '@shared/schema';

const router = express.Router();

/**
 * GET /api/stages/:stageId/documents
 * Получить все документы этапа
 */
router.get('/api/stages/:stageId/documents', async (req, res) => {
  try {
    const { stageId } = req.params;
    const documents = await stageDocumentsRepository.getStageDocuments(stageId);
    res.json(documents);
  } catch (error) {
    console.error('Error fetching stage documents:', error);
    res.status(500).json({ error: 'Failed to fetch stage documents' });
  }
});

/**
 * GET /api/stages/:stageId/documents/type/:mediaType
 * Получить документы этапа по типу (photo, video, audio, document)
 */
router.get('/api/stages/:stageId/documents/type/:mediaType', async (req, res) => {
  try {
    const { stageId, mediaType } = req.params;
    const documents = await stageDocumentsRepository.getStageDocumentsByType(stageId, mediaType);
    res.json(documents);
  } catch (error) {
    console.error('Error fetching stage documents by type:', error);
    res.status(500).json({ error: 'Failed to fetch stage documents' });
  }
});

/**
 * GET /api/stages/:stageId/documents/stats
 * Получить статистику по медиа этапа
 */
router.get('/api/stages/:stageId/documents/stats', async (req, res) => {
  try {
    const { stageId } = req.params;
    const stats = await stageDocumentsRepository.getStageMediaStats(stageId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stage media stats:', error);
    res.status(500).json({ error: 'Failed to fetch media stats' });
  }
});

/**
 * GET /api/stage-documents/:id
 * Получить документ по ID
 */
router.get('/api/stage-documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const document = await stageDocumentsRepository.getStageDocumentById(id);

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json(document);
  } catch (error) {
    console.error('Error fetching stage document:', error);
    res.status(500).json({ error: 'Failed to fetch stage document' });
  }
});

/**
 * POST /api/stages/:stageId/documents
 * Создать новый документ этапа
 */
router.post('/api/stages/:stageId/documents', async (req, res) => {
  try {
    const { stageId } = req.params;
    const data: InsertStageDocument = {
      ...req.body,
      stage_id: stageId,
    };

    const document = await stageDocumentsRepository.createStageDocument(data);
    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating stage document:', error);
    res.status(500).json({ error: 'Failed to create stage document' });
  }
});

/**
 * PUT /api/stage-documents/:id
 * Обновить документ
 */
router.put('/api/stage-documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data: Partial<InsertStageDocument> = req.body;

    const updated = await stageDocumentsRepository.updateStageDocument(id, data);

    if (!updated) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating stage document:', error);
    res.status(500).json({ error: 'Failed to update stage document' });
  }
});

/**
 * DELETE /api/stage-documents/:id
 * Удалить документ
 */
router.delete('/api/stage-documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await stageDocumentsRepository.deleteStageDocument(id);

    if (!success) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting stage document:', error);
    res.status(500).json({ error: 'Failed to delete stage document' });
  }
});

/**
 * DELETE /api/stages/:stageId/documents
 * Удалить все документы этапа
 */
router.delete('/api/stages/:stageId/documents', async (req, res) => {
  try {
    const { stageId } = req.params;
    const count = await stageDocumentsRepository.deleteAllStageDocuments(stageId);

    res.json({ deleted: count });
  } catch (error) {
    console.error('Error deleting stage documents:', error);
    res.status(500).json({ error: 'Failed to delete stage documents' });
  }
});

export default router;
