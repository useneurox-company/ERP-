import { Router, Request, Response } from 'express';
import { dealContactsRepository } from './repository';
import { insertDealContactSchema } from '@shared/schema';
import { z } from 'zod';

export const router = Router();

// GET /api/deals/:dealId/contacts - Get all contacts for a deal
router.get('/api/deals/:dealId/contacts', async (req: Request, res: Response) => {
  try {
    const contacts = await dealContactsRepository.findByDealId(req.params.dealId);
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching deal contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET /api/deal-contacts/:id - Get contact by ID
router.get('/api/deal-contacts/:id', async (req: Request, res: Response) => {
  try {
    const contact = await dealContactsRepository.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// POST /api/deals/:dealId/contacts - Create new contact
router.post('/api/deals/:dealId/contacts', async (req: Request, res: Response) => {
  try {
    const data = insertDealContactSchema.parse({
      ...req.body,
      deal_id: req.params.dealId,
    });
    const contact = await dealContactsRepository.create(data);
    res.status(201).json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// PUT /api/deal-contacts/:id - Update contact
router.put('/api/deal-contacts/:id', async (req: Request, res: Response) => {
  try {
    const data = insertDealContactSchema.partial().parse(req.body);
    const contact = await dealContactsRepository.update(req.params.id, data);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /api/deal-contacts/:id - Delete contact
router.delete('/api/deal-contacts/:id', async (req: Request, res: Response) => {
  try {
    await dealContactsRepository.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

export default router;
