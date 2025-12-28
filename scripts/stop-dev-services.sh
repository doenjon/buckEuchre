#!/bin/bash

# ==============================================================================
# Buck Euchre - Stop Development Services
# ==============================================================================
# 
# This script stops and removes the PostgreSQL database container
# 
# Usage:
#   ./stop-dev-services.sh        # Stop but keep data
#   ./stop-dev-services.sh clean  # Stop and remove all data
# 
# ==============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Buck Euchre - Stop Services${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Stop containers
echo -e "${GREEN}Stopping services...${NC}"
docker-compose -f docker-compose.dev.yml down

# Clean volumes if requested
if [ "$1" == "clean" ]; then
    echo ""
    echo -e "${YELLOW}⚠ Removing all data volumes...${NC}"
    docker-compose -f docker-compose.dev.yml down -v
    echo -e "${RED}⚠ All database data has been deleted!${NC}"
else
    echo ""
    echo -e "${GREEN}✓${NC} Services stopped (data preserved)"
    echo ""
    echo "To remove all data:"
    echo "  ./stop-dev-services.sh clean"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
