import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class BackupService {
    constructor() {
        this.dbPath = 'tenant_manager.db';
        this.backupDir = join(process.cwd(), 'backups');
        this.maxBackups = 30; // Keep 30 days of backups
    }

    async ensureBackupDirectory() {
        try {
            await fs.access(this.backupDir);
        } catch {
            await fs.mkdir(this.backupDir, { recursive: true });
        }
    }

    async createBackup() {
        await this.ensureBackupDirectory();
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = join(this.backupDir, `tenant_manager_${timestamp}.db`);
        
        return new Promise((resolve, reject) => {
            const sourceDb = new sqlite3.Database(this.dbPath);
            const targetDb = new sqlite3.Database(backupPath);
            
            sourceDb.backup(targetDb, (err) => {
                sourceDb.close();
                targetDb.close();
                
                if (err) {
                    reject(new Error(`Backup failed: ${err.message}`));
                } else {
                    console.log(`Database backup created: ${backupPath}`);
                    resolve(backupPath);
                }
            });
        });
    }

    async restoreBackup(backupPath) {
        if (!await this.fileExists(backupPath)) {
            throw new Error(`Backup file not found: ${backupPath}`);
        }

        // Create a safety backup before restore
        const safetyBackupPath = await this.createBackup();
        console.log(`Safety backup created before restore: ${safetyBackupPath}`);

        return new Promise((resolve, reject) => {
            const sourceDb = new sqlite3.Database(backupPath);
            const targetDb = new sqlite3.Database(this.dbPath);
            
            sourceDb.backup(targetDb, (err) => {
                sourceDb.close();
                targetDb.close();
                
                if (err) {
                    reject(new Error(`Restore failed: ${err.message}`));
                } else {
                    console.log(`Database restored from: ${backupPath}`);
                    resolve();
                }
            });
        });
    }

    async listBackups() {
        await this.ensureBackupDirectory();
        
        try {
            const files = await fs.readdir(this.backupDir);
            const backups = files
                .filter(file => file.startsWith('tenant_manager_') && file.endsWith('.db'))
                .map(file => join(this.backupDir, file))
                .sort()
                .reverse(); // Most recent first
                
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
            
            for (const backup of toDelete) {
                try {
                    await fs.unlink(backup);
                    console.log(`Cleaned up old backup: ${backup}`);
                } catch (error) {
                    console.error(`Failed to delete backup ${backup}:`, error);
                }
            }
        }
    }

    async verifyDatabaseIntegrity(dbPath = this.dbPath) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);
            
            db.all('PRAGMA integrity_check', (err, rows) => {
                db.close();
                
                if (err) {
                    reject(new Error(`Integrity check failed: ${err.message}`));
                } else {
                    const result = rows[0];
                    if (result && result.integrity_check === 'ok') {
                        resolve(true);
                    } else {
                        reject(new Error(`Database integrity issues found: ${JSON.stringify(rows)}`));
                    }
                }
            });
        });
    }

    async getBackupInfo() {
        const backups = await this.listBackups();
        const backupInfo = [];
        
        for (const backup of backups) {
            try {
                const stats = await fs.stat(backup);
                await this.verifyDatabaseIntegrity(backup);
                
                backupInfo.push({
                    path: backup,
                    size: stats.size,
                    created: stats.birthtime,
                    valid: true
                });
            } catch (error) {
                backupInfo.push({
                    path: backup,
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
        console.log(`Starting automatic backups every ${intervalHours} hours`);
        
        const backupInterval = setInterval(async () => {
            try {
                await this.createBackup();
                await this.cleanupOldBackups();
            } catch (error) {
                console.error('Automatic backup failed:', error);
            }
        }, intervalHours * 60 * 60 * 1000);

        // Create initial backup
        this.createBackup().catch(console.error);
        
        return backupInterval;
    }
}

export default new BackupService();