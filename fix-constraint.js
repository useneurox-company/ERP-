import 'dotenv/config';
import { Pool } from 'pg';

// Try to connect with superuser first, fallback to regular user
const superuserPool = new Pool({
  connectionString: 'postgresql://postgres:@localhost:5432/emerald_erp_local',
});

const regularPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://emerald_user:emerald123@localhost:5432/emerald_erp_local',
});

async function dropConstraint() {
  let pool = superuserPool;
  let usingSuperuser = false;

  try {
    // Check if constraint exists first
    const checkResult = await pool.query(
      `SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_name = 'projects' AND constraint_type = 'UNIQUE' AND constraint_name = 'projects_project_number_unique';`
    );

    if (checkResult.rows.length === 0) {
      console.log('✅ Constraint does not exist or already removed');
      await pool.end();
      await regularPool.end();
      process.exit(0);
    }

    usingSuperuser = true;
    console.log('Using superuser connection...');
  } catch (e) {
    console.log('Superuser connection failed, trying regular user...');
    usingSuperuser = false;
    pool = regularPool;
  }

  try {
    const result = await pool.query(
      `ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_number_unique;`
    );
    console.log('✅ Constraint dropped successfully');
  } catch (error) {
    console.error('❌ Error dropping constraint:', error.message);
    if (!usingSuperuser) {
      console.error('\nNote: The current database user does not have permission to drop constraints.');
      console.error('You need to run this with a PostgreSQL superuser (e.g., postgres)');
    }
    process.exit(1);
  }

  await superuserPool.end();
  await regularPool.end();
  process.exit(0);
}

dropConstraint();
