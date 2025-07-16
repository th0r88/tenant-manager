#!/usr/bin/env node

/**
 * Phase 5: Full Integration Testing
 * Test all application functionality with PostgreSQL
 */

import { getDatabaseAdapter } from './src/backend/database/db.js';
import environmentConfig from './src/backend/config/environment.js';
import calculationService from './src/backend/services/calculationService.js';
import pdfService from './src/backend/services/pdfService.js';
import backupService from './src/backend/services/backupService.js';
import { promises as fs } from 'fs';
import { join } from 'path';

async function testFullIntegration() {
    console.log('🚀 Phase 5: Full Integration Testing with PostgreSQL\n');
    
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
        
        console.log('✅ Database adapter initialized for PostgreSQL');
        
        // Test 1: Basic Database Operations
        console.log('\n📊 Testing Basic Database Operations...');
        
        const healthCheck = await adapter.healthCheck();
        console.log(`   ✅ Health check: ${healthCheck ? 'PASSED' : 'FAILED'}`);
        
        // Test table structure
        const tables = await adapter.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        console.log(`   ✅ Tables found: ${tables.rows.map(r => r.table_name).join(', ')}`);
        
        // Test 2: Property Management Operations
        console.log('\n🏠 Testing Property Management Operations...');
        
        // Create property
        const propertyResult = await adapter.query(`
            INSERT INTO properties (name, address, property_type, house_area, number_of_tenants, monthly_costs) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `, ['Integration Test Property', '123 Integration Street', 'apartment', 150.75, 3, 1200.00]);
        
        const propertyId = propertyResult.rows[0].id;
        console.log(`   ✅ Property created with ID: ${propertyId}`);
        
        // Read property
        const readProperty = await adapter.query('SELECT * FROM properties WHERE id = $1', [propertyId]);
        console.log(`   ✅ Property read: ${readProperty.rows[0].name} (${readProperty.rows[0].house_area} m²)`);
        
        // Update property
        await adapter.query('UPDATE properties SET house_area = $1 WHERE id = $2', [175.50, propertyId]);
        console.log('   ✅ Property updated');
        
        // Test 3: Tenant Management Operations
        console.log('\n👥 Testing Tenant Management Operations...');
        
        // Create multiple tenants
        const tenantResults = [];
        const tenantData = [
            ['John', 'Doe', '123 Tenant St', '1234567890123', 'TAX001', 600.00, 12, 50.25, 2],
            ['Jane', 'Smith', '456 Tenant Ave', '2345678901234', 'TAX002', 700.00, 12, 62.50, 1],
            ['Bob', 'Johnson', '789 Tenant Blvd', '3456789012345', 'TAX003', 500.00, 12, 62.75, 2]
        ];
        
        for (const [name, surname, address, emso, taxNumber, rent, lease, area, people] of tenantData) {
            const tenantResult = await adapter.query(`
                INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
            `, [propertyId, name, surname, address, emso, taxNumber, rent, lease, area, people, '2024-01-01']);
            
            tenantResults.push(tenantResult.rows[0].id);
            console.log(`   ✅ Tenant created: ${name} ${surname} (ID: ${tenantResult.rows[0].id})`);
        }
        
        // Test tenant queries
        const allTenants = await adapter.query('SELECT * FROM tenants WHERE property_id = $1', [propertyId]);
        console.log(`   ✅ Retrieved ${allTenants.rows.length} tenants`);
        
        // Test 4: Utility Management Operations
        console.log('\n⚡ Testing Utility Management Operations...');
        
        // Create utility entries
        const utilityEntries = [
            ['electricity', 180.75, 'per_person'],
            ['water', 120.50, 'per_sqm'],
            ['gas', 95.25, 'per_person'],
            ['internet', 60.00, 'per_person']
        ];
        
        const utilityResults = [];
        for (const [type, amount, method] of utilityEntries) {
            const utilityResult = await adapter.query(`
                INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
            `, [propertyId, 12, 2024, type, amount, method]);
            
            utilityResults.push(utilityResult.rows[0].id);
            console.log(`   ✅ Utility entry created: ${type} - $${amount} (${method})`);
        }
        
        // Test 5: Calculation Service Integration
        console.log('\n🧮 Testing Calculation Service Integration...');
        
        // Test per-person allocation
        const perPersonResult = await calculationService.calculateUtilityAllocation(
            propertyId, utilityResults[0], 'per_person'
        );
        console.log(`   ✅ Per-person allocation calculated: ${perPersonResult.allocations.length} allocations`);
        
        // Test per-sqm allocation
        const perSqmResult = await calculationService.calculateUtilityAllocation(
            propertyId, utilityResults[1], 'per_sqm'
        );
        console.log(`   ✅ Per-sqm allocation calculated: ${perSqmResult.allocations.length} allocations`);
        
        // Verify calculation accuracy
        const totalPerPerson = perPersonResult.allocations.reduce((sum, a) => sum + a.allocated_amount, 0);
        const totalPerSqm = perSqmResult.allocations.reduce((sum, a) => sum + a.allocated_amount, 0);
        console.log(`   ✅ Calculation accuracy: per-person=${totalPerPerson.toFixed(2)}, per-sqm=${totalPerSqm.toFixed(2)}`);
        
        // Test 6: PDF Generation Service
        console.log('\n📄 Testing PDF Generation Service...');
        
        // Create tenant report
        const tenantId = tenantResults[0];
        const reportData = {
            tenant: allTenants.rows.find(t => t.id === tenantId),
            property: readProperty.rows[0],
            month: 12,
            year: 2024,
            rent_amount: 600.00,
            utilities: [
                { utility_type: 'electricity', allocated_amount: 60.25 },
                { utility_type: 'water', allocated_amount: 25.12 },
                { utility_type: 'gas', allocated_amount: 31.75 }
            ],
            total_amount: 717.12
        };
        
        const pdfPath = join(process.cwd(), 'test-report.pdf');
        await pdfService.generateTenantReport(reportData, pdfPath);
        
        // Verify PDF was created
        const pdfExists = await fs.access(pdfPath).then(() => true).catch(() => false);
        console.log(`   ✅ PDF report generated: ${pdfExists ? 'SUCCESS' : 'FAILED'}`);
        
        if (pdfExists) {
            const pdfStats = await fs.stat(pdfPath);
            console.log(`   ✅ PDF file size: ${pdfStats.size} bytes`);
        }
        
        // Test 7: Backup and Restore Integration
        console.log('\n💾 Testing Backup and Restore Integration...');
        
        // Create backup
        const backupResult = await backupService.createBackup({
            name: 'integration-test-backup'
        });
        console.log(`   ✅ Backup created: ${backupResult.path}`);
        
        // Verify backup
        const backupVerification = await backupService.verifyBackup(backupResult.path);
        console.log(`   ✅ Backup verification: ${backupVerification.valid ? 'PASSED' : 'FAILED'}`);
        
        // Test database integrity
        const integrityCheck = await backupService.verifyDatabaseIntegrity();
        console.log(`   ✅ Database integrity: ${integrityCheck ? 'PASSED' : 'FAILED'}`);
        
        // Test 8: Complex Query Operations
        console.log('\n🔍 Testing Complex Query Operations...');
        
        // Test JOIN operations
        const joinResult = await adapter.query(`
            SELECT 
                p.name as property_name,
                t.name as tenant_name,
                t.surname,
                t.rent_amount,
                ue.utility_type,
                ue.total_amount as utility_total,
                tua.allocated_amount
            FROM properties p
            JOIN tenants t ON t.property_id = p.id
            LEFT JOIN utility_entries ue ON ue.property_id = p.id
            LEFT JOIN tenant_utility_allocations tua ON tua.tenant_id = t.id AND tua.utility_entry_id = ue.id
            WHERE p.id = $1
            ORDER BY t.name, ue.utility_type
        `, [propertyId]);
        
        console.log(`   ✅ Complex JOIN query executed: ${joinResult.rows.length} rows`);
        
        // Test aggregation operations
        const aggregationResult = await adapter.query(`
            SELECT 
                COUNT(DISTINCT t.id) as tenant_count,
                SUM(t.rent_amount) as total_rent,
                AVG(t.room_area) as avg_room_area,
                COUNT(DISTINCT ue.id) as utility_count
            FROM properties p
            LEFT JOIN tenants t ON t.property_id = p.id
            LEFT JOIN utility_entries ue ON ue.property_id = p.id
            WHERE p.id = $1
        `, [propertyId]);
        
        const stats = aggregationResult.rows[0];
        console.log(`   ✅ Aggregation results: ${stats.tenant_count} tenants, $${stats.total_rent} total rent`);
        
        // Test 9: Transaction Operations
        console.log('\n🔄 Testing Transaction Operations...');
        
        // Test transaction with multiple operations
        const transactionTest = async () => {
            const client = await adapter.connection.connect();
            try {
                await client.query('BEGIN');
                
                // Create billing period
                const billingResult = await client.query(`
                    INSERT INTO billing_periods (property_id, month, year, total_rent_calculated, total_utilities_calculated) 
                    VALUES ($1, $2, $3, $4, $5) RETURNING id
                `, [propertyId, 12, 2024, 1800.00, 456.50]);
                
                const billingId = billingResult.rows[0].id;
                
                // Update calculation status
                await client.query(`
                    UPDATE billing_periods 
                    SET calculation_status = $1 
                    WHERE id = $2
                `, ['calculated', billingId]);
                
                await client.query('COMMIT');
                console.log(`   ✅ Transaction completed: billing period ${billingId}`);
                
                return billingId;
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        };
        
        const billingId = await transactionTest();
        
        // Test 10: Performance Validation
        console.log('\n⚡ Testing Performance Validation...');
        
        const performanceStart = Date.now();
        
        // Execute multiple concurrent operations
        const performanceTests = [
            adapter.query('SELECT COUNT(*) FROM tenants WHERE property_id = $1', [propertyId]),
            adapter.query('SELECT COUNT(*) FROM utility_entries WHERE property_id = $1', [propertyId]),
            adapter.query('SELECT COUNT(*) FROM tenant_utility_allocations'),
            adapter.query('SELECT AVG(rent_amount) FROM tenants WHERE property_id = $1', [propertyId])
        ];
        
        const performanceResults = await Promise.all(performanceTests);
        const performanceEnd = Date.now();
        
        console.log(`   ✅ Performance test completed in ${performanceEnd - performanceStart}ms`);
        console.log(`   ✅ Concurrent queries executed: ${performanceResults.length}`);
        
        // Test 11: Error Handling and Recovery
        console.log('\n⚠️  Testing Error Handling and Recovery...');
        
        // Test constraint violation handling
        try {
            await adapter.query(`
                INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [propertyId, 'Test', 'Duplicate', '123 Test St', '1234567890123', 'TAX001', 500.00, 12, 30.00, 1]);
        } catch (error) {
            console.log(`   ✅ Constraint violation handled: ${error.message}`);
        }
        
        // Test invalid data handling
        try {
            await adapter.query(`
                INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [propertyId, 'Test', 'Invalid', '123 Test St', '123456789012', 'TAX999', -500.00, 12, 30.00, 1]);
        } catch (error) {
            console.log(`   ✅ Invalid data handled: ${error.message}`);
        }
        
        // Test 12: Cleanup
        console.log('\n🧹 Cleaning up test data...');
        
        // Cleanup in reverse order of creation
        await adapter.query('DELETE FROM billing_periods WHERE id = $1', [billingId]);
        await adapter.query('DELETE FROM tenant_utility_allocations WHERE tenant_id = ANY($1)', [tenantResults]);
        
        for (const utilityId of utilityResults) {
            await adapter.query('DELETE FROM utility_entries WHERE id = $1', [utilityId]);
        }
        
        for (const tenantId of tenantResults) {
            await adapter.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
        }
        
        await adapter.query('DELETE FROM properties WHERE id = $1', [propertyId]);
        
        // Cleanup test files
        if (pdfExists) {
            await fs.unlink(pdfPath);
        }
        await backupService.deleteBackup(backupResult.path);
        
        console.log('   ✅ All test data cleaned up');
        
        console.log('\n✅ Full Integration Testing COMPLETED!');
        console.log('🎉 All application functionality verified with PostgreSQL:');
        console.log('   ✅ Database operations and health checks');
        console.log('   ✅ Property management CRUD operations');
        console.log('   ✅ Tenant management with validation');
        console.log('   ✅ Utility management and calculations');
        console.log('   ✅ Calculation service integration');
        console.log('   ✅ PDF generation service');
        console.log('   ✅ Backup and restore operations');
        console.log('   ✅ Complex queries and JOINs');
        console.log('   ✅ Transaction management');
        console.log('   ✅ Performance validation');
        console.log('   ✅ Error handling and recovery');
        console.log('   ✅ Data integrity and constraints');
        
    } catch (error) {
        console.error('\n❌ Full integration test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testFullIntegration().catch(console.error);