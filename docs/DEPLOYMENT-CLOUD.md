# Cloud Provider Deployment Guide

Deploy the Tenant Management System to cloud providers like AWS, DigitalOcean, Linode, or Vultr.

## Prerequisites

- Cloud server with Ubuntu 20.04+ or Debian 11+
- Minimum 1GB RAM, 1 CPU, 10GB storage
- SSH access to your server
- Basic command line knowledge

## Option 1: Traditional Installation

### Step 1: Server Setup

```bash
# Connect to your server
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Create application user
useradd -m -s /bin/bash tenant-manager
```

### Step 2: Deploy Application

```bash
# Switch to application user
su - tenant-manager

# Clone your application (replace with your repository)
git clone YOUR_REPOSITORY_URL tenant-manager
cd tenant-manager

# Install dependencies
npm install --production

# Create necessary directories
mkdir -p data backups logs alerts

# Set up environment
cp .env.example .env
nano .env
```

Edit `.env` file:
```bash
NODE_ENV=production
PORT=5999
HOST=0.0.0.0
DATABASE_PATH=./data/tenant_manager.db
LOG_LEVEL=info
BACKUP_INTERVAL=24
```

### Step 3: Start the Application

```bash
# Start with PM2
pm2 start src/backend/server.js --name tenant-manager

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
# Run the command it outputs (as root)
```

### Step 4: Configure Firewall

```bash
# Switch back to root
exit

# Configure UFW firewall
ufw allow ssh
ufw allow 5999
ufw enable
```

### Step 5: Access Your Application

Open your browser and navigate to:
```
http://YOUR_SERVER_IP:5999
```

## Option 2: Docker Installation

### Step 1: Install Docker

```bash
# Connect to your server
ssh root@YOUR_SERVER_IP

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### Step 2: Deploy with Docker Compose

```bash
# Clone your application
git clone YOUR_REPOSITORY_URL tenant-manager
cd tenant-manager

# Start the application
docker-compose up -d

# Check status
docker-compose ps
```

### Step 3: Configure Firewall

```bash
# Configure UFW firewall
ufw allow ssh
ufw allow 5999
ufw enable
```

### Step 4: Access Your Application

Open your browser and navigate to:
```
http://YOUR_SERVER_IP:5999
```

## Management Commands

### Traditional Install
```bash
# View logs
pm2 logs tenant-manager

# Restart application
pm2 restart tenant-manager

# Stop application
pm2 stop tenant-manager

# Check status
pm2 status
```

### Docker Install
```bash
# View logs
docker-compose logs -f

# Restart application
docker-compose restart

# Stop application
docker-compose down

# Update application
git pull
docker-compose build
docker-compose up -d
```

## Troubleshooting

### Check if application is running
```bash
curl http://localhost:5999/api/health
```

### Check server resources
```bash
htop
df -h
free -h
```

### View application logs
- Traditional: `pm2 logs tenant-manager`
- Docker: `docker-compose logs tenant-manager`

## Security Notes

- Change default SSH port if needed
- Use SSH key authentication instead of passwords
- Consider setting up a reverse proxy (nginx) for SSL in the future
- Regularly update your server: `apt update && apt upgrade`

## Next Steps

- Set up regular backups of the `data` directory
- Monitor server resources and application health
- Consider implementing log rotation for large deployments