#!/bin/bash

# ==============================================================================
# Buck Euchre - Database Restore Script
# ==============================================================================
# 
# This script restores the PostgreSQL database from a backup
# 
# Usage:
#   ./restore-database.sh <backup_file>
# 
# Example:
#   ./restore-database.sh backups/buckeuchre_backup_20231015_120000.sql
# 
# ==============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Buck Euchre - Database Restore${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if backup file is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ No backup file specified${NC}"
    echo ""
    echo "Usage:"
    echo "  ./restore-database.sh <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh backups/*.sql 2>/dev/null || echo "  No backups found"
    echo ""
    exit 1
fi

backup_file="$1"

# Check if backup file exists
if [ ! -f "$backup_file" ]; then
    echo -e "${RED}❌ Backup file not found: $backup_file${NC}"
    echo ""
    exit 1
fi

# Check if docker-compose is running
if ! docker-compose ps | grep "buckeuchre-postgres" | grep -q "Up"; then
    echo -e "${RED}❌ PostgreSQL container is not running${NC}"
    echo ""
    echo "Start services first:"
    echo "  docker-compose up -d"
    echo ""
    exit 1
fi

# Load environment variables
export $(cat .env.production 2>/dev/null || cat .env.dev 2>/dev/null | grep -v '^#' | xargs)

echo -e "${YELLOW}⚠ WARNING: This will REPLACE all current database data!${NC}"
echo ""
read -p "Are you sure you want to restore from $backup_file? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo -e "${GREEN}Restoring database...${NC}"
echo ""

# Restore database using docker exec
docker exec -i buckeuchre-postgres psql \
    -U "${POSTGRES_USER:-buckeuchre}" \
    -d "${POSTGRES_DB:-buckeuchre}" \
    < "$backup_file"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓${NC} Database restored successfully!"
    echo ""
    echo -e "${GREEN}Done!${NC}"
else
    echo ""
    echo -e "${RED}❌ Restore failed!${NC}"
    exit 1
fi
