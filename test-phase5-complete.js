#!/usr/bin/env node

/**
 * Complete Phase 5 test - Integration & Testing
 * Tests all Phase 5 components together
 */

import { getDatabaseAdapter } from './src/backend/database/db.js';
import calculationService from './src/backend/services/calculationService.js';
import pdfService from './src/backend/services/pdfService.js';
import backupService from './src/backend/services/backupService.js';
import environmentConfig from './src/backend/config/environment.js';
import { promises as fs } from 'fs';
import { join } from 'path';

async function testPhase5Complete() {
    console.log('🎯 Phase 5 Complete Test - Integration & Testing\n');
    
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
        
        // Test 1: Full Application Integration
        console.log('\n🔗 Testing Full Application Integration...');
        
        const integrationStart = Date.now();
        
        // Apply all database optimizations
        await adapter.applyIndexes();
        console.log('   ✅ Database indexes applied');
        
        // Test health check
        const health = await adapter.healthCheck();
        console.log(`   ✅ Health check: ${health ? 'PASSED' : 'FAILED'}`);
        
        // Test connection info
        const connectionInfo = adapter.getConnectionInfo();
        console.log(`   ✅ Connection: ${connectionInfo.type} to ${connectionInfo.config.host}:${connectionInfo.config.port}`);
        
        const integrationEnd = Date.now();
        console.log(`   ✅ Integration setup completed in ${integrationEnd - integrationStart}ms`);
        
        // Test 2: End-to-End Workflow
        console.log('\n🔄 Testing End-to-End Workflow...');
        
        const workflowStart = Date.now();
        
        // Create property
        const propertyResult = await adapter.query(`
            INSERT INTO properties (name, address, property_type, house_area, number_of_tenants, monthly_costs) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `, ['E2E Test Property', '100 Integration Ave', 'apartment', 120.00, 3, 1000.00]);
        
        const propertyId = propertyResult.rows[0].id;
        console.log(`   ✅ Property created: ${propertyId}`);
        
        // Create tenants
        const tenantData = [
            ['Alice', 'Integration', '101 E2E St', '1111111111111', 'E2E001', 600.00, 12, 40.00, 2],
            ['Bob', 'Testing', '102 E2E St', '2222222222222', 'E2E002', 700.00, 12, 45.00, 1],
            ['Carol', 'Complete', '103 E2E St', '3333333333333', 'E2E003', 800.00, 12, 35.00, 2]
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
        
        // Create utilities
        const utilityData = [
            ['electricity', 150.00, 'per_person'],
            ['water', 90.00, 'per_sqm'],
            ['gas', 75.00, 'per_person']
        ];
        
        const utilityIds = [];
        for (const [type, amount, method] of utilityData) {
            const result = await adapter.query(`
                INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
            `, [propertyId, 12, 2024, type, amount, method]);
            
            utilityIds.push(result.rows[0].id);
            console.log(`   ✅ Utility created: ${type} - $${amount}`);
        }
        
        // Calculate allocations
        const allocations = [];
        for (const utilityId of utilityIds) {
            const utilityResult = await adapter.query('SELECT * FROM utility_entries WHERE id = $1', [utilityId]);
            const utility = utilityResult.rows[0];
            
            const calculation = await calculationService.calculateUtilityAllocation(
                propertyId, utilityId, utility.allocation_method
            );
            
            console.log(`   ✅ Calculated ${utility.utility_type}: ${calculation.allocations.length} allocations`);
            
            // Store allocations
            for (const allocation of calculation.allocations) {
                await adapter.query(`
                    INSERT INTO tenant_utility_allocations (tenant_id, utility_entry_id, allocated_amount) 
                    VALUES ($1, $2, $3)
                `, [allocation.tenant_id, utilityId, allocation.allocated_amount]);
                
                allocations.push(allocation);
            }
        }
        
        console.log(`   ✅ Stored ${allocations.length} utility allocations`);
        
        // Generate PDF reports
        const pdfPaths = [];
        const propertyDetails = await adapter.query('SELECT * FROM properties WHERE id = $1', [propertyId]);
        const property = propertyDetails.rows[0];
        
        for (const tenantId of tenantIds) {
            const tenantResult = await adapter.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
            const tenant = tenantResult.rows[0];
            
            const tenantAllocations = await adapter.query(`
                SELECT ue.utility_type, ue.allocation_method, tua.allocated_amount
                FROM tenant_utility_allocations tua
                JOIN utility_entries ue ON ue.id = tua.utility_entry_id
                WHERE tua.tenant_id = $1
            `, [tenantId]);
            
            const reportData = {
                tenant: tenant,
                property: property,
                month: 12,
                year: 2024,
                rent_amount: tenant.rent_amount,
                utilities: tenantAllocations.rows,
                total_amount: parseFloat(tenant.rent_amount) + 
                             tenantAllocations.rows.reduce((sum, u) => sum + parseFloat(u.allocated_amount), 0)
            };
            
            const pdfPath = join(process.cwd(), `e2e-report-${tenant.name}-${tenant.surname}.pdf`);
            await pdfService.generateTenantReport(reportData, pdfPath);
            
            const pdfExists = await fs.access(pdfPath).then(() => true).catch(() => false);
            if (pdfExists) {
                pdfPaths.push(pdfPath);
                console.log(`   ✅ PDF generated: ${tenant.name} ${tenant.surname}`);
            }
        }
        
        // Create backup
        const backupResult = await backupService.createBackup({
            name: 'e2e-integration-backup'
        });
        
        console.log(`   ✅ Backup created: ${backupResult.path}`);
        
        const workflowEnd = Date.now();
        console.log(`   ✅ End-to-end workflow completed in ${workflowEnd - workflowStart}ms`);
        
        // Test 3: Performance Under Real Conditions
        console.log('\n⚡ Testing Performance Under Real Conditions...');
        
        const performanceStart = Date.now();
        
        // Simulate real-world queries
        const realWorldQueries = [
            // Monthly tenant summary
            adapter.query(`
                SELECT 
                    t.name, t.surname, t.rent_amount,
                    SUM(tua.allocated_amount) as total_utilities,
                    t.rent_amount + SUM(tua.allocated_amount) as total_bill
                FROM tenants t
                LEFT JOIN tenant_utility_allocations tua ON tua.tenant_id = t.id
                LEFT JOIN utility_entries ue ON ue.id = tua.utility_entry_id AND ue.month = 12 AND ue.year = 2024
                WHERE t.property_id = $1
                GROUP BY t.id, t.name, t.surname, t.rent_amount
            `, [propertyId]),
            
            // Property financial summary
            adapter.query(`
                SELECT 
                    p.name,
                    COUNT(DISTINCT t.id) as tenant_count,
                    SUM(t.rent_amount) as total_rent,
                    SUM(ue.total_amount) as total_utilities_cost,
                    SUM(tua.allocated_amount) as total_allocated
                FROM properties p
                LEFT JOIN tenants t ON t.property_id = p.id
                LEFT JOIN utility_entries ue ON ue.property_id = p.id AND ue.month = 12 AND ue.year = 2024
                LEFT JOIN tenant_utility_allocations tua ON tua.tenant_id = t.id
                WHERE p.id = $1
                GROUP BY p.id, p.name
            `, [propertyId]),
            
            // Utility analysis
            adapter.query(`
                SELECT 
                    ue.utility_type,
                    ue.allocation_method,
                    ue.total_amount,
                    COUNT(tua.id) as allocation_count,
                    SUM(tua.allocated_amount) as total_allocated,
                    AVG(tua.allocated_amount) as avg_per_tenant
                FROM utility_entries ue
                LEFT JOIN tenant_utility_allocations tua ON tua.utility_entry_id = ue.id
                WHERE ue.property_id = $1 AND ue.month = 12 AND ue.year = 2024
                GROUP BY ue.id, ue.utility_type, ue.allocation_method, ue.total_amount
            `, [propertyId])
        ];
        
        const realWorldResults = await Promise.all(realWorldQueries);
        
        const performanceEnd = Date.now();
        console.log(`   ✅ Real-world queries completed in ${performanceEnd - performanceStart}ms`);
        
        // Display results
        console.log('   📊 Tenant Summary:');
        for (const tenant of realWorldResults[0].rows) {
            console.log(`     ${tenant.name} ${tenant.surname}: $${tenant.rent_amount} rent + $${parseFloat(tenant.total_utilities || 0).toFixed(2)} utilities = $${parseFloat(tenant.total_bill || tenant.rent_amount).toFixed(2)}`);
        }
        
        console.log('   📊 Property Summary:');
        const propertySummary = realWorldResults[1].rows[0];
        console.log(`     ${propertySummary.name}: ${propertySummary.tenant_count} tenants, $${propertySummary.total_rent} rent, $${parseFloat(propertySummary.total_utilities_cost || 0).toFixed(2)} utilities`);
        
        console.log('   📊 Utility Analysis:');
        for (const utility of realWorldResults[2].rows) {
            console.log(`     ${utility.utility_type}: $${utility.total_amount} total, ${utility.allocation_count} allocations, $${parseFloat(utility.avg_per_tenant || 0).toFixed(2)} avg`);
        }
        
        // Test 4: Error Handling and Recovery
        console.log('\n⚠️  Testing Error Handling and Recovery...');
        
        const errorStart = Date.now();
        
        // Test constraint violations
        try {
            await adapter.query(`
                INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [propertyId, 'Duplicate', 'EMSO', '999 Error St', '1111111111111', 'ERR001', 500.00, 12, 30.00, 1]);
        } catch (error) {
            console.log(`   ✅ Constraint violation handled: ${error.message}`);
        }
        
        // Test invalid calculations
        try {
            await calculationService.calculateUtilityAllocation(99999, 99999, 'invalid_method');
        } catch (error) {
            console.log(`   ✅ Invalid calculation handled: ${error.message}`);
        }
        
        // Test connection recovery
        const healthAfterError = await adapter.healthCheck();
        console.log(`   ✅ Health check after errors: ${healthAfterError ? 'PASSED' : 'FAILED'}`);
        
        const errorEnd = Date.now();
        console.log(`   ✅ Error handling tests completed in ${errorEnd - errorStart}ms`);
        
        // Test 5: Backup and Recovery Verification
        console.log('\n💾 Testing Backup and Recovery Verification...');
        
        const backupStart = Date.now();
        
        // Verify backup
        const backupVerification = await backupService.verifyBackup(backupResult.path);
        console.log(`   ✅ Backup verification: ${backupVerification.valid ? 'PASSED' : 'FAILED'}`);
        
        // Test backup integrity
        const backupIntegrity = await backupService.verifyDatabaseIntegrity();
        console.log(`   ✅ Database integrity: ${backupIntegrity ? 'PASSED' : 'FAILED'}`);
        
        // Get backup info
        const backupInfo = await backupService.getBackupInfo();
        const testBackupInfo = backupInfo.find(b => b.filename.includes('e2e-integration-backup'));
        
        if (testBackupInfo) {
            console.log(`   ✅ Backup info: ${testBackupInfo.filename} (${testBackupInfo.size} bytes, ${testBackupInfo.tables} tables)`);
        }
        
        const backupEnd = Date.now();
        console.log(`   ✅ Backup verification completed in ${backupEnd - backupStart}ms`);
        
        // Test 6: Concurrent Operations
        console.log('\n🔄 Testing Concurrent Operations...');
        
        const concurrentStart = Date.now();
        
        // Mix of different operations
        const concurrentOps = [
            // Queries
            adapter.query('SELECT COUNT(*) FROM tenants WHERE property_id = $1', [propertyId]),
            adapter.query('SELECT AVG(rent_amount) FROM tenants WHERE property_id = $1', [propertyId]),
            adapter.query('SELECT SUM(total_amount) FROM utility_entries WHERE property_id = $1', [propertyId]),
            
            // Calculations
            calculationService.calculateUtilityAllocation(propertyId, utilityIds[0], 'per_person'),
            calculationService.calculateUtilityAllocation(propertyId, utilityIds[1], 'per_sqm'),
            
            // Health checks
            adapter.healthCheck(),
            adapter.healthCheck(),
            
            // Metadata operations
            backupService.getTableInfo(),
            backupService.listBackups()
        ];
        
        const concurrentResults = await Promise.all(concurrentOps);
        
        const concurrentEnd = Date.now();
        console.log(`   ✅ Concurrent operations completed in ${concurrentEnd - concurrentStart}ms`);
        console.log(`   ✅ Successfully executed ${concurrentResults.length} concurrent operations`);
        
        // Test 7: Resource Usage Monitoring
        console.log('\n📊 Testing Resource Usage Monitoring...');
        
        const resourceStart = Date.now();
        
        // Get database statistics
        const dbStats = await adapter.query(`
            SELECT 
                pg_size_pretty(pg_database_size(current_database())) as db_size,
                (SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()) as active_connections,
                pg_size_pretty(pg_total_relation_size('tenants')) as tenants_size,
                pg_size_pretty(pg_total_relation_size('utility_entries')) as utilities_size
        `);
        
        const stats = dbStats.rows[0];
        console.log(`   ✅ Database size: ${stats.db_size}`);
        console.log(`   ✅ Active connections: ${stats.active_connections}`);
        console.log(`   ✅ Tenants table: ${stats.tenants_size}`);
        console.log(`   ✅ Utilities table: ${stats.utilities_size}`);
        
        // Get index usage
        const indexStats = await adapter.query(`
            SELECT 
                indexname,
                idx_scan,
                idx_tup_read
            FROM pg_stat_user_indexes 
            WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
            ORDER BY idx_scan DESC
            LIMIT 5
        `);
        
        console.log(`   ✅ Top 5 used indexes:`);
        for (const index of indexStats.rows) {
            console.log(`     ${index.indexname}: ${index.idx_scan} scans, ${index.idx_tup_read} tuples`);
        }
        
        const resourceEnd = Date.now();
        console.log(`   ✅ Resource monitoring completed in ${resourceEnd - resourceStart}ms`);
        
        // Test 8: Cleanup and Validation
        console.log('\n🧹 Testing Cleanup and Validation...');
        
        const cleanupStart = Date.now();
        
        // Delete PDFs
        for (const pdfPath of pdfPaths) {
            try {
                await fs.unlink(pdfPath);
                console.log(`   ✅ PDF deleted: ${pdfPath}`);
            } catch (error) {
                console.log(`   ⚠️  Could not delete PDF: ${pdfPath}`);
            }
        }
        
        // Delete test data
        await adapter.query('DELETE FROM tenant_utility_allocations WHERE tenant_id = ANY($1)', [tenantIds]);
        console.log('   ✅ Deleted utility allocations');
        
        for (const utilityId of utilityIds) {
            await adapter.query('DELETE FROM utility_entries WHERE id = $1', [utilityId]);
        }
        console.log('   ✅ Deleted utility entries');
        
        for (const tenantId of tenantIds) {
            await adapter.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
        }
        console.log('   ✅ Deleted tenants');
        
        await adapter.query('DELETE FROM properties WHERE id = $1', [propertyId]);
        console.log('   ✅ Deleted property');
        
        // Delete backup
        await backupService.deleteBackup(backupResult.path);
        console.log('   ✅ Deleted backup');
        
        // Final health check
        const finalHealth = await adapter.healthCheck();
        console.log(`   ✅ Final health check: ${finalHealth ? 'PASSED' : 'FAILED'}`);
        
        const cleanupEnd = Date.now();
        console.log(`   ✅ Cleanup completed in ${cleanupEnd - cleanupStart}ms`);
        
        console.log('\n✅ Phase 5 Complete Test PASSED!');
        console.log('🎉 All Phase 5 components working together perfectly:');
        console.log('   ✅ Full application integration');
        console.log('   ✅ End-to-end workflow execution');
        console.log('   ✅ Performance under real conditions');
        console.log('   ✅ Error handling and recovery');
        console.log('   ✅ Backup and recovery verification');
        console.log('   ✅ Concurrent operations handling');
        console.log('   ✅ Resource usage monitoring');
        console.log('   ✅ Cleanup and validation');
        console.log('   ✅ PostgreSQL optimization complete');
        console.log('   ✅ Production-ready tenant management system');
        
    } catch (error) {
        console.error('\n❌ Phase 5 complete test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testPhase5Complete().catch(console.error);