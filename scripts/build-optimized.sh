#!/bin/bash
# ==============================================================================
# Optimized Docker Build Script
# ==============================================================================
#
# This script builds Docker images with BuildKit optimizations enabled
#
# Usage:
#   ./scripts/build-optimized.sh [service]
#
# Examples:
#   ./scripts/build-optimized.sh           # Build all services
#   ./scripts/build-optimized.sh backend   # Build only backend
#   ./scripts/build-optimized.sh frontend  # Build only frontend
#
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print with color
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Enable BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

print_info "BuildKit enabled: DOCKER_BUILDKIT=1"

# Parse arguments
SERVICE="${1:-}"

# Build with progress output
print_info "Starting optimized Docker build..."
echo ""

if [ -z "$SERVICE" ]; then
    print_info "Building all services with BuildKit optimizations..."
    docker-compose build --progress=auto
else
    print_info "Building $SERVICE with BuildKit optimizations..."
    docker-compose build --progress=auto "$SERVICE"
fi

echo ""
print_success "Build completed successfully!"
print_info "Images are ready to use with: docker-compose up"

# Show build cache info
echo ""
print_info "Build cache info:"
docker buildx du || print_warning "Install buildx for detailed cache information"
