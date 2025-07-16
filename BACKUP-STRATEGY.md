# PostgreSQL Backup Strategy

## Overview

This document outlines comprehensive backup strategies for the PostgreSQL-based tenant management system, ensuring data protection, disaster recovery, and business continuity.

## Backup Architecture

### Multi-Layer Backup Approach

1. **Application-Level Backups**: SQL dumps via backup service
2. **Database-Level Backups**: PostgreSQL native tools
3. **Volume-Level Backups**: Docker volume snapshots
4. **File-System Backups**: Host-level backup integration

## Application Backup Service

### Automated Backups

The application includes an integrated backup service with PostgreSQL support:

#### Features
- **Automatic scheduling**: Configurable intervals (default: 24 hours)
- **SQL dump format**: PostgreSQL-compatible backups
- **Metadata tracking**: Backup integrity and versioning
- **Retention management**: Automatic cleanup of old backups
- **Verification**: Backup integrity checking

#### Configuration

**Environment Variables:**
```bash
# Backup configuration
BACKUP_ENABLED=true
BACKUP_INTERVAL=24          # Hours between backups
BACKUP_RETENTION=30         # Days to retain backups
BACKUP_DIRECTORY=/app/backups
```

**Docker Compose Integration:**
```yaml
services:
  tenant-manager:
    environment:
      - BACKUP_INTERVAL=24
      - BACKUP_RETENTION=30
    volumes:
      - tenant-backups:/app/backups
```

### Manual Backup Operations

#### Create Manual Backup

```bash
# Using application service
docker compose exec tenant-manager node -e "
const backupService = require('./src/backend/services/backupService.js').default;
backupService.createBackup({
    name: 'manual-backup-$(date +%Y%m%d-%H%M%S)'
}).then(result => {
    console.log('Backup created:', result.path);
    console.log('Size:', result.size, 'bytes');
    console.log('Checksum:', result.checksum);
}).catch(console.error);
"
```

#### List Available Backups

```bash
# List all backups
docker compose exec tenant-manager node -e "
const backupService = require('./src/backend/services/backupService.js').default;
backupService.listBackups().then(backups => {
    console.log('Available backups:');
    backups.forEach(backup => {
        console.log('- ' + backup.filename + ' (' + backup.size + ' bytes, ' + backup.created + ')');
    });
}).catch(console.error);
"
```

#### Verify Backup Integrity

```bash
# Verify specific backup
docker compose exec tenant-manager node -e "
const backupService = require('./src/backend/services/backupService.js').default;
backupService.verifyBackup('/app/backups/backup-file.sql').then(result => {
    console.log('Backup valid:', result.valid);
    console.log('Tables:', result.tables);
    console.log('Checksum:', result.checksum);
}).catch(console.error);
"
```

## PostgreSQL Native Backups

### pg_dump Backups

#### Complete Database Dump

```bash
# Create full database dump
docker compose exec postgres pg_dump -U tenant_user -d tenant_manager \
  --format=custom \
  --compress=9 \
  --verbose \
  --file=/tmp/tenant_manager_full.dump

# Copy dump to host
docker compose cp postgres:/tmp/tenant_manager_full.dump ./backups/
```

#### Schema-Only Backup

```bash
# Backup schema without data
docker compose exec postgres pg_dump -U tenant_user -d tenant_manager \
  --schema-only \
  --format=plain \
  --file=/tmp/tenant_manager_schema.sql
```

#### Data-Only Backup

```bash
# Backup data without schema
docker compose exec postgres pg_dump -U tenant_user -d tenant_manager \
  --data-only \
  --format=custom \
  --file=/tmp/tenant_manager_data.dump
```

#### Table-Specific Backup

```bash
# Backup specific tables
docker compose exec postgres pg_dump -U tenant_user -d tenant_manager \
  --table=tenants \
  --table=properties \
  --format=plain \
  --file=/tmp/tenant_manager_core.sql
```

### pg_basebackup (Point-in-Time Recovery)

#### Setup WAL Archiving

**Update PostgreSQL configuration:**
```bash
# Create archive directory
docker compose exec postgres mkdir -p /var/lib/postgresql/archive

# Update postgresql.conf
docker compose exec postgres bash -c "cat >> /var/lib/postgresql/data/postgresql.conf << EOF
# WAL archiving for PITR
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/archive/%f'
wal_level = replica
max_wal_senders = 3
checkpoint_segments = 8
EOF"

# Restart PostgreSQL
docker compose restart postgres
```

#### Create Base Backup

```bash
# Create base backup
docker compose exec postgres pg_basebackup \
  -U tenant_user \
  -D /tmp/basebackup \
  -Ft \
  -z \
  -P \
  -v

# Copy to host
docker compose cp postgres:/tmp/basebackup ./backups/basebackup-$(date +%Y%m%d-%H%M%S)/
```

## Automated Backup Scripts

### Daily Backup Script

```bash
cat > daily-backup.sh << 'EOF'
#!/bin/bash

# Daily backup script for tenant management system
set -e

BACKUP_DIR="/opt/tenant-manager/backups"
DATE=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$BACKUP_DIR/backup-$DATE.log"

mkdir -p "$BACKUP_DIR"

echo "Starting daily backup at $(date)" | tee "$LOG_FILE"

# 1. Application backup
echo "Creating application backup..." | tee -a "$LOG_FILE"
docker compose exec tenant-manager node -e "
const backupService = require('./src/backend/services/backupService.js').default;
backupService.createBackup({name: 'daily-backup-$DATE'});
" 2>&1 | tee -a "$LOG_FILE"

# 2. PostgreSQL dump
echo "Creating PostgreSQL dump..." | tee -a "$LOG_FILE"
docker compose exec postgres pg_dump -U tenant_user -d tenant_manager \
  --format=custom \
  --compress=9 \
  > "$BACKUP_DIR/postgres-dump-$DATE.dump" 2>> "$LOG_FILE"

# 3. Volume backup
echo "Creating volume backup..." | tee -a "$LOG_FILE"
docker run --rm -v tenant-manager_postgres-data:/source:ro \
  -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/postgres-volume-$DATE.tar.gz" -C /source .

# 4. Cleanup old backups (keep 30 days)
echo "Cleaning up old backups..." | tee -a "$LOG_FILE"
find "$BACKUP_DIR" -name "*.dump" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

# 5. Verify latest backup
echo "Verifying backup integrity..." | tee -a "$LOG_FILE"
pg_restore --list "$BACKUP_DIR/postgres-dump-$DATE.dump" > /dev/null

echo "Daily backup completed at $(date)" | tee -a "$LOG_FILE"

# Send notification (optional)
# curl -X POST -H "Content-Type: application/json" \
#   -d "{\"text\":\"Tenant Manager backup completed: $DATE\"}" \
#   YOUR_WEBHOOK_URL
EOF

chmod +x daily-backup.sh
```

### Weekly Backup Script

```bash
cat > weekly-backup.sh << 'EOF'
#!/bin/bash

# Weekly comprehensive backup script
set -e

BACKUP_DIR="/opt/tenant-manager/backups/weekly"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "Starting weekly comprehensive backup at $(date)"

# 1. Full database backup with WAL
docker compose exec postgres pg_basebackup \
  -U tenant_user \
  -D /tmp/weekly-backup \
  -Ft \
  -z \
  -P \
  -v

docker compose cp postgres:/tmp/weekly-backup "$BACKUP_DIR/basebackup-$DATE/"

# 2. Configuration backup
mkdir -p "$BACKUP_DIR/config-$DATE"
cp docker-compose.yml "$BACKUP_DIR/config-$DATE/"
cp .env "$BACKUP_DIR/config-$DATE/"
cp -r src/backend/database/*.sql "$BACKUP_DIR/config-$DATE/"

# 3. Application files backup
tar czf "$BACKUP_DIR/application-$DATE.tar.gz" \
  --exclude node_modules \
  --exclude .git \
  --exclude backups \
  .

# 4. Test restore (optional - in test environment)
# ./test-restore.sh "$BACKUP_DIR/postgres-dump-$DATE.dump"

echo "Weekly backup completed at $(date)"
EOF

chmod +x weekly-backup.sh
```

## Restore Procedures

### Application Backup Restore

```bash
# Restore using backup service
docker compose exec tenant-manager node -e "
const backupService = require('./src/backend/services/backupService.js').default;
backupService.restoreBackup('/app/backups/backup-file.sql').then(() => {
    console.log('Restore completed successfully');
}).catch(console.error);
"
```

### PostgreSQL Dump Restore

#### Complete Database Restore

```bash
# Stop application
docker compose stop tenant-manager

# Drop and recreate database
docker compose exec postgres psql -U tenant_user -d postgres -c "DROP DATABASE IF EXISTS tenant_manager;"
docker compose exec postgres psql -U tenant_user -d postgres -c "CREATE DATABASE tenant_manager OWNER tenant_user;"

# Restore from dump
docker compose exec postgres pg_restore \
  -U tenant_user \
  -d tenant_manager \
  --verbose \
  --clean \
  --if-exists \
  /path/to/backup.dump

# Restart application
docker compose start tenant-manager
```

#### Selective Table Restore

```bash
# Restore specific tables
docker compose exec postgres pg_restore \
  -U tenant_user \
  -d tenant_manager \
  --table=tenants \
  --table=properties \
  --verbose \
  /path/to/backup.dump
```

### Point-in-Time Recovery

```bash
# Stop PostgreSQL
docker compose stop postgres

# Remove current data
docker compose exec postgres rm -rf /var/lib/postgresql/data/*

# Restore base backup
docker compose exec postgres tar -xzf /path/to/basebackup.tar.gz -C /var/lib/postgresql/data/

# Create recovery configuration
docker compose exec postgres bash -c "cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = 'cp /var/lib/postgresql/archive/%f %p'
recovery_target_time = '2024-01-15 14:30:00'
EOF"

# Start PostgreSQL
docker compose start postgres
```

## Backup Monitoring

### Health Checks

```bash
cat > backup-health-check.sh << 'EOF'
#!/bin/bash

# Backup health monitoring script
set -e

BACKUP_DIR="/opt/tenant-manager/backups"
ALERT_EMAIL="admin@example.com"

# Check if daily backup exists
TODAY=$(date +%Y%m%d)
DAILY_BACKUP=$(find "$BACKUP_DIR" -name "*daily-backup-$TODAY*" -type f)

if [ -z "$DAILY_BACKUP" ]; then
    echo "ALERT: No daily backup found for $TODAY"
    # Send alert
    exit 1
fi

# Check backup age
LATEST_BACKUP=$(find "$BACKUP_DIR" -name "*.dump" -type f -exec stat -c '%Y %n' {} \; | sort -nr | head -1 | cut -d' ' -f2-)
BACKUP_AGE=$(( $(date +%s) - $(stat -c %Y "$LATEST_BACKUP") ))
MAX_AGE=$((24 * 3600))  # 24 hours

if [ "$BACKUP_AGE" -gt "$MAX_AGE" ]; then
    echo "ALERT: Latest backup is older than 24 hours"
    exit 1
fi

# Test backup integrity
pg_restore --list "$LATEST_BACKUP" > /dev/null

echo "Backup health check passed"
EOF

chmod +x backup-health-check.sh
```

### Backup Metrics

```bash
cat > backup-metrics.sh << 'EOF'
#!/bin/bash

# Collect backup metrics
BACKUP_DIR="/opt/tenant-manager/backups"

echo "=== Backup Metrics ==="
echo "Backup directory: $BACKUP_DIR"
echo "Total backups: $(find "$BACKUP_DIR" -name "*.dump" -o -name "*.sql" | wc -l)"
echo "Total size: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo "Latest backup: $(find "$BACKUP_DIR" -name "*.dump" -type f -exec stat -c '%y %n' {} \; | sort -nr | head -1)"
echo "Oldest backup: $(find "$BACKUP_DIR" -name "*.dump" -type f -exec stat -c '%y %n' {} \; | sort -n | head -1)"

# Database size
echo "Database size: $(docker compose exec postgres psql -U tenant_user -d tenant_manager -t -c "SELECT pg_size_pretty(pg_database_size('tenant_manager'));" | xargs)"

# Backup success rate (last 7 days)
SUCCESSFUL_BACKUPS=$(find "$BACKUP_DIR" -name "*.dump" -mtime -7 | wc -l)
echo "Successful backups (7 days): $SUCCESSFUL_BACKUPS"
EOF

chmod +x backup-metrics.sh
```

## Automation and Scheduling

### Cron Jobs

```bash
# Edit crontab
crontab -e

# Add backup schedules
# Daily backup at 2 AM
0 2 * * * /opt/tenant-manager/daily-backup.sh

# Weekly backup on Sunday at 1 AM
0 1 * * 0 /opt/tenant-manager/weekly-backup.sh

# Backup health check every 6 hours
0 */6 * * * /opt/tenant-manager/backup-health-check.sh

# Backup metrics daily at 8 AM
0 8 * * * /opt/tenant-manager/backup-metrics.sh
```

### Systemd Timer (Alternative)

```bash
# Create backup service
cat > /etc/systemd/system/tenant-manager-backup.service << 'EOF'
[Unit]
Description=Tenant Manager Daily Backup
Wants=tenant-manager-backup.timer

[Service]
Type=oneshot
ExecStart=/opt/tenant-manager/daily-backup.sh
EOF

# Create backup timer
cat > /etc/systemd/system/tenant-manager-backup.timer << 'EOF'
[Unit]
Description=Tenant Manager Daily Backup Timer
Requires=tenant-manager-backup.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable and start timer
systemctl enable tenant-manager-backup.timer
systemctl start tenant-manager-backup.timer
```

## Disaster Recovery

### Recovery Time Objectives (RTO)

- **Application restore**: < 30 minutes
- **Database restore**: < 1 hour
- **Complete system recovery**: < 2 hours

### Recovery Point Objectives (RPO)

- **Daily backups**: < 24 hours data loss
- **With WAL archiving**: < 15 minutes data loss
- **Continuous replication**: < 1 minute data loss

### Disaster Recovery Procedures

#### Complete System Recovery

```bash
# 1. Prepare new environment
docker compose down
docker system prune -f

# 2. Restore configuration
cp backups/config-latest/* .

# 3. Restore PostgreSQL data
docker compose up -d postgres
# Wait for PostgreSQL to start
sleep 30

# 4. Restore database
docker compose exec -T postgres psql -U tenant_user -d postgres << EOF
DROP DATABASE IF EXISTS tenant_manager;
CREATE DATABASE tenant_manager OWNER tenant_user;
EOF

# Restore from latest backup
docker compose exec postgres pg_restore \
  -U tenant_user \
  -d tenant_manager \
  --verbose \
  /path/to/latest/backup.dump

# 5. Start application
docker compose up -d tenant-manager

# 6. Verify recovery
curl http://localhost:5999/api/health
```

#### Testing Recovery Procedures

```bash
cat > test-recovery.sh << 'EOF'
#!/bin/bash

# Test recovery procedures
set -e

echo "Testing disaster recovery procedures..."

# 1. Create test environment
docker compose -f docker-compose.test.yml up -d

# 2. Restore test data
LATEST_BACKUP=$(find ./backups -name "*.dump" -type f | head -1)
docker compose -f docker-compose.test.yml exec postgres pg_restore \
  -U tenant_user \
  -d tenant_manager \
  --clean \
  --if-exists \
  "$LATEST_BACKUP"

# 3. Verify data integrity
docker compose -f docker-compose.test.yml exec postgres psql -U tenant_user -d tenant_manager -c "
SELECT 
  'properties' as table_name, COUNT(*) as count FROM properties
UNION ALL
SELECT 'tenants', COUNT(*) FROM tenants
UNION ALL
SELECT 'utility_entries', COUNT(*) FROM utility_entries;"

# 4. Cleanup test environment
docker compose -f docker-compose.test.yml down -v

echo "Recovery test completed successfully"
EOF

chmod +x test-recovery.sh
```

## Security Considerations

### Backup Encryption

```bash
# Encrypt backups using GPG
gpg --symmetric --cipher-algo AES256 --compress-algo 1 \
  --output backup-encrypted.gpg \
  backup-file.dump

# Decrypt backup
gpg --decrypt backup-encrypted.gpg > backup-file.dump
```

### Access Control

```bash
# Set proper permissions
chmod 600 /opt/tenant-manager/backups/*
chown backup-user:backup-group /opt/tenant-manager/backups/

# Restrict PostgreSQL access
docker compose exec postgres psql -U postgres -c "
REVOKE ALL ON DATABASE tenant_manager FROM PUBLIC;
GRANT CONNECT ON DATABASE tenant_manager TO tenant_user;
"
```

### Backup Verification

```bash
# Verify backup integrity regularly
find /opt/tenant-manager/backups -name "*.dump" -exec pg_restore --list {} \; > /dev/null
```

## Best Practices

### 1. Backup Strategy

- **3-2-1 Rule**: 3 copies, 2 different media, 1 offsite
- **Regular testing**: Test restore procedures monthly
- **Monitoring**: Implement backup monitoring and alerting
- **Documentation**: Keep recovery procedures updated

### 2. Performance Considerations

- **Schedule wisely**: Perform backups during low-usage periods
- **Compression**: Use compression to reduce backup size
- **Incremental backups**: Consider incremental backups for large datasets
- **Storage optimization**: Implement backup retention policies

### 3. Security

- **Encryption**: Encrypt backups at rest and in transit
- **Access control**: Limit backup access to authorized personnel
- **Secure storage**: Use secure, offsite backup storage
- **Audit logging**: Log all backup and restore operations

### 4. Automation

- **Automated scheduling**: Use cron jobs or systemd timers
- **Health monitoring**: Implement automated backup verification
- **Alerting**: Set up alerts for backup failures
- **Self-healing**: Implement automatic retry mechanisms

This comprehensive backup strategy ensures robust data protection and reliable disaster recovery capabilities for the PostgreSQL-based tenant management system.