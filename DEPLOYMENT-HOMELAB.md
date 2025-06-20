# Homelab/Internal Network Deployment Guide

Deploy the Tenant Management System in your homelab or internal network environment.

## Prerequisites

- Local server, Raspberry Pi, or computer running Linux/macOS/Windows
- Minimum 512MB RAM, 1 CPU (can run on Raspberry Pi 3+)
- Network access to the deployment machine
- Basic terminal/command line knowledge

## Quick Start (Recommended)

### Option 1: Docker Compose (Easiest)

```bash
# Clone the repository
git clone YOUR_REPOSITORY_URL tenant-manager
cd tenant-manager

# Use homelab-specific configuration
docker-compose -f docker-compose.homelab.yml up -d

# Check if it's running
docker-compose -f docker-compose.homelab.yml ps
```

That's it! Access your application at `http://YOUR_DEVICE_IP:5999`

### Option 2: Development Mode

```bash
# Clone the repository
git clone YOUR_REPOSITORY_URL tenant-manager
cd tenant-manager

# Install dependencies
npm install

# Start in development mode
npm run dev
```

Access at `http://localhost:3000` (frontend) and `http://localhost:5999` (API)

## Detailed Setup Instructions

### Traditional Installation

#### Step 1: Install Node.js

**On Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

**On macOS:**
```bash
# Using Homebrew
brew install node

# Or download from nodejs.org
```

**On Windows:**
- Download from [nodejs.org](https://nodejs.org/)
- Install using the installer

#### Step 2: Deploy Application

```bash
# Clone repository
git clone YOUR_REPOSITORY_URL tenant-manager
cd tenant-manager

# Install dependencies
npm install

# Create local directories
mkdir -p data backups logs alerts

# Set up environment
cp .env.example .env
```

Edit `.env` for homelab use:
```bash
NODE_ENV=development
PORT=5999
HOST=0.0.0.0
DATABASE_PATH=./data/tenant_manager.db
LOG_LEVEL=debug
BACKUP_INTERVAL=24
```

#### Step 3: Start Application

```bash
# Option A: Development mode (with frontend)
npm run dev

# Option B: Production mode (backend only)
npm start

# Option C: With PM2 (if installed)
npm install -g pm2
pm2 start src/backend/server.js --name tenant-manager
pm2 save
```

### Docker Installation

#### Step 1: Install Docker

**On Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in
```

**On macOS:**
- Install Docker Desktop from [docker.com](https://docker.com)

**On Windows:**
- Install Docker Desktop from [docker.com](https://docker.com)

#### Step 2: Deploy with Docker

```bash
# Clone repository
git clone YOUR_REPOSITORY_URL tenant-manager
cd tenant-manager

# Start with homelab configuration
docker-compose -f docker-compose.homelab.yml up -d

# View logs
docker-compose -f docker-compose.homelab.yml logs -f
```

## Network Configuration

### Access from Other Devices

To access from other devices on your network:

1. **Find your device's IP address:**
   ```bash
   # Linux/macOS
   ip addr show  # or ifconfig
   
   # Windows
   ipconfig
   ```

2. **Configure firewall (if needed):**
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 5999
   
   # CentOS/RHEL
   sudo firewall-cmd --add-port=5999/tcp --permanent
   sudo firewall-cmd --reload
   ```

3. **Access from network:**
   - Open `http://DEVICE_IP:3001` in any browser on your network

### Static IP (Optional)

For consistent access, consider setting a static IP:

```bash
# Ubuntu - edit netplan configuration
sudo nano /etc/netplan/01-netcfg.yaml

# Example configuration:
network:
  version: 2
  ethernets:
    eth0:  # or your interface name
      addresses: [192.168.1.100/24]
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]

# Apply changes
sudo netplan apply
```

## Raspberry Pi Specific Setup

### Raspberry Pi OS Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (ARM-compatible)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# For older Pi models, you might need:
# sudo apt install nodejs npm

# Verify installation
node --version
npm --version
```

### Performance Optimization for Pi

```bash
# Increase swap space (if needed)
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Set CONF_SWAPSIZE=1024
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

# Enable container features (for Docker)
sudo nano /boot/cmdline.txt
# Add: cgroup_enable=cpuset cgroup_memory=1 cgroup_enable=memory
sudo reboot
```

## Homelab Integration

### Reverse Proxy Setup (Optional)

If you use nginx or Traefik in your homelab:

**Nginx configuration:**
```nginx
server {
    listen 80;
    server_name tenant-manager.local;  # Add to your local DNS
    
    location / {
        proxy_pass http://localhost:5999;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Traefik labels (Docker Compose):**
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.tenant-manager.rule=Host(`tenant-manager.local`)"
  - "traefik.http.services.tenant-manager.loadbalancer.server.port=5999"
```

### Home Assistant Integration (Optional)

Add to Home Assistant for monitoring:

```yaml
# configuration.yaml
sensor:
  - platform: rest
    name: "Tenant Manager Status"
    resource: "http://YOUR_DEVICE_IP:5999/api/health"
    value_template: "{{ value_json.status }}"
    scan_interval: 300
```

## Management Commands

### Check Application Status
```bash
# Traditional install
curl http://localhost:5999/api/health

# Docker install
docker-compose -f docker-compose.homelab.yml ps
curl http://localhost:5999/api/health
```

### View Logs
```bash
# Traditional install
tail -f logs/app.log  # if file logging enabled

# Development mode
# Logs appear in terminal

# Docker install
docker-compose -f docker-compose.homelab.yml logs -f
```

### Update Application
```bash
# Traditional install
git pull
npm install
# Restart application

# Docker install
git pull
docker-compose -f docker-compose.homelab.yml down
docker-compose -f docker-compose.homelab.yml build
docker-compose -f docker-compose.homelab.yml up -d
```

## Data Location

Your data is stored in:
- **Traditional install:** `./data/tenant_manager.db`
- **Docker install:** `./data/tenant_manager.db` (mounted from host)

## Backup Recommendations

Since you're handling backups yourself, consider:

1. **Automatic sync to NAS/cloud:**
   ```bash
   # Example rsync command
   rsync -av ./data/ /path/to/nas/tenant-manager-backup/
   ```

2. **Version control for configuration:**
   ```bash
   git add .env docker-compose.homelab.yml
   git commit -m "Update homelab configuration"
   ```

## Troubleshooting

### Common Issues

1. **Port 3001 already in use:**
   ```bash
   # Find what's using the port
   lsof -i :5999
   netstat -tulpn | grep 5999
   
   # Change port in .env file
   PORT=6000
   ```

2. **Permission issues:**
   ```bash
   # Fix permissions
   sudo chown -R $USER:$USER ./data ./backups ./logs
   ```

3. **Docker issues:**
   ```bash
   # Reset Docker setup
   docker-compose -f docker-compose.homelab.yml down -v
   docker-compose -f docker-compose.homelab.yml up -d
   ```

4. **Network access issues:**
   ```bash
   # Check if service is listening
   netstat -tulpn | grep 5999
   
   # Test local access
   curl http://localhost:5999/api/health
   
   # Check firewall
   sudo ufw status
   ```

### Performance Tuning

For better performance on limited hardware:

```bash
# Reduce health check interval
# In .env file:
HEALTH_CHECK_INTERVAL=3600000  # 1 hour instead of 30 minutes

# Limit log retention
# In .env file:
LOG_LEVEL=warn  # Reduce log verbosity
```

## Access Your Application

Once running, access your application at:
- **Local access:** `http://localhost:5999`
- **Network access:** `http://YOUR_DEVICE_IP:5999`
- **With reverse proxy:** `http://tenant-manager.local` (or your configured domain)

The application will be available to all devices on your local network!