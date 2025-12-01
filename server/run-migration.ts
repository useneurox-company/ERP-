import { migrateRolesAndPermissions } from './migrations/add_roles_and_permissions';
import { migrateStageTypes } from './migrations/add_stage_types';

console.log('Starting migrations...');

// Run migrations sequentially
migrateRolesAndPermissions()
  .then(() => {
    console.log('✅ Roles and permissions migration completed!');
    return migrateStageTypes();
  })
  .then(() => {
    console.log('✅ All migrations completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
