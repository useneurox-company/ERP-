import { db } from './db';
import { process_templates, template_stages } from '@shared/schema';

async function reseedTemplates() {
  console.log('🗑️  Deleting old templates and their stages...');

  // Delete all template_stages and process_templates
  await db.delete(template_stages);
  await db.delete(process_templates);

  console.log('✅ Old templates deleted');
  console.log('🌱 Now run: npm run seed-stage-types');
}

reseedTemplates().catch(console.error);
