#!/usr/bin/env node

import backupService from '../services/backupService.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function showHelp() {
    console.log(`
Database Backup Utility

Usage:
  node backupCli.js backup               - Create a backup
  node backupCli.js restore <file>       - Restore from backup file
  node backupCli.js list                 - List available backups
  node backupCli.js cleanup              - Clean up old backups
  node backupCli.js verify               - Verify database integrity
  node backupCli.js info                 - Show backup information

Examples:
  node backupCli.js backup
  node backupCli.js restore ./backups/tenant_manager_2024-01-15T10-30-00-000Z.db
  node backupCli.js list
`);
}

async function handleCommand() {
    const command = process.argv[2];
    
    try {
        switch (command) {
            case 'backup':
                console.log('Creating database backup...');
                const backupPath = await backupService.createBackup();
                console.log(`✅ Backup created successfully: ${backupPath}`);
                break;
                
            case 'restore':
                const restoreFile = process.argv[3];
                if (!restoreFile) {
                    console.error('❌ Please specify backup file to restore from');
                    console.log('Usage: node backupCli.js restore <backup-file>');
                    process.exit(1);
                }
                
                console.log(`Restoring database from: ${restoreFile}`);
                await backupService.restoreBackup(restoreFile);
                console.log('✅ Database restored successfully');
                break;
                
            case 'list':
                console.log('Available backups:');
                const backups = await backupService.listBackups();
                if (backups.length === 0) {
                    console.log('No backups found.');
                } else {
                    backups.forEach((backup, index) => {
                        console.log(`  ${index + 1}. ${backup}`);
                    });
                }
                break;
                
            case 'cleanup':
                console.log('Cleaning up old backups...');
                await backupService.cleanupOldBackups();
                console.log('✅ Cleanup completed');
                break;
                
            case 'verify':
                console.log('Verifying database integrity...');
                await backupService.verifyDatabaseIntegrity();
                console.log('✅ Database integrity check passed');
                break;
                
            case 'info':
                console.log('Backup information:');
                const info = await backupService.getBackupInfo();
                if (info.length === 0) {
                    console.log('No backups found.');
                } else {
                    info.forEach((backup, index) => {
                        console.log(`\n${index + 1}. ${backup.path}`);
                        if (backup.valid) {
                            console.log(`   Size: ${(backup.size / 1024 / 1024).toFixed(2)} MB`);
                            console.log(`   Created: ${backup.created.toISOString()}`);
                            console.log(`   Status: ✅ Valid`);
                        } else {
                            console.log(`   Status: ❌ Invalid - ${backup.error}`);
                        }
                    });
                }
                break;
                
            case 'help':
            case '--help':
            case '-h':
            default:
                await showHelp();
                break;
        }
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    handleCommand();
}

export { handleCommand };