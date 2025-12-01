import { Router, Request, Response } from 'express';
import { salesPipelinesRepository } from './repository';
import { insertSalesPipelineSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// GET /api/sales-pipelines - Get all pipelines
router.get('/', async (req: Request, res: Response) => {
  try {
    const pipelines = await salesPipelinesRepository.findAll();
    res.json(pipelines);
  } catch (error) {
    console.error('Error fetching sales pipelines:', error);
    res.status(500).json({ error: 'Failed to fetch sales pipelines' });
  }
});

// GET /api/sales-pipelines/default - Get default pipeline
router.get('/default', async (req: Request, res: Response) => {
  try {
    const pipeline = await salesPipelinesRepository.findDefault();
    if (!pipeline) {
      return res.status(404).json({ error: 'No default pipeline found' });
    }
    res.json(pipeline);
  } catch (error) {
    console.error('Error fetching default pipeline:', error);
    res.status(500).json({ error: 'Failed to fetch default pipeline' });
  }
});

// GET /api/sales-pipelines/:id - Get pipeline by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const pipeline = await salesPipelinesRepository.findById(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }
    res.json(pipeline);
  } catch (error) {
    console.error('Error fetching pipeline:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
});

// POST /api/sales-pipelines - Create new pipeline
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = insertSalesPipelineSchema.parse(req.body);
    const pipeline = await salesPipelinesRepository.create(data);
    res.status(201).json(pipeline);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating pipeline:', error);
    res.status(500).json({ error: 'Failed to create pipeline' });
  }
});

// PUT /api/sales-pipelines/:id - Update pipeline
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = insertSalesPipelineSchema.partial().parse(req.body);
    const pipeline = await salesPipelinesRepository.update(req.params.id, data);

    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    res.json(pipeline);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating pipeline:', error);
    res.status(500).json({ error: 'Failed to update pipeline' });
  }
});

// DELETE /api/sales-pipelines/:id - Delete pipeline
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Check if this is the default pipeline
    const pipeline = await salesPipelinesRepository.findById(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    if (pipeline.is_default) {
      return res.status(400).json({ error: 'Cannot delete default pipeline' });
    }

    await salesPipelinesRepository.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting pipeline:', error);
    res.status(500).json({ error: 'Failed to delete pipeline' });
  }
});

// POST /api/sales-pipelines/:id/set-default - Set pipeline as default
router.post('/:id/set-default', async (req: Request, res: Response) => {
  try {
    const pipeline = await salesPipelinesRepository.findById(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    await salesPipelinesRepository.setAsDefault(req.params.id);
    res.json({ message: 'Pipeline set as default' });
  } catch (error) {
    console.error('Error setting default pipeline:', error);
    res.status(500).json({ error: 'Failed to set default pipeline' });
  }
});

// GET /api/sales-pipelines/:id/stages - Get stages for a pipeline
router.get('/:id/stages', async (req: Request, res: Response) => {
  try {
    const stages = await salesPipelinesRepository.findStages(req.params.id);
    res.json(stages);
  } catch (error) {
    console.error('Error fetching pipeline stages:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline stages' });
  }
});

// GET /api/sales-pipelines/:id/custom-fields - Get custom fields for a pipeline
router.get('/:id/custom-fields', async (req: Request, res: Response) => {
  try {
    const customFields = await salesPipelinesRepository.findCustomFields(req.params.id);
    res.json(customFields);
  } catch (error) {
    console.error('Error fetching pipeline custom fields:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline custom fields' });
  }
});

export default router;
