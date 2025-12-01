CREATE TABLE "action_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"reason" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action_type" text NOT NULL,
	"user_id" text,
	"field_changed" text,
	"old_value" text,
	"new_value" text,
	"description" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_corrections" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text,
	"user_id" text NOT NULL,
	"original_data" text NOT NULL,
	"corrected_data" text NOT NULL,
	"correction_type" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"inn" text,
	"address" text,
	"phone" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"pipeline_id" text,
	"name" text NOT NULL,
	"field_type" text NOT NULL,
	"options" text,
	"is_required" integer DEFAULT 0 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"pipeline_id" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"color" text DEFAULT '#6366f1',
	"order" integer NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"document_id" text,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"name" text NOT NULL,
	"position" text,
	"phone" text,
	"email" text,
	"is_primary" integer DEFAULT 0 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_custom_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"field_definition_id" text NOT NULL,
	"value" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"document_type" text NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1,
	"file_url" text NOT NULL,
	"data" text,
	"total_amount" real,
	"is_signed" integer DEFAULT 0,
	"parent_id" text,
	"comment" text,
	"contract_number" text,
	"contract_date" text,
	"payment_schedule" text,
	"company_info" text,
	"customer_name" text,
	"customer_phone" text,
	"customer_address" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"message_type" text NOT NULL,
	"content" text NOT NULL,
	"author_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"direction" text DEFAULT 'outgoing' NOT NULL,
	"is_read" integer DEFAULT 0 NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" text PRIMARY KEY NOT NULL,
	"pipeline_id" text,
	"client_name" text NOT NULL,
	"company" text,
	"contact_phone" text,
	"contact_email" text,
	"order_number" text,
	"amount" real,
	"stage" text DEFAULT 'new' NOT NULL,
	"deadline" timestamp,
	"manager_id" text,
	"production_days_count" integer,
	"tags" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "deals_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"project_id" text,
	"project_stage_id" text,
	"template_stage_id" text,
	"file_path" text NOT NULL,
	"size" integer,
	"uploaded_by" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"amount" real NOT NULL,
	"project_id" text,
	"description" text,
	"date" integer NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"client_name" text NOT NULL,
	"address" text NOT NULL,
	"installer_id" text,
	"phone" text,
	"date" integer,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"payment" real,
	"notes" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_prices" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"price" real NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"item_name" text NOT NULL,
	"worker_id" text,
	"payment" real,
	"deadline" timestamp,
	"progress" integer DEFAULT 0,
	"qr_code" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_items" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"article" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price" real,
	"source_document_id" text,
	"order" integer NOT NULL,
	"image_url" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"item_id" text,
	"stage_type_id" text,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assignee_id" text,
	"duration_days" integer,
	"planned_start_date" text,
	"planned_end_date" text,
	"actual_start_date" text,
	"actual_end_date" text,
	"cost" real,
	"description" text,
	"type_data" text,
	"order" integer NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"project_number" text,
	"name" text NOT NULL,
	"client_name" text NOT NULL,
	"deal_id" text,
	"invoice_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0,
	"duration_days" integer,
	"started_at" text,
	"manager_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "projects_project_number_unique" UNIQUE("project_number")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"module" text NOT NULL,
	"can_view" boolean DEFAULT false NOT NULL,
	"can_create" boolean DEFAULT false NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"view_all" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sales_pipelines" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_items" (
	"id" text PRIMARY KEY NOT NULL,
	"shipment_id" text NOT NULL,
	"item_id" text NOT NULL,
	"item_name" text NOT NULL,
	"item_sku" text,
	"quantity" real NOT NULL,
	"unit" text NOT NULL,
	"is_package" integer DEFAULT false,
	"package_details" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" text PRIMARY KEY NOT NULL,
	"shipment_number" text NOT NULL,
	"project_name" text NOT NULL,
	"delivery_address" text,
	"warehouse_keeper" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"confirmed_at" integer,
	"cancelled_at" integer,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "shipments_shipment_number_unique" UNIQUE("shipment_number")
);
--> statement-breakpoint
CREATE TABLE "stage_deadline_history" (
	"id" text PRIMARY KEY NOT NULL,
	"stage_id" text NOT NULL,
	"changed_by" text NOT NULL,
	"changed_by_name" text NOT NULL,
	"old_planned_start" timestamp,
	"new_planned_start" timestamp,
	"old_planned_end" timestamp,
	"new_planned_end" timestamp,
	"reason" text,
	"is_auto_shift" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_dependencies" (
	"id" text PRIMARY KEY NOT NULL,
	"stage_id" text NOT NULL,
	"depends_on_stage_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"stage_id" text NOT NULL,
	"document_type" text NOT NULL,
	"file_name" text,
	"file_url" text,
	"file_size" integer,
	"mime_type" text,
	"metadata" text,
	"uploaded_by" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_media_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"stage_id" text NOT NULL,
	"media_id" text NOT NULL,
	"user_id" text NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"stage_id" text NOT NULL,
	"user_id" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"stage_type_code" text NOT NULL,
	"can_read" boolean DEFAULT false NOT NULL,
	"can_write" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"can_start" boolean DEFAULT false NOT NULL,
	"can_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_types" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "stage_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "stock_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"item_name" text NOT NULL,
	"status" text NOT NULL,
	"quantity" real NOT NULL,
	"min_stock" real NOT NULL,
	"user_id" text,
	"read" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_checklist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"item_text" text NOT NULL,
	"is_completed" integer DEFAULT 0 NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assignee_id" text,
	"created_by" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"deadline" text,
	"start_date" text,
	"completed_at" text,
	"status" text DEFAULT 'new' NOT NULL,
	"related_entity_type" text,
	"related_entity_id" text,
	"deal_id" text,
	"project_id" text,
	"project_stage_id" text,
	"project_item_id" text,
	"submitted_for_review_at" text,
	"reviewed_by" text,
	"reviewed_at" text,
	"review_status" text,
	"rejection_reason" text,
	"estimated_hours" real,
	"actual_hours" real,
	"tags" text,
	"attachments_count" integer DEFAULT 0,
	"comments_count" integer DEFAULT 0,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_dependencies" (
	"id" text PRIMARY KEY NOT NULL,
	"template_stage_id" text NOT NULL,
	"depends_on_template_stage_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_stage_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"template_stage_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"stage_type_id" text,
	"name" text NOT NULL,
	"description" text,
	"duration_days" integer,
	"assignee_id" text,
	"cost" real,
	"order" integer NOT NULL,
	"template_data" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"module" text NOT NULL,
	"can_view" boolean DEFAULT false NOT NULL,
	"can_create" boolean DEFAULT false NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"view_all" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"project_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text,
	"full_name" text,
	"role_id" text,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "warehouse_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"icon" text,
	"color" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"barcode" text,
	"quantity" real DEFAULT 0 NOT NULL,
	"reserved_quantity" real DEFAULT 0 NOT NULL,
	"unit" text NOT NULL,
	"price" real DEFAULT 0,
	"location" text,
	"category_id" text,
	"supplier" text,
	"description" text,
	"min_stock" real DEFAULT 0,
	"track_min_stock" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'normal' NOT NULL,
	"project_id" text,
	"project_name" text,
	"package_details" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"project_id" text NOT NULL,
	"quantity" real NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reserved_by" text,
	"reason" text,
	"notes" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"released_at" integer
);
--> statement-breakpoint
CREATE TABLE "warehouse_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"type" text NOT NULL,
	"quantity" real NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"notes" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_audit_log" ADD CONSTRAINT "action_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_corrections" ADD CONSTRAINT "ai_corrections_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_corrections" ADD CONSTRAINT "ai_corrections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_pipeline_id_sales_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."sales_pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stages" ADD CONSTRAINT "deal_stages_pipeline_id_sales_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."sales_pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_attachments" ADD CONSTRAINT "deal_attachments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_attachments" ADD CONSTRAINT "deal_attachments_document_id_deal_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."deal_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_attachments" ADD CONSTRAINT "deal_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_contacts" ADD CONSTRAINT "deal_contacts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_custom_fields" ADD CONSTRAINT "deal_custom_fields_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_custom_fields" ADD CONSTRAINT "deal_custom_fields_field_definition_id_custom_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."custom_field_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_parent_id_deal_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."deal_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_messages" ADD CONSTRAINT "deal_messages_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_messages" ADD CONSTRAINT "deal_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_pipeline_id_sales_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."sales_pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_stage_id_project_stages_id_fk" FOREIGN KEY ("project_stage_id") REFERENCES "public"."project_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_template_stage_id_template_stages_id_fk" FOREIGN KEY ("template_stage_id") REFERENCES "public"."template_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_installer_id_users_id_fk" FOREIGN KEY ("installer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_templates" ADD CONSTRAINT "process_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_stages" ADD CONSTRAINT "production_stages_task_id_production_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."production_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_tasks" ADD CONSTRAINT "production_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_tasks" ADD CONSTRAINT "production_tasks_worker_id_users_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_source_document_id_deal_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."deal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_messages" ADD CONSTRAINT "project_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_messages" ADD CONSTRAINT "project_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_item_id_project_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."project_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_stage_type_id_stage_types_id_fk" FOREIGN KEY ("stage_type_id") REFERENCES "public"."stage_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_invoice_id_deal_documents_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."deal_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_item_id_warehouse_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."warehouse_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_deadline_history" ADD CONSTRAINT "stage_deadline_history_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_deadline_history" ADD CONSTRAINT "stage_deadline_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_dependencies" ADD CONSTRAINT "stage_dependencies_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_dependencies" ADD CONSTRAINT "stage_dependencies_depends_on_stage_id_project_stages_id_fk" FOREIGN KEY ("depends_on_stage_id") REFERENCES "public"."project_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_documents" ADD CONSTRAINT "stage_documents_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_documents" ADD CONSTRAINT "stage_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_media_comments" ADD CONSTRAINT "stage_media_comments_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_media_comments" ADD CONSTRAINT "stage_media_comments_media_id_stage_documents_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."stage_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_media_comments" ADD CONSTRAINT "stage_media_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_messages" ADD CONSTRAINT "stage_messages_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_messages" ADD CONSTRAINT "stage_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_notifications" ADD CONSTRAINT "stock_notifications_item_id_warehouse_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."warehouse_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_notifications" ADD CONSTRAINT "stock_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_stage_id_project_stages_id_fk" FOREIGN KEY ("project_stage_id") REFERENCES "public"."project_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_item_id_project_items_id_fk" FOREIGN KEY ("project_item_id") REFERENCES "public"."project_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_dependencies" ADD CONSTRAINT "template_dependencies_template_stage_id_template_stages_id_fk" FOREIGN KEY ("template_stage_id") REFERENCES "public"."template_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_dependencies" ADD CONSTRAINT "template_dependencies_depends_on_template_stage_id_template_stages_id_fk" FOREIGN KEY ("depends_on_template_stage_id") REFERENCES "public"."template_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_stage_attachments" ADD CONSTRAINT "template_stage_attachments_template_stage_id_template_stages_id_fk" FOREIGN KEY ("template_stage_id") REFERENCES "public"."template_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_stage_attachments" ADD CONSTRAINT "template_stage_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_stages" ADD CONSTRAINT "template_stages_template_id_process_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."process_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_stages" ADD CONSTRAINT "template_stages_stage_type_id_stage_types_id_fk" FOREIGN KEY ("stage_type_id") REFERENCES "public"."stage_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_stages" ADD CONSTRAINT "template_stages_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_categories" ADD CONSTRAINT "warehouse_categories_parent_id_warehouse_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."warehouse_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_items" ADD CONSTRAINT "warehouse_items_category_id_warehouse_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."warehouse_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_items" ADD CONSTRAINT "warehouse_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_reservations" ADD CONSTRAINT "warehouse_reservations_item_id_warehouse_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."warehouse_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_reservations" ADD CONSTRAINT "warehouse_reservations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_reservations" ADD CONSTRAINT "warehouse_reservations_reserved_by_users_id_fk" FOREIGN KEY ("reserved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_item_id_warehouse_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."warehouse_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;