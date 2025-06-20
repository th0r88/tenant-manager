# Tenant Management System

🏠 **Multi-tenant property management system** for landlords and property managers. Built with Node.js/Express backend, React frontend, and SQLite database.

## 🚀 Quick Start

### Docker Run (Simplest)
```bash
docker run -p 5999:5999 -v $(pwd)/data:/app/data jferme/tenant-manager
```

### Docker Compose (Recommended)
```yaml
services:
  tenant-manager:
    image: jferme/tenant-manager:latest
    ports:
      - "5999:5999"
    volumes:
      - ./data:/app/data
      - ./backups:/app/backups
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

Access at: **http://localhost:5999**

## ✨ Features

- **🏠 Multi-Property Management**: Manage multiple properties with isolated data
- **👥 Tenant Management**: Full CRUD operations (EMŠO, tax numbers, rent amounts)
- **⚡ Utility Cost Allocation**: Automatic allocation per person or per square meter
- **📄 PDF Reports**: Generate professional monthly tenant invoices
- **📊 Dashboard Analytics**: Cross-property insights and revenue trends
- **🌍 Multi-Language**: English and Slovenian support
- **🔒 Production Ready**: Health checks, monitoring, and security hardening

## 🏗️ Architecture Support

- **linux/amd64** - Intel/AMD servers, Intel Macs
- **linux/arm64** - Apple Silicon Macs, ARM servers, Raspberry Pi 4+

## 📋 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `5999` | Server port |
| `DATABASE_PATH` | `/app/data/tenant_manager.db` | SQLite database path |
| `LOG_LEVEL` | `info` | Logging level |

## 💾 Data Persistence

Mount volumes to persist your data:
- **`/app/data`** - SQLite database and application data
- **`/app/backups`** - Automated database backups
- **`/app/logs`** - Application logs (if file logging enabled)

## 🔗 Links

- **GitHub Repository**: [Source Code & Documentation](https://github.com/th0r88/tenant-manager)
- **Deployment Guides**: Docker, VPS, Cloud, and Homelab instructions
- **Multi-Architecture**: Automated builds for Intel and ARM platforms

## 📊 Health Check

The container includes built-in health checks:
```bash
curl http://localhost:5999/api/health
```

Built for **homelab** and **production** environments with Docker Compose support.

---
🐳 **Multi-architecture Docker images** • 🔄 **Automated CI/CD** • 📚 **Comprehensive Documentation**