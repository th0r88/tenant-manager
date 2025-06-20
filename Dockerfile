# Tenant Management System - Production Dockerfile

# Build stage for frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy application code
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Install build dependencies for sqlite3 and other native modules
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++

# Create non-root user for security
RUN addgroup -g 1001 -S tenant-manager && \
    adduser -S tenant-manager -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies and clean up build deps in one layer
RUN npm install --omit=dev --prefer-offline --no-audit && \
    npm cache clean --force && \
    apk del .build-deps

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