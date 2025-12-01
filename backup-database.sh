#!/bin/bash

# PostgreSQL backup script for Emerald ERP
# Runs before each deployment to preserve production data

BACKUP_DIR="/var/backups/postgresql/emerald_erp"
DB_NAME="emerald_erp"
DB_USER="emerald_user"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

echo "📦 Creating PostgreSQL backup..."
echo "   Database: ${DB_NAME}"
echo "   Location: ${BACKUP_FILE}"

# Create compressed backup
sudo -u postgres pg_dump ${DB_NAME} | gzip > ${BACKUP_FILE}

# Check if backup was successful
if [ $? -eq 0 ]; then
    FILE_SIZE=$(ls -lh ${BACKUP_FILE} | awk '{print $5}')
    echo "✅ Backup created successfully (${FILE_SIZE})"

    # Keep only last 10 backups
    cd ${BACKUP_DIR}
    ls -t ${DB_NAME}_*.sql.gz | tail -n +11 | xargs -r rm
    echo "🧹 Old backups cleaned (keeping last 10)"
else
    echo "❌ Backup failed!"
    exit 1
fi

echo "🎉 Database backup complete!"