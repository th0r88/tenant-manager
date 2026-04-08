# Tenant Management System - Production Dockerfile

# Build stage for frontend only - no native modules needed
FROM node:22.22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (rolldown/Vite 8 requires native bindings for build)
RUN npm ci

# Copy application code
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:22.22-alpine AS production

# Patch base image vulnerabilities
RUN apk upgrade --no-cache

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S tenant-manager && \
    adduser -S tenant-manager -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies (skip better-sqlite3 native build - production uses PostgreSQL)
RUN npm install --omit=dev --no-audit --ignore-scripts && \
    npm cache clean --force

# Copy application code (backend)
COPY src/ ./src/

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Create necessary directories and set permissions
RUN mkdir -p /app/backups /app/alerts /app/logs && \
    chown -R tenant-manager:tenant-manager /app

# Switch to non-root user
USER tenant-manager

# Expose port
EXPOSE 5999

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5999/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "src/backend/server.js"]
