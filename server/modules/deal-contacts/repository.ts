import { db } from '../../db';
import { deal_contacts } from '@shared/schema';
import type { InsertDealContact, DealContact } from '@shared/schema';
import { eq, and, asc } from 'drizzle-orm';

export class DealContactsRepository {
  // Get all contacts for a deal
  async findByDealId(dealId: string): Promise<DealContact[]> {
    return await db
      .select()
      .from(deal_contacts)
      .where(eq(deal_contacts.deal_id, dealId))
      .orderBy(asc(deal_contacts.order), asc(deal_contacts.created_at));
  }

  // Get contact by ID
  async findById(id: string): Promise<DealContact | undefined> {
    const results = await db
      .select()
      .from(deal_contacts)
      .where(eq(deal_contacts.id, id))
      .limit(1);

    return results[0];
  }

  // Create contact
  async create(data: InsertDealContact): Promise<DealContact> {
    // If setting as primary, unset other primary contacts for this deal
    if (data.is_primary) {
      await db
        .update(deal_contacts)
        .set({ is_primary: 0 })
        .where(eq(deal_contacts.deal_id, data.deal_id));
    }

    const result = await db
      .insert(deal_contacts)
      .values(data)
      .returning();

    return result[0];
  }

  // Update contact
  async update(id: string, data: Partial<InsertDealContact>): Promise<DealContact | undefined> {
    // If setting as primary, get the deal_id first and unset others
    if (data.is_primary) {
      const contact = await this.findById(id);
      if (contact) {
        await db
          .update(deal_contacts)
          .set({ is_primary: 0 })
          .where(and(
            eq(deal_contacts.deal_id, contact.deal_id),
            eq(deal_contacts.is_primary, 1)
          ));
      }
    }

    const result = await db
      .update(deal_contacts)
      .set(data)
      .where(eq(deal_contacts.id, id))
      .returning();

    return result[0];
  }

  // Delete contact
  async delete(id: string): Promise<void> {
    await db
      .delete(deal_contacts)
      .where(eq(deal_contacts.id, id));
  }

  // Get primary contact for a deal
  async findPrimaryContact(dealId: string): Promise<DealContact | undefined> {
    const results = await db
      .select()
      .from(deal_contacts)
      .where(and(
        eq(deal_contacts.deal_id, dealId),
        eq(deal_contacts.is_primary, 1)
      ))
      .limit(1);

    return results[0];
  }
}

export const dealContactsRepository = new DealContactsRepository();
