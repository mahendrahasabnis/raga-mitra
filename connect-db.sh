#!/bin/bash
# Quick script to connect to aarogya_mitra database
# Usage: ./connect-db.sh [command]
# Example: ./connect-db.sh "\dt" (list tables)
# Example: ./connect-db.sh (interactive psql)

DB_HOST="34.180.1.107"
DB_USER="app_user"
DB_NAME="aarogya_mitra"
DB_PASSWORD="app_password_2024"

if [ -z "$1" ]; then
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME"
else
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "$1"
fi
