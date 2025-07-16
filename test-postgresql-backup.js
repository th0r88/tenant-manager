#!/usr/bin/env node

/**
 * Test PostgreSQL backup functionality
 * Run this to verify Phase 4 backup service implementation
 */

import backupService from './src/backend/services/backupService.js';
import { getDatabaseAdapter } from './src/backend/database/db.js';
import environmentConfig from './src/backend/config/environment.js';

async function testPostgreSQLBackup() {
    console.log('🔍 Testing PostgreSQL backup functionality...\n');
    
    try {
        // Override environment for testing
        process.env.DATABASE_TYPE = 'postgresql';
        process.env.DATABASE_HOST = 'localhost';  // Change to 'postgres' for docker
        process.env.DATABASE_PORT = '5432';
        process.env.DATABASE_NAME = 'tenant_manager';
        process.env.DATABASE_USER = 'tenant_user';
        process.env.DATABASE_PASSWORD = 'tenant_pass';
        
        const adapter = getDatabaseAdapter();
        if (!adapter) {
            throw new Error('Database adapter not initialized');
        }
        
        console.log('✅ Database adapter initialized');
        
        // Test 1: Create sample data for backup
        console.log('\n📊 Creating sample data for backup...');
        
        // Create property
        const propertyResult = await adapter.query(
            'INSERT INTO properties (name, address, property_type, house_area, number_of_tenants) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            ['Backup Test Property', '123 Backup Street', 'apartment', 100.50, 2]
        );
        const propertyId = propertyResult.rows[0].id;
        console.log(`   ✅ Property created with ID: ${propertyId}`);
        
        // Create tenant
        const tenantResult = await adapter.query(
            `INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
            [propertyId, 'Test', 'Tenant', '123 Test Address', '1234567890123', 'TAX123', 850.00, 12, 45.50, 2, '2024-01-01']
        );
        const tenantId = tenantResult.rows[0].id;
        console.log(`   ✅ Tenant created with ID: ${tenantId}`);
        
        // Create utility entry
        const utilityResult = await adapter.query(
            `INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [propertyId, 12, 2024, 'electricity', 150.75, 'per_person']
        );
        const utilityId = utilityResult.rows[0].id;
        console.log(`   ✅ Utility entry created with ID: ${utilityId}`);
        
        // Test 2: Create backup
        console.log('\n💾 Testing backup creation...');
        
        const backupResult = await backupService.createBackup({
            name: 'postgresql-test-backup'
        });
        
        console.log(`   ✅ Backup created: ${backupResult.path}`);
        console.log(`   📊 Backup size: ${backupResult.size} bytes`);
        console.log(`   🔐 Backup checksum: ${backupResult.checksum}`);
        
        // Test 3: Verify backup
        console.log('\n🔍 Testing backup verification...');
        
        const verificationResult = await backupService.verifyBackup(backupResult.path);
        
        console.log(`   ✅ Backup verification passed`);
        console.log(`   📊 Tables found: ${verificationResult.tables}`);
        console.log(`   🔐 Checksum verified: ${verificationResult.checksum}`);
        
        // Test 4: List backups
        console.log('\n📋 Testing backup listing...');
        
        const backups = await backupService.listBackups();
        const testBackup = backups.find(b => b.filename.includes('postgresql-test-backup'));
        
        if (testBackup) {
            console.log(`   ✅ Backup found in list: ${testBackup.filename}`);
            console.log(`   📊 Size: ${testBackup.size} bytes`);
            console.log(`   📅 Created: ${testBackup.created}`);
        } else {
            throw new Error('Test backup not found in backup list');
        }
        
        // Test 5: Get table info
        console.log('\n📊 Testing table info...');
        
        const tableInfo = await backupService.getTableInfo();
        
        if (tableInfo.length > 0) {
            console.log(`   ✅ Table info retrieved: ${tableInfo.length} tables`);
            for (const table of tableInfo) {
                console.log(`   📋 Table: ${table.name} (${table.row_count} rows)`);
            }
        } else {
            throw new Error('No table information retrieved');
        }
        
        // Test 6: Database integrity check
        console.log('\n🔍 Testing database integrity check...');
        
        const integrityResult = await backupService.verifyDatabaseIntegrity();
        
        if (integrityResult) {
            console.log(`   ✅ Database integrity check passed`);
        } else {
            throw new Error('Database integrity check failed');
        }
        
        // Test 7: Backup info
        console.log('\n📊 Testing backup info...');
        
        const backupInfo = await backupService.getBackupInfo();
        const testBackupInfo = backupInfo.find(b => b.filename.includes('postgresql-test-backup'));
        
        if (testBackupInfo) {
            console.log(`   ✅ Backup info retrieved: ${testBackupInfo.filename}`);
            console.log(`   📊 Tables: ${testBackupInfo.tables}`);
            console.log(`   ✅ Valid: ${testBackupInfo.valid}`);
        } else {
            throw new Error('Test backup info not found');
        }
        
        // Test 8: Cleanup (delete test data)
        console.log('\n🧹 Cleaning up test data...');
        
        await adapter.query('DELETE FROM utility_entries WHERE id = $1', [utilityId]);
        await adapter.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
        await adapter.query('DELETE FROM properties WHERE id = $1', [propertyId]);
        
        console.log('   ✅ Test data cleaned up');
        
        // Test 9: Delete test backup
        console.log('\n🗑️  Deleting test backup...');
        
        await backupService.deleteBackup(backupResult.path);
        
        console.log(`   ✅ Test backup deleted: ${backupResult.path}`);
        
        console.log('\n✅ All PostgreSQL backup tests passed!');
        console.log('🔧 PostgreSQL backup service verified:');
        console.log('   - Backup creation (.sql format)');
        console.log('   - Backup verification and integrity');
        console.log('   - Backup listing and metadata');
        console.log('   - Table information retrieval');
        console.log('   - Database integrity checking');
        console.log('   - Backup cleanup and deletion');
        console.log('   - PostgreSQL-specific functionality');
        
    } catch (error) {
        console.error('\n❌ PostgreSQL backup test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testPostgreSQLBackup().catch(console.error);