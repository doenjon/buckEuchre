#!/bin/bash

# ==============================================================================
# Buck Euchre - Database Backup Script
# ==============================================================================
# 
# This script creates a backup of the PostgreSQL database
# 
# Usage:
#   ./backup-database.sh
# 
# Backups are stored in: ./backups/
# 
# ==============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Buck Euchre - Database Backup${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if docker-compose is running
if ! docker-compose ps | grep "buckeuchre-postgres" | grep -q "Up"; then
    echo -e "${RED}❌ PostgreSQL container is not running${NC}"
    echo ""
    echo "Start services first:"
    echo "  docker-compose up -d"
    echo ""
    exit 1
fi

# Create backups directory if it doesn't exist
mkdir -p backups

# Generate backup filename with timestamp
timestamp=$(date +"%Y%m%d_%H%M%S")
backup_file="backups/buckeuchre_backup_${timestamp}.sql"

echo -e "${GREEN}Creating backup...${NC}"
echo ""

# Load environment variables
export $(cat .env.production 2>/dev/null || cat .env.dev 2>/dev/null | grep -v '^#' | xargs)

# Create backup using docker exec
docker exec buckeuchre-postgres pg_dump \
    -U "${POSTGRES_USER:-buckeuchre}" \
    -d "${POSTGRES_DB:-buckeuchre}" \
    -F plain \
    -f "/backups/$(basename $backup_file)"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Backup created successfully!"
    echo ""
    echo "Backup file: $backup_file"
    echo "Size: $(du -h $backup_file | cut -f1)"
    echo ""
    
    # Show backup directory contents
    echo "Available backups:"
    ls -lh backups/*.sql 2>/dev/null || echo "  No backups found"
    echo ""
    
    # Cleanup old backups (keep last 7 days)
    echo -e "${YELLOW}Cleaning up old backups (keeping last 7 days)...${NC}"
    find backups -name "buckeuchre_backup_*.sql" -mtime +7 -delete
    echo ""
    
    echo -e "${GREEN}Done!${NC}"
else
    echo -e "${RED}❌ Backup failed!${NC}"
    exit 1
fi
