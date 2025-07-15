# Production Deployment Guide - Tenant Management System 1.1

This guide covers deploying the tenant management system with containerized SQLite database in production environments, including homelab setups with enterprise-grade reliability and security hardening.

## Prerequisites

### System Requirements
- **Operating System**: Linux (Ubuntu 20.04+), macOS, or Windows with WSL2
- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 1.29 or higher
- **Node.js**: Version 18+ (LTS recommended)
- **Memory**: Minimum 2GB RAM, recommended 4GB+
- **Storage**: Minimum 10GB free space
- **Network**: Ports 5999 (application) and 5998 (database management)

### Software Dependencies
```bash
# Install Docker (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install docker.io docker-compose

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
docker --version
docker-compose --version
node --version
```

## Quick Start (Containerized Deployment)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd tennants
npm install
```

### 2. Configure Environment

```bash
# Set environment variables for containerized deployment
export DATABASE_TYPE=http
export DATABASE_HOST=sqlite-db
export DATABASE_PORT=8080
export DATABASE_NAME=tenant_manager.db
export DATABASE_USER=tenant_user
export DATABASE_PASSWORD=secure_password_here
export NODE_ENV=production
export PORT=5999
```

### 3. Deploy with Zero Downtime

```bash
# Make deployment script executable
chmod +x deploy-production.sh

# Run full production deployment
./deploy-production.sh deploy
```

### 4. Verify Deployment

```bash
# Check application health
curl http://localhost:5999/api/health

# Run post-deployment tests
./deploy-production.sh test
```

## Legacy Deployment (File-based Database)

For backwards compatibility, file-based deployment is still supported:

### 1. Environment Configuration
```bash
# Server Configuration
NODE_ENV=production
PORT=5999
HOST=0.0.0.0

# Database Configuration (File-based)
DATABASE_TYPE=file
DATABASE_PATH=tenant_manager.db

# Backup Configuration
BACKUP_INTERVAL=24

# Logging Configuration
LOG_LEVEL=info
LOG_TO_FILE=true
```

### 2. Initialize Database
```bash
npm run setup-db
```

### 3. Start Production Server
```bash
npm run start:prod
```

## Configuration Management

### Environment Variables

The system supports configuration through:
1. **Environment variables** (highest priority)
2. **config.json file** (medium priority)
3. **Default values** (lowest priority)

### Key Configuration Options

#### Server Configuration
- `PORT`: Server port (default: 3001)
- `HOST`: Server host (default: 0.0.0.0)
- `NODE_ENV`: Environment (development/production)

#### Database Configuration
- `DATABASE_PATH`: SQLite database file path
- `BACKUP_INTERVAL`: Backup frequency in hours (default: 24)

#### Monitoring Configuration
- `LOG_LEVEL`: Logging level (debug/info/warn/error)
- `LOG_TO_FILE`: Enable file logging (true/false)
- `HEALTH_CHECK_INTERVAL`: Health check frequency in milliseconds

### Process Management

#### Option 1: PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Create PM2 config
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'tenant-manager',
    script: 'src/backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
EOF

# Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Option 2: Systemd Service

```bash
# Create service file
sudo cat > /etc/systemd/system/tenant-manager.service << EOF
[Unit]
Description=Tenant Manager
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/property-manager
ExecStart=/usr/bin/node src/backend/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable tenant-manager
sudo systemctl start tenant-manager
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL Configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Serve frontend static files
    location / {
        root /path/to/property-manager/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy API requests
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Database Management

1. **Backup Database**
   ```bash
   # Create backup script
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   cp /var/lib/tenant-manager/database.db /backups/database_$DATE.db
   
   # Schedule with cron
   echo "0 2 * * * /path/to/backup-script.sh" | crontab -
   ```

2. **Database Location**
   - Production: `/var/lib/tenant-manager/database.db`
   - Ensure proper permissions: `chown www-data:www-data`

### Security Considerations

1. **Firewall Configuration**
   ```bash
   # Only allow necessary ports
   ufw allow ssh
   ufw allow 80
   ufw allow 443
   ufw deny 3001  # Block direct access to backend
   ufw enable
   ```

2. **File Permissions**
   ```bash
   # Set proper ownership
   chown -R www-data:www-data /path/to/property-manager
   chmod -R 755 /path/to/property-manager
   chmod 600 .env
   ```

### Monitoring

1. **Health Check Endpoint**
   - URL: `https://your-domain.com/api/health`
   - Returns: `{"status": "ok"}`

2. **Log Management**
   ```bash
   # PM2 logs
   pm2 logs tenant-manager
   
   # Systemd logs
   journalctl -u tenant-manager -f
   ```

### Updates

1. **Deploy New Version**
   ```bash
   git pull origin main
   npm install
   npm run build
   pm2 restart tenant-manager
   ```

2. **Zero-Downtime Deployment**
   ```bash
   # Blue-Green deployment with PM2
   pm2 start ecosystem.config.js --name tenant-manager-new
   # Test new instance
   pm2 delete tenant-manager
   pm2 restart tenant-manager-new --name tenant-manager
   ```

### Troubleshooting

1. **Check Application Status**
   ```bash
   pm2 status
   curl http://localhost:3001/api/health
   ```

2. **Common Issues**
   - Port already in use: Check for existing processes
   - Database permissions: Ensure www-data can read/write
   - Build failures: Check Node.js version compatibility

### Performance Optimization

1. **Frontend Optimization**
   - Static file caching with Nginx
   - Gzip compression enabled
   - CDN for assets (optional)

2. **Backend Optimization**
   - Database connection pooling
   - Request rate limiting
   - Process clustering with PM2