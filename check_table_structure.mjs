import { db } from "./server/db.ts";

const result = await db.prepare("PRAGMA table_info(warehouse_items)").all();
console.log(JSON.stringify(result, null, 2));
