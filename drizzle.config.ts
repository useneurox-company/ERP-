import { defineConfig} from "drizzle-kit";
import 'dotenv/config';

const dbUrl = process.env.DATABASE_URL || "./.local/emerald_erp.db";
const isPostgres = dbUrl.startsWith('postgresql://');

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: isPostgres ? "postgresql" : "sqlite",
  dbCredentials: {
    url: dbUrl,
  },
});
