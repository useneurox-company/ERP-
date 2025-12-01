import { db } from "../../db";
import { custom_field_definitions, deal_custom_fields, InsertCustomFieldDefinition, InsertDealCustomField } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export const customFieldsRepository = {
  // Custom Field Definitions
  async getDefinitions() {
    return db.select().from(custom_field_definitions);
  },

  async getDefinitionById(id: string) {
    const [definition] = await db
      .select()
      .from(custom_field_definitions)
      .where(eq(custom_field_definitions.id, id));
    return definition;
  },

  async createDefinition(data: InsertCustomFieldDefinition) {
    const [definition] = await db
      .insert(custom_field_definitions)
      .values(data)
      .returning();
    return definition;
  },

  async updateDefinition(id: string, data: Partial<InsertCustomFieldDefinition>) {
    const [definition] = await db
      .update(custom_field_definitions)
      .set(data)
      .where(eq(custom_field_definitions.id, id))
      .returning();
    return definition;
  },

  async deleteDefinition(id: string) {
    await db
      .delete(custom_field_definitions)
      .where(eq(custom_field_definitions.id, id));
  },

  // Deal Custom Field Values
  async getDealCustomFields(dealId: string) {
    return db
      .select({
        id: deal_custom_fields.id,
        deal_id: deal_custom_fields.deal_id,
        field_definition_id: deal_custom_fields.field_definition_id,
        value: deal_custom_fields.value,
        created_at: deal_custom_fields.created_at,
        field_name: custom_field_definitions.name,
        field_type: custom_field_definitions.field_type,
        options: custom_field_definitions.options,
      })
      .from(deal_custom_fields)
      .leftJoin(
        custom_field_definitions,
        eq(deal_custom_fields.field_definition_id, custom_field_definitions.id)
      )
      .where(eq(deal_custom_fields.deal_id, dealId));
  },

  async setDealCustomField(data: InsertDealCustomField) {
    // Check if value already exists
    const existing = await db
      .select()
      .from(deal_custom_fields)
      .where(
        and(
          eq(deal_custom_fields.deal_id, data.deal_id),
          eq(deal_custom_fields.field_definition_id, data.field_definition_id)
        )
      );

    if (existing.length > 0) {
      // Update existing value
      const [field] = await db
        .update(deal_custom_fields)
        .set({ value: data.value })
        .where(eq(deal_custom_fields.id, existing[0].id))
        .returning();
      return field;
    } else {
      // Insert new value
      const [field] = await db
        .insert(deal_custom_fields)
        .values(data)
        .returning();
      return field;
    }
  },

  async deleteDealCustomField(id: string) {
    await db
      .delete(deal_custom_fields)
      .where(eq(deal_custom_fields.id, id));
  },
};
