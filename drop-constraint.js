import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://emerald_user:emerald123@localhost:5432/emerald_erp_local',
});

async function dropConstraint() {
  try {
    const result = await pool.query(
      `ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_number_unique;`
    );
    console.log('✅ Constraint dropped successfully');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error dropping constraint:', error.message);
    await pool.end();
    process.exit(1);
  }
}

dropConstraint();
