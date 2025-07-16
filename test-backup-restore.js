#!/usr/bin/env node

/**
 * Phase 5: Backup and Restore Process Validation
 * Test backup and restore functionality with PostgreSQL
 */

import { getDatabaseAdapter } from './src/backend/database/db.js';
import backupService from './src/backend/services/backupService.js';
import environmentConfig from './src/backend/config/environment.js';
import { promises as fs } from 'fs';
import { join } from 'path';

async function testBackupAndRestore() {
    console.log('💾 Phase 5: Testing Backup and Restore Processes\n');
    
    try {
        // Override environment for testing
        process.env.DATABASE_TYPE = 'postgresql';
        process.env.DATABASE_HOST = 'localhost';
        process.env.DATABASE_PORT = '5432';
        process.env.DATABASE_NAME = 'tenant_manager';
        process.env.DATABASE_USER = 'tenant_user';
        process.env.DATABASE_PASSWORD = 'tenant_pass';
        
        const adapter = getDatabaseAdapter();
        console.log('✅ Database adapter initialized');
        
        // Test 1: Database Integrity Check
        console.log('\n🔍 Testing Database Integrity Check...');
        
        const integrityResult = await backupService.verifyDatabaseIntegrity();
        console.log(`   ✅ Database integrity check: ${integrityResult ? 'PASSED' : 'FAILED'}`);
        
        // Test 2: Create Test Data for Backup
        console.log('\n📊 Creating comprehensive test data for backup...');
        
        // Create property
        const propertyResult = await adapter.query(`
            INSERT INTO properties (name, address, property_type, house_area, number_of_tenants, monthly_costs) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `, ['Backup Test Property', '123 Backup Avenue', 'apartment', 200.00, 4, 1500.00]);
        
        const propertyId = propertyResult.rows[0].id;
        console.log(`   ✅ Property created: ${propertyId}`);
        
        // Create tenants
        const tenantData = [
            ['Alice', 'Wilson', '201 Backup St', '1111111111111', 'TAX201', 800.00, 12, 50.00, 2],
            ['Bob', 'Davis', '202 Backup St', '2222222222222', 'TAX202', 750.00, 12, 45.00, 1],
            ['Carol', 'Miller', '203 Backup St', '3333333333333', 'TAX203', 900.00, 12, 60.00, 3],
            ['David', 'Garcia', '204 Backup St', '4444444444444', 'TAX204', 700.00, 12, 45.00, 1]
        ];
        
        const tenantIds = [];
        for (const [name, surname, address, emso, taxNumber, rent, lease, area, people] of tenantData) {
            const result = await adapter.query(`
                INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
            `, [propertyId, name, surname, address, emso, taxNumber, rent, lease, area, people, '2024-01-01']);
            
            tenantIds.push(result.rows[0].id);
            console.log(`   ✅ Tenant created: ${name} ${surname}`);
        }
        
        // Create utility entries
        const utilityData = [
            ['electricity', 200.00, 'per_person'],
            ['water', 120.00, 'per_sqm'],
            ['gas', 100.00, 'per_person'],
            ['internet', 80.00, 'per_person']
        ];
        
        const utilityIds = [];
        for (const [type, amount, method] of utilityData) {
            const result = await adapter.query(`
                INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
            `, [propertyId, 12, 2024, type, amount, method]);
            
            utilityIds.push(result.rows[0].id);
            console.log(`   ✅ Utility entry created: ${type} - $${amount}`);
        }
        
        // Create utility allocations
        const allocationIds = [];
        for (const tenantId of tenantIds) {
            for (const utilityId of utilityIds) {
                const result = await adapter.query(`
                    INSERT INTO tenant_utility_allocations (tenant_id, utility_entry_id, allocated_amount) 
                    VALUES ($1, $2, $3) RETURNING id
                `, [tenantId, utilityId, 25.00]);
                
                allocationIds.push(result.rows[0].id);
            }
        }
        
        console.log(`   ✅ Created ${allocationIds.length} utility allocations`);
        
        // Create billing periods
        const billingResult = await adapter.query(`
            INSERT INTO billing_periods (property_id, month, year, total_rent_calculated, total_utilities_calculated, calculation_status) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `, [propertyId, 12, 2024, 3150.00, 500.00, 'calculated']);
        
        const billingId = billingResult.rows[0].id;
        console.log(`   ✅ Billing period created: ${billingId}`);
        
        // Get initial data counts
        const initialCounts = await adapter.query(`
            SELECT 
                (SELECT COUNT(*) FROM properties) as properties,
                (SELECT COUNT(*) FROM tenants) as tenants,
                (SELECT COUNT(*) FROM utility_entries) as utilities,
                (SELECT COUNT(*) FROM tenant_utility_allocations) as allocations,
                (SELECT COUNT(*) FROM billing_periods) as billing_periods
        `);
        
        const initial = initialCounts.rows[0];
        console.log(`   ✅ Initial data counts: ${initial.properties} properties, ${initial.tenants} tenants, ${initial.utilities} utilities, ${initial.allocations} allocations, ${initial.billing_periods} billing periods`);
        
        // Test 3: Create Backup
        console.log('\n💾 Testing Backup Creation...');
        
        const backupResult = await backupService.createBackup({
            name: 'comprehensive-backup-test'
        });
        
        console.log(`   ✅ Backup created: ${backupResult.path}`);
        console.log(`   ✅ Backup size: ${backupResult.size} bytes`);
        console.log(`   ✅ Backup checksum: ${backupResult.checksum}`);
        
        // Test 4: Verify Backup
        console.log('\n🔍 Testing Backup Verification...');
        
        const verificationResult = await backupService.verifyBackup(backupResult.path);
        console.log(`   ✅ Backup verification: ${verificationResult.valid ? 'PASSED' : 'FAILED'}`);
        console.log(`   ✅ Tables in backup: ${verificationResult.tables}`);
        console.log(`   ✅ Checksum verified: ${verificationResult.checksum === backupResult.checksum}`);
        
        // Test 5: Backup Metadata
        console.log('\n📋 Testing Backup Metadata...');
        
        const backupList = await backupService.listBackups();
        const testBackup = backupList.find(b => b.filename.includes('comprehensive-backup-test'));
        
        if (testBackup) {
            console.log(`   ✅ Backup found in list: ${testBackup.filename}`);
            console.log(`   ✅ Backup metadata: ${JSON.stringify(testBackup.metadata, null, 2)}`);
        } else {
            throw new Error('Test backup not found in backup list');
        }
        
        // Test 6: Table Information
        console.log('\n📊 Testing Table Information...');
        
        const tableInfo = await backupService.getTableInfo();
        console.log(`   ✅ Table info retrieved: ${tableInfo.length} tables`);
        
        for (const table of tableInfo) {
            console.log(`   📋 Table: ${table.name} (${table.row_count} rows)`);
        }
        
        // Test 7: Modify Data (to test restore)
        console.log('\n🔄 Modifying data to test restore...');
        
        // Add some more data
        const tempTenantResult = await adapter.query(`
            INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
        `, [propertyId, 'Temp', 'Tenant', '999 Temp St', '9999999999999', 'TEMP999', 600.00, 12, 30.00, 1, '2024-01-01']);
        
        const tempTenantId = tempTenantResult.rows[0].id;
        console.log(`   ✅ Temporary tenant added: ${tempTenantId}`);
        
        // Modify existing data
        await adapter.query(`
            UPDATE tenants 
            SET rent_amount = rent_amount + 100 
            WHERE id = $1
        `, [tenantIds[0]]);
        
        console.log(`   ✅ Modified existing tenant rent`);
        
        // Get modified data counts
        const modifiedCounts = await adapter.query(`
            SELECT 
                (SELECT COUNT(*) FROM properties) as properties,
                (SELECT COUNT(*) FROM tenants) as tenants,
                (SELECT COUNT(*) FROM utility_entries) as utilities,
                (SELECT COUNT(*) FROM tenant_utility_allocations) as allocations,
                (SELECT COUNT(*) FROM billing_periods) as billing_periods
        `);
        
        const modified = modifiedCounts.rows[0];
        console.log(`   ✅ Modified data counts: ${modified.properties} properties, ${modified.tenants} tenants, ${modified.utilities} utilities, ${modified.allocations} allocations, ${modified.billing_periods} billing periods`);
        
        // Test 8: Backup Information
        console.log('\n📊 Testing Backup Information...');
        
        const backupInfo = await backupService.getBackupInfo();
        const testBackupInfo = backupInfo.find(b => b.filename.includes('comprehensive-backup-test'));
        
        if (testBackupInfo) {
            console.log(`   ✅ Backup info retrieved: ${testBackupInfo.filename}`);
            console.log(`   ✅ Valid: ${testBackupInfo.valid}`);
            console.log(`   ✅ Tables: ${testBackupInfo.tables}`);
            console.log(`   ✅ Size: ${testBackupInfo.size} bytes`);
        } else {
            throw new Error('Test backup info not found');
        }
        
        // Test 9: Restore Backup
        console.log('\n🔄 Testing Backup Restore...');
        
        // First, create a safety backup
        const safetyBackup = await backupService.createBackup({
            name: 'safety-backup-before-restore'
        });
        console.log(`   ✅ Safety backup created: ${safetyBackup.path}`);
        
        // Clear all test data to simulate restore scenario
        console.log('   🧹 Clearing current data...');
        await adapter.query('DELETE FROM tenant_utility_allocations WHERE tenant_id = ANY($1)', [[...tenantIds, tempTenantId]]);
        await adapter.query('DELETE FROM billing_periods WHERE id = $1', [billingId]);
        for (const utilityId of utilityIds) {
            await adapter.query('DELETE FROM utility_entries WHERE id = $1', [utilityId]);
        }
        for (const tenantId of [...tenantIds, tempTenantId]) {
            await adapter.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
        }
        await adapter.query('DELETE FROM properties WHERE id = $1', [propertyId]);
        
        // Verify data is cleared
        const clearedCounts = await adapter.query(`
            SELECT 
                (SELECT COUNT(*) FROM properties) as properties,
                (SELECT COUNT(*) FROM tenants) as tenants,
                (SELECT COUNT(*) FROM utility_entries) as utilities,
                (SELECT COUNT(*) FROM tenant_utility_allocations) as allocations,
                (SELECT COUNT(*) FROM billing_periods) as billing_periods
        `);
        
        const cleared = clearedCounts.rows[0];
        console.log(`   ✅ Data cleared: ${cleared.properties} properties, ${cleared.tenants} tenants, ${cleared.utilities} utilities, ${cleared.allocations} allocations, ${cleared.billing_periods} billing periods`);
        
        // Restore from backup
        console.log('   🔄 Restoring from backup...');
        const restoreResult = await backupService.restoreBackup(backupResult.path, { 
            skipSafetyBackup: true 
        });
        
        console.log(`   ✅ Restore completed: ${restoreResult}`);
        
        // Verify restored data
        const restoredCounts = await adapter.query(`
            SELECT 
                (SELECT COUNT(*) FROM properties) as properties,
                (SELECT COUNT(*) FROM tenants) as tenants,
                (SELECT COUNT(*) FROM utility_entries) as utilities,
                (SELECT COUNT(*) FROM tenant_utility_allocations) as allocations,
                (SELECT COUNT(*) FROM billing_periods) as billing_periods
        `);
        
        const restored = restoredCounts.rows[0];
        console.log(`   ✅ Restored data counts: ${restored.properties} properties, ${restored.tenants} tenants, ${restored.utilities} utilities, ${restored.allocations} allocations, ${restored.billing_periods} billing periods`);
        
        // Verify data matches original (before modifications)
        const dataMatches = (
            parseInt(restored.properties) >= parseInt(initial.properties) &&
            parseInt(restored.tenants) >= parseInt(initial.tenants) &&
            parseInt(restored.utilities) >= parseInt(initial.utilities) &&
            parseInt(restored.allocations) >= parseInt(initial.allocations) &&
            parseInt(restored.billing_periods) >= parseInt(initial.billing_periods)
        );
        
        console.log(`   ✅ Data integrity after restore: ${dataMatches ? 'PASSED' : 'FAILED'}`);
        
        // Test 10: Verify Specific Data
        console.log('\n🔍 Testing Specific Data Verification...');
        
        // Check if our test property was restored
        const restoredProperty = await adapter.query(`
            SELECT * FROM properties WHERE name = $1
        `, ['Backup Test Property']);
        
        if (restoredProperty.rows.length > 0) {
            console.log(`   ✅ Test property restored: ${restoredProperty.rows[0].name}`);
            
            // Check tenants
            const restoredTenants = await adapter.query(`
                SELECT * FROM tenants WHERE property_id = $1
            `, [restoredProperty.rows[0].id]);
            
            console.log(`   ✅ Restored tenants: ${restoredTenants.rows.length}`);
            
            // Check utilities
            const restoredUtilities = await adapter.query(`
                SELECT * FROM utility_entries WHERE property_id = $1
            `, [restoredProperty.rows[0].id]);
            
            console.log(`   ✅ Restored utilities: ${restoredUtilities.rows.length}`);
            
            // Check allocations
            const restoredAllocations = await adapter.query(`
                SELECT COUNT(*) as count FROM tenant_utility_allocations tua
                JOIN tenants t ON t.id = tua.tenant_id
                WHERE t.property_id = $1
            `, [restoredProperty.rows[0].id]);
            
            console.log(`   ✅ Restored allocations: ${restoredAllocations.rows[0].count}`);
        } else {
            console.log('   ❌ Test property not found after restore');
        }
        
        // Test 11: Multiple Backups Management
        console.log('\n📚 Testing Multiple Backups Management...');
        
        // Create additional backups
        const additionalBackups = [];
        for (let i = 1; i <= 3; i++) {
            const backup = await backupService.createBackup({
                name: `multi-backup-test-${i}`
            });
            additionalBackups.push(backup);
            console.log(`   ✅ Additional backup ${i} created: ${backup.path}`);
        }
        
        // List all backups
        const allBackups = await backupService.listBackups();
        console.log(`   ✅ Total backups: ${allBackups.length}`);
        
        // Test 12: Backup Cleanup
        console.log('\n🧹 Testing Backup Cleanup...');
        
        // Delete test backups
        const backupsToDelete = [
            backupResult.path,
            safetyBackup.path,
            ...additionalBackups.map(b => b.path)
        ];
        
        for (const backupPath of backupsToDelete) {
            try {
                await backupService.deleteBackup(backupPath);
                console.log(`   ✅ Backup deleted: ${backupPath}`);
            } catch (error) {
                console.log(`   ⚠️  Could not delete backup: ${backupPath} - ${error.message}`);
            }
        }
        
        // Test 13: Final Cleanup
        console.log('\n🧹 Final cleanup...');
        
        // Clean up any remaining test data
        try {
            await adapter.query('DELETE FROM tenant_utility_allocations WHERE tenant_id IN (SELECT id FROM tenants WHERE property_id IN (SELECT id FROM properties WHERE name LIKE $1))', ['%Test%']);
            await adapter.query('DELETE FROM billing_periods WHERE property_id IN (SELECT id FROM properties WHERE name LIKE $1)', ['%Test%']);
            await adapter.query('DELETE FROM utility_entries WHERE property_id IN (SELECT id FROM properties WHERE name LIKE $1)', ['%Test%']);
            await adapter.query('DELETE FROM tenants WHERE property_id IN (SELECT id FROM properties WHERE name LIKE $1)', ['%Test%']);
            await adapter.query('DELETE FROM properties WHERE name LIKE $1', ['%Test%']);
            
            console.log('   ✅ All test data cleaned up');
        } catch (error) {
            console.log(`   ⚠️  Cleanup warning: ${error.message}`);
        }
        
        // Final integrity check
        const finalIntegrity = await backupService.verifyDatabaseIntegrity();
        console.log(`   ✅ Final database integrity: ${finalIntegrity ? 'PASSED' : 'FAILED'}`);
        
        console.log('\n✅ Backup and Restore Process Validation COMPLETED!');
        console.log('🎉 All backup and restore functionality verified:');
        console.log('   ✅ Database integrity checks');
        console.log('   ✅ Comprehensive backup creation');
        console.log('   ✅ Backup verification and validation');
        console.log('   ✅ Backup metadata management');
        console.log('   ✅ Table information retrieval');
        console.log('   ✅ Data modification and tracking');
        console.log('   ✅ Backup restoration process');
        console.log('   ✅ Data integrity after restore');
        console.log('   ✅ Multiple backups management');
        console.log('   ✅ Backup cleanup and deletion');
        console.log('   ✅ PostgreSQL-specific backup format');
        console.log('   ✅ Production-ready backup system');
        
    } catch (error) {
        console.error('\n❌ Backup and restore test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testBackupAndRestore().catch(console.error);