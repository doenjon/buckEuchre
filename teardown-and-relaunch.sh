#!/bin/bash

# ==============================================================================
# Buck Euchre - Complete Teardown and Relaunch Script
# ==============================================================================
# 
# This script completely tears down the docker setup and relaunches it
# 
# Usage:
#   ./teardown-and-relaunch.sh
# 
# ==============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Buck Euchre - Complete Teardown${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker is running"
echo ""

# Step 1: Stop and remove all containers, networks
echo -e "${YELLOW}Step 1: Stopping and removing containers...${NC}"
docker compose down

echo ""

# Step 2: Remove volumes (optional - uncomment if you want to wipe all data)
# echo -e "${YELLOW}Step 2: Removing volumes...${NC}"
# docker compose down -v

# Step 3: Remove any orphaned containers/networks
echo -e "${YELLOW}Step 2: Cleaning up orphaned resources...${NC}"
docker system prune -f

echo ""

# Step 4: Verify everything is down
echo -e "${YELLOW}Step 3: Verifying teardown...${NC}"
if [ $(docker compose ps -q 2>/dev/null | wc -l) -eq 0 ]; then
    echo -e "${GREEN}✓${NC} All containers stopped"
else
    echo -e "${RED}⚠${NC} Some containers may still be running"
    docker compose ps
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Teardown Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Step 5: Relaunch using production-start.sh
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Relaunching Services...${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

if [ -f "./production-start.sh" ]; then
    chmod +x ./production-start.sh
    ./production-start.sh
else
    echo -e "${YELLOW}⚠${NC} production-start.sh not found, using docker compose directly..."
    echo ""
    
    # Check if .env.production exists
    if [ ! -f .env.production ]; then
        echo -e "${RED}❌ .env.production not found!${NC}"
        echo "Please create .env.production before relaunching."
        exit 1
    fi
    
    # Source environment variables
    export $(cat .env.production | grep -v '^#' | xargs)
    
    # Pull and build
    echo -e "${GREEN}Pulling latest images...${NC}"
    docker compose pull
    
    echo ""
    echo -e "${GREEN}Building images...${NC}"
    docker compose build --no-cache
    
    echo ""
    echo -e "${GREEN}Starting services...${NC}"
    docker compose up -d
    
    echo ""
    echo -e "${GREEN}Waiting for services to be healthy...${NC}"
    sleep 5
    
    echo ""
    echo -e "${GREEN}Service Status:${NC}"
    docker compose ps
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Complete!${NC}"
echo -e "${GREEN}================================${NC}"

