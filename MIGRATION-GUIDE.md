# SQLite to PostgreSQL Migration Guide

## Overview

This guide provides step-by-step instructions for migrating from SQLite to PostgreSQL database backend in the tenant management application.

## Migration Benefits

- **Better Performance**: PostgreSQL excels in complex queries and reporting
- **Scalability**: True client-server architecture with connection pooling
- **Container Separation**: Database runs in separate, dedicated container
- **Production Ready**: Industry-standard database for property management
- **ACID Compliance**: Enhanced data integrity and consistency
- **Multi-tenant Ready**: Superior schema separation capabilities

## Pre-Migration Checklist

### 1. Backup Existing Data

**Create SQLite backup:**
```bash
# Stop the application
docker compose down

# Create backup directory
mkdir -p migration-backups

# Copy SQLite database
cp tenant_manager.db migration-backups/tenant_manager_backup_$(date +%Y%m%d_%H%M%S).db

# Create SQL dump for verification
sqlite3 tenant_manager.db .dump > migration-backups/sqlite_dump_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Verify Data Integrity

**Check SQLite database:**
```bash
# Verify database integrity
sqlite3 tenant_manager.db "PRAGMA integrity_check;"

# Count records by table
sqlite3 tenant_manager.db "
SELECT 'properties' as table_name, COUNT(*) as record_count FROM properties
UNION ALL
SELECT 'tenants', COUNT(*) FROM tenants
UNION ALL  
SELECT 'utility_entries', COUNT(*) FROM utility_entries
UNION ALL
SELECT 'tenant_utility_allocations', COUNT(*) FROM tenant_utility_allocations;"
```

### 3. Document Current Configuration

**Save current environment:**
```bash
# Export current configuration
echo "Current SQLite configuration:" > migration-backups/current_config.txt
env | grep DATABASE >> migration-backups/current_config.txt
```

## Migration Process

### Phase 1: Setup PostgreSQL Environment

#### 1.1 Update Configuration Files

**Update docker-compose.yml:**
The PostgreSQL configuration is already included. Verify these services exist:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: postgres-db
    environment:
      - POSTGRES_DB=tenant_manager
      - POSTGRES_USER=tenant_user
      - POSTGRES_PASSWORD=tenant_pass
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./src/backend/database/init-postgres.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
      - ./src/backend/database/constraints-postgres.sql:/docker-entrypoint-initdb.d/02-constraints.sql:ro
      - ./src/backend/database/indexes-postgres.sql:/docker-entrypoint-initdb.d/03-indexes.sql:ro
```

#### 1.2 Update Environment Variables

**Create new environment configuration:**
```bash
# Create PostgreSQL environment file
cat > .env.postgresql << EOF
# PostgreSQL Configuration
NODE_ENV=production
DATABASE_TYPE=postgresql
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=tenant_manager
DATABASE_USER=tenant_user
DATABASE_PASSWORD=change_this_secure_password

# Performance Settings
DATABASE_POOL_MAX=20
DATABASE_POOL_MIN=5
DATABASE_TIMEOUT=30000
DATABASE_RETRY_ATTEMPTS=3

# Application Settings
LOG_LEVEL=info
BACKUP_INTERVAL=24
BACKUP_RETENTION=30
HEALTH_CHECK_ENABLED=true
EOF
```

### Phase 2: Data Migration

#### 2.1 Export SQLite Data

**Create migration script:**
```bash
cat > migrate-sqlite-to-postgresql.js << 'EOF'
#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import pkg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pkg;

async function migrateSQLiteToPostgreSQL() {
    console.log('🔄 Starting SQLite to PostgreSQL migration...');
    
    // SQLite connection
    const sqliteDb = new sqlite3.Database('tenant_manager.db');
    
    // PostgreSQL connection
    const pgClient = new Client({
        host: 'localhost',
        port: 5432,
        database: 'tenant_manager',
        user: 'tenant_user',
        password: 'tenant_pass'
    });
    
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL');
    
    try {
        // Get table list
        const tables = ['properties', 'tenants', 'utility_entries', 'tenant_utility_allocations', 'billing_periods'];
        
        for (const tableName of tables) {
            console.log(`📊 Migrating table: ${tableName}`);
            
            // Get SQLite data
            const rows = await new Promise((resolve, reject) => {
                sqliteDb.all(`SELECT * FROM ${tableName}`, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
            
            console.log(`   Found ${rows.length} rows in ${tableName}`);
            
            if (rows.length > 0) {
                // Get column names
                const columns = Object.keys(rows[0]);
                const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                
                // Insert data
                for (const row of rows) {
                    const values = columns.map(col => row[col]);
                    await pgClient.query(sql, values);
                }
                
                console.log(`   ✅ Migrated ${rows.length} rows to ${tableName}`);
            }
        }
        
        // Update sequences
        for (const tableName of tables) {
            try {
                await pgClient.query(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM ${tableName}), 1), false)`);
                console.log(`   ✅ Updated sequence for ${tableName}`);
            } catch (error) {
                console.log(`   ⚠️  Could not update sequence for ${tableName}: ${error.message}`);
            }
        }
        
        console.log('✅ Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        sqliteDb.close();
        await pgClient.end();
    }
}

migrateSQLiteToPostgreSQL().catch(console.error);
EOF

chmod +x migrate-sqlite-to-postgresql.js
```

#### 2.2 Start PostgreSQL Container

```bash
# Start only PostgreSQL service
docker compose up -d postgres

# Wait for PostgreSQL to be ready
docker compose exec postgres pg_isready -U tenant_user -d tenant_manager

# Verify schema was created
docker compose exec postgres psql -U tenant_user -d tenant_manager -c "\dt"
```

#### 2.3 Run Migration

```bash
# Install required dependencies if not already installed
npm install sqlite3 pg

# Run migration script
node migrate-sqlite-to-postgresql.js
```

#### 2.4 Verify Migration

**Check data integrity:**
```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U tenant_user -d tenant_manager

# Count records by table
SELECT 'properties' as table_name, COUNT(*) as record_count FROM properties
UNION ALL
SELECT 'tenants', COUNT(*) FROM tenants
UNION ALL  
SELECT 'utility_entries', COUNT(*) FROM utility_entries
UNION ALL
SELECT 'tenant_utility_allocations', COUNT(*) FROM tenant_utility_allocations;

# Check sample data
SELECT * FROM properties LIMIT 5;
SELECT * FROM tenants LIMIT 5;

# Exit PostgreSQL
\q
```

### Phase 3: Application Migration

#### 3.1 Update Environment Configuration

```bash
# Backup current environment
cp .env .env.sqlite.backup

# Use PostgreSQL configuration
cp .env.postgresql .env

# Update passwords
sed -i 's/change_this_secure_password/your_actual_secure_password/g' .env
```

#### 3.2 Start Full Application

```bash
# Start all services with PostgreSQL
docker compose up -d

# Check service status
docker compose ps

# Follow logs
docker compose logs -f
```

#### 3.3 Verify Application Functionality

**Test basic operations:**
```bash
# Health check
curl http://localhost:5999/api/health

# Test property listing
curl http://localhost:5999/api/properties

# Test tenant listing  
curl http://localhost:5999/api/tenants

# Test utilities
curl http://localhost:5999/api/utilities
```

**Test web interface:**
1. Open http://localhost:5999 in browser
2. Verify all data is displayed correctly
3. Test creating/editing a tenant
4. Test utility calculations
5. Test PDF generation

### Phase 4: Performance Optimization

#### 4.1 Apply Database Indexes

The indexes are automatically applied during container startup via `indexes-postgres.sql`.

**Verify indexes:**
```bash
docker compose exec postgres psql -U tenant_user -d tenant_manager -c "
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;"
```

#### 4.2 Update Statistics

```bash
docker compose exec postgres psql -U tenant_user -d tenant_manager -c "
ANALYZE properties;
ANALYZE tenants;
ANALYZE utility_entries;
ANALYZE tenant_utility_allocations;
ANALYZE billing_periods;"
```

## Post-Migration Verification

### Comprehensive Testing

#### 1. Data Integrity Tests

**Run data verification script:**
```bash
cat > verify-migration.js << 'EOF'
#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

async function verifyMigration() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        database: 'tenant_manager',
        user: 'tenant_user',
        password: 'tenant_pass'
    });
    
    await client.connect();
    
    try {
        // Test relationships
        const result = await client.query(`
            SELECT 
                p.name as property_name,
                COUNT(t.id) as tenant_count,
                COUNT(ue.id) as utility_count
            FROM properties p
            LEFT JOIN tenants t ON t.property_id = p.id
            LEFT JOIN utility_entries ue ON ue.property_id = p.id
            GROUP BY p.id, p.name
            ORDER BY p.name
        `);
        
        console.log('Property relationships:');
        console.table(result.rows);
        
        // Test constraints
        console.log('Testing constraints...');
        try {
            await client.query("INSERT INTO tenants (property_id, name, surname, emso) VALUES (99999, 'Test', 'User', '1234567890123')");
            console.log('❌ Foreign key constraint not working');
        } catch (error) {
            console.log('✅ Foreign key constraints working');
        }
        
        console.log('✅ Migration verification completed');
        
    } finally {
        await client.end();
    }
}

verifyMigration().catch(console.error);
EOF

chmod +x verify-migration.js
node verify-migration.js
```

#### 2. Performance Tests

**Run performance test:**
```bash
# Use existing test scripts
node test-performance-optimization.js
```

#### 3. Backup System Test

**Test PostgreSQL backups:**
```bash
# Create test backup
docker compose exec tenant-manager node -e "
const backupService = require('./src/backend/services/backupService.js').default;
backupService.createBackup({name: 'post-migration-test'}).then(result => {
    console.log('Backup created:', result.path);
    console.log('Size:', result.size, 'bytes');
}).catch(console.error);
"
```

## Rollback Procedure

### If Migration Fails

#### 1. Stop PostgreSQL Services

```bash
# Stop all services
docker compose down

# Remove PostgreSQL volumes (if needed)
docker compose down -v
```

#### 2. Restore SQLite Configuration

```bash
# Restore SQLite environment
cp .env.sqlite.backup .env

# Restore SQLite docker-compose (if using containerized SQLite)
# Or simply remove DATABASE_TYPE environment variable to default to file
```

#### 3. Restart with SQLite

```bash
# Start with SQLite configuration
docker compose up -d

# Verify application works with SQLite
curl http://localhost:5999/api/health
```

## Troubleshooting

### Common Migration Issues

#### 1. Character Encoding Problems

**Problem:** Special characters not displaying correctly

**Solution:**
```bash
# Ensure PostgreSQL uses UTF-8
docker compose exec postgres psql -U tenant_user -d tenant_manager -c "SHOW server_encoding;"

# Should return UTF8
# If not, recreate database with UTF-8 encoding
```

#### 2. Date Format Issues

**Problem:** Date fields not migrating correctly

**Solution:**
```bash
# Check date formats in PostgreSQL
docker compose exec postgres psql -U tenant_user -d tenant_manager -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenants' AND column_name LIKE '%date%';"

# Update date formats if necessary
```

#### 3. Sequence Issues

**Problem:** Auto-increment IDs not working after migration

**Solution:**
```bash
# Reset sequences manually
docker compose exec postgres psql -U tenant_user -d tenant_manager -c "
SELECT setval('properties_id_seq', (SELECT COALESCE(MAX(id), 1) FROM properties));
SELECT setval('tenants_id_seq', (SELECT COALESCE(MAX(id), 1) FROM tenants));
SELECT setval('utility_entries_id_seq', (SELECT COALESCE(MAX(id), 1) FROM utility_entries));
SELECT setval('tenant_utility_allocations_id_seq', (SELECT COALESCE(MAX(id), 1) FROM tenant_utility_allocations));
"
```

#### 4. Performance Issues

**Problem:** Queries slower than SQLite

**Solution:**
```bash
# Ensure indexes are applied
docker compose exec postgres psql -U tenant_user -d tenant_manager -c "
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename;"

# Update statistics
docker compose exec postgres psql -U tenant_user -d tenant_manager -c "ANALYZE;"
```

## Best Practices

### 1. Migration Timing

- **Maintenance Window**: Perform migration during low-usage periods
- **Backup First**: Always create comprehensive backups before migration
- **Test Environment**: Test migration process in development environment first
- **Rollback Plan**: Have tested rollback procedure ready

### 2. Data Validation

- **Record Counts**: Verify all records migrated correctly
- **Relationships**: Test foreign key relationships
- **Constraints**: Verify all business rules still enforced
- **Performance**: Compare query performance before/after

### 3. Security Considerations

- **Password Security**: Use strong, unique passwords for PostgreSQL
- **Network Security**: Limit PostgreSQL port exposure
- **User Permissions**: Create limited-privilege users for application
- **Backup Security**: Encrypt backup files and secure storage

### 4. Monitoring

- **Performance Metrics**: Monitor database performance post-migration
- **Error Logging**: Watch for database-related errors
- **Resource Usage**: Monitor CPU, memory, and disk usage
- **Backup Verification**: Regularly verify backup integrity

## Success Criteria

Migration is considered successful when:

- ✅ All data migrated without loss
- ✅ Application functionality verified
- ✅ Performance meets or exceeds SQLite baseline
- ✅ Backup system working correctly
- ✅ All tests passing
- ✅ No data integrity issues
- ✅ PostgreSQL-specific features operational

## Support

For migration issues:

1. **Check logs**: `docker compose logs postgres` and `docker compose logs tenant-manager`
2. **Verify data**: Compare record counts and sample data
3. **Test connectivity**: Ensure application can connect to PostgreSQL
4. **Review configuration**: Double-check environment variables
5. **Rollback if necessary**: Use rollback procedure if critical issues found

This migration guide provides a comprehensive path from SQLite to PostgreSQL with proper testing, verification, and rollback procedures.