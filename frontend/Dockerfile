# ==============================================================================
# Buck Euchre Frontend - Production Dockerfile
# ==============================================================================
# 
# Multi-stage build:
# 1. Build React app with Vite
# 2. Serve with nginx
# 
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY vite.config.ts ./
COPY postcss.config.js ./
COPY tailwind.config.js ./

# Install dependencies
RUN npm ci

# Copy source code
COPY index.html ./
COPY public ./public
COPY src ./src

# Build for production
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production (nginx)
# ------------------------------------------------------------------------------
FROM nginx:alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

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
