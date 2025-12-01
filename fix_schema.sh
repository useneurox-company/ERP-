#!/bin/bash

# Fix the converted schema
cat "C:/NX/Emerald ERP/shared/schema.ts" | \
# Remove enum lines
grep -v "// pgEnum removed" | \
# Fix imports
sed '4s/.*/import { sqliteTable, text, integer, real } from "drizzle-orm\/sqlite-core";/' | \
# Fix gen_random_uuid
sed 's/\.default(sql\`gen_random_uuid()\`)/.primaryKey().\$defaultFn(() => genId())/g' | \
sed 's/\.default(true)/.default(1)/g' | \
sed 's/\.default(false)/.default(0)/g' | \
sed 's/\.defaultNow()/.\$defaultFn(() => new Date())/g' | \
# Fix boolean mode
sed 's/integer("\([^"]*\)")/integer("\1", { mode: "boolean" })/g' | \
# Fix timestamp mode
sed 's/integer("\([^"]*\)", { mode: "boolean" }), { mode: "timestamp" }/integer("\1", { mode: "timestamp" })/g' | \
sed 's/integer("created_at", { mode: "boolean" })/integer("created_at", { mode: "timestamp" })/g' | \
sed 's/integer("updated_at", { mode: "boolean" })/integer("updated_at", { mode: "timestamp" })/g' | \
sed 's/integer("deadline", { mode: "boolean" })/integer("deadline", { mode: "timestamp" })/g' | \
sed 's/integer("date", { mode: "boolean" })/integer("date", { mode: "timestamp" })/g' | \
sed 's/integer("started_at", { mode: "boolean" })/integer("started_at", { mode: "timestamp" })/g' | \
sed 's/integer("planned_start_date", { mode: "boolean" })/integer("planned_start_date", { mode: "timestamp" })/g' | \
sed 's/integer("planned_end_date", { mode: "boolean" })/integer("planned_end_date", { mode: "timestamp" })/g' | \
sed 's/integer("actual_start_date", { mode: "boolean" })/integer("actual_start_date", { mode: "timestamp" })/g' | \
sed 's/integer("actual_end_date", { mode: "boolean" })/integer("actual_end_date", { mode: "timestamp" })/g' | \
sed 's/integer("size", { mode: "boolean" })/integer("size")/g' | \
sed 's/integer("file_size", { mode: "boolean" })/integer("file_size")/g' | \
sed 's/integer("version", { mode: "boolean" })/integer("version")/g' | \
sed 's/integer("order", { mode: "boolean" })/integer("order")/g' | \
sed 's/integer("quantity", { mode: "boolean" })/integer("quantity")/g' | \
sed 's/integer("progress", { mode: "boolean" })/integer("progress")/g' | \
sed 's/integer("production_days_count", { mode: "boolean" })/integer("production_days_count")/g' | \
sed 's/integer("duration_days", { mode: "boolean" })/integer("duration_days")/g' | \
sed 's/integer("attachments_count", { mode: "boolean" })/integer("attachments_count")/g' | \
sed 's/integer("comments_count", { mode: "boolean" })/integer("comments_count")/g' | \
sed 's/integer("can_create_deals", { mode: "boolean" })/integer("can_create_deals", { mode: "boolean" })/g' | \
sed 's/integer("can_edit_deals", { mode: "boolean" })/integer("can_edit_deals", { mode: "boolean" })/g' | \
sed 's/integer("can_delete_deals", { mode: "boolean" })/integer("can_delete_deals", { mode: "boolean" })/g' | \
sed 's/integer("is_signed", { mode: "boolean" })/integer("is_signed", { mode: "boolean" })/g' | \
sed 's/integer("is_active", { mode: "boolean" })/integer("is_active", { mode: "boolean" })/g' > "C:/NX/Emerald ERP/shared/schema_fixed.ts"

mv "C:/NX/Emerald ERP/shared/schema_fixed.ts" "C:/NX/Emerald ERP/shared/schema.ts"
echo "Schema fixed"
