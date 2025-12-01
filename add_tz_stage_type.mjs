// Add technical_specification stage type to database
import { db } from './server/db.js';
import { stage_types } from './shared/schema.js';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

async function addTechSpecType() {
  console.log('Adding technical_specification stage type...');

  // Check if it already exists
  const existing = await db
    .select()
    .from(stage_types)
    .where(eq(stage_types.code, 'technical_specification'))
    .limit(1);

  if (existing.length > 0) {
    console.log('✅ Technical Specification stage type already exists');
    console.log('   ID:', existing[0].id);
    console.log('   Name:', existing[0].name);
    return;
  }

  // Insert new stage type (using integer for is_active to support SQLite)
  await db.insert(stage_types).values({
    id: nanoid(),
    code: 'technical_specification',
    name: 'Техническое задание',
    icon: '📋',
    description: 'Формирование технического задания с допами и финальным КП',
    is_active: 1, // Use 1 instead of true for SQLite compatibility
  });

  console.log('✅ Technical Specification stage type created successfully');
}

addTechSpecType()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
