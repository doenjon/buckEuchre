# ==============================================================================
# Buck Euchre Frontend - Production Dockerfile
# ==============================================================================
#
# Multi-stage build with BuildKit optimizations:
# 1. Build React app with Vite
# 2. Serve with nginx
#
# Build with: DOCKER_BUILDKIT=1 docker build -f frontend/Dockerfile .
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
# Stage 2: Build frontend
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Copy shared package
WORKDIR /shared
COPY --from=shared-builder /shared /shared

# Build frontend
WORKDIR /app

# Copy only package files first for better caching
COPY frontend/package*.json ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

# Copy configuration files
COPY frontend/tsconfig.json ./
COPY frontend/tsconfig.node.json ./
COPY frontend/vite.config.ts ./
COPY frontend/postcss.config.js ./
COPY frontend/tailwind.config.js ./

# Copy source code
COPY frontend/index.html ./
COPY frontend/public ./public
COPY frontend/src ./src

# Build for production
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production (nginx)
# ------------------------------------------------------------------------------
FROM nginx:alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy nginx configuration
COPY frontend/nginx/nginx.conf /etc/nginx/nginx.conf
COPY frontend/nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy built app from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Add health check script
RUN echo '#!/bin/sh' > /usr/local/bin/health-check.sh && \
    echo 'wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1' >> /usr/local/bin/health-check.sh && \
    chmod +x /usr/local/bin/health-check.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD /usr/local/bin/health-check.sh

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
