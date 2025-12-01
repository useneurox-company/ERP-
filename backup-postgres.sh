#!/bin/bash
# PostgreSQL Backup Script for Emerald ERP

BACKUP_DIR='/var/backups/postgresql/emerald_erp'
DB_NAME='emerald_erp'
DB_USER='emerald_user'
DB_PASSWORD='EmeraldSecure2025!'
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/emerald_erp_${DATE}.sql.gz"
DAYS_TO_KEEP=7

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Perform backup
echo "Starting PostgreSQL backup: ${DATE}"
PGPASSWORD=${DB_PASSWORD} pg_dump -U ${DB_USER} -h localhost ${DB_NAME} | gzip > ${BACKUP_FILE}

if [ $? -eq 0 ]; then
    echo "Backup completed successfully: ${BACKUP_FILE}"
    
    # Delete backups older than DAYS_TO_KEEP
    find ${BACKUP_DIR} -name "emerald_erp_*.sql.gz" -type f -mtime +${DAYS_TO_KEEP} -delete
    echo "Old backups cleaned (older than ${DAYS_TO_KEEP} days)"
else
    echo "Backup failed!"
    exit 1
fi
