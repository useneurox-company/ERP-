CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action_type` text NOT NULL,
	`user_id` text,
	`field_changed` text,
	`old_value` text,
	`new_value` text,
	`description` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ai_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ai_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text,
	`user_id` text NOT NULL,
	`original_data` text NOT NULL,
	`corrected_data` text NOT NULL,
	`correction_type` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `company_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`inn` text,
	`address` text,
	`phone` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `custom_field_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text,
	`name` text NOT NULL,
	`field_type` text NOT NULL,
	`options` text,
	`is_required` integer DEFAULT 0 NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pipeline_id`) REFERENCES `sales_pipelines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `deal_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`color` text DEFAULT '#6366f1',
	`order` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pipeline_id`) REFERENCES `sales_pipelines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `deal_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`document_id` text,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer,
	`mime_type` text,
	`uploaded_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `deal_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `deal_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`name` text NOT NULL,
	`position` text,
	`phone` text,
	`email` text,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `deal_custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`field_definition_id` text NOT NULL,
	`value` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_definition_id`) REFERENCES `custom_field_definitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `deal_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`document_type` text NOT NULL,
	`name` text NOT NULL,
	`version` integer DEFAULT 1,
	`file_url` text NOT NULL,
	`data` text,
	`total_amount` real,
	`is_signed` integer DEFAULT 0,
	`parent_id` text,
	`comment` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `deal_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `deal_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`message_type` text NOT NULL,
	`content` text NOT NULL,
	`author_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text,
	`client_name` text NOT NULL,
	`company` text,
	`contact_phone` text,
	`contact_email` text,
	`order_number` text,
	`amount` real,
	`stage` text DEFAULT 'new' NOT NULL,
	`deadline` integer,
	`manager_id` text,
	`production_days_count` integer,
	`tags` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`pipeline_id`) REFERENCES `sales_pipelines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deals_order_number_unique` ON `deals` (`order_number`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`project_id` text,
	`project_stage_id` text,
	`template_stage_id` text,
	`file_path` text NOT NULL,
	`size` integer,
	`uploaded_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_stage_id`) REFERENCES `project_stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_stage_id`) REFERENCES `template_stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `financial_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`project_id` text,
	`description` text,
	`date` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `installations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_name` text NOT NULL,
	`address` text NOT NULL,
	`installer_id` text,
	`phone` text,
	`date` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`payment` real,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`installer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `material_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`unit` text NOT NULL,
	`price` real NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `process_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_by` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `production_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `production_tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `production_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`item_name` text NOT NULL,
	`worker_id` text,
	`payment` real,
	`deadline` integer,
	`progress` integer DEFAULT 0,
	`qr_code` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`worker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_items` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`article` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`price` real,
	`source_document_id` text,
	`order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_document_id`) REFERENCES `deal_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`item_id` text,
	`name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`assignee_id` text,
	`duration_days` integer,
	`planned_start_date` integer,
	`planned_end_date` integer,
	`actual_start_date` integer,
	`actual_end_date` integer,
	`cost` real,
	`description` text,
	`order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `project_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`client_name` text NOT NULL,
	`deal_id` text,
	`invoice_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`progress` integer DEFAULT 0,
	`duration_days` integer,
	`started_at` integer,
	`manager_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `deal_documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`role_id` text NOT NULL,
	`module` text NOT NULL,
	`can_view` integer DEFAULT 0 NOT NULL,
	`can_create` integer DEFAULT 0 NOT NULL,
	`can_edit` integer DEFAULT 0 NOT NULL,
	`can_delete` integer DEFAULT 0 NOT NULL,
	`view_all` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_system` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_name_unique` ON `roles` (`name`);--> statement-breakpoint
CREATE TABLE `sales_pipelines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_default` integer DEFAULT 0 NOT NULL,
	`order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stage_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_id` text NOT NULL,
	`depends_on_stage_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`stage_id`) REFERENCES `project_stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_stage_id`) REFERENCES `project_stages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stage_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_id` text NOT NULL,
	`user_id` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`stage_id`) REFERENCES `project_stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `task_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`item_text` text NOT NULL,
	`is_completed` integer DEFAULT 0 NOT NULL,
	`order` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`assignee_id` text,
	`created_by` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`deadline` integer,
	`start_date` integer,
	`completed_at` integer,
	`status` text DEFAULT 'new' NOT NULL,
	`related_entity_type` text,
	`related_entity_id` text,
	`estimated_hours` real,
	`actual_hours` real,
	`tags` text,
	`attachments_count` integer DEFAULT 0,
	`comments_count` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `template_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`template_stage_id` text NOT NULL,
	`depends_on_template_stage_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`template_stage_id`) REFERENCES `template_stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_template_stage_id`) REFERENCES `template_stages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `template_stage_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`template_stage_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer,
	`mime_type` text,
	`uploaded_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`template_stage_id`) REFERENCES `template_stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `template_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`duration_days` integer,
	`assignee_id` text,
	`cost` real,
	`order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `process_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`email` text,
	`full_name` text,
	`role_id` text,
	`phone` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `warehouse_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text,
	`barcode` text,
	`quantity` real DEFAULT 0 NOT NULL,
	`reserved_quantity` real DEFAULT 0 NOT NULL,
	`unit` text NOT NULL,
	`price` real DEFAULT 0,
	`location` text,
	`category` text NOT NULL,
	`supplier` text,
	`description` text,
	`min_stock` real DEFAULT 0,
	`status` text DEFAULT 'normal' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `warehouse_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`project_id` text NOT NULL,
	`quantity` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reserved_by` text NOT NULL,
	`reason` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`released_at` integer,
	FOREIGN KEY (`item_id`) REFERENCES `warehouse_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reserved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `warehouse_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `warehouse_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
