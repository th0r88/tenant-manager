import Database from 'better-sqlite3';
import pkg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool, Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Database adapter for multiple database types
 * Supports SQLite (file-based), HTTP-based databases, and PostgreSQL
 */
export default class DatabaseAdapter {
    constructor(config) {
        this.config = config;
        this.connection = null;
        this.type = config.type || 'file';
        this.retryAttempts = 0;
        this.maxRetries = config.retries || 3;
        this.retryDelay = config.retryDelay || 1000;
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 5;
        this.healthCheckInterval = null;
        this.errorHandlers = new Map();
    }

    /**
     * Initialize connection based on database type
     */
    async initializeConnection() {
        switch (this.type) {
            case 'postgresql':
                await this.initializePostgreSQL();
                break;
            case 'http':
                await this.initializeHTTP();
                break;
            case 'file':
            default:
                await this.initializeSQLite();
                break;
        }
    }

    /**
     * Initialize PostgreSQL connection with enhanced error handling and retry logic
     */
    async initializePostgreSQL() {
        console.log('Initializing PostgreSQL connection...');
        
        const poolConfig = {
            user: this.config.user,
            host: this.config.host,
            database: this.config.name,
            password: this.config.password,
            port: this.config.port,
            max: this.config.pool?.max || 10,
            min: this.config.pool?.min || 2,
            idleTimeoutMillis: this.config.pool?.idle || 30000,
            connectionTimeoutMillis: this.config.timeout || 30000,
            statement_timeout: this.config.postgresql?.statement_timeout || 30000,
            query_timeout: this.config.postgresql?.query_timeout || 30000,
            ssl: this.config.postgresql?.ssl || false,
            application_name: 'tenant-manager',
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000
        };

        this.connection = new Pool(poolConfig);
        
        // Setup connection pool event handlers
        this.setupPoolEventHandlers();
        
        // Test connection with retry logic
        await this.testConnectionWithRetry();
        
        // Setup periodic health checks
        this.setupHealthCheckInterval();
        
        this.isConnected = true;
        console.log('PostgreSQL connection pool initialized successfully');
    }
    
    /**
     * Setup connection pool event handlers
     */
    setupPoolEventHandlers() {
        this.connection.on('connect', (client) => {
            console.log('New PostgreSQL client connected');
        });
        
        this.connection.on('acquire', (client) => {
            console.log('PostgreSQL client acquired from pool');
        });
        
        this.connection.on('release', (client) => {
            console.log('PostgreSQL client released back to pool');
        });
        
        this.connection.on('error', (error, client) => {
            console.error('PostgreSQL pool error:', error);
            this.handleConnectionError(error);
        });
        
        this.connection.on('remove', (client) => {
            console.log('PostgreSQL client removed from pool');
        });
    }
    
    /**
     * Test connection with retry logic
     */
    async testConnectionWithRetry() {
        const maxAttempts = this.maxConnectionAttempts;
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const client = await this.connection.connect();
                console.log(`PostgreSQL connection test successful (attempt ${attempt}/${maxAttempts})`);
                client.release();
                return;
            } catch (error) {
                lastError = error;
                console.error(`PostgreSQL connection test failed (attempt ${attempt}/${maxAttempts}):`, error.message);
                
                if (attempt < maxAttempts) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                    console.log(`Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                } else {
                    console.error('All connection attempts failed');
                    throw new Error(`PostgreSQL connection failed after ${maxAttempts} attempts: ${lastError.message}`);
                }
            }
        }
    }
    
    /**
     * Setup periodic health checks
     */
    setupHealthCheckInterval() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.healthCheck();
            } catch (error) {
                console.error('Health check failed:', error);
                this.handleConnectionError(error);
            }
        }, 30000); // Check every 30 seconds
    }
    
    /**
     * Handle connection errors
     */
    handleConnectionError(error) {
        console.error('Database connection error:', error);
        
        // Map PostgreSQL error codes to user-friendly messages
        const errorMessages = {
            'ECONNREFUSED': 'Database connection refused. Please check if PostgreSQL is running.',
            'ENOTFOUND': 'Database host not found. Please check the hostname.',
            'ECONNRESET': 'Database connection was reset. Retrying...',
            'ETIMEDOUT': 'Database connection timed out. Please check network connectivity.',
            '28P01': 'Database authentication failed. Please check username and password.',
            '3D000': 'Database does not exist. Please check the database name.',
            '42P01': 'Table does not exist. Please check the database schema.',
            '23505': 'Duplicate key violation. The data already exists.',
            '23503': 'Foreign key violation. Referenced record does not exist.',
            '23502': 'Not null violation. Required field is missing.',
            '23514': 'Check constraint violation. Invalid data provided.'
        };
        
        const errorCode = error.code || error.errno || 'UNKNOWN';
        const friendlyMessage = errorMessages[errorCode] || `Database error: ${error.message}`;
        
        // Store error for potential retry
        this.lastError = {
            original: error,
            code: errorCode,
            message: friendlyMessage,
            timestamp: new Date()
        };
        
        // Execute registered error handlers
        this.errorHandlers.forEach((handler, name) => {
            try {
                handler(error, friendlyMessage);
            } catch (handlerError) {
                console.error(`Error in error handler ${name}:`, handlerError);
            }
        });
    }
    
    /**
     * Sleep utility for retry logic
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Initialize SQLite connection using better-sqlite3
     */
    async initializeSQLite() {
        console.log('Initializing SQLite connection...');

        try {
            this.connection = new Database(this.config.path);
            this.connection.pragma('foreign_keys = ON');
            this.connection.pragma('encoding = "UTF-8"');
            this.connection.pragma('journal_mode = WAL');
            console.log('SQLite database opened successfully');
            console.log('SQLite pragma settings applied');
        } catch (err) {
            console.error('Error opening SQLite database:', err);
            throw err;
        }
    }

    /**
     * Initialize HTTP connection (placeholder)
     */
    async initializeHTTP() {
        console.log('Initializing HTTP-based database connection...');
        // HTTP implementation would go here
        throw new Error('HTTP database adapter not implemented yet');
    }

    /**
     * Initialize database schema
     */
    async initializeSchema() {
        let schemaFile;
        switch (this.type) {
            case 'postgresql':
                schemaFile = 'init-postgres.sql';
                break;
            case 'http':
                schemaFile = 'schema.sql';
                break;
            case 'file':
            default:
                schemaFile = 'schema.sql';
                break;
        }
        
        const schema = readFileSync(join(__dirname, schemaFile), 'utf8');
        return await this.exec(schema);
    }

    /**
     * Apply database migrations
     */
    async applyMigrations() {
        try {
            let migrationFile;
            switch (this.type) {
                case 'postgresql':
                    migrationFile = 'migration-postgres.sql';
                    break;
                case 'http':
                    migrationFile = 'migration.sql';
                    break;
                case 'file':
                default:
                    migrationFile = 'migration.sql';
                    break;
            }
            
            const migration = readFileSync(join(__dirname, migrationFile), 'utf8');
            await this.exec(migration);
            console.log('Migration completed successfully');

            // SQLite: recreate utility_entries if CHECK constraint is outdated
            if (this.type === 'file') {
                await this.migrateSqliteUtilityEntries();
            }
        } catch (error) {
            console.log('Migration skipped (likely new installation):', error.message);
        }
    }

    /**
     * SQLite-specific: recreate utility_entries table to update CHECK constraint
     * SQLite cannot ALTER CHECK constraints, so we must recreate the table
     */
    async migrateSqliteUtilityEntries() {
        try {
            // Test if per_apartment is allowed by the current CHECK constraint
            await this.query(
                "INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) VALUES (0, 0, 0, '__check_test__', 0, 'per_apartment')",
                []
            );
            // If it succeeded, delete the test row and we're done
            await this.query("DELETE FROM utility_entries WHERE utility_type = '__check_test__'", []);
        } catch (e) {
            if (e.message && e.message.includes('CHECK')) {
                console.log('Recreating utility_entries table to update CHECK constraint...');
                const statements = [
                    `CREATE TABLE utility_entries_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        property_id INTEGER NOT NULL DEFAULT 1,
                        month INTEGER NOT NULL,
                        year INTEGER NOT NULL,
                        utility_type TEXT NOT NULL,
                        total_amount REAL NOT NULL,
                        allocation_method TEXT NOT NULL CHECK (allocation_method IN ('per_person', 'per_sqm', 'per_person_weighted', 'per_sqm_weighted', 'direct', 'per_apartment')),
                        assigned_tenant_id INTEGER REFERENCES tenants (id) ON DELETE SET NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
                    )`,
                    `INSERT INTO utility_entries_new SELECT id, property_id, month, year, utility_type, total_amount, allocation_method, assigned_tenant_id, created_at FROM utility_entries`,
                    `DROP TABLE utility_entries`,
                    `ALTER TABLE utility_entries_new RENAME TO utility_entries`,
                    `CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_utility_entry ON utility_entries (property_id, month, year, utility_type) WHERE assigned_tenant_id IS NULL`
                ];
                for (const sql of statements) {
                    await this.exec(sql);
                }
                console.log('utility_entries table recreated with updated CHECK constraint');
            }
        }
    }

    /**
     * Apply database constraints
     */
    async applyConstraints() {
        try {
            let constraintsFile;
            switch (this.type) {
                case 'postgresql':
                    constraintsFile = 'constraints-postgres.sql';
                    break;
                case 'http':
                    constraintsFile = 'constraints.sql';
                    break;
                case 'file':
                default:
                    constraintsFile = 'constraints.sql';
                    break;
            }
            
            const constraints = readFileSync(join(__dirname, constraintsFile), 'utf8');
            await this.exec(constraints);
            console.log('Database constraints applied successfully');
        } catch (error) {
            console.log('Some constraints skipped (may already exist):', error.message);
        }
    }

    /**
     * Apply database indexes for performance optimization
     */
    async applyIndexes() {
        try {
            let indexesFile;
            switch (this.type) {
                case 'postgresql':
                    indexesFile = 'indexes-postgres.sql';
                    break;
                case 'http':
                    indexesFile = 'indexes.sql';
                    break;
                case 'file':
                default:
                    indexesFile = 'indexes.sql';
                    break;
            }
            
            const indexes = readFileSync(join(__dirname, indexesFile), 'utf8');
            await this.exec(indexes);
            console.log('Database indexes applied successfully');
        } catch (error) {
            console.log('Some indexes skipped (may already exist):', error.message);
        }
    }

    /**
     * Execute SQL query
     */
    async query(sql, params = []) {
        switch (this.type) {
            case 'postgresql':
                return await this.postgresQuery(sql, params);
            case 'http':
                return await this.httpQuery(sql, params);
            case 'file':
            default:
                return await this.sqliteQuery(sql, params);
        }
    }

    /**
     * Execute PostgreSQL query with enhanced error handling and retry logic
     */
    async postgresQuery(sql, params = []) {
        const maxAttempts = this.maxRetries;
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const client = await this.connection.connect();
                try {
                    const result = await client.query(sql, params);
                    return {
                        rows: result.rows,
                        rowCount: result.rowCount,
                        changes: result.rowCount,
                        lastID: result.rows[0]?.id || null
                    };
                } finally {
                    client.release();
                }
            } catch (error) {
                lastError = error;
                this.handleConnectionError(error);
                
                // Check if error is retryable
                if (this.isRetryableError(error) && attempt < maxAttempts) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    console.log(`Query failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`);
                    await this.sleep(delay);
                    continue;
                }
                
                // Transform error to user-friendly format
                const enhancedError = this.enhanceError(error, sql, params);
                throw enhancedError;
            }
        }
        
        throw new Error(`Query failed after ${maxAttempts} attempts: ${lastError.message}`);
    }
    
    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        const retryableErrors = [
            'ECONNRESET',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'EHOSTUNREACH',
            'ENETUNREACH',
            'EAI_AGAIN',
            'EADDRNOTAVAIL'
        ];
        
        const retryableCodes = [
            '53300', // Too many connections
            '53400', // Configuration limit exceeded
            '57P01', // Admin shutdown
            '57P02', // Crash shutdown
            '57P03', // Cannot connect now
            '58000', // System error
            '58030', // IO error
            'XX000', // Internal error
            'XX001', // Data corrupted
            'XX002'  // Index corrupted
        ];
        
        return retryableErrors.includes(error.code) || 
               retryableErrors.includes(error.errno) ||
               retryableCodes.includes(error.code);
    }
    
    /**
     * Enhance error with context information
     */
    enhanceError(error, sql, params) {
        const enhancedError = new Error(this.lastError?.message || error.message);
        enhancedError.originalError = error;
        enhancedError.sql = sql;
        enhancedError.params = params;
        enhancedError.code = error.code;
        enhancedError.sqlState = error.sqlState;
        enhancedError.constraint = error.constraint;
        enhancedError.table = error.table;
        enhancedError.column = error.column;
        enhancedError.dataType = error.dataType;
        enhancedError.timestamp = new Date();
        
        return enhancedError;
    }

    /**
     * Convert PostgreSQL-style $1, $2 placeholders to SQLite ? placeholders
     * and expand params array to match repeated references
     */
    convertQuery(sql, params) {
        const expandedParams = [];
        const convertedSql = sql.replace(/\$(\d+)/g, (match, num) => {
            expandedParams.push(params[parseInt(num) - 1]);
            return '?';
        });
        return { sql: convertedSql, params: expandedParams };
    }

    /**
     * Execute SQLite query using better-sqlite3 (synchronous)
     */
    async sqliteQuery(sql, params = []) {
        try {
            const converted = this.convertQuery(sql, params);
            const stmt = this.connection.prepare(converted.sql);
            // Determine if it's a SELECT/RETURNING or a write operation
            const sqlTrimmed = sql.trimStart().toUpperCase();
            if (sqlTrimmed.startsWith('SELECT') || sqlTrimmed.startsWith('PRAGMA') || sql.toUpperCase().includes('RETURNING')) {
                const rows = stmt.all(...converted.params);
                return {
                    rows: rows || [],
                    rowCount: rows?.length || 0,
                    changes: 0,
                    lastID: null
                };
            } else {
                const result = stmt.run(...converted.params);
                return {
                    rows: [],
                    rowCount: result.changes,
                    changes: result.changes,
                    lastID: result.lastInsertRowid
                };
            }
        } catch (err) {
            throw err;
        }
    }

    /**
     * Execute HTTP query (placeholder)
     */
    async httpQuery(sql, params = []) {
        throw new Error('HTTP query not implemented yet');
    }

    /**
     * Execute SQL without returning results
     */
    async exec(sql) {
        switch (this.type) {
            case 'postgresql':
                return await this.postgresExec(sql);
            case 'http':
                return await this.httpExec(sql);
            case 'file':
            default:
                return await this.sqliteExec(sql);
        }
    }

    /**
     * Execute PostgreSQL exec
     */
    async postgresExec(sql) {
        try {
            const client = await this.connection.connect();
            try {
                await client.query(sql);
                return true;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('PostgreSQL exec error:', error);
            throw error;
        }
    }

    /**
     * Execute SQLite exec using better-sqlite3 (synchronous)
     */
    async sqliteExec(sql) {
        try {
            this.connection.exec(this.convertQuery(sql, []).sql);
            return true;
        } catch (err) {
            throw err;
        }
    }

    /**
     * Execute HTTP exec (placeholder)
     */
    async httpExec(sql) {
        throw new Error('HTTP exec not implemented yet');
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            switch (this.type) {
                case 'postgresql':
                    const result = await this.query('SELECT 1 as health');
                    return result.rows[0]?.health === 1;
                case 'http':
                    // HTTP health check implementation
                    return true;
                case 'file':
                default:
                    const sqliteResult = await this.query('SELECT 1 as health');
                    return sqliteResult.rows[0]?.health === 1;
            }
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }

    /**
     * Get connection info
     */
    getConnectionInfo() {
        return {
            type: this.type,
            config: {
                host: this.config.host,
                port: this.config.port,
                database: this.config.name,
                user: this.config.user
            }
        };
    }

    /**
     * Close connection
     */
    async close() {
        if (this.connection) {
            switch (this.type) {
                case 'postgresql':
                    await this.connection.end();
                    break;
                case 'http':
                    // HTTP cleanup
                    break;
                case 'file':
                default:
                    try {
                        this.connection.close();
                    } catch (err) {
                        console.error('Error closing SQLite database:', err);
                    }
                    return;
            }
        }
    }
}