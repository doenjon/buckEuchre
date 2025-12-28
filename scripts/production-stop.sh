#!/bin/bash

# ==============================================================================
# Buck Euchre - Production Stop Script
# ==============================================================================
# 
# This script stops all production services
# 
# Usage:
#   ./production-stop.sh        # Stop but keep data
#   ./production-stop.sh clean  # Stop and remove all data
# 
# ==============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Buck Euchre - Stop Production${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Stop containers
echo -e "${GREEN}Stopping services...${NC}"
docker-compose down

# Clean volumes if requested
if [ "$1" == "clean" ]; then
    echo ""
    echo -e "${YELLOW}⚠ Removing all data volumes...${NC}"
    read -p "Are you sure? This will delete ALL data! (yes/no): " confirm
    
    if [ "$confirm" == "yes" ]; then
        docker-compose down -v
        echo -e "${RED}⚠ All data has been deleted!${NC}"
    else
        echo "Cancelled. Data preserved."
    fi
else
    echo ""
    echo -e "${GREEN}✓${NC} Services stopped (data preserved)"
    echo ""
    echo "To remove all data:"
    echo "  ./production-stop.sh clean"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
