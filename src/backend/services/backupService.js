import sqlite3 from 'sqlite3';
import pkg from 'pg';
import { promises as fs, readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { getDatabaseAdapter } from '../database/db.js';
import environmentConfig from '../config/environment.js';
import { getQueryTemplate } from '../database/queryAdapter.js';
import axios from 'axios';

const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class BackupService {
    constructor() {
        this.dbPath = 'tenant_manager.db';
        this.backupDir = join(process.cwd(), 'backups');
        this.maxBackups = 30; // Keep 30 days of backups
        this.compressionEnabled = false;
        this.encryptionEnabled = false;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    async ensureBackupDirectory() {
        try {
            await fs.access(this.backupDir);
        } catch {
            await fs.mkdir(this.backupDir, { recursive: true });
        }
    }

    async createBackup(options = {}) {
        await this.ensureBackupDirectory();
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = options.name || `tenant_manager_${timestamp}`;
        const config = environmentConfig.getDatabaseConfig();
        
        // Use appropriate file extension based on database type
        const extension = config.type === 'postgresql' ? '.sql' : '.db';
        const backupPath = join(this.backupDir, `${backupName}${extension}`);
        
        try {
            console.log(`🔄 Creating ${config.type} backup: ${backupName}...`);
            
            switch (config.type) {
                case 'postgresql':
                    await this.createPostgreSQLBackup(backupPath, options);
                    break;
                case 'http':
                    await this.createHttpBackup(backupPath, options);
                    break;
                case 'file':
                default:
                    await this.createFileBackup(backupPath, options);
                    break;
            }
            
            // Generate backup metadata
            const metadata = await this.generateBackupMetadata(backupPath, options);
            const metadataPath = join(this.backupDir, `${backupName}.meta.json`);
            writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
            
            // Cleanup old backups
            await this.cleanupOldBackups();
            
            console.log(`✅ Backup created successfully: ${backupPath}`);
            return {
                path: backupPath,
                metadata: metadata,
                size: metadata.size,
                checksum: metadata.checksum
            };
            
        } catch (error) {
            console.error(`❌ Backup failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create backup from PostgreSQL database
     */
    async createPostgreSQLBackup(backupPath, options = {}) {
        const config = environmentConfig.getDatabaseConfig();
        const client = new Client({
            host: config.host,
            port: config.port,
            database: config.name,
            user: config.user,
            password: config.password,
            ssl: config.postgresql?.ssl || false
        });
        
        try {
            await client.connect();
            console.log('🔗 Connected to PostgreSQL for backup');
            
            // Get all tables
            const tablesResult = await client.query(`
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                ORDER BY tablename
            `);
            
            const tables = tablesResult.rows.map(row => row.tablename);
            let sqlDump = `-- PostgreSQL Database Backup\n`;
            sqlDump += `-- Generated: ${new Date().toISOString()}\n`;
            sqlDump += `-- Database: ${config.name}\n`;
            sqlDump += `-- Host: ${config.host}:${config.port}\n\n`;
            
            // Add schema for each table
            for (const tableName of tables) {
                console.log(`📋 Backing up table: ${tableName}`);
                
                // Get table schema
                const schemaResult = await client.query(`
                    SELECT 
                        'CREATE TABLE ' || quote_ident(table_name) || ' (' ||
                        string_agg(
                            quote_ident(column_name) || ' ' || 
                            data_type ||
                            case when character_maximum_length is not null 
                                then '(' || character_maximum_length || ')' 
                                else '' 
                            end ||
                            case when is_nullable = 'NO' then ' NOT NULL' else '' end,
                            ', '
                        ) || ');' as create_statement
                    FROM information_schema.columns 
                    WHERE table_name = $1 
                    AND table_schema = 'public'
                    GROUP BY table_name
                `, [tableName]);
                
                if (schemaResult.rows.length > 0) {
                    sqlDump += `\n-- Table: ${tableName}\n`;
                    sqlDump += `DROP TABLE IF EXISTS ${tableName};\n`;
                    sqlDump += `${schemaResult.rows[0].create_statement}\n`;
                }
                
                // Get table data
                const dataResult = await client.query(`SELECT * FROM ${tableName}`);
                
                if (dataResult.rows.length > 0) {
                    const columns = Object.keys(dataResult.rows[0]);
                    
                    sqlDump += `\n-- Data for table: ${tableName}\n`;
                    
                    for (const row of dataResult.rows) {
                        const values = columns.map(col => {
                            const value = row[col];
                            if (value === null) return 'NULL';
                            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
                            if (value instanceof Date) return `'${value.toISOString()}'`;
                            if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
                            return value;
                        }).join(', ');
                        
                        sqlDump += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values});\n`;
                    }
                }
            }
            
            // Add indexes and constraints
            const indexesResult = await client.query(`
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey'
            `);
            
            if (indexesResult.rows.length > 0) {
                sqlDump += `\n-- Indexes\n`;
                for (const index of indexesResult.rows) {
                    sqlDump += `${index.indexdef};\n`;
                }
            }
            
            // Write backup to file
            writeFileSync(backupPath, sqlDump, 'utf8');
            
            console.log(`📦 PostgreSQL backup completed: ${backupPath}`);
            
        } catch (error) {
            throw new Error(`PostgreSQL backup failed: ${error.message}`);
        } finally {
            await client.end();
        }
    }
    
    /**
     * Create backup from HTTP-based database
     */
    async createHttpBackup(backupPath, options = {}) {
        const config = environmentConfig.getDatabaseConfig();
        const baseURL = `http://${config.host}:${config.port}`;
        
        const client = axios.create({
            baseURL,
            timeout: 300000, // 5 minute timeout for backup
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        // Add authentication if configured
        if (config.user && config.password) {
            client.defaults.auth = {
                username: config.user,
                password: config.password
            };
        }

        try {
            // Get database dump via HTTP API
            const response = await client.get('/backup', {
                responseType: 'arraybuffer',
                params: {
                    format: 'sqlite',
                    include_schema: true,
                    include_data: true
                }
            });

            // Write backup to file
            writeFileSync(backupPath, response.data);
            
            console.log(`📦 HTTP backup completed: ${backupPath}`);
        } catch (error) {
            if (error.response?.status === 404) {
                // Fallback: create backup using SQL dump
                await this.createSqlDumpBackup(backupPath, client);
            } else {
                throw new Error(`HTTP backup failed: ${error.message}`);
            }
        }
    }

    /**
     * Create backup using SQL dump approach
     */
    async createSqlDumpBackup(backupPath, client) {
        try {
            console.log('🔄 Creating SQL dump backup...');
            
            // Get all tables
            const config = environmentConfig.getDatabaseConfig();
            const tablesResponse = await client.post('/query', {
                sql: getQueryTemplate('systemTables', config.type),
                params: []
            });

            const tables = tablesResponse.data.rows;
            let sqlDump = '-- SQLite Database Backup\n';
            sqlDump += `-- Generated: ${new Date().toISOString()}\n\n`;

            // Add schema
            sqlDump += '-- Schema\n';
            for (const table of tables) {
                sqlDump += `${table.sql};\n`;
            }
            sqlDump += '\n';

            // Add data
            sqlDump += '-- Data\n';
            for (const table of tables) {
                const dataResponse = await client.post('/query', {
                    sql: `SELECT * FROM ${table.name}`,
                    params: []
                });

                const rows = dataResponse.data.rows;
                if (rows.length > 0) {
                    const columns = Object.keys(rows[0]);
                    
                    for (const row of rows) {
                        const values = columns.map(col => {
                            const value = row[col];
                            if (value === null) return 'NULL';
                            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
                            return value;
                        }).join(', ');
                        
                        sqlDump += `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${values});\n`;
                    }
                }
            }

            // Convert SQL dump to SQLite database
            await this.createSqliteFromDump(backupPath, sqlDump);
            
            console.log('✅ SQL dump backup completed');
        } catch (error) {
            throw new Error(`SQL dump backup failed: ${error.message}`);
        }
    }

    /**
     * Create SQLite database from SQL dump
     */
    async createSqliteFromDump(backupPath, sqlDump) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(backupPath, (err) => {
                if (err) {
                    reject(new Error(`Failed to create backup database: ${err.message}`));
                    return;
                }

                db.exec(sqlDump, (err) => {
                    if (err) {
                        reject(new Error(`Failed to execute SQL dump: ${err.message}`));
                        return;
                    }

                    db.close((err) => {
                        if (err) {
                            reject(new Error(`Failed to close backup database: ${err.message}`));
                        } else {
                            resolve();
                        }
                    });
                });
            });
        });
    }

    /**
     * Create backup from file-based database
     */
    async createFileBackup(backupPath, options = {}) {
        return new Promise((resolve, reject) => {
            const sourceDb = new sqlite3.Database(this.dbPath);
            const targetDb = new sqlite3.Database(backupPath);
            
            sourceDb.backup(targetDb, (err) => {
                sourceDb.close();
                targetDb.close();
                
                if (err) {
                    reject(new Error(`File backup failed: ${err.message}`));
                } else {
                    console.log(`📦 File backup completed: ${backupPath}`);
                    resolve();
                }
            });
        });
    }

    /**
     * Generate backup metadata
     */
    async generateBackupMetadata(backupPath, options = {}) {
        const stats = await fs.stat(backupPath);
        const data = readFileSync(backupPath);
        const checksum = createHash('sha256').update(data).digest('hex');
        
        const config = environmentConfig.getDatabaseConfig();
        
        return {
            name: options.name || 'auto-backup',
            timestamp: new Date().toISOString(),
            size: stats.size,
            checksum: checksum,
            database_type: config.type,
            database_config: {
                type: config.type,
                host: config.host || 'file',
                port: config.port || null,
                path: config.path || null
            },
            tables: await this.getTableInfo(),
            version: process.env.npm_package_version || '1.0.0'
        };
    }

    /**
     * Get table information for metadata
     */
    async getTableInfo() {
        try {
            const adapter = getDatabaseAdapter();
            if (!adapter) {
                return [];
            }

            const config = environmentConfig.getDatabaseConfig();
            
            if (config.type === 'postgresql') {
                // PostgreSQL-specific table info
                const result = await adapter.query(`
                    SELECT tablename as name, 
                           'CREATE TABLE ' || tablename || ' (...)' as sql
                    FROM pg_tables 
                    WHERE schemaname = 'public'
                `);
                
                const tables = [];
                for (const row of result.rows) {
                    const countResult = await adapter.query(`SELECT COUNT(*) as count FROM ${row.name}`);
                    tables.push({
                        name: row.name,
                        schema: row.sql,
                        row_count: parseInt(countResult.rows[0].count)
                    });
                }
                
                return tables;
            } else {
                // HTTP/Other database types
                const result = await adapter.query(getQueryTemplate('systemTables', config.type));
                
                const tables = [];
                for (const row of result.rows) {
                    const countResult = await adapter.query(`SELECT COUNT(*) as count FROM ${row.name}`);
                    tables.push({
                        name: row.name,
                        schema: row.sql,
                        row_count: parseInt(countResult.rows[0].count)
                    });
                }
                
                return tables;
            }
        } catch (error) {
            console.warn(`Could not get table info: ${error.message}`);
            return [];
        }
    }

    async restoreBackup(backupPath, options = {}) {
        if (!existsSync(backupPath)) {
            throw new Error(`Backup file not found: ${backupPath}`);
        }

        try {
            console.log(`🔄 Restoring backup: ${backupPath}...`);
            
            // Create a safety backup before restore
            if (!options.skipSafetyBackup) {
                const safetyBackupResult = await this.createBackup({ name: 'pre-restore-safety' });
                console.log(`Safety backup created before restore: ${safetyBackupResult.path}`);
            }
            
            const config = environmentConfig.getDatabaseConfig();
            
            switch (config.type) {
                case 'postgresql':
                    await this.restorePostgreSQLBackup(backupPath, options);
                    break;
                case 'http':
                    await this.restoreHttpBackup(backupPath, options);
                    break;
                case 'file':
                default:
                    await this.restoreFileBackup(backupPath, options);
                    break;
            }
            
            console.log(`✅ Backup restored successfully`);
            return true;
            
        } catch (error) {
            console.error(`❌ Restore failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Restore PostgreSQL database from backup
     */
    async restorePostgreSQLBackup(backupPath, options = {}) {
        const config = environmentConfig.getDatabaseConfig();
        const client = new Client({
            host: config.host,
            port: config.port,
            database: config.name,
            user: config.user,
            password: config.password,
            ssl: config.postgresql?.ssl || false
        });
        
        try {
            await client.connect();
            console.log('🔗 Connected to PostgreSQL for restore');
            
            // Read backup file
            const sqlDump = readFileSync(backupPath, 'utf8');
            
            // Split SQL statements
            const statements = sqlDump
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
            
            console.log(`📋 Executing ${statements.length} SQL statements...`);
            
            // Execute each statement
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                
                if (statement.trim()) {
                    try {
                        await client.query(statement);
                        if (i % 100 === 0) {
                            console.log(`   Executed ${i + 1}/${statements.length} statements`);
                        }
                    } catch (error) {
                        // Log error but continue with other statements
                        console.warn(`   Warning: Statement ${i + 1} failed: ${error.message}`);
                        console.warn(`   Statement: ${statement.substring(0, 100)}...`);
                    }
                }
            }
            
            console.log(`📦 PostgreSQL restore completed: ${backupPath}`);
            
        } catch (error) {
            throw new Error(`PostgreSQL restore failed: ${error.message}`);
        } finally {
            await client.end();
        }
    }
    
    /**
     * Restore HTTP-based database from backup
     */
    async restoreHttpBackup(backupPath, options = {}) {
        const config = environmentConfig.getDatabaseConfig();
        const baseURL = `http://${config.host}:${config.port}`;
        
        const client = axios.create({
            baseURL,
            timeout: 300000, // 5 minute timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Add authentication if configured
        if (config.user && config.password) {
            client.defaults.auth = {
                username: config.user,
                password: config.password
            };
        }

        try {
            // Try direct database restore
            const backupData = readFileSync(backupPath);
            
            await client.post('/restore', backupData, {
                headers: {
                    'Content-Type': 'application/octet-stream'
                }
            });
            
            console.log('📦 HTTP restore completed');
        } catch (error) {
            if (error.response?.status === 404) {
                // Fallback: restore using SQL approach
                await this.restoreSqlDumpBackup(backupPath, client);
            } else {
                throw new Error(`HTTP restore failed: ${error.message}`);
            }
        }
    }

    /**
     * Restore database using SQL dump approach
     */
    async restoreSqlDumpBackup(backupPath, client) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(backupPath, sqlite3.OPEN_READONLY, async (err) => {
                if (err) {
                    reject(new Error(`Failed to open backup database: ${err.message}`));
                    return;
                }

                try {
                    // Get all tables from backup
                    const config = environmentConfig.getDatabaseConfig();
                    db.all(getQueryTemplate('systemTables', 'sqlite'), async (err, tables) => {
                        if (err) {
                            reject(new Error(`Failed to get tables: ${err.message}`));
                            return;
                        }

                        try {
                            // Drop existing tables
                            for (const table of tables) {
                                await client.post('/exec', {
                                    sql: `DROP TABLE IF EXISTS ${table.name}`
                                });
                            }

                            // Recreate tables and restore data
                            for (const table of tables) {
                                // Get table schema
                                db.get(getQueryTemplate('systemTablesByName', 'sqlite'), [table.name], async (err, schema) => {
                                    if (err) {
                                        reject(new Error(`Failed to get schema for ${table.name}: ${err.message}`));
                                        return;
                                    }

                                    try {
                                        // Create table
                                        await client.post('/exec', {
                                            sql: schema.sql
                                        });

                                        // Restore data
                                        db.all(`SELECT * FROM ${table.name}`, async (err, rows) => {
                                            if (err) {
                                                reject(new Error(`Failed to get data from ${table.name}: ${err.message}`));
                                                return;
                                            }

                                            if (rows.length > 0) {
                                                const columns = Object.keys(rows[0]);
                                                const placeholders = columns.map(() => '?').join(', ');
                                                const sql = `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${placeholders})`;

                                                for (const row of rows) {
                                                    const values = columns.map(col => row[col]);
                                                    await client.post('/query', {
                                                        sql: sql,
                                                        params: values
                                                    });
                                                }
                                            }
                                        });
                                    } catch (error) {
                                        reject(new Error(`Failed to restore table ${table.name}: ${error.message}`));
                                    }
                                });
                            }

                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    });
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Restore file-based database from backup
     */
    async restoreFileBackup(backupPath, options = {}) {
        return new Promise((resolve, reject) => {
            const sourceDb = new sqlite3.Database(backupPath);
            const targetDb = new sqlite3.Database(this.dbPath);
            
            sourceDb.backup(targetDb, (err) => {
                sourceDb.close();
                targetDb.close();
                
                if (err) {
                    reject(new Error(`File restore failed: ${err.message}`));
                } else {
                    console.log(`📦 File restore completed: ${backupPath}`);
                    resolve();
                }
            });
        });
    }

    async listBackups() {
        await this.ensureBackupDirectory();
        
        try {
            const files = await fs.readdir(this.backupDir);
            const backups = [];
            
            for (const file of files) {
                if (file.endsWith('.db') || file.endsWith('.sql')) {
                    const backupPath = join(this.backupDir, file);
                    const metadataPath = join(this.backupDir, file.replace(/\.(db|sql)$/, '.meta.json'));
                    
                    let metadata = {};
                    if (existsSync(metadataPath)) {
                        try {
                            metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
                        } catch (error) {
                            console.warn(`Could not read metadata for ${file}: ${error.message}`);
                        }
                    }
                    
                    const stats = await fs.stat(backupPath);
                    backups.push({
                        filename: file,
                        path: backupPath,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        metadata: metadata
                    });
                }
            }
            
            // Sort by creation time (newest first)
            backups.sort((a, b) => b.created - a.created);
            
            return backups;
        } catch (error) {
            console.error('Error listing backups:', error);
            return [];
        }
    }

    async cleanupOldBackups() {
        const backups = await this.listBackups();
        
        if (backups.length > this.maxBackups) {
            const toDelete = backups.slice(this.maxBackups);
            
            console.log(`🧹 Cleaning up ${toDelete.length} old backups...`);
            
            for (const backup of toDelete) {
                try {
                    await this.deleteBackup(backup.path);
                } catch (error) {
                    console.error(`Failed to delete backup ${backup.filename}:`, error);
                }
            }
        }
    }

    /**
     * Delete backup file
     */
    async deleteBackup(backupPath) {
        if (!existsSync(backupPath)) {
            throw new Error(`Backup file not found: ${backupPath}`);
        }

        try {
            await fs.unlink(backupPath);
            
            // Also delete metadata file if it exists
            const metadataPath = backupPath.replace(/\.(db|sql)$/, '.meta.json');
            if (existsSync(metadataPath)) {
                await fs.unlink(metadataPath);
            }
            
            console.log(`🗑️  Backup deleted: ${backupPath}`);
            return true;
        } catch (error) {
            throw new Error(`Failed to delete backup: ${error.message}`);
        }
    }

    /**
     * Verify backup integrity
     */
    async verifyBackup(backupPath) {
        if (!existsSync(backupPath)) {
            throw new Error(`Backup file not found: ${backupPath}`);
        }

        try {
            const metadataPath = backupPath.replace(/\.(db|sql)$/, '.meta.json');
            
            if (!existsSync(metadataPath)) {
                throw new Error(`Backup metadata not found: ${metadataPath}`);
            }

            const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
            const backupData = readFileSync(backupPath);
            const currentChecksum = createHash('sha256').update(backupData).digest('hex');

            if (currentChecksum !== metadata.checksum) {
                throw new Error(`Backup integrity check failed: checksum mismatch`);
            }

            // Verify backup content based on database type
            if (backupPath.endsWith('.sql')) {
                // PostgreSQL SQL dump verification
                const sqlContent = backupData.toString('utf8');
                const tableCount = (sqlContent.match(/CREATE TABLE/g) || []).length;
                
                return {
                    valid: true,
                    checksum: currentChecksum,
                    tables: tableCount,
                    metadata: metadata
                };
            } else {
                // SQLite database verification
                return new Promise((resolve, reject) => {
                    const db = new sqlite3.Database(backupPath, sqlite3.OPEN_READONLY, (err) => {
                        if (err) {
                            reject(new Error(`Cannot open backup database: ${err.message}`));
                            return;
                        }

                        // Test basic queries
                        db.get(getQueryTemplate('systemTableCount', 'sqlite'), (err, row) => {
                            db.close();
                            
                            if (err) {
                                reject(new Error(`Backup database query failed: ${err.message}`));
                            } else {
                                resolve({
                                    valid: true,
                                    checksum: currentChecksum,
                                    tables: row.count,
                                    metadata: metadata
                                });
                            }
                        });
                    });
                });
            }
        } catch (error) {
            throw new Error(`Backup verification failed: ${error.message}`);
        }
    }

    async verifyDatabaseIntegrity(dbPath = this.dbPath) {
        try {
            const config = environmentConfig.getDatabaseConfig();
            
            switch (config.type) {
                case 'postgresql':
                    return await this.verifyPostgreSQLIntegrity();
                case 'http':
                    // For HTTP connections, use the adapter for basic connectivity check
                    const adapter = getDatabaseAdapter();
                    const result = await adapter.query('SELECT 1 as test');
                    
                    if (result.rows[0]?.test === 1) {
                        return true;
                    } else {
                        throw new Error(`Database connectivity test failed`);
                    }
                case 'file':
                default:
                    // For PostgreSQL, use the standard integrity check
                    return await this.verifyPostgreSQLIntegrity();
            }
        } catch (error) {
            throw new Error(`Database integrity verification failed: ${error.message}`);
        }
    }
    
    /**
     * Verify PostgreSQL database integrity
     */
    async verifyPostgreSQLIntegrity() {
        const config = environmentConfig.getDatabaseConfig();
        const client = new Client({
            host: config.host,
            port: config.port,
            database: config.name,
            user: config.user,
            password: config.password,
            ssl: config.postgresql?.ssl || false
        });
        
        try {
            await client.connect();
            
            // Check database connection
            const connectionResult = await client.query('SELECT 1 as connected');
            if (!connectionResult.rows[0]?.connected) {
                throw new Error('Database connection failed');
            }
            
            // Check table existence
            const tablesResult = await client.query(`
                SELECT COUNT(*) as table_count 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            `);
            
            const tableCount = parseInt(tablesResult.rows[0].table_count);
            if (tableCount === 0) {
                throw new Error('No tables found in database');
            }
            
            // Check for basic table structure
            const expectedTables = ['properties', 'tenants', 'utility_entries', 'tenant_utility_allocations'];
            for (const tableName of expectedTables) {
                const tableResult = await client.query(`
                    SELECT COUNT(*) as exists 
                    FROM information_schema.tables 
                    WHERE table_name = $1 AND table_schema = 'public'
                `, [tableName]);
                
                if (parseInt(tableResult.rows[0].exists) === 0) {
                    throw new Error(`Required table '${tableName}' not found`);
                }
            }
            
            console.log(`✅ PostgreSQL integrity check passed: ${tableCount} tables found`);
            return true;
            
        } catch (error) {
            throw new Error(`PostgreSQL integrity check failed: ${error.message}`);
        } finally {
            await client.end();
        }
    }

    async getBackupInfo() {
        const backups = await this.listBackups();
        const backupInfo = [];
        
        for (const backup of backups) {
            try {
                const verification = await this.verifyBackup(backup.path);
                
                backupInfo.push({
                    filename: backup.filename,
                    path: backup.path,
                    size: backup.size,
                    created: backup.created,
                    modified: backup.modified,
                    metadata: backup.metadata,
                    checksum: verification.checksum,
                    tables: verification.tables,
                    valid: verification.valid
                });
            } catch (error) {
                backupInfo.push({
                    filename: backup.filename,
                    path: backup.path,
                    size: backup.size,
                    created: backup.created,
                    modified: backup.modified,
                    metadata: backup.metadata,
                    error: error.message,
                    valid: false
                });
            }
        }
        
        return backupInfo;
    }

    async fileExists(path) {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    // Schedule automatic backups
    startAutomaticBackups(intervalHours = 24) {
        const intervalMs = intervalHours * 60 * 60 * 1000;
        
        console.log(`⏰ Starting automatic backups every ${intervalHours} hours`);
        
        const backupInterval = setInterval(async () => {
            try {
                console.log('🔄 Running scheduled backup...');
                await this.createBackup({ name: 'scheduled-backup' });
                await this.cleanupOldBackups();
                console.log('✅ Scheduled backup completed');
            } catch (error) {
                console.error(`❌ Scheduled backup failed: ${error.message}`);
            }
        }, intervalMs);

        // Create initial backup
        this.createBackup({ name: 'initial-backup' }).catch(console.error);
        
        // Return function to stop scheduling
        return () => {
            clearInterval(backupInterval);
            console.log('⏹️  Automatic backup scheduling stopped');
        };
    }
}

export default new BackupService();