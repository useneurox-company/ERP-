import express from 'express';
import { stageTypesRepository } from './repository';
import type { InsertStageType } from '@shared/schema';

const router = express.Router();

/**
 * GET /api/stage-types
 * Получить все активные типы этапов
 */
router.get('/api/stage-types', async (req, res) => {
  try {
    const stageTypes = await stageTypesRepository.getActiveStageTypes();
    res.json(stageTypes);
  } catch (error) {
    console.error('Error fetching stage types:', error);
    res.status(500).json({ error: 'Failed to fetch stage types' });
  }
});

/**
 * GET /api/stage-types/all
 * Получить все типы этапов (включая неактивные)
 */
router.get('/api/stage-types/all', async (req, res) => {
  try {
    const stageTypes = await stageTypesRepository.getAllStageTypes();
    res.json(stageTypes);
  } catch (error) {
    console.error('Error fetching all stage types:', error);
    res.status(500).json({ error: 'Failed to fetch stage types' });
  }
});

/**
 * GET /api/stage-types/:id
 * Получить тип этапа по ID
 */
router.get('/api/stage-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const stageType = await stageTypesRepository.getStageTypeById(id);

    if (!stageType) {
      res.status(404).json({ error: 'Stage type not found' });
      return;
    }

    res.json(stageType);
  } catch (error) {
    console.error('Error fetching stage type:', error);
    res.status(500).json({ error: 'Failed to fetch stage type' });
  }
});

/**
 * POST /api/stage-types
 * Создать новый тип этапа
 */
router.post('/api/stage-types', async (req, res) => {
  try {
    const data: InsertStageType = req.body;

    // Проверяем уникальность кода
    const existing = await stageTypesRepository.getStageTypeByCode(data.code);
    if (existing) {
      res.status(400).json({ error: 'Stage type with this code already exists' });
      return;
    }

    const stageType = await stageTypesRepository.createStageType(data);
    res.status(201).json(stageType);
  } catch (error) {
    console.error('Error creating stage type:', error);
    res.status(500).json({ error: 'Failed to create stage type' });
  }
});

/**
 * PUT /api/stage-types/:id
 * Обновить тип этапа
 */
router.put('/api/stage-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data: Partial<InsertStageType> = req.body;

    // Если обновляется код, проверяем уникальность
    if (data.code) {
      const existing = await stageTypesRepository.getStageTypeByCode(data.code);
      if (existing && existing.id !== id) {
        res.status(400).json({ error: 'Stage type with this code already exists' });
        return;
      }
    }

    const updated = await stageTypesRepository.updateStageType(id, data);

    if (!updated) {
      res.status(404).json({ error: 'Stage type not found' });
      return;
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating stage type:', error);
    res.status(500).json({ error: 'Failed to update stage type' });
  }
});

/**
 * DELETE /api/stage-types/:id
 * Деактивировать тип этапа (мягкое удаление)
 */
router.delete('/api/stage-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await stageTypesRepository.deactivateStageType(id);

    if (!success) {
      res.status(404).json({ error: 'Stage type not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deactivating stage type:', error);
    res.status(500).json({ error: 'Failed to deactivate stage type' });
  }
});

/**
 * POST /api/stage-types/:id/activate
 * Активировать тип этапа
 */
router.post('/api/stage-types/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await stageTypesRepository.activateStageType(id);

    if (!success) {
      res.status(404).json({ error: 'Stage type not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error activating stage type:', error);
    res.status(500).json({ error: 'Failed to activate stage type' });
  }
});

export default router;
