# ==============================================================================
# Buck Euchre Backend - Production Dockerfile
# ==============================================================================
#
# Multi-stage build for optimized production image with BuildKit optimizations
#
# Build with: DOCKER_BUILDKIT=1 docker build -f backend/Dockerfile .
#
# ==============================================================================

# syntax=docker/dockerfile:1.4

# ------------------------------------------------------------------------------
# Stage 1: Build shared package
# ------------------------------------------------------------------------------
FROM node:20-alpine AS shared-builder

WORKDIR /shared

# Copy only package files first for better caching
COPY shared/package*.json ./

# Install dependencies with cache mount for npm
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

# Copy source and build
COPY shared/tsconfig.json ./
COPY shared/src ./src

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Build backend
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Copy shared package
WORKDIR /shared
COPY --from=shared-builder /shared /shared

# Build backend
WORKDIR /app

# Copy only package files first for better caching
COPY backend/package*.json ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

# Copy configuration and source
COPY backend/tsconfig.json ./
COPY backend/prisma ./prisma
COPY backend/src ./src

# Generate Prisma Client with cache
RUN --mount=type=cache,target=/root/.npm \
    npx prisma generate

# Build TypeScript
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production
# ------------------------------------------------------------------------------
FROM node:20-alpine AS production

# Install required dependencies for Prisma
RUN apk add --no-cache dumb-init openssl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy shared package
WORKDIR /shared
COPY --from=builder --chown=nodejs:nodejs /shared /shared

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Copy Prisma schema first
COPY --chown=nodejs:nodejs backend/prisma ./prisma

# Install production dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production --prefer-offline --no-audit && \
    npm cache clean --force

# Generate Prisma Client for production
RUN --mount=type=cache,target=/root/.npm \
    npx prisma generate

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/app/src/index.js"]
