import { pgTable, text, integer, real, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { nanoid } from 'nanoid';

const genId = () => nanoid();

// Project Status Type
export const projectStatusValues = ['pending', 'in_progress', 'completed', 'reclamation'] as const;
export type ProjectStatus = typeof projectStatusValues[number];

// Roles
export const roles = pgTable('roles', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  is_system: boolean('is_system').default(false).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, created_at: true, updated_at: true });
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

// Role Permissions
export const role_permissions = pgTable('role_permissions', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  role_id: text('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  module: text('module').notNull(), // deals, projects, warehouse, finance, etc.
  can_view: boolean('can_view').default(false).notNull(),
  can_create: boolean('can_create').default(false).notNull(),
  can_edit: boolean('can_edit').default(false).notNull(),
  can_delete: boolean('can_delete').default(false).notNull(),
  view_all: boolean('view_all').default(false).notNull(), // видеть все данные или только свои
  hide_prices: boolean('hide_prices').default(false).notNull(), // скрывать цены от пользователя
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertRolePermissionSchema = createInsertSchema(role_permissions).omit({ id: true, created_at: true, updated_at: true });
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof role_permissions.$inferSelect;

// Users
export const users = pgTable('users', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  email: text('email'),
  full_name: text('full_name'),
  role_id: text('role_id').references(() => roles.id),
  phone: text('phone'),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, created_at: true, updated_at: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserWithPassword = typeof users.$inferSelect;
export type User = Omit<UserWithPassword, 'password'>;

// User Permissions (Индивидуальные права пользователей)
export const user_permissions = pgTable('user_permissions', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  user_id: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  module: text('module').notNull(), // deals, projects, warehouse, finance, etc.
  can_view: boolean('can_view').default(false).notNull(),
  can_create: boolean('can_create').default(false).notNull(),
  can_edit: boolean('can_edit').default(false).notNull(),
  can_delete: boolean('can_delete').default(false).notNull(),
  view_all: boolean('view_all').default(false).notNull(), // видеть все данные или только свои
  hide_prices: boolean('hide_prices').default(false).notNull(), // скрывать цены от пользователя
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertUserPermissionSchema = createInsertSchema(user_permissions).omit({ id: true, created_at: true, updated_at: true });
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;
export type UserPermission = typeof user_permissions.$inferSelect;

// Sales Pipelines (Воронки продаж)
export const salesPipelines = pgTable('sales_pipelines', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  is_default: boolean('is_default').default(false).notNull(),
  order: integer('order').notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertSalesPipelineSchema = createInsertSchema(salesPipelines).omit({ id: true, created_at: true, updated_at: true });
export type InsertSalesPipeline = z.infer<typeof insertSalesPipelineSchema>;
export type SalesPipeline = typeof salesPipelines.$inferSelect;

// Deal Stages
export const dealStages = pgTable('deal_stages', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  pipeline_id: text('pipeline_id').references(() => salesPipelines.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  key: text('key').notNull(),
  color: text('color').default('#6366f1'),
  order: integer('order').notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertDealStageSchema = createInsertSchema(dealStages).omit({ id: true, created_at: true });
export type InsertDealStage = z.infer<typeof insertDealStageSchema>;
export type DealStage = typeof dealStages.$inferSelect;

// Deals
export const deals = pgTable('deals', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  pipeline_id: text('pipeline_id').references(() => salesPipelines.id),
  client_name: text('client_name').notNull(),
  company: text('company'),
  contact_phone: text('contact_phone'),
  contact_email: text('contact_email'),
  order_number: text('order_number').unique(),
  amount: real('amount'),
  stage: text('stage').notNull().default('new'),
  deadline: timestamp('deadline'),
  manager_id: text('manager_id').references(() => users.id),
  production_days_count: integer('production_days_count'),
  tags: text('tags'),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertDealSchema = createInsertSchema(deals)
  .omit({ id: true, created_at: true, updated_at: true })
  .extend({
    company: z.string().nullable().optional().transform((val) => val === '' ? null : val),
    amount: z.union([z.number(), z.string(), z.null()]).optional().transform((val) => {
      if (val === null || val === undefined || val === '') return null;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    }),
    manager_id: z.string().nullable().optional().transform((val) => val === '' ? null : val),
    production_days_count: z.union([z.number(), z.string(), z.null()]).optional().transform((val) => {
      if (val === null || val === undefined || val === '') return null;
      const num = typeof val === 'string' ? parseInt(val) : val;
      return isNaN(num) ? null : num;
    }),
    tags: z.union([z.array(z.string()), z.string(), z.null()]).optional().transform((val) => {
      if (!val || (Array.isArray(val) && val.length === 0)) return null;
      if (Array.isArray(val)) return JSON.stringify(val);
      return val;
    }),
  });

export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

// Deal Contacts
export const deal_contacts = pgTable('deal_contacts', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  deal_id: text('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  position: text('position'),
  phone: text('phone'),
  email: text('email'),
  is_primary: integer('is_primary', { mode: 'boolean' }).default(0).notNull(),
  order: integer('order').notNull().default(0),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertDealContactSchema = createInsertSchema(deal_contacts)
  .omit({ id: true, created_at: true })
  .extend({
    is_primary: z.boolean().optional().transform((val) => val ? 1 : 0),
    order: z.number().optional().default(0),
  });
export type InsertDealContact = z.infer<typeof insertDealContactSchema>;
export type DealContact = typeof deal_contacts.$inferSelect;

// Deal Messages
export const deal_messages = pgTable('deal_messages', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  deal_id: text('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  message_type: text('message_type').notNull(),
  content: text('content').notNull(),
  author_id: text('author_id').references(() => users.id).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  // Chat features
  direction: text('direction').default('outgoing').notNull(),
  is_read: integer('is_read', { mode: 'boolean' }).default(0).notNull(),
  read_at: timestamp('read_at'),
});

export const insertDealMessageSchema = createInsertSchema(deal_messages).omit({ id: true, created_at: true });
export type InsertDealMessage = z.infer<typeof insertDealMessageSchema>;
export type DealMessage = typeof deal_messages.$inferSelect;

// Deal Documents
export const deal_documents = pgTable('deal_documents', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  deal_id: text('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  document_type: text('document_type').default('document'),
  media_type: text('media_type'),
  name: text('name').notNull(),
  document_number: text('document_number'), // Номер документа: для договора {сделка}-{дата}, для КП/счёта {номер_сделки}
  version: integer('version').default(1),
  file_url: text('file_url').notNull(),
  data: text('data'),
  total_amount: real('total_amount'),
  is_signed: integer('is_signed', { mode: 'boolean' }).default(0),
  parent_id: text('parent_id').references((): any => deal_documents.id, { onDelete: 'cascade' }),
  comment: text('comment'),
  contract_number: text('contract_number'),
  contract_date: text('contract_date'),
  payment_schedule: text('payment_schedule'),
  company_info: text('company_info'),
  customer_name: text('customer_name'),
  customer_phone: text('customer_phone'),
  customer_address: text('customer_address'),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertDealDocumentSchema = createInsertSchema(deal_documents).omit({ id: true, created_at: true, updated_at: true }).extend({
  is_signed: z.union([z.boolean(), z.number()]).transform(val => typeof val === 'boolean' ? (val ? 1 : 0) : val).optional(),
});
export type InsertDealDocument = z.infer<typeof insertDealDocumentSchema>;
export type DealDocument = typeof deal_documents.$inferSelect;

// Deal Attachments
export const deal_attachments = pgTable('deal_attachments', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  deal_id: text('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  document_id: text('document_id').references(() => deal_documents.id, { onDelete: 'cascade' }),
  file_name: text('file_name').notNull(),
  file_path: text('file_path').notNull(),
  file_size: integer('file_size'),
  mime_type: text('mime_type'),
  thumbnail_url: text('thumbnail_url'),
  uploaded_by: text('uploaded_by').references(() => users.id),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertDealAttachmentSchema = createInsertSchema(deal_attachments).omit({ id: true, created_at: true });
export type InsertDealAttachment = z.infer<typeof insertDealAttachmentSchema>;
export type DealAttachment = typeof deal_attachments.$inferSelect;

// Projects
export const projects = pgTable('projects', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  project_number: text('project_number'),
  name: text('name').notNull(),
  client_name: text('client_name').notNull(),
  deal_id: text('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  invoice_id: text('invoice_id').references(() => deal_documents.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending'),
  progress: integer('progress').default(0),
  duration_days: integer('duration_days'),
  started_at: text('started_at'), // ISO 8601 string
  manager_id: text('manager_id').references(() => users.id),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
});

export const insertProjectSchema = createInsertSchema(projects)
  .omit({ id: true, created_at: true, updated_at: true })
  .extend({
    status: z.enum(projectStatusValues).optional(),
  });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Project Items
export const project_items = pgTable('project_items', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  project_id: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  article: text('article'),
  quantity: integer('quantity').notNull().default(1),
  price: real('price'),
  source_document_id: text('source_document_id').references(() => deal_documents.id),
  order: integer('order').notNull(),
  image_url: text('image_url'),
  ready_for_montage: boolean('ready_for_montage').default(false).notNull(), // Готово к монтажу
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
});

export const insertProjectItemSchema = createInsertSchema(project_items).omit({ id: true, created_at: true, updated_at: true });
export type InsertProjectItem = z.infer<typeof insertProjectItemSchema>;
export type ProjectItem = typeof project_items.$inferSelect;

// Project Stages
export const project_stages = pgTable('project_stages', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  project_id: text('project_id').references(() => projects.id).notNull(),
  item_id: text('item_id').references(() => project_items.id),
  stage_type_id: text('stage_type_id').references(() => stage_types.id), // тип этапа из библиотеки
  name: text('name').notNull(),
  status: text('status').notNull().default('pending'),
  assignee_id: text('assignee_id').references(() => users.id),
  duration_days: integer('duration_days'),
  planned_start_date: text('planned_start_date'), // ISO 8601 string
  planned_end_date: text('planned_end_date'), // ISO 8601 string
  actual_start_date: text('actual_start_date'), // ISO 8601 string
  actual_end_date: text('actual_end_date'), // ISO 8601 string
  cost: real('cost'),
  description: text('description'),
  type_data: text('type_data'), // JSON данные специфичные для типа этапа
  order: integer('order').notNull(),
  is_system: integer('is_system').default(0).notNull(), // Системный этап (не удаляется обычным пользователем)
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
});

export const insertProjectStageSchema = createInsertSchema(project_stages).omit({ id: true, created_at: true, updated_at: true });
export type InsertProjectStage = z.infer<typeof insertProjectStageSchema>;
export type ProjectStage = typeof project_stages.$inferSelect;

// Stage Dependencies
export const stage_dependencies = pgTable('stage_dependencies', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  stage_id: text('stage_id').references(() => project_stages.id, { onDelete: 'cascade' }).notNull(),
  depends_on_stage_id: text('depends_on_stage_id').references(() => project_stages.id, { onDelete: 'cascade' }).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertStageDependencySchema = createInsertSchema(stage_dependencies).omit({ id: true, created_at: true });
export type InsertStageDependency = z.infer<typeof insertStageDependencySchema>;
export type StageDependency = typeof stage_dependencies.$inferSelect;

// Stage Messages
export const stage_messages = pgTable('stage_messages', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  stage_id: text('stage_id').references(() => project_stages.id, { onDelete: 'cascade' }).notNull(),
  user_id: text('user_id').references(() => users.id).notNull(),
  message: text('message').notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertStageMessageSchema = createInsertSchema(stage_messages).omit({ id: true, created_at: true });
export type InsertStageMessage = z.infer<typeof insertStageMessageSchema>;
export type StageMessage = typeof stage_messages.$inferSelect;

// Stage Documents (медиа-файлы этапов)
export const stage_documents = pgTable('stage_documents', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  stage_id: text('stage_id').references(() => project_stages.id, { onDelete: 'cascade' }).notNull(),
  document_type: text('document_type').default('document'),
  media_type: text('media_type'), // photo, video, audio, document
  file_name: text('file_name'),
  file_url: text('file_url'),
  file_path: text('file_path'),
  file_size: integer('file_size'),
  mime_type: text('mime_type'),
  thumbnail_url: text('thumbnail_url'),
  metadata: text('metadata'),
  uploaded_by: text('uploaded_by').references(() => users.id),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertStageDocumentSchema = createInsertSchema(stage_documents).omit({ id: true, created_at: true, updated_at: true });
export type InsertStageDocument = z.infer<typeof insertStageDocumentSchema>;
export type StageDocument = typeof stage_documents.$inferSelect;

// Stage Media Comments (комментарии к медиа-файлам)
export const stage_media_comments = pgTable('stage_media_comments', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  stage_id: text('stage_id').references(() => project_stages.id, { onDelete: 'cascade' }).notNull(),
  media_id: text('media_id').references(() => stage_documents.id, { onDelete: 'cascade' }).notNull(),
  user_id: text('user_id').references(() => users.id).notNull(),
  comment: text('comment').notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertStageMediaCommentSchema = createInsertSchema(stage_media_comments).omit({ id: true, created_at: true });
export type InsertStageMediaComment = z.infer<typeof insertStageMediaCommentSchema>;
export type StageMediaComment = typeof stage_media_comments.$inferSelect;

// Project Messages
export const project_messages = pgTable('project_messages', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  project_id: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  user_id: text('user_id').references(() => users.id).notNull(),
  message: text('message').notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertProjectMessageSchema = createInsertSchema(project_messages).omit({ id: true, created_at: true });
export type InsertProjectMessage = z.infer<typeof insertProjectMessageSchema>;
export type ProjectMessage = typeof project_messages.$inferSelect;

// User Roles (Project-specific role assignments)
export const user_roles = pgTable('user_roles', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  user_id: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull(), // project_manager, measurer, constructor, procurement, production, installer, client
  project_id: text('project_id').references(() => projects.id, { onDelete: 'cascade' }), // null = global role
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertUserRoleSchema = createInsertSchema(user_roles).omit({ id: true, created_at: true, updated_at: true });
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof user_roles.$inferSelect;

// Stage Permissions (Permissions matrix for roles x stage types)
export const stage_permissions = pgTable('stage_permissions', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  role: text('role').notNull(), // роль из user_roles
  stage_type_code: text('stage_type_code').notNull(), // код типа этапа
  can_read: boolean('can_read').default(false).notNull(),
  can_write: boolean('can_write').default(false).notNull(),
  can_delete: boolean('can_delete').default(false).notNull(),
  can_start: boolean('can_start').default(false).notNull(),
  can_complete: boolean('can_complete').default(false).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertStagePermissionSchema = createInsertSchema(stage_permissions).omit({ id: true, created_at: true, updated_at: true });
export type InsertStagePermission = z.infer<typeof insertStagePermissionSchema>;
export type StagePermission = typeof stage_permissions.$inferSelect;

// Action Audit Log (Logging all user actions for security and debugging)
export const action_audit_log = pgTable('action_audit_log', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  user_id: text('user_id').references(() => users.id).notNull(),
  action: text('action').notNull(), // read, write, delete, start, complete
  entity_type: text('entity_type').notNull(), // project, stage, document, etc.
  entity_id: text('entity_id').notNull(),
  success: boolean('success').default(true).notNull(),
  reason: text('reason'), // причина отказа, если success = false
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertActionAuditLogSchema = createInsertSchema(action_audit_log).omit({ id: true, created_at: true });
export type InsertActionAuditLog = z.infer<typeof insertActionAuditLogSchema>;
export type ActionAuditLog = typeof action_audit_log.$inferSelect;

// Production Tasks
export const production_tasks = pgTable('production_tasks', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  project_id: text('project_id').references(() => projects.id),
  item_name: text('item_name').notNull(),
  worker_id: text('worker_id').references(() => users.id),
  payment: real('payment'),
  deadline: timestamp('deadline'),
  progress: integer('progress').default(0),
  qr_code: text('qr_code'),
  status: text('status').notNull().default('pending'),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertProductionTaskSchema = createInsertSchema(production_tasks).omit({ id: true, created_at: true, updated_at: true });
export type InsertProductionTask = z.infer<typeof insertProductionTaskSchema>;
export type ProductionTask = typeof production_tasks.$inferSelect;

// Production Stages
export const production_stages = pgTable('production_stages', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  task_id: text('task_id').references(() => production_tasks.id).notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('pending'),
  order: integer('order').notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertProductionStageSchema = createInsertSchema(production_stages).omit({ id: true, created_at: true, updated_at: true });
export type InsertProductionStage = z.infer<typeof insertProductionStageSchema>;
export type ProductionStage = typeof production_stages.$inferSelect;

// Warehouse Categories
export const warehouseCategories = pgTable('warehouse_categories', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  name: text('name').notNull(),
  parent_id: text('parent_id').references((): any => warehouseCategories.id, { onDelete: 'cascade' }),
  icon: text('icon'),
  color: text('color'),
  order: integer('order').default(0).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertWarehouseCategorySchema = createInsertSchema(warehouseCategories).omit({ id: true, created_at: true, updated_at: true });
export type InsertWarehouseCategory = z.infer<typeof insertWarehouseCategorySchema>;
export type WarehouseCategory = typeof warehouseCategories.$inferSelect;

// Warehouse Items
export const warehouse_items = pgTable('warehouse_items', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  name: text('name').notNull(),
  sku: text('sku'),
  barcode: text('barcode'),
  quantity: real('quantity').notNull().default(0),
  reserved_quantity: real('reserved_quantity').notNull().default(0),
  unit: text('unit').notNull(),
  price: real('price').default(0),
  location: text('location'),
  category_id: text('category_id').references(() => warehouseCategories.id),
  supplier: text('supplier'),
  description: text('description'),
  min_stock: real('min_stock').default(0),
  track_min_stock: integer('track_min_stock', { mode: 'boolean' }).default(0).notNull(),
  status: text('status').notNull().default('normal'),
  project_id: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  project_name: text('project_name'), // Название проекта для упаковок
  package_details: text('package_details'), // JSON с деталями упаковки
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertWarehouseItemSchema = createInsertSchema(warehouse_items)
  .omit({ id: true, created_at: true, updated_at: true })
  .extend({
    quantity: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val),
    reserved_quantity: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional().transform(val => {
      if (val === null || val === undefined || val === '') return 0;
      return typeof val === 'string' ? parseFloat(val) : val;
    }),
    price: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional().transform(val => {
      if (val === null || val === undefined || val === '') return 0;
      return typeof val === 'string' ? parseFloat(val) : val;
    }),
    min_stock: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional().transform(val => {
      if (val === null || val === undefined || val === '') return 0;
      return typeof val === 'string' ? parseFloat(val) : val;
    }),
    track_min_stock: z.union([z.boolean(), z.number(), z.null(), z.undefined()]).optional().transform(val => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val === 1 ? 1 : 0;
      return val ? 1 : 0; // Convert boolean to 0/1 for SQLite
    }),
    sku: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    supplier: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    project_id: z.string().optional().nullable(),
    project_name: z.string().optional().nullable(),
    package_details: z.string().optional().nullable(),
  });
export type InsertWarehouseItem = z.infer<typeof insertWarehouseItemSchema>;
export type WarehouseItem = typeof warehouse_items.$inferSelect;

// Warehouse Transactions
export const warehouse_transactions = pgTable('warehouse_transactions', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  item_id: text('item_id').references(() => warehouse_items.id).notNull(),
  type: text('type').notNull(),
  quantity: real('quantity').notNull(),
  user_id: text('user_id').references(() => users.id).notNull(),
  project_id: text('project_id').references(() => projects.id),
  notes: text('notes'),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertWarehouseTransactionSchema = createInsertSchema(warehouse_transactions).omit({ id: true, created_at: true });
export type InsertWarehouseTransaction = z.infer<typeof insertWarehouseTransactionSchema>;
export type WarehouseTransaction = typeof warehouse_transactions.$inferSelect;

// Warehouse Reservations
export const warehouse_reservations = pgTable('warehouse_reservations', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  item_id: text('item_id').references(() => warehouse_items.id, { onDelete: 'cascade' }).notNull(),
  project_id: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  quantity: real('quantity').notNull(),
  status: text('status').notNull().default('pending'), // pending | confirmed | released | cancelled
  reserved_by: text('reserved_by').references(() => users.id),
  reason: text('reason'),
  notes: text('notes'),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  released_at: integer('released_at', { mode: 'timestamp' }),
});

export const insertWarehouseReservationSchema = createInsertSchema(warehouse_reservations, {
  quantity: z.number().positive("Количество должно быть больше 0"),
  status: z.enum(["pending", "confirmed", "released", "cancelled"]).optional(),
  reserved_by: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
}).omit({
  id: true,
  created_at: true,
  updated_at: true,
  released_at: true,
});

export type WarehouseReservation = typeof warehouse_reservations.$inferSelect;
export type InsertWarehouseReservation = z.infer<typeof insertWarehouseReservationSchema>;

// Shipments (Накладные на отгрузку)
export const shipments = pgTable('shipments', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  shipment_number: text('shipment_number').notNull().unique(),
  project_name: text('project_name').notNull(),
  delivery_address: text('delivery_address'),
  warehouse_keeper: text('warehouse_keeper').notNull(),
  status: text('status').notNull().default('draft'), // draft | confirmed | cancelled
  notes: text('notes'),
  created_by: text('created_by').notNull().references(() => users.id),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  confirmed_at: integer('confirmed_at', { mode: 'timestamp' }),
  cancelled_at: integer('cancelled_at', { mode: 'timestamp' }),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertShipmentSchema = createInsertSchema(shipments, {
  shipment_number: z.string().optional(),
  project_name: z.string().min(1, "Укажите проект"),
  delivery_address: z.string().optional(),
  warehouse_keeper: z.string().min(1, "Укажите ФИО кладовщика"),
  status: z.enum(["draft", "confirmed", "cancelled"]).optional(),
  notes: z.string().optional(),
}).omit({
  id: true,
  created_at: true,
  updated_at: true,
  confirmed_at: true,
  cancelled_at: true,
});

export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = z.infer<typeof insertShipmentSchema>;

// Shipment Items (Позиции накладной)
export const shipment_items = pgTable('shipment_items', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  shipment_id: text('shipment_id').notNull().references(() => shipments.id, { onDelete: 'cascade' }),
  item_id: text('item_id').notNull().references(() => warehouse_items.id),
  item_name: text('item_name').notNull(),
  item_sku: text('item_sku'),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  is_package: boolean('is_package').default(false),
  package_details: text('package_details'),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertShipmentItemSchema = createInsertSchema(shipment_items, {
  quantity: z.number().positive("Количество должно быть больше 0"),
  is_package: z.boolean().optional(),
  package_details: z.string().optional(),
}).omit({
  id: true,
  created_at: true,
});

export type ShipmentItem = typeof shipment_items.$inferSelect;
export type InsertShipmentItem = z.infer<typeof insertShipmentItemSchema>;

// Financial Transactions
export const financial_transactions = pgTable('financial_transactions', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  type: text('type').notNull(),
  category: text('category').notNull(),
  amount: real('amount').notNull(),
  project_id: text('project_id').references(() => projects.id),
  description: text('description'),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertFinancialTransactionSchema = createInsertSchema(financial_transactions).omit({ id: true, created_at: true });
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;
export type FinancialTransaction = typeof financial_transactions.$inferSelect;

// Installations
export const installations = pgTable('installations', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  project_id: text('project_id').references(() => projects.id),
  client_name: text('client_name').notNull(),
  address: text('address').notNull(),
  installer_id: text('installer_id').references(() => users.id),
  phone: text('phone'),
  date: integer('date', { mode: 'timestamp' }),
  status: text('status').notNull().default('scheduled'),
  payment: real('payment'),
  notes: text('notes'),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertInstallationSchema = createInsertSchema(installations).omit({ id: true, created_at: true, updated_at: true });
export type InsertInstallation = z.infer<typeof insertInstallationSchema>;
export type Installation = typeof installations.$inferSelect;

// Tasks
export const tasks = pgTable('tasks', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  assignee_id: text('assignee_id').references(() => users.id),
  created_by: text('created_by').references(() => users.id),
  priority: text('priority').notNull().default('normal'), // low, normal, high, urgent
  deadline: text('deadline'), // ISO 8601 string
  start_date: text('start_date'), // ISO 8601 string
  completed_at: text('completed_at'), // ISO 8601 string
  status: text('status').notNull().default('new'), // new, in_progress, pending_review, completed, rejected, cancelled, on_hold
  related_entity_type: text('related_entity_type'), // deal, project, client, contact, etc.
  related_entity_id: text('related_entity_id'),
  // Прямые ссылки на сущности (для удобства)
  deal_id: text('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  project_id: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  project_stage_id: text('project_stage_id').references(() => project_stages.id, { onDelete: 'cascade' }),
  project_item_id: text('project_item_id').references(() => project_items.id, { onDelete: 'cascade' }),
  // Система review/approval
  submitted_for_review_at: text('submitted_for_review_at'), // ISO 8601 string
  reviewed_by: text('reviewed_by').references(() => users.id),
  reviewed_at: text('reviewed_at'), // ISO 8601 string
  review_status: text('review_status'), // pending, approved, rejected
  rejection_reason: text('rejection_reason'),
  estimated_hours: real('estimated_hours'),
  actual_hours: real('actual_hours'),
  tags: text('tags'), // JSON array
  attachments_count: integer('attachments_count').default(0),
  comments_count: integer('comments_count').default(0),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, created_at: true, updated_at: true }).extend({
  deadline: z.union([
    z.string(),
    z.date().transform((val) => val.toISOString())
  ]).nullable().optional(),
  start_date: z.union([
    z.string(),
    z.date().transform((val) => val.toISOString()),
    z.number().transform((val) => new Date(val).toISOString())
  ]).nullable().optional(),
  completed_at: z.union([
    z.string(),
    z.date().transform((val) => val.toISOString())
  ]).nullable().optional(),
  submitted_for_review_at: z.union([
    z.string(),
    z.date().transform((val) => val.toISOString())
  ]).nullable().optional(),
  reviewed_at: z.union([
    z.string(),
    z.date().transform((val) => val.toISOString())
  ]).nullable().optional(),
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Task Attachments
export const task_attachments = pgTable('task_attachments', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  task_id: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  file_name: text('file_name').notNull(),
  file_path: text('file_path').notNull(),
  file_size: integer('file_size'),
  mime_type: text('mime_type'),
  thumbnail_url: text('thumbnail_url'),
  uploaded_by: text('uploaded_by').references(() => users.id),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertTaskAttachmentSchema = createInsertSchema(task_attachments).omit({ id: true, created_at: true });
export type InsertTaskAttachment = z.infer<typeof insertTaskAttachmentSchema>;
export type TaskAttachment = typeof task_attachments.$inferSelect;

// Documents
export const documents = pgTable('documents', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  project_id: text('project_id').references(() => projects.id),
  project_stage_id: text('project_stage_id').references(() => project_stages.id, { onDelete: 'cascade' }),
  template_stage_id: text('template_stage_id').references(() => template_stages.id, { onDelete: 'cascade' }),
  file_path: text('file_path').notNull(),
  size: integer('size'),
  uploaded_by: text('uploaded_by').references(() => users.id),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, created_at: true, updated_at: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Company Settings
export const company_settings = pgTable('company_settings', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  company_name: text('company_name').notNull(),
  inn: text('inn'),
  address: text('address'),
  phone: text('phone'),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertCompanySettingsSchema = createInsertSchema(company_settings).omit({ id: true, created_at: true, updated_at: true });
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof company_settings.$inferSelect;

// AI Chat Messages
export const ai_chat_messages = pgTable('ai_chat_messages', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  deal_id: text('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  user_id: text('user_id').references(() => users.id).notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertAiChatMessageSchema = createInsertSchema(ai_chat_messages).omit({ id: true, created_at: true });
export type InsertAiChatMessage = z.infer<typeof insertAiChatMessageSchema>;
export type AiChatMessage = typeof ai_chat_messages.$inferSelect;

// AI Corrections
export const ai_corrections = pgTable('ai_corrections', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  deal_id: text('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  user_id: text('user_id').references(() => users.id).notNull(),
  original_data: text('original_data').notNull(),
  corrected_data: text('corrected_data').notNull(),
  correction_type: text('correction_type').notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertAiCorrectionSchema = createInsertSchema(ai_corrections).omit({ id: true, created_at: true });
export type InsertAiCorrection = z.infer<typeof insertAiCorrectionSchema>;
export type AiCorrection = typeof ai_corrections.$inferSelect;

// Material Prices
export const material_prices = pgTable('material_prices', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  unit: text('unit').notNull(),
  price: real('price').notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertMaterialPriceSchema = createInsertSchema(material_prices).omit({ id: true, updated_at: true });
export type InsertMaterialPrice = z.infer<typeof insertMaterialPriceSchema>;
export type MaterialPrice = typeof material_prices.$inferSelect;

// Custom Field Definitions
export const custom_field_definitions = pgTable('custom_field_definitions', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  pipeline_id: text('pipeline_id').references(() => salesPipelines.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  field_type: text('field_type').notNull(),
  options: text('options'),
  is_required: integer('is_required', { mode: 'boolean' }).default(0).notNull(),
  order: integer('order').notNull().default(0),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertCustomFieldDefinitionSchema = createInsertSchema(custom_field_definitions)
  .omit({ id: true, created_at: true })
  .extend({
    is_required: z.boolean().optional().transform((val) => val ? 1 : 0),
  });
export type InsertCustomFieldDefinition = z.infer<typeof insertCustomFieldDefinitionSchema>;
export type CustomFieldDefinition = typeof custom_field_definitions.$inferSelect;

// Deal Custom Fields
export const deal_custom_fields = pgTable('deal_custom_fields', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  deal_id: text('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull(),
  field_definition_id: text('field_definition_id').references(() => custom_field_definitions.id).notNull(),
  value: text('value'),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertDealCustomFieldSchema = createInsertSchema(deal_custom_fields).omit({ id: true, created_at: true });
export type InsertDealCustomField = z.infer<typeof insertDealCustomFieldSchema>;
export type DealCustomField = typeof deal_custom_fields.$inferSelect;

// Stage Types (библиотека типов этапов)
export const stage_types = pgTable('stage_types', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  code: text('code').notNull().unique(), // measurement, production, installation, etc.
  name: text('name').notNull(), // Замер, Производство, Монтаж
  icon: text('icon'), // emoji или название иконки
  description: text('description'),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertStageTypeSchema = createInsertSchema(stage_types).omit({ id: true, created_at: true, updated_at: true });
export type InsertStageType = z.infer<typeof insertStageTypeSchema>;
export type StageType = typeof stage_types.$inferSelect;

// Process Templates
export const process_templates = pgTable('process_templates', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  created_by: text('created_by').references(() => users.id),
  is_active: integer('is_active').default(1).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertProcessTemplateSchema = createInsertSchema(process_templates).omit({ id: true, created_at: true, updated_at: true });
export type InsertProcessTemplate = z.infer<typeof insertProcessTemplateSchema>;
export type ProcessTemplate = typeof process_templates.$inferSelect;

// Template Stages
export const template_stages = pgTable('template_stages', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  template_id: text('template_id').references(() => process_templates.id, { onDelete: 'cascade' }).notNull(),
  stage_type_id: text('stage_type_id').references(() => stage_types.id), // тип этапа из библиотеки
  name: text('name').notNull(),
  description: text('description'),
  duration_days: integer('duration_days'),
  assignee_id: text('assignee_id').references(() => users.id),
  cost: real('cost'),
  order: integer('order').notNull(),
  template_data: text('template_data'), // JSON данные специфичные для типа этапа (для шаблонов)
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertTemplateStageSchema = createInsertSchema(template_stages).omit({ id: true, created_at: true, updated_at: true });
export type InsertTemplateStage = z.infer<typeof insertTemplateStageSchema>;
export type TemplateStage = typeof template_stages.$inferSelect;

// Template Dependencies
export const template_dependencies = pgTable('template_dependencies', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  template_stage_id: text('template_stage_id').references(() => template_stages.id, { onDelete: 'cascade' }).notNull(),
  depends_on_template_stage_id: text('depends_on_template_stage_id').references(() => template_stages.id, { onDelete: 'cascade' }).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertTemplateDependencySchema = createInsertSchema(template_dependencies).omit({ id: true, created_at: true });
export type InsertTemplateDependency = z.infer<typeof insertTemplateDependencySchema>;
export type TemplateDependency = typeof template_dependencies.$inferSelect;

// Template Stage Attachments
export const template_stage_attachments = pgTable('template_stage_attachments', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  template_stage_id: text('template_stage_id').references(() => template_stages.id, { onDelete: 'cascade' }).notNull(),
  file_name: text('file_name').notNull(),
  file_path: text('file_path').notNull(),
  file_size: integer('file_size'),
  mime_type: text('mime_type'),
  thumbnail_url: text('thumbnail_url'),
  uploaded_by: text('uploaded_by').references(() => users.id),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertTemplateStageAttachmentSchema = createInsertSchema(template_stage_attachments).omit({ id: true, created_at: true, updated_at: true });
export type InsertTemplateStageAttachment = z.infer<typeof insertTemplateStageAttachmentSchema>;
export type TemplateStageAttachment = typeof template_stage_attachments.$inferSelect;

// Stage Deadline History
export const stage_deadline_history = pgTable('stage_deadline_history', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  stage_id: text('stage_id').references(() => project_stages.id, { onDelete: 'cascade' }).notNull(),
  changed_by: text('changed_by').references(() => users.id).notNull(),
  changed_by_name: text('changed_by_name').notNull(),
  old_planned_start: timestamp('old_planned_start'),
  new_planned_start: timestamp('new_planned_start'),
  old_planned_end: timestamp('old_planned_end'),
  new_planned_end: timestamp('new_planned_end'),
  reason: text('reason'), // причина изменения
  is_auto_shift: boolean('is_auto_shift').default(false).notNull(), // true если это автоматический сдвиг
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertStageDeadlineHistorySchema = createInsertSchema(stage_deadline_history).omit({ id: true, created_at: true });
export type InsertStageDeadlineHistory = z.infer<typeof insertStageDeadlineHistorySchema>;
export type StageDeadlineHistory = typeof stage_deadline_history.$inferSelect;

// Task Comments
export const task_comments = pgTable('task_comments', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  task_id: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  author_id: text('author_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertTaskCommentSchema = createInsertSchema(task_comments).omit({ id: true, created_at: true });
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof task_comments.$inferSelect;

// Task Checklist Items
export const task_checklist_items = pgTable('task_checklist_items', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  task_id: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  item_text: text('item_text').notNull(),
  is_completed: integer('is_completed', { mode: 'boolean' }).default(0).notNull(),
  order: integer('order').notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertTaskChecklistItemSchema = createInsertSchema(task_checklist_items).omit({ id: true, created_at: true });
export type InsertTaskChecklistItem = z.infer<typeof insertTaskChecklistItemSchema>;
export type TaskChecklistItem = typeof task_checklist_items.$inferSelect;

// Activity Logs (unified logging for all entities)
export const activity_logs = pgTable('activity_logs', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  entity_type: text('entity_type').notNull(), // deal, project, task, etc.
  entity_id: text('entity_id').notNull(),
  action_type: text('action_type').notNull(), // created, updated, status_changed, assigned, completed, etc.
  user_id: text('user_id').references(() => users.id),
  field_changed: text('field_changed'), // which field was changed
  old_value: text('old_value'),
  new_value: text('new_value'),
  description: text('description'), // human-readable description
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activity_logs).omit({ id: true, created_at: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activity_logs.$inferSelect;

// Stock Notifications (уведомления о минимальном остатке)
export const stock_notifications = pgTable('stock_notifications', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  item_id: text('item_id').references(() => warehouse_items.id, { onDelete: 'cascade' }).notNull(),
  item_name: text('item_name').notNull(),
  status: text('status').notNull(), // low | critical
  quantity: real('quantity').notNull(),
  min_stock: real('min_stock').notNull(),
  user_id: text('user_id').references(() => users.id), // кому отправлено
  read: integer('read', { mode: 'boolean' }).default(0).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertStockNotificationSchema = createInsertSchema(stock_notifications).omit({ id: true, created_at: true });
export type InsertStockNotification = z.infer<typeof insertStockNotificationSchema>;
export type StockNotification = typeof stock_notifications.$inferSelect;

// Procurement Comparisons (Сравнение закупок с Excel)
export const procurement_comparisons = pgTable('procurement_comparisons', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  project_id: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  stage_id: text('stage_id').references(() => project_stages.id, { onDelete: 'cascade' }),
  created_by: text('created_by'), // Убрана foreign key для локальной разработки
  file_name: text('file_name').notNull(), // имя загруженного Excel файла
  status: text('status').default('draft').notNull(), // draft, comparing, completed, ordered
  total_items: integer('total_items').default(0).notNull(),
  items_in_stock: integer('items_in_stock').default(0).notNull(),
  items_partial: integer('items_partial').default(0).notNull(),
  items_missing: integer('items_missing').default(0).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertProcurementComparisonSchema = createInsertSchema(procurement_comparisons).omit({ id: true, created_at: true, updated_at: true });
export type InsertProcurementComparison = z.infer<typeof insertProcurementComparisonSchema>;
export type ProcurementComparison = typeof procurement_comparisons.$inferSelect;

// Procurement Comparison Items (Позиции сравнения)
export const procurement_comparison_items = pgTable('procurement_comparison_items', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  comparison_id: text('comparison_id').references(() => procurement_comparisons.id, { onDelete: 'cascade' }).notNull(),
  // Данные из Excel
  excel_name: text('excel_name').notNull(),
  excel_sku: text('excel_sku'),
  excel_quantity: real('excel_quantity').default(0).notNull(),
  excel_unit: text('excel_unit').default('шт'),
  // Сопоставление со складом
  warehouse_item_id: text('warehouse_item_id').references(() => warehouse_items.id),
  warehouse_quantity: real('warehouse_quantity').default(0), // сколько есть на складе
  // Статус и AI
  status: text('status').default('pending').notNull(), // in_stock, partial, missing, alternative_selected
  match_confidence: text('match_confidence'), // high, medium, low
  ai_suggestions: text('ai_suggestions'), // JSON массив альтернатив от AI
  // Выбор пользователя
  selected_alternative_id: text('selected_alternative_id').references(() => warehouse_items.id),
  quantity_to_order: real('quantity_to_order').default(0),
  added_to_order: integer('added_to_order', { mode: 'boolean' }).default(0).notNull(),
  // Данные для закупки
  supplier_id: text('supplier_id'), // References suppliers.id
  price: real('price'),
  note: text('note'),
  procurement_status: text('procurement_status').default('pending'), // pending, ordered, in_transit, received, cancelled
  ordered_at: timestamp('ordered_at'),
  received_at: timestamp('received_at'),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertProcurementComparisonItemSchema = createInsertSchema(procurement_comparison_items).omit({ id: true, created_at: true, ordered_at: true, received_at: true });
export type InsertProcurementComparisonItem = z.infer<typeof insertProcurementComparisonItemSchema>;
export type ProcurementComparisonItem = typeof procurement_comparison_items.$inferSelect;


// Suppliers (Поставщики)
export const suppliers = pgTable('suppliers', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  name: text('name').notNull(),
  contact_person: text('contact_person'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  inn: text('inn'),
  notes: text('notes'),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, created_at: true, updated_at: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

// Clients (Клиенты)
export const clients = pgTable('clients', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  name: text('name').notNull(),
  contact_person: text('contact_person'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  inn: text('inn'),
  notes: text('notes'),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, created_at: true, updated_at: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Installers (Монтажники)
export const installers = pgTable('installers', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  specialization: text('specialization'), // Тип работ: мебель, кухни, и т.д.
  hourly_rate: real('hourly_rate'), // Ставка за час
  qualification_level: text('qualification_level').default('medium'), // low, medium, high - уровень квалификации
  description: text('description'), // Описание монтажника
  notes: text('notes'),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertInstallerSchema = createInsertSchema(installers).omit({ id: true, created_at: true, updated_at: true });
export type InsertInstaller = z.infer<typeof insertInstallerSchema>;
export type Installer = typeof installers.$inferSelect;

// Montage Orders (Заказы на монтаж)
export const montage_orders = pgTable('montage_orders', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  order_number: text('order_number'), // M-001, M-002 и т.д.
  project_id: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  address: text('address').notNull(),
  client_name: text('client_name'),
  client_phone: text('client_phone'),
  scheduled_date: text('scheduled_date'), // ISO 8601
  scheduled_time: text('scheduled_time'), // "10:00" или "10:00-14:00"
  deadline: text('deadline'), // Срок выполнения (до какого числа надо завершить)
  status: text('status').notNull().default('planned'), // planned, in_progress, completed, cancelled
  installer_id: text('installer_id').references(() => installers.id),
  total_cost: real('total_cost'),
  notes: text('notes'),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertMontageOrderSchema = createInsertSchema(montage_orders).omit({ id: true, created_at: true, updated_at: true });
export type InsertMontageOrder = z.infer<typeof insertMontageOrderSchema>;
export type MontageOrder = typeof montage_orders.$inferSelect;

// Montage Items (Позиции в заказе на монтаж)
export const montage_items = pgTable('montage_items', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  montage_order_id: text('montage_order_id')
    .references(() => montage_orders.id, { onDelete: 'cascade' })
    .notNull(),
  project_item_id: text('project_item_id')
    .references(() => project_items.id, { onDelete: 'cascade' })
    .notNull(),
  quantity: integer('quantity').notNull().default(1), // Сколько штук из позиции монтируем
  status: text('status').notNull().default('pending'), // pending, installed, issue
  cost: real('cost'), // Стоимость монтажа этой позиции
  notes: text('notes'),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertMontageItemSchema = createInsertSchema(montage_items).omit({ id: true, created_at: true, updated_at: true });
export type InsertMontageItem = z.infer<typeof insertMontageItemSchema>;
export type MontageItem = typeof montage_items.$inferSelect;

// Montage Order Installers (Связь заказов на монтаж с монтажниками - many-to-many)
export const montage_order_installers = pgTable('montage_order_installers', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  montage_order_id: text('montage_order_id')
    .references(() => montage_orders.id, { onDelete: 'cascade' })
    .notNull(),
  installer_id: text('installer_id')
    .references(() => installers.id, { onDelete: 'cascade' })
    .notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
});

export const insertMontageOrderInstallerSchema = createInsertSchema(montage_order_installers).omit({ id: true, created_at: true });
export type InsertMontageOrderInstaller = z.infer<typeof insertMontageOrderInstallerSchema>;
export type MontageOrderInstaller = typeof montage_order_installers.$inferSelect;

// Montage Statuses (Статусы для Kanban колонок)
export const montage_statuses = pgTable('montage_statuses', {
  id: text('id').$defaultFn(() => genId()).primaryKey(),
  code: text('code').notNull().unique(), // planned, in_progress, on_hold, etc.
  name: text('name').notNull(), // Запланирован, В работе, На удержании
  color: text('color').notNull().default('gray'), // yellow, blue, green, gray, red, purple
  bg_color: text('bg_color'), // bg-yellow-100, bg-blue-100, etc.
  text_color: text('text_color'), // text-yellow-600, text-blue-600, etc.
  order: integer('order').notNull().default(0), // Порядок колонок
  is_system: boolean('is_system').default(false).notNull(), // Системные нельзя удалить (planned, completed)
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updated_at: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const insertMontageStatusSchema = createInsertSchema(montage_statuses).omit({ id: true, created_at: true, updated_at: true });
export type InsertMontageStatus = z.infer<typeof insertMontageStatusSchema>;
export type MontageStatus = typeof montage_statuses.$inferSelect;
