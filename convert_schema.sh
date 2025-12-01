#!/bin/bash
# PostgreSQL to SQLite schema converter

sed 's/from "drizzle-orm\/pg-core"/from "drizzle-orm\/sqlite-core"/g' "C:/NX/Emerald ERP/shared/schema.pg.backup.ts" | \
sed 's/pgTable/sqliteTable/g' | \
sed 's/pgEnum/\/\/ pgEnum removed/g' | \
sed 's/statusEnum("status")/text("status")/g' | \
sed 's/warehouseCategoryEnum("category")/text("category")/g' | \
sed 's/warehouseStatusEnum("status")/text("status")/g' | \
sed 's/transactionTypeEnum("type")/text("type")/g' | \
sed 's/financialTypeEnum("type")/text("type")/g' | \
sed 's/installationStatusEnum("status")/text("status")/g' | \
sed 's/priorityEnum("priority")/text("priority")/g' | \
sed 's/documentTypeEnum("type")/text("type")/g' | \
sed 's/messageTypeEnum("message_type")/text("message_type")/g' | \
sed 's/dealDocumentTypeEnum("document_type")/text("document_type")/g' | \
sed 's/customFieldTypeEnum("field_type")/text("field_type")/g' | \
sed 's/numeric/real/g' | \
sed 's/timestamp/integer/g' | \
sed 's/jsonb/text/g' | \
sed 's/varchar/text/g' | \
sed 's/boolean/integer/g' | \
sed 's/sql\`gen_random_uuid()\`/\$defaultFn(() => nanoid())/g' | \
sed 's/\.array()/\/\/ array removed - store as JSON text/g' | \
sed '1s/^/import { nanoid } from "nanoid";\n/' | \
sed '2s/^/const genId = () => nanoid();\n/' > "C:/NX/Emerald ERP/shared/schema.ts"

echo "Schema converted successfully"
