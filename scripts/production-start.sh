#!/bin/bash

# ==============================================================================
# Buck Euchre - Production Startup Script
# ==============================================================================
# 
# This script starts all production services using Docker Compose
# 
# Prerequisites:
# 1. Docker and Docker Compose installed
# 2. .env.production file created with all required variables
# 3. SSL certificates configured (if using HTTPS)
# 
# Usage:
#   ./production-start.sh
# 
# ==============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Buck Euchre - Production Setup${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker is running"
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production not found!${NC}"
    echo ""
    echo "Please create .env.production from .env.production.example:"
    echo "  cp .env.production.example .env.production"
    echo ""
    echo "Then update all values with secure production credentials."
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} .env.production found"
echo ""

# Source environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Verify critical environment variables
missing_vars=()

if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "CHANGE_THIS_GENERATE_STRONG_PASSWORD" ]; then
    missing_vars+=("POSTGRES_PASSWORD")
fi

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "CHANGE_THIS_GENERATE_RANDOM_SECRET_AT_LEAST_32_CHARS" ]; then
    missing_vars+=("JWT_SECRET")
fi

if [ -z "$CORS_ORIGIN" ] || [ "$CORS_ORIGIN" = "https://yourdomain.com" ]; then
    missing_vars+=("CORS_ORIGIN")
fi

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing or invalid environment variables:${NC}"
    for var in "${missing_vars[@]}"; do
        echo -e "${RED}  - $var${NC}"
    done
    echo ""
    echo "Please update .env.production with secure production values."
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} Environment variables validated"
echo ""

# Pull latest images
echo -e "${GREEN}Pulling latest Docker images...${NC}"
docker-compose pull

echo ""

# Build custom images
echo -e "${GREEN}Building application images...${NC}"
docker-compose build --no-cache

echo ""

# Start services
echo -e "${GREEN}Starting production services...${NC}"
docker-compose up -d

echo ""

# Wait for services to be healthy
echo -e "${GREEN}Waiting for services to be healthy...${NC}"
echo ""

max_attempts=60
attempt=0

while [ $attempt -lt $max_attempts ]; do
    healthy_count=$(docker-compose ps | grep -c "healthy" || true)
    
    if [ "$healthy_count" -ge 3 ]; then
        echo -e "${GREEN}✓${NC} All services are healthy!"
        break
    fi
    
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}❌ Services failed to start within ${max_attempts} seconds${NC}"
        echo ""
        echo "Check logs with:"
        echo "  docker-compose logs"
        echo ""
        docker-compose ps
        exit 1
    fi
    
    sleep 1
    echo -n "."
done

echo ""
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Production Services Started!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Services:"
docker-compose ps
echo ""
echo "Access your application at:"
echo "  http://localhost (or your configured domain)"
echo ""
echo "Useful commands:"
echo "  View logs:        docker-compose logs -f"
echo "  Stop services:    docker-compose down"
echo "  Restart:          docker-compose restart"
echo "  View status:      docker-compose ps"
echo ""
echo "⚠️  Remember to:"
echo "  - Configure SSL/TLS certificates for HTTPS"
echo "  - Set up database backups"
echo "  - Configure monitoring and alerting"
echo "  - Review security settings"
echo ""
