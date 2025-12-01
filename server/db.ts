import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from "@shared/schema";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if we should use PostgreSQL based on DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
const nodeEnv = process.env.NODE_ENV;
const isPostgres = dbUrl && dbUrl.startsWith('postgresql://');
let db: any;

if (isPostgres && dbUrl) {
  // Use PostgreSQL in production
  console.log('📂 Using PostgreSQL database');
  console.log('📂 Connection string:', dbUrl);

  // Create pool with explicit configuration
  const pool = new Pool({
    connectionString: dbUrl,
    // Add connection timeout to help with debugging
    connectionTimeoutMillis: 5000,
    // Add idle timeout
    idleTimeoutMillis: 30000,
    // Max connections
    max: 20
  });

  // Test the connection
  pool.query('SELECT 1').then(() => {
    console.log('✅ PostgreSQL connection verified');
  }).catch(err => {
    console.error('❌ PostgreSQL connection failed:', err.message);
  });

  db = drizzlePg(pool, { schema });
} else {
  // Use SQLite for local development (default behavior)
  // Create .local directory if it doesn't exist
  const localDir = join(__dirname, '../.local');
  if (!existsSync(localDir)) {
    mkdirSync(localDir, { recursive: true });
  }

  // Create local SQLite database file in .local directory
  const dbPath = join(localDir, 'emerald_erp.db');

  console.log(`📂 Using local SQLite database at: ${dbPath}`);

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Configure Drizzle with proper date handling for SQLite
  // Timestamps will be stored as Unix timestamps (milliseconds)
  db = drizzleSqlite(sqlite, {
    schema,
    mode: 'default'
  });
}

export { db };
