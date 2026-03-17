# Self-Managed VPS/Server Deployment Guide

Deploy the Tenant Management System to your own VPS or dedicated server.

## Prerequisites

- VPS/Server with Ubuntu 20.04+ or Debian 11+
- Minimum 1GB RAM, 1 CPU, 20GB storage
- Root or sudo access
- Basic Linux administration knowledge

## Option 1: Traditional Installation

### Step 1: Initial Server Setup

```bash
# Connect to your server
ssh root@YOUR_SERVER_IP

# Update system packages
apt update && apt upgrade -y

# Install essential packages
apt install -y curl wget git ufw fail2ban

# Configure timezone (optional)
timedatectl set-timezone America/New_York  # Change as needed
```

### Step 2: Install Node.js

```bash
# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 globally
npm install -g pm2
```

### Step 3: Create Application User

```bash
# Create dedicated user for security
useradd -m -s /bin/bash tenant-manager
usermod -aG sudo tenant-manager  # Optional: if you need sudo access

# Switch to application user
su - tenant-manager
```

### Step 4: Deploy Application

```bash
# Clone your repository
git clone YOUR_REPOSITORY_URL tenant-manager
cd tenant-manager

# Install dependencies
npm ci --production

# Create necessary directories
mkdir -p data backups logs alerts

# Set up environment configuration
cp .env.example .env
nano .env
```

Configure `.env` file:
```bash
NODE_ENV=production
PORT=5999
HOST=0.0.0.0
DATABASE_PATH=./data/tenant_manager.db
LOG_LEVEL=info
LOG_TO_FILE=true
BACKUP_INTERVAL=24
HEALTH_CHECK_INTERVAL=1800000
```

### Step 5: Configure Systemd Service

```bash
# Switch back to root
exit

# Create systemd service file
cat > /etc/systemd/system/tenant-manager.service << EOF
[Unit]
Description=Tenant Management System
Documentation=https://github.com/your-repo/tenant-manager
After=network.target

[Service]
Type=simple
User=tenant-manager
WorkingDirectory=/home/tenant-manager/tenant-manager
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/usr/bin/node src/backend/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tenant-manager

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/home/tenant-manager/tenant-manager

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start service
systemctl daemon-reload
systemctl enable tenant-manager
systemctl start tenant-manager

# Check service status
systemctl status tenant-manager
```

### Step 6: Configure Firewall

```bash
# Configure UFW firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 5999/tcp
ufw enable

# Check firewall status
ufw status
```

### Step 7: Configure Fail2Ban (Optional)

```bash
# Configure fail2ban for SSH protection
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
EOF

# Restart fail2ban
systemctl restart fail2ban
```

## Option 2: Docker Installation

### Step 1: Install Docker

```bash
# Remove old Docker versions
apt remove -y docker docker-engine docker.io containerd runc

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Add your user to docker group (optional)
usermod -aG docker tenant-manager

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Step 2: Deploy Application

```bash
# Switch to application user
su - tenant-manager

# Clone repository
git clone YOUR_REPOSITORY_URL tenant-manager
cd tenant-manager

# Create environment file
cp .env.example .env
nano .env
```

Configure `.env` for Docker:
```bash
NODE_ENV=production
DATABASE_PATH=/app/data/tenant_manager.db
LOG_LEVEL=info
BACKUP_INTERVAL=24
```

```bash
# Start services
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs
```

### Step 3: Configure Firewall

```bash
# Switch back to root
exit

# Configure firewall (same as traditional install)
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 5999/tcp
ufw enable
```

## Management Commands

### Systemd Service Management
```bash
# Check status
systemctl status tenant-manager

# View logs
journalctl -u tenant-manager -f

# Restart service
systemctl restart tenant-manager

# Stop service
systemctl stop tenant-manager

# Start service
systemctl start tenant-manager
```

### Docker Management
```bash
# View logs
docker-compose logs -f tenant-manager

# Restart container
docker-compose restart tenant-manager

# Update application
git pull
docker-compose build
docker-compose up -d

# Stop all services
docker-compose down
```

## Health Monitoring

### Check Application Health
```bash
# Check if application is responding
curl http://localhost:5999/api/health

# Check detailed status
curl http://localhost:5999/api/status
```

### System Monitoring
```bash
# Check system resources
htop
free -h
df -h

# Check service status
systemctl status tenant-manager

# Check firewall
ufw status verbose
```

## Maintenance

### Regular Updates
```bash
# Update system packages
apt update && apt upgrade -y

# Update Node.js application
su - tenant-manager
cd tenant-manager
git pull
npm ci --production

# Restart service
sudo systemctl restart tenant-manager
```

### Log Management
```bash
# View application logs
journalctl -u tenant-manager --since "1 hour ago"

# Rotate logs (if needed)
journalctl --vacuum-time=7d
```

## Security Hardening

### Additional Security Measures
```bash
# Change SSH port (optional)
nano /etc/ssh/sshd_config
# Change: Port 22 to Port 2222
systemctl restart ssh

# Disable root login (recommended)
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
systemctl restart ssh

# Install and configure logwatch
apt install -y logwatch
# Configure email alerts (optional)
```

## Troubleshooting

### Common Issues

1. **Service won't start**
   ```bash
   journalctl -u tenant-manager -n 50
   ```

2. **Permission issues**
   ```bash
   chown -R tenant-manager:tenant-manager /home/tenant-manager/tenant-manager
   ```

3. **Port already in use**
   ```bash
   netstat -tulpn | grep 5999
   ```

4. **Database issues**
   ```bash
   su - tenant-manager
   cd tenant-manager
   ls -la data/
   ```

### Performance Tuning

For high-traffic deployments:
```bash
# Increase file descriptor limits
echo "tenant-manager soft nofile 65536" >> /etc/security/limits.conf
echo "tenant-manager hard nofile 65536" >> /etc/security/limits.conf

# Configure log rotation
cat > /etc/logrotate.d/tenant-manager << EOF
/home/tenant-manager/tenant-manager/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF
```

## Access Your Application

Once deployed, access your application at:
```
http://YOUR_SERVER_IP:5999
```

The application will be available on your server's IP address on port 3001.