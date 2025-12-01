import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

const genId = () => nanoid();

export function migrateSalesPipelines(db: Database.Database) {
  console.log('Running migration: add_sales_pipelines');

  // Create sales_pipelines table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_pipelines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      "order" INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Create default pipeline if not exists
  const defaultPipelineId = genId();
  const existingPipeline = db.prepare('SELECT id FROM sales_pipelines WHERE is_default = 1').get();

  if (!existingPipeline) {
    console.log('Creating default sales pipeline...');
    db.prepare(`
      INSERT INTO sales_pipelines (id, name, description, is_default, "order", created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      defaultPipelineId,
      'Основная воронка',
      'Стандартная воронка продаж',
      1,
      0,
      Date.now(),
      Date.now()
    );
  }

  // Check if pipeline_id column exists in deal_stages
  const stagesTableInfo = db.prepare("PRAGMA table_info(deal_stages)").all() as any[];
  const hasPipelineIdInStages = stagesTableInfo.some((col: any) => col.name === 'pipeline_id');

  if (!hasPipelineIdInStages) {
    console.log('Migrating deal_stages table...');

    // Get the default pipeline ID (either newly created or existing)
    const defaultPipeline = db.prepare('SELECT id FROM sales_pipelines WHERE is_default = 1').get() as any;
    const pipelineId = defaultPipeline?.id || defaultPipelineId;

    // Backup existing stages
    db.exec(`
      CREATE TABLE IF NOT EXISTS deal_stages_backup AS SELECT * FROM deal_stages;
    `);

    // Drop old table and create new one with pipeline_id
    db.exec(`DROP TABLE IF EXISTS deal_stages`);
    db.exec(`
      CREATE TABLE deal_stages (
        id TEXT PRIMARY KEY,
        pipeline_id TEXT NOT NULL,
        name TEXT NOT NULL,
        key TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        "order" INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (pipeline_id) REFERENCES sales_pipelines(id) ON DELETE CASCADE
      );
    `);

    // Migrate old stages to default pipeline
    const oldStages = db.prepare('SELECT * FROM deal_stages_backup').all() as any[];
    if (oldStages.length > 0) {
      console.log(`Migrating ${oldStages.length} existing stages to default pipeline...`);
      const insertStmt = db.prepare(`
        INSERT INTO deal_stages (id, pipeline_id, name, key, color, "order", created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const stage of oldStages) {
        insertStmt.run(
          stage.id,
          pipelineId,
          stage.name,
          stage.key,
          stage.color,
          stage.order,
          stage.created_at
        );
      }
    } else {
      // Create default stages if none existed
      console.log('Creating default stages...');
      const defaultStages = [
        { name: 'Новый', key: 'new', color: '#6366f1', order: 0 },
        { name: 'Переговоры', key: 'negotiation', color: '#8b5cf6', order: 1 },
        { name: 'Предложение отправлено', key: 'proposal_sent', color: '#3b82f6', order: 2 },
        { name: 'Договор', key: 'contract', color: '#10b981', order: 3 },
        { name: 'Успешно', key: 'won', color: '#22c55e', order: 4 },
        { name: 'Отказ', key: 'lost', color: '#ef4444', order: 5 },
      ];

      const insertStmt = db.prepare(`
        INSERT INTO deal_stages (id, pipeline_id, name, key, color, "order", created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const stage of defaultStages) {
        insertStmt.run(
          genId(),
          pipelineId,
          stage.name,
          stage.key,
          stage.color,
          stage.order,
          Date.now()
        );
      }
    }

    // Drop backup table
    db.exec(`DROP TABLE IF EXISTS deal_stages_backup`);
  }

  // Check if pipeline_id column exists in deals
  const dealsTableInfo = db.prepare("PRAGMA table_info(deals)").all() as any[];
  const hasPipelineIdInDeals = dealsTableInfo.some((col: any) => col.name === 'pipeline_id');

  if (!hasPipelineIdInDeals) {
    console.log('Adding pipeline_id to deals table...');

    // Get the default pipeline ID
    const defaultPipeline = db.prepare('SELECT id FROM sales_pipelines WHERE is_default = 1').get() as any;
    const pipelineId = defaultPipeline?.id || defaultPipelineId;

    // Add column
    db.exec(`ALTER TABLE deals ADD COLUMN pipeline_id TEXT REFERENCES sales_pipelines(id)`);

    // Set all existing deals to default pipeline
    db.prepare(`UPDATE deals SET pipeline_id = ? WHERE pipeline_id IS NULL`).run(pipelineId);
  }

  // Check if pipeline_id, is_required, and order columns exist in custom_field_definitions
  const customFieldsTableInfo = db.prepare("PRAGMA table_info(custom_field_definitions)").all() as any[];
  const hasPipelineIdInCustomFields = customFieldsTableInfo.some((col: any) => col.name === 'pipeline_id');
  const hasIsRequired = customFieldsTableInfo.some((col: any) => col.name === 'is_required');
  const hasOrder = customFieldsTableInfo.some((col: any) => col.name === 'order');

  if (!hasPipelineIdInCustomFields || !hasIsRequired || !hasOrder) {
    console.log('Migrating custom_field_definitions table...');

    // Backup existing custom fields
    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_field_definitions_backup AS SELECT * FROM custom_field_definitions;
    `);

    // Drop and recreate table
    db.exec(`DROP TABLE IF EXISTS custom_field_definitions`);
    db.exec(`
      CREATE TABLE custom_field_definitions (
        id TEXT PRIMARY KEY,
        pipeline_id TEXT,
        name TEXT NOT NULL,
        field_type TEXT NOT NULL,
        options TEXT,
        is_required INTEGER NOT NULL DEFAULT 0,
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (pipeline_id) REFERENCES sales_pipelines(id) ON DELETE CASCADE
      );
    `);

    // Migrate old custom fields (make them global by setting pipeline_id to NULL)
    const oldCustomFields = db.prepare('SELECT * FROM custom_field_definitions_backup').all() as any[];
    if (oldCustomFields.length > 0) {
      console.log(`Migrating ${oldCustomFields.length} existing custom fields as global fields...`);
      const insertStmt = db.prepare(`
        INSERT INTO custom_field_definitions (id, pipeline_id, name, field_type, options, is_required, "order", created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < oldCustomFields.length; i++) {
        const field = oldCustomFields[i];
        insertStmt.run(
          field.id,
          null, // Global field
          field.name,
          field.field_type,
          field.options,
          0, // Not required by default
          i, // Order based on existing sequence
          field.created_at
        );
      }
    }

    // Drop backup table
    db.exec(`DROP TABLE IF EXISTS custom_field_definitions_backup`);
  }

  console.log('Migration add_sales_pipelines completed successfully');
}
