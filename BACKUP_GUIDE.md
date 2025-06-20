# Database Backup & Recovery Guide

## Overview

The tenant management system now includes automated backup functionality to protect against data loss. This guide covers backup operations, recovery procedures, and maintenance tasks.

## Automatic Backups

### Configuration
- **Frequency**: Every 24 hours
- **Retention**: 30 days of backups
- **Storage**: `./backups/` directory
- **Format**: SQLite database files with timestamps

### Status
Automatic backups start when the server starts. Check server logs for backup status:
```
✅ Automatic database backups enabled
Database backup created: ./backups/tenant_manager_2024-01-15T10-30-00-000Z.db
```

## Manual Backup Operations

### Create Backup
```bash
# Via npm script
npm run backup

# Via CLI utility
node src/backend/utils/backupCli.js backup
```

### List Available Backups
```bash
npm run backup:list
```

### Verify Database Integrity
```bash
npm run backup:verify
```

### View Backup Information
```bash
npm run backup:info
```

### Clean Up Old Backups
```bash
npm run backup:cleanup
```

## Recovery Procedures

### Restore from Backup
```bash
# List available backups first
npm run backup:list

# Restore from specific backup
npm run backup:restore ./backups/tenant_manager_2024-01-15T10-30-00-000Z.db
```

**Important**: The restore process automatically creates a safety backup before restoration.

### Emergency Recovery Steps

1. **Stop the application**:
   ```bash
   # Kill any running server processes
   pkill -f 'node.*server.js'
   ```

2. **Verify backup integrity**:
   ```bash
   npm run backup:verify
   ```

3. **Restore from backup**:
   ```bash
   npm run backup:restore <backup-file-path>
   ```

4. **Restart the application**:
   ```bash
   npm run server
   ```

5. **Verify system health**:
   ```bash
   curl http://localhost:3001/api/health
   ```

## API Endpoints

### Health Check with Database Integrity
```
GET /api/health
```
Response includes database status:
```json
{
  "status": "ok",
  "message": "Tenant Manager API is running",
  "database": "healthy"
}
```

### Manual Backup Creation
```
POST /api/backup/create
```

### List Backups
```
GET /api/backup/list
```

### Verify Database
```
POST /api/backup/verify
```

## Monitoring

### Check Backup Status
Monitor these log messages:
- ✅ `Database backup created: <path>`
- ✅ `Cleaned up old backup: <path>`
- ❌ `Automatic backup failed: <error>`

### Database Integrity Warnings
Watch for these critical alerts:
- 🚨 `POTENTIAL DATABASE CORRUPTION DETECTED`
- ❌ `Database integrity check failed`

## Backup File Details

### File Naming Convention
```
tenant_manager_YYYY-MM-DDTHH-mm-ss-sssZ.db
```

### Storage Location
```
./backups/
├── tenant_manager_2024-01-15T10-30-00-000Z.db
├── tenant_manager_2024-01-14T10-30-00-000Z.db
└── ...
```

### File Validation
Each backup is automatically verified for:
- Database integrity (PRAGMA integrity_check)
- File accessibility
- SQLite format validity

## Troubleshooting

### Backup Fails
1. Check disk space availability
2. Verify write permissions on `./backups/` directory
3. Ensure database is not locked by another process

### Restore Fails
1. Verify backup file exists and is readable
2. Check backup file integrity first
3. Ensure no applications are using the database

### Database Corruption Detected
1. **Immediate action**: Stop accepting new data
2. **Verify**: Run integrity check on current database
3. **Restore**: Use most recent known-good backup
4. **Investigate**: Check system logs for root cause

## Best Practices

### Regular Maintenance
- Run weekly integrity checks
- Monitor backup logs daily
- Test restore procedures monthly
- Keep backups in multiple locations for critical data

### Before Major Operations
- Create manual backup before bulk data imports
- Backup before application updates
- Backup before schema changes

### Security
- Backup files contain sensitive tenant data
- Store backups securely with appropriate permissions
- Consider encryption for backups in sensitive environments

## Recovery Time Objectives

- **Backup Creation**: < 30 seconds
- **Database Verification**: < 10 seconds
- **Full Restore**: < 2 minutes
- **System Recovery**: < 5 minutes total

## Support

For backup and recovery issues:
1. Check server logs for detailed error messages
2. Verify backup file integrity
3. Ensure proper file permissions
4. Contact system administrator if corruption is detected