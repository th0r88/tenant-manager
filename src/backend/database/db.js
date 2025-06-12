import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new sqlite3.Database('tenant_manager.db');

export function initializeDatabase() {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    
    return new Promise((resolve, reject) => {
        db.exec(schema, (error) => {
            if (error) {
                reject(error);
            } else {
                console.log('Database initialized successfully');
                // Run migration for existing installations
                runMigration().then(resolve).catch(reject);
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

export default db;