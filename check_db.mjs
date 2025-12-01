import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const result = await pool.query();

console.log('=== TABLES ===');
result.rows.forEach(row => console.log(row.table_name));

await pool.end();
