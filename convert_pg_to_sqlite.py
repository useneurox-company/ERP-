import re

# Read PostgreSQL schema
with open('shared/schema.pg.backup.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace imports
content = re.sub(
    r'import \{ pgTable, text, varchar, integer, timestamp, pgEnum, numeric, boolean, jsonb \} from "drizzle-orm/pg-core";',
    'import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";',
    content
)

# Remove sql import
content = re.sub(r'import \{ sql \} from "drizzle-orm";', '', content)

# Add nanoid import at the beginning
content = 'import { nanoid } from "nanoid";\nconst genId = () => nanoid();\n\n' + content

# Remove enum declarations
content = re.sub(r'export const \w+Enum = pgEnum\([^)]+\);', '', content)

# Replace table definitions
content = content.replace('pgTable', 'sqliteTable')

# Replace column types
content = content.replace('varchar', 'text')
content = re.sub(r'numeric\([^)]+\)', 'real', content)
content = re.sub(r'timestamp\(("[^"]+"),\s*\{[^}]*\}\)', r'integer(\1, { mode: "timestamp" })', content)
content = content.replace('timestamp(', 'integer(')
content = content.replace('boolean(', 'integer(')
content = content.replace('jsonb(', 'text(')

# Replace array types
content = re.sub(r'\.array\(\)', '', content)

# Replace default UUID generation
content = re.sub(r'\.default\(sql`gen_random_uuid\(\)`\)', '.$defaultFn(() => genId())', content)

# Replace enum column types with text
enum_types = [
    ('statusEnum', 'status'),
    ('warehouseCategoryEnum', 'category'),
    ('warehouseStatusEnum', 'status'),
    ('transactionTypeEnum', 'type'),
    ('financialTypeEnum', 'type'),
    ('installationStatusEnum', 'status'),
    ('priorityEnum', 'priority'),
    ('documentTypeEnum', 'type'),
    ('messageTypeEnum', 'message_type'),
    ('dealDocumentTypeEnum', 'document_type'),
    ('customFieldTypeEnum', 'field_type'),
]

for enum_name, col_name in enum_types:
    content = re.sub(rf'{enum_name}\("{col_name}"\)', f'text("{col_name}")', content)

# Fix boolean defaults
content = content.replace('.default(true)', '.default(1)')
content = content.replace('.default(false)', '.default(0)')

# Replace defaultNow with $defaultFn
content = content.replace('.defaultNow()', '.$defaultFn(() => new Date())')

# Add mode: "boolean" for boolean columns
boolean_columns = [
    'can_create_deals',
    'can_edit_deals',
    'can_delete_deals',
    'is_signed',
    'is_active',
]

for col in boolean_columns:
    content = re.sub(rf'integer\("{col}"\)', f'integer("{col}", {{ mode: "boolean" }})', content)

# Write SQLite schema
with open('shared/schema.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Conversion complete!")
