# Environment Variables Documentation

## Overview

This document describes all environment variables used by the tenant management application, providing a comprehensive reference for deployment and configuration.

## Database Configuration

### Required Database Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DATABASE_TYPE` | Database type (postgresql, file, http) | `file` | `postgresql` |
| `DATABASE_HOST` | Database server hostname | `localhost` | `postgres` |
| `DATABASE_PORT` | Database server port | `5432` | `5432` |
| `DATABASE_NAME` | Database name | `tenant_manager` | `tenant_manager` |
| `DATABASE_USER` | Database username | `tenant_user` | `tenant_user` |
| `DATABASE_PASSWORD` | Database password | `tenant_pass` | `your_secure_password` |

### Optional Database Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DATABASE_POOL_MAX` | Maximum connections in pool | `20` | `50` |
| `DATABASE_POOL_MIN` | Minimum connections in pool | `5` | `10` |
| `DATABASE_TIMEOUT` | Connection timeout (ms) | `30000` | `60000` |
| `DATABASE_RETRY_ATTEMPTS` | Number of retry attempts | `3` | `5` |
| `DATABASE_SSL` | Enable SSL connections | `false` | `true` |

## Application Configuration

### Server Settings

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Application environment | `development` | `production` |
| `PORT` | Server port | `5999` | `3000` |
| `HOST` | Server host | `0.0.0.0` | `localhost` |

### Logging Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `LOG_LEVEL` | Logging level | `info` | `debug` |
| `LOG_ENABLE_CONSOLE` | Enable console logging | `true` | `false` |
| `LOG_ENABLE_FILE` | Enable file logging | `false` | `true` |
| `LOG_MAX_FILE_SIZE` | Max log file size | `10MB` | `50MB` |
| `LOG_MAX_FILES` | Max number of log files | `5` | `10` |

## Backup & Monitoring

### Backup Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `BACKUP_ENABLED` | Enable automatic backups | `false` | `true` |
| `BACKUP_INTERVAL` | Backup interval (hours) | `24` | `12` |
| `BACKUP_RETENTION` | Backup retention (days) | `30` | `60` |
| `BACKUP_DIRECTORY` | Backup storage directory | `./backups` | `/data/backups` |

### Health Monitoring

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `HEALTH_CHECK_ENABLED` | Enable health checks | `true` | `false` |
| `HEALTH_CHECK_INTERVAL` | Health check interval (ms) | `30000` | `60000` |
| `HEALTH_CHECK_TIMEOUT` | Health check timeout (ms) | `5000` | `10000` |

## Security Configuration

### Security Settings

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `REQUEST_TIMEOUT` | Request timeout (ms) | `30000` | `60000` |
| `MAX_REQUEST_SIZE` | Maximum request size | `10MB` | `50MB` |
| `RATE_LIMIT_ENABLED` | Enable rate limiting | `false` | `true` |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | `900000` | `300000` |
| `RATE_LIMIT_MAX` | Max requests per window | `1000` | `500` |

## PostgreSQL Specific Configuration

### PostgreSQL Performance Settings

These variables are used when `DATABASE_TYPE=postgresql`:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `POSTGRES_DB` | PostgreSQL database name | `tenant_manager` | `tenant_db` |
| `POSTGRES_USER` | PostgreSQL username | `tenant_user` | `app_user` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `tenant_pass` | `secure_password` |
| `POSTGRES_INITDB_ARGS` | Database initialization args | `--encoding=UTF-8 --locale=C` | Custom args |
| `POSTGRES_HOST_AUTH_METHOD` | Authentication method | `md5` | `trust` |

### PostgreSQL Performance Tuning

These are automatically configured via docker-compose command parameters:

| Setting | Value | Description |
|---------|-------|-------------|
| `max_connections` | `100` | Maximum concurrent connections |
| `shared_buffers` | `256MB` | Shared memory for caching |
| `effective_cache_size` | `1GB` | Estimated cache size |
| `maintenance_work_mem` | `64MB` | Memory for maintenance operations |
| `work_mem` | `4MB` | Memory per query operation |
| `wal_buffers` | `16MB` | Write-ahead log buffers |

## Environment File Examples

### Development (.env.development)

```bash
# Database Configuration
DATABASE_TYPE=postgresql
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=tenant_manager_dev
DATABASE_USER=dev_user
DATABASE_PASSWORD=dev_password

# Application
NODE_ENV=development
PORT=5999
LOG_LEVEL=debug

# Development Features
HEALTH_CHECK_ENABLED=true
BACKUP_ENABLED=false
```

### Production (.env.production)

```bash
# Database Configuration
DATABASE_TYPE=postgresql
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=tenant_manager
DATABASE_USER=tenant_user
DATABASE_PASSWORD=your_secure_production_password
DATABASE_POOL_MAX=20
DATABASE_POOL_MIN=5

# Application
NODE_ENV=production
PORT=5999
LOG_LEVEL=info

# Production Features
HEALTH_CHECK_ENABLED=true
BACKUP_ENABLED=true
BACKUP_INTERVAL=24
BACKUP_RETENTION=30
```

### Docker Compose (.env)

```bash
# PostgreSQL Container
POSTGRES_DB=tenant_manager
POSTGRES_USER=tenant_user
POSTGRES_PASSWORD=tenant_pass

# Application Container
NODE_ENV=production
DATABASE_TYPE=postgresql
DATABASE_HOST=postgres
LOG_LEVEL=info
```

## Docker Compose Integration

When using Docker Compose, environment variables are configured in the `docker-compose.yml` file:

```yaml
environment:
  - NODE_ENV=production
  - DATABASE_TYPE=postgresql
  - DATABASE_HOST=postgres
  - DATABASE_PORT=5432
  - DATABASE_NAME=tenant_manager
  - DATABASE_USER=tenant_user
  - DATABASE_PASSWORD=tenant_pass
  - DATABASE_POOL_MAX=20
  - DATABASE_POOL_MIN=5
  - LOG_LEVEL=info
  - BACKUP_INTERVAL=24
  - HEALTH_CHECK_ENABLED=true
```

## Configuration Validation

The application validates environment variables on startup and will:

1. **Log warnings** for missing optional variables
2. **Use defaults** for unspecified optional variables  
3. **Fail to start** if required variables are missing
4. **Validate formats** for typed variables (numbers, booleans)

## Security Best Practices

### Sensitive Variables

Always protect these sensitive environment variables:

- `DATABASE_PASSWORD`
- `POSTGRES_PASSWORD`
- Any authentication tokens or secrets

### Recommendations

1. **Use Docker secrets** for production deployments
2. **Rotate passwords** regularly
3. **Limit database permissions** to minimum required
4. **Use strong passwords** (generated, not predictable)
5. **Never commit** sensitive values to version control

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Connection refused | Wrong DATABASE_HOST | Check container networking |
| Authentication failed | Wrong credentials | Verify DATABASE_USER/PASSWORD |
| Timeout errors | Low timeout values | Increase DATABASE_TIMEOUT |
| Pool exhaustion | High concurrent load | Increase DATABASE_POOL_MAX |

### Debugging Environment

Enable debug logging to troubleshoot configuration:

```bash
LOG_LEVEL=debug
DATABASE_TIMEOUT=60000
HEALTH_CHECK_ENABLED=true
```

## Migration Notes

### From SQLite to PostgreSQL

When migrating from SQLite, update these variables:

```bash
# Old SQLite configuration
DATABASE_TYPE=file
DATABASE_PATH=tenant_manager.db

# New PostgreSQL configuration  
DATABASE_TYPE=postgresql
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=tenant_manager
DATABASE_USER=tenant_user
DATABASE_PASSWORD=tenant_pass
```

### Breaking Changes

The following variables are new and required for PostgreSQL:

- `DATABASE_HOST`
- `DATABASE_PORT` 
- `DATABASE_USER`
- `DATABASE_PASSWORD`

The following variables are deprecated:

- `DATABASE_PATH` (SQLite only)

## Support

For additional configuration questions:

1. Check application logs for validation errors
2. Verify Docker container connectivity
3. Test database connections manually
4. Review PostgreSQL container logs

This configuration provides a production-ready, secure, and performant PostgreSQL-based tenant management system.