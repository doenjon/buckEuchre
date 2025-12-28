#!/bin/bash

# ==============================================================================
# Buck Euchre - Start Development Services
# ==============================================================================
# 
# This script starts the PostgreSQL database using Docker Compose
# 
# Usage:
#   ./start-dev-services.sh
# 
# ==============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Buck Euchre - Development Setup${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker is running"
echo ""

# Check if .env.dev exists
if [ ! -f .env.dev ]; then
    echo -e "${YELLOW}⚠ .env.dev not found, using default values${NC}"
    echo -e "${YELLOW}  For custom configuration, create .env.dev from .env.dev example${NC}"
    echo ""
fi

# Start Docker services
echo -e "${GREEN}Starting PostgreSQL...${NC}"
docker-compose -f docker-compose.dev.yml up -d

echo ""
echo -e "${GREEN}Waiting for PostgreSQL to be ready...${NC}"

# Wait for PostgreSQL to be healthy
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker-compose -f docker-compose.dev.yml ps | grep "healthy" > /dev/null; then
        echo -e "${GREEN}✓${NC} PostgreSQL is ready!"
        break
    fi
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}❌ PostgreSQL failed to start after ${max_attempts} seconds${NC}"
        echo ""
        echo "Check logs with:"
        echo "  docker-compose -f docker-compose.dev.yml logs postgres"
        exit 1
    fi
    sleep 1
    echo -n "."
done

echo ""
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Services Started Successfully!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "PostgreSQL:"
echo "  Host:     localhost"
echo "  Port:     5432"
echo "  Database: buckeuchre"
echo "  User:     buckeuchre"
echo ""
echo "Next steps:"
echo "  1. Run migrations:  cd backend && npx prisma migrate dev"
echo "  2. Start backend:   cd backend && npm run dev"
echo "  3. Start frontend:  cd frontend && npm run dev"
echo ""
echo "Useful commands:"
echo "  Stop services:  docker-compose -f docker-compose.dev.yml down"
echo "  View logs:      docker-compose -f docker-compose.dev.yml logs -f"
echo "  Restart:        docker-compose -f docker-compose.dev.yml restart"
echo ""
