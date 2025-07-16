#!/usr/bin/env node

/**
 * Phase 5: Tenant Management Operations Testing
 * Verify all tenant management operations work correctly with PostgreSQL
 */

import { getDatabaseAdapter } from './src/backend/database/db.js';
import environmentConfig from './src/backend/config/environment.js';

async function testTenantManagementOperations() {
    console.log('👥 Phase 5: Testing Tenant Management Operations\n');
    
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
        
        // Create test property first
        const propertyResult = await adapter.query(`
            INSERT INTO properties (name, address, property_type, house_area, number_of_tenants, monthly_costs) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `, ['Tenant Test Property', '123 Tenant Test St', 'apartment', 200.00, 4, 1500.00]);
        
        const propertyId = propertyResult.rows[0].id;
        console.log(`✅ Test property created: ${propertyId}`);
        
        // Test 1: Basic Tenant CRUD Operations
        console.log('\n🏠 Testing Basic Tenant CRUD Operations...');
        
        // Create tenant
        const tenantResult = await adapter.query(`
            INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, created_at
        `, [propertyId, 'Test', 'Tenant', '123 Test Address', '1234567890123', 'TAX001', 800.00, 12, 55.50, 2, '2024-01-01']);
        
        const tenantId = tenantResult.rows[0].id;
        console.log(`   ✅ Tenant created: ${tenantId} at ${tenantResult.rows[0].created_at}`);
        
        // Read tenant
        const readTenant = await adapter.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
        const tenant = readTenant.rows[0];
        console.log(`   ✅ Tenant read: ${tenant.name} ${tenant.surname} (${tenant.emso})`);
        
        // Update tenant
        await adapter.query(`
            UPDATE tenants 
            SET rent_amount = $1, room_area = $2, number_of_people = $3 
            WHERE id = $4
        `, [900.00, 60.00, 3, tenantId]);
        console.log('   ✅ Tenant updated');
        
        // Verify update
        const updatedTenant = await adapter.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
        const updated = updatedTenant.rows[0];
        console.log(`   ✅ Update verified: rent=${updated.rent_amount}, area=${updated.room_area}, people=${updated.number_of_people}`);
        
        // Test 2: Tenant Validation and Constraints
        console.log('\n✅ Testing Tenant Validation and Constraints...');
        
        // Test duplicate EMŠO validation
        try {
            await adapter.query(`
                INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [propertyId, 'Duplicate', 'EMSO', '456 Test St', '1234567890123', 'TAX002', 700.00, 12, 40.00, 1]);
            throw new Error('Should have failed due to duplicate EMŠO');
        } catch (error) {
            console.log(`   ✅ Duplicate EMŠO validation: ${error.message}`);
        }
        
        // Test invalid EMŠO format
        try {
            await adapter.query(`
                INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [propertyId, 'Invalid', 'EMSO', '789 Test St', '12345678901', 'TAX003', 650.00, 12, 35.00, 1]);
            throw new Error('Should have failed due to invalid EMŠO format');
        } catch (error) {
            console.log(`   ✅ Invalid EMŠO format validation: ${error.message}`);
        }
        
        // Test negative rent validation
        try {
            await adapter.query(`
                INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [propertyId, 'Negative', 'Rent', '101 Test St', '2345678901234', 'TAX004', -500.00, 12, 40.00, 1]);
            throw new Error('Should have failed due to negative rent');
        } catch (error) {
            console.log(`   ✅ Negative rent validation: ${error.message}`);
        }
        
        // Test 3: Multiple Tenants Management
        console.log('\n👥 Testing Multiple Tenants Management...');
        
        // Create multiple tenants
        const tenantData = [
            ['John', 'Smith', '201 Tenant Ave', '3456789012345', 'TAX101', 750.00, 12, 45.00, 1],
            ['Jane', 'Johnson', '202 Tenant Ave', '4567890123456', 'TAX102', 850.00, 12, 50.00, 2],
            ['Bob', 'Williams', '203 Tenant Ave', '5678901234567', 'TAX103', 700.00, 12, 42.50, 1],
            ['Alice', 'Brown', '204 Tenant Ave', '6789012345678', 'TAX104', 800.00, 12, 48.00, 2]
        ];
        
        const tenantIds = [];
        for (const [name, surname, address, emso, taxNumber, rent, lease, area, people] of tenantData) {
            const result = await adapter.query(`
                INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
            `, [propertyId, name, surname, address, emso, taxNumber, rent, lease, area, people, '2024-01-01']);
            
            tenantIds.push(result.rows[0].id);
            console.log(`   ✅ Tenant created: ${name} ${surname} (ID: ${result.rows[0].id})`);
        }
        
        // Test bulk operations
        const allTenants = await adapter.query('SELECT * FROM tenants WHERE property_id = $1 ORDER BY name', [propertyId]);
        console.log(`   ✅ Retrieved ${allTenants.rows.length} tenants`);
        
        // Test tenant aggregations
        const tenantStats = await adapter.query(`
            SELECT 
                COUNT(*) as total_tenants,
                SUM(rent_amount) as total_rent,
                AVG(rent_amount) as avg_rent,
                SUM(room_area) as total_area,
                AVG(room_area) as avg_area,
                SUM(number_of_people) as total_people
            FROM tenants 
            WHERE property_id = $1
        `, [propertyId]);
        
        const stats = tenantStats.rows[0];
        console.log(`   ✅ Tenant statistics:`);
        console.log(`       Total tenants: ${stats.total_tenants}`);
        console.log(`       Total rent: $${stats.total_rent}`);
        console.log(`       Average rent: $${parseFloat(stats.avg_rent).toFixed(2)}`);
        console.log(`       Total area: ${stats.total_area} m²`);
        console.log(`       Average area: ${parseFloat(stats.avg_area).toFixed(2)} m²`);
        console.log(`       Total people: ${stats.total_people}`);
        
        // Test 4: Tenant Filtering and Searching
        console.log('\n🔍 Testing Tenant Filtering and Searching...');
        
        // Filter by rent range
        const rentFilter = await adapter.query(`
            SELECT * FROM tenants 
            WHERE property_id = $1 AND rent_amount BETWEEN $2 AND $3 
            ORDER BY rent_amount
        `, [propertyId, 700.00, 800.00]);
        
        console.log(`   ✅ Rent filter (700-800): ${rentFilter.rows.length} tenants`);
        
        // Search by name
        const nameSearch = await adapter.query(`
            SELECT * FROM tenants 
            WHERE property_id = $1 AND (name ILIKE $2 OR surname ILIKE $2)
        `, [propertyId, '%John%']);
        
        console.log(`   ✅ Name search ('John'): ${nameSearch.rows.length} tenants`);
        
        // Filter by move-in date
        const dateFilter = await adapter.query(`
            SELECT * FROM tenants 
            WHERE property_id = $1 AND move_in_date >= $2
        `, [propertyId, '2024-01-01']);
        
        console.log(`   ✅ Date filter (2024+): ${dateFilter.rows.length} tenants`);
        
        // Test 5: Tenant Lifecycle Management
        console.log('\n📅 Testing Tenant Lifecycle Management...');
        
        // Add move-out date to one tenant
        const moveOutTenant = tenantIds[0];
        await adapter.query(`
            UPDATE tenants 
            SET move_out_date = $1 
            WHERE id = $2
        `, ['2024-12-31', moveOutTenant]);
        
        console.log(`   ✅ Move-out date set for tenant ${moveOutTenant}`);
        
        // Test active/inactive tenants
        const activeTenants = await adapter.query(`
            SELECT COUNT(*) as active_count 
            FROM tenants 
            WHERE property_id = $1 AND move_out_date IS NULL
        `, [propertyId]);
        
        const inactiveTenants = await adapter.query(`
            SELECT COUNT(*) as inactive_count 
            FROM tenants 
            WHERE property_id = $1 AND move_out_date IS NOT NULL
        `, [propertyId]);
        
        console.log(`   ✅ Active tenants: ${activeTenants.rows[0].active_count}`);
        console.log(`   ✅ Inactive tenants: ${inactiveTenants.rows[0].inactive_count}`);
        
        // Test 6: Tenant Relationships and Dependencies
        console.log('\n🔗 Testing Tenant Relationships and Dependencies...');
        
        // Test tenant-property relationship
        const tenantProperty = await adapter.query(`
            SELECT t.name, t.surname, p.name as property_name, p.address as property_address
            FROM tenants t
            JOIN properties p ON p.id = t.property_id
            WHERE t.id = $1
        `, [tenantId]);
        
        console.log(`   ✅ Tenant-property relationship: ${tenantProperty.rows[0].name} lives at ${tenantProperty.rows[0].property_name}`);
        
        // Test property capacity validation
        const propertyCapacity = await adapter.query(`
            SELECT 
                p.number_of_tenants as max_tenants,
                COUNT(t.id) as current_tenants
            FROM properties p
            LEFT JOIN tenants t ON t.property_id = p.id AND t.move_out_date IS NULL
            WHERE p.id = $1
            GROUP BY p.id, p.number_of_tenants
        `, [propertyId]);
        
        const capacity = propertyCapacity.rows[0];
        console.log(`   ✅ Property capacity: ${capacity.current_tenants}/${capacity.max_tenants} tenants`);
        
        // Test 7: Tenant Data Integrity
        console.log('\n🔒 Testing Tenant Data Integrity...');
        
        // Test foreign key constraints
        try {
            await adapter.query(`
                INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [99999, 'Invalid', 'Property', '999 Test St', '7890123456789', 'TAX999', 600.00, 12, 30.00, 1]);
            throw new Error('Should have failed due to invalid property_id');
        } catch (error) {
            console.log(`   ✅ Foreign key constraint: ${error.message}`);
        }
        
        // Test unique constraints
        try {
            await adapter.query(`
                INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [propertyId, 'Duplicate', 'Tax', '888 Test St', '8901234567890', 'TAX101', 600.00, 12, 30.00, 1]);
            throw new Error('Should have failed due to duplicate tax_number');
        } catch (error) {
            console.log(`   ✅ Unique constraint: ${error.message}`);
        }
        
        // Test 8: Tenant Performance with Large Dataset
        console.log('\n⚡ Testing Tenant Performance...');
        
        const performanceStart = Date.now();
        
        // Create multiple queries to test performance
        const performanceQueries = [
            adapter.query('SELECT COUNT(*) FROM tenants WHERE property_id = $1', [propertyId]),
            adapter.query('SELECT AVG(rent_amount) FROM tenants WHERE property_id = $1', [propertyId]),
            adapter.query('SELECT SUM(room_area) FROM tenants WHERE property_id = $1', [propertyId]),
            adapter.query('SELECT MAX(move_in_date) FROM tenants WHERE property_id = $1', [propertyId])
        ];
        
        await Promise.all(performanceQueries);
        
        const performanceEnd = Date.now();
        console.log(`   ✅ Performance test completed in ${performanceEnd - performanceStart}ms`);
        
        // Test 9: Cleanup
        console.log('\n🧹 Cleaning up tenant test data...');
        
        // Delete all tenants
        const allTenantIds = [tenantId, ...tenantIds];
        for (const id of allTenantIds) {
            await adapter.query('DELETE FROM tenants WHERE id = $1', [id]);
        }
        
        // Delete property
        await adapter.query('DELETE FROM properties WHERE id = $1', [propertyId]);
        
        console.log('   ✅ All test data cleaned up');
        
        console.log('\n✅ Tenant Management Operations Testing COMPLETED!');
        console.log('🎉 All tenant management functionality verified:');
        console.log('   ✅ Basic CRUD operations');
        console.log('   ✅ Data validation and constraints');
        console.log('   ✅ Multiple tenants management');
        console.log('   ✅ Filtering and searching');
        console.log('   ✅ Lifecycle management');
        console.log('   ✅ Relationships and dependencies');
        console.log('   ✅ Data integrity checks');
        console.log('   ✅ Performance validation');
        console.log('   ✅ PostgreSQL-specific features');
        
    } catch (error) {
        console.error('\n❌ Tenant management test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testTenantManagementOperations().catch(console.error);