# Tenant Management System - Production Dockerfile

# Build stage - use slim (glibc) image; rolldown's musl binding strips emoji Unicode
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies fresh (lock file is macOS-specific, need platform bindings)
RUN rm -f package-lock.json && npm install

# Copy application code
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:22-slim AS production

# Patch base image vulnerabilities
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN groupadd -g 1001 tenant-manager && \
    useradd -u 1001 -g tenant-manager -s /bin/false tenant-manager

# Copy package files
COPY package*.json ./

# Install production dependencies (skip better-sqlite3 native build - production uses PostgreSQL)
RUN rm -f package-lock.json && npm install --omit=dev --no-audit --ignore-scripts && \
    npm cache clean --force

# Copy application code (backend)
COPY src/ ./src/

# Copy maintenance scripts (reconcile-overpayments, verify-allocations, etc.)
COPY scripts/ ./scripts/

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
