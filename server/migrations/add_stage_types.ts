import { db } from '../db';
import { stage_types } from '@shared/schema';

const DEFAULT_STAGE_TYPES = [
  {
    code: 'measurement',
    name: 'Замер',
    icon: '📏',
    description: 'Проведение замеров на объекте',
    is_active: 1,
  },
  {
    code: 'design',
    name: 'Проектирование',
    icon: '📐',
    description: 'Разработка проекта и чертежей',
    is_active: 1,
  },
  {
    code: 'approval',
    name: 'Согласование',
    icon: '✅',
    description: 'Согласование проекта с клиентом',
    is_active: 1,
  },
  {
    code: 'production',
    name: 'Производство',
    icon: '🏭',
    description: 'Изготовление мебели',
    is_active: 1,
  },
  {
    code: 'delivery',
    name: 'Доставка',
    icon: '🚚',
    description: 'Доставка продукции на объект',
    is_active: 1,
  },
  {
    code: 'installation',
    name: 'Монтаж',
    icon: '🔧',
    description: 'Установка и монтаж мебели',
    is_active: 1,
  },
];

export async function migrateStageTypes() {
  console.log('🔄 Starting stage types migration...');

  try {
    // Create tables using better-sqlite3 directly
    console.log('📋 Creating tables...');

    const Database = (await import('better-sqlite3')).default;
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const dbPath = join(__dirname, '../../.local/emerald_erp.db');
    const sqlite = new Database(dbPath);

    // Create stage_types table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS stage_types (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        icon TEXT,
        description TEXT,
        is_active INTEGER DEFAULT 1 NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Add stage_type_id to template_stages
    try {
      sqlite.exec('ALTER TABLE template_stages ADD COLUMN stage_type_id TEXT REFERENCES stage_types(id);');
      console.log('  ✅ Added stage_type_id to template_stages');
    } catch (e: any) {
      if (!e.message.includes('duplicate column name')) throw e;
      console.log('  ℹ️  Column stage_type_id already exists in template_stages');
    }

    // Add stage_type_id to project_stages
    try {
      sqlite.exec('ALTER TABLE project_stages ADD COLUMN stage_type_id TEXT REFERENCES stage_types(id);');
      console.log('  ✅ Added stage_type_id to project_stages');
    } catch (e: any) {
      if (!e.message.includes('duplicate column name')) throw e;
      console.log('  ℹ️  Column stage_type_id already exists in project_stages');
    }

    // Add type_data to project_stages
    try {
      sqlite.exec('ALTER TABLE project_stages ADD COLUMN type_data TEXT;');
      console.log('  ✅ Added type_data to project_stages');
    } catch (e: any) {
      if (!e.message.includes('duplicate column name')) throw e;
      console.log('  ℹ️  Column type_data already exists in project_stages');
    }

    // Create stage_documents table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS stage_documents (
        id TEXT PRIMARY KEY,
        stage_id TEXT NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
        media_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        thumbnail_url TEXT,
        uploaded_by TEXT REFERENCES users(id),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    console.log('  ✅ Created stage_documents table');

    // Create stage_media_comments table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS stage_media_comments (
        id TEXT PRIMARY KEY,
        stage_id TEXT NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
        media_id TEXT NOT NULL REFERENCES stage_documents(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id),
        comment TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    console.log('  ✅ Created stage_media_comments table');

    sqlite.close();

    console.log('✅ Tables created successfully!');

    // Insert default stage types
    console.log('📝 Creating default stage types...');
    for (const stageType of DEFAULT_STAGE_TYPES) {
      try {
        // Check if stage type already exists
        const existing = await db.query.stage_types.findFirst({
          where: (st, { eq }) => eq(st.code, stageType.code),
        });

        if (!existing) {
          await db.insert(stage_types).values(stageType);
          console.log(`  ✅ Created stage type: ${stageType.name} (${stageType.code})`);
        } else {
          console.log(`  ℹ️  Stage type "${stageType.name}" already exists, skipping...`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to create stage type ${stageType.name}:`, error);
      }
    }

    console.log('✅ Stage types migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Export the migration function
