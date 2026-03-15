import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import DatabaseAdapter from './adapter.js';
import environmentConfig from '../config/environment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database instance - uses adapter pattern
let dbAdapter = null;
let legacyDb = null;

// Initialize database adapter based on configuration
async function initializeAdapter() {
    const config = environmentConfig.getDatabaseConfig();
    
    if (config.type === 'postgresql') {
        console.log('Initializing PostgreSQL database connection...');
        dbAdapter = new DatabaseAdapter(config);
    } else if (config.type === 'http') {
        console.log('Initializing HTTP-based database connection...');
        dbAdapter = new DatabaseAdapter(config);
    } else {
        console.log('Initializing file-based database connection...');
        // For backward compatibility, also initialize legacy connection
        initializeLegacyConnection();
        dbAdapter = new DatabaseAdapter(config);
    }
    
    await dbAdapter.initializeConnection();
    return dbAdapter;
}

// Legacy file-based connection for backward compatibility
function initializeLegacyConnection() {
    const config = environmentConfig.getDatabaseConfig();
    try {
        legacyDb = new Database(config.path);
        legacyDb.pragma('foreign_keys = ON');
        legacyDb.pragma('encoding = "UTF-8"');
        console.log('Legacy database opened successfully');
        console.log('Legacy database pragma settings applied');
    } catch (err) {
        console.error('Error opening legacy database:', err);
    }
}

// Initialize database with unified interface
export async function initializeDatabase() {
    try {
        // Initialize adapter
        if (!dbAdapter) {
            await initializeAdapter();
        }
        
        // Initialize schema using adapter
        await dbAdapter.initializeSchema();
        console.log('Database initialized successfully');
        
        // Run migration for existing installations
        await dbAdapter.applyMigrations();
        
        // Apply constraints
        await dbAdapter.applyConstraints();
        
        return true;
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
}

// Legacy migration function for backward compatibility
function runMigration() {
    const migration = readFileSync(join(__dirname, 'migration.sql'), 'utf8');
    if (legacyDb) {
        try {
            legacyDb.exec(migration);
            console.log('Migration completed successfully');
        } catch (error) {
            console.log('Migration skipped (likely new installation)');
        }
    }
}

// Legacy constraints function for backward compatibility
function applyConstraints() {
    const constraints = readFileSync(join(__dirname, 'constraints.sql'), 'utf8');
    if (legacyDb) {
        try {
            legacyDb.exec(constraints);
            console.log('Database constraints applied successfully');
        } catch (error) {
            console.log('Some constraints skipped (may already exist)');
        }
    }
}

// Database query wrapper with adapter pattern
export async function query(sql, params = []) {
    if (!dbAdapter) {
        await initializeAdapter();
    }
    return await dbAdapter.query(sql, params);
}

// Database exec wrapper with adapter pattern
export async function exec(sql) {
    if (!dbAdapter) {
        await initializeAdapter();
    }
    return await dbAdapter.exec(sql);
}

// Health check wrapper
export async function healthCheck() {
    if (!dbAdapter) {
        await initializeAdapter();
    }
    return await dbAdapter.healthCheck();
}

// Get connection info for debugging
export function getConnectionInfo() {
    return dbAdapter ? dbAdapter.getConnectionInfo() : { type: 'none', config: {} };
}

// Close database connections
export async function closeDatabase() {
    if (dbAdapter) {
        await dbAdapter.close();
    }
    if (legacyDb) {
        try {
            legacyDb.close();
            console.log('Legacy database closed');
        } catch (err) {
            console.error('Error closing legacy database:', err);
        }
    }
}

// Export adapter instance for advanced usage
export function getDatabaseAdapter() {
    return dbAdapter;
}

// Export legacy db for backward compatibility (deprecated)
export const db = legacyDb;

// Default export maintains backward compatibility
export default {
    // Legacy interface (better-sqlite3 is synchronous, but we keep callback pattern for compat)
    all: (sql, params, callback) => {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        if (legacyDb) {
            try {
                const rows = legacyDb.prepare(sql).all(...(params || []));
                if (callback) callback(null, rows);
            } catch (err) {
                if (callback) callback(err);
            }
        } else {
            query(sql, params)
                .then(result => { if (callback) callback(null, result.rows); })
                .catch(err => { if (callback) callback(err); });
        }
    },

    get: (sql, params, callback) => {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        if (legacyDb) {
            try {
                const row = legacyDb.prepare(sql).get(...(params || []));
                if (callback) callback(null, row);
            } catch (err) {
                if (callback) callback(err);
            }
        } else {
            query(sql, params)
                .then(result => { if (callback) callback(null, result.rows[0]); })
                .catch(err => { if (callback) callback(err); });
        }
    },

    run: (sql, params, callback) => {
        if (legacyDb) {
            try {
                const result = legacyDb.prepare(sql).run(...(params || []));
                if (callback) callback.call({ changes: result.changes, lastID: result.lastInsertRowid }, null);
            } catch (err) {
                if (callback) callback(err);
            }
        } else {
            query(sql, params)
                .then(result => { if (callback) callback.call({ changes: result.changes, lastID: result.lastID }, null); })
                .catch(err => { if (callback) callback(err); });
        }
    },

    exec: (sql, callback) => {
        if (legacyDb) {
            try {
                legacyDb.exec(sql);
                if (callback) callback(null);
            } catch (err) {
                if (callback) callback(err);
            }
        } else {
            exec(sql)
                .then(() => { if (callback) callback(null); })
                .catch(err => { if (callback) callback(err); });
        }
    },
    
    // New adapter interface
    query,
    exec,
    healthCheck,
    getConnectionInfo,
    closeDatabase,
    getDatabaseAdapter
};