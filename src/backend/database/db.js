import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Enable verbose mode for debugging
sqlite3.verbose();

const db = new sqlite3.Database('tenant_manager.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Database opened successfully');
        // Enable foreign keys and set encoding immediately after opening
        db.exec('PRAGMA foreign_keys = ON; PRAGMA encoding = "UTF-8";', (err) => {
            if (err) {
                console.error('Error setting pragma:', err);
            } else {
                console.log('Database pragma settings applied');
            }
        });
    }
});

export function initializeDatabase() {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    
    return new Promise((resolve, reject) => {
        db.exec(schema, (error) => {
            if (error) {
                reject(error);
            } else {
                console.log('Database initialized successfully');
                // Run migration for existing installations
                runMigration()
                    .then(() => applyConstraints())
                    .then(resolve)
                    .catch(reject);
            }
        });
    });
}

function runMigration() {
    const migration = readFileSync(join(__dirname, 'migration.sql'), 'utf8');
    
    return new Promise((resolve, reject) => {
        db.exec(migration, (error) => {
            if (error) {
                console.log('Migration skipped (likely new installation)');
                resolve(); // Don't fail on migration errors for new installations
            } else {
                console.log('Migration completed successfully');
                resolve();
            }
        });
    });
}

function applyConstraints() {
    const constraints = readFileSync(join(__dirname, 'constraints.sql'), 'utf8');
    
    return new Promise((resolve, reject) => {
        db.exec(constraints, (error) => {
            if (error) {
                console.log('Some constraints skipped (may already exist)');
                resolve(); // Don't fail on constraint errors
            } else {
                console.log('Database constraints applied successfully');
                resolve();
            }
        });
    });
}

export default db;