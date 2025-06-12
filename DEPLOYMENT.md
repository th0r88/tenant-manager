# Deployment Guide

## Production Setup

### Prerequisites

- Node.js 18+ and npm
- Linux/Ubuntu server (recommended)
- Domain name (optional)
- SSL certificate (recommended)

### Environment Setup

1. **Clone Repository**
   ```bash
   git clone https://github.com/th0r88/property-manager.git
   cd property-manager
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

4. **Build Application**
   ```bash
   npm run build
   ```

### Production Environment Variables

```bash
# .env
NODE_ENV=production
PORT=3001
DB_PATH=/var/lib/tenant-manager/database.db
VITE_API_BASE=https://your-domain.com/api
```

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