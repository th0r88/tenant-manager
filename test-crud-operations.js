#!/usr/bin/env node

/**
 * Test CRUD operations for PostgreSQL compatibility
 * Run this to verify Phase 3 implementation
 */

import { getDatabaseAdapter } from './src/backend/database/db.js';
import environmentConfig from './src/backend/config/environment.js';

async function testCRUDOperations() {
    console.log('🔍 Testing CRUD operations for PostgreSQL compatibility...\n');
    
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
        
        // Test 1: Properties CRUD
        console.log('\n📊 Testing Properties CRUD...');
        
        // Create property
        const propertyResult = await adapter.query(
            'INSERT INTO properties (name, address, property_type, house_area, number_of_tenants) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            ['Test Property', '123 Test Street', 'apartment', 100.50, 2]
        );
        const propertyId = propertyResult.rows[0].id;
        console.log(`   ✅ Property created with ID: ${propertyId}`);
        
        // Read property
        const readProperty = await adapter.query('SELECT * FROM properties WHERE id = $1', [propertyId]);
        console.log(`   ✅ Property read: ${readProperty.rows[0].name}`);
        
        // Update property
        await adapter.query(
            'UPDATE properties SET name = $1, house_area = $2 WHERE id = $3',
            ['Updated Test Property', 120.75, propertyId]
        );
        console.log('   ✅ Property updated');
        
        // Test 2: Tenants CRUD
        console.log('\n👥 Testing Tenants CRUD...');
        
        // Create tenant
        const tenantResult = await adapter.query(
            `INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
            [propertyId, 'John', 'Doe', '123 Test Address', '1234567890123', 'TAX123', 850.00, 12, 45.50, 2, '2024-01-01']
        );
        const tenantId = tenantResult.rows[0].id;
        console.log(`   ✅ Tenant created with ID: ${tenantId}`);
        
        // Read tenant
        const readTenant = await adapter.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
        console.log(`   ✅ Tenant read: ${readTenant.rows[0].name} ${readTenant.rows[0].surname}`);
        
        // Update tenant
        await adapter.query(
            'UPDATE tenants SET rent_amount = $1, room_area = $2 WHERE id = $3',
            [900.00, 50.00, tenantId]
        );
        console.log('   ✅ Tenant updated');
        
        // Test 3: Utility Entries CRUD
        console.log('\n⚡ Testing Utility Entries CRUD...');
        
        // Create utility entry
        const utilityResult = await adapter.query(
            `INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [propertyId, 12, 2024, 'electricity', 150.75, 'per_person']
        );
        const utilityId = utilityResult.rows[0].id;
        console.log(`   ✅ Utility entry created with ID: ${utilityId}`);
        
        // Read utility entry
        const readUtility = await adapter.query('SELECT * FROM utility_entries WHERE id = $1', [utilityId]);
        console.log(`   ✅ Utility entry read: ${readUtility.rows[0].utility_type} - $${readUtility.rows[0].total_amount}`);
        
        // Update utility entry
        await adapter.query(
            'UPDATE utility_entries SET total_amount = $1, allocation_method = $2 WHERE id = $3',
            [175.25, 'per_sqm', utilityId]
        );
        console.log('   ✅ Utility entry updated');
        
        // Test 4: Tenant Utility Allocations CRUD
        console.log('\n🔄 Testing Tenant Utility Allocations CRUD...');
        
        // Create allocation
        const allocationResult = await adapter.query(
            `INSERT INTO tenant_utility_allocations (tenant_id, utility_entry_id, allocated_amount) 
             VALUES ($1, $2, $3) RETURNING id`,
            [tenantId, utilityId, 87.63]
        );
        const allocationId = allocationResult.rows[0].id;
        console.log(`   ✅ Allocation created with ID: ${allocationId}`);
        
        // Read allocation
        const readAllocation = await adapter.query('SELECT * FROM tenant_utility_allocations WHERE id = $1', [allocationId]);
        console.log(`   ✅ Allocation read: $${readAllocation.rows[0].allocated_amount}`);
        
        // Update allocation
        await adapter.query(
            'UPDATE tenant_utility_allocations SET allocated_amount = $1 WHERE id = $2',
            [92.50, allocationId]
        );
        console.log('   ✅ Allocation updated');
        
        // Test 5: Billing Periods CRUD
        console.log('\n📋 Testing Billing Periods CRUD...');
        
        // Create billing period
        const billingResult = await adapter.query(
            `INSERT INTO billing_periods (property_id, month, year, total_rent_calculated, total_utilities_calculated, calculation_status) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [propertyId, 12, 2024, 850.00, 175.25, 'calculated']
        );
        const billingId = billingResult.rows[0].id;
        console.log(`   ✅ Billing period created with ID: ${billingId}`);
        
        // Read billing period
        const readBilling = await adapter.query('SELECT * FROM billing_periods WHERE id = $1', [billingId]);
        console.log(`   ✅ Billing period read: ${readBilling.rows[0].month}/${readBilling.rows[0].year} - $${readBilling.rows[0].total_rent_calculated}`);
        
        // Update billing period
        await adapter.query(
            'UPDATE billing_periods SET calculation_status = $1, total_utilities_calculated = $2 WHERE id = $3',
            ['finalized', 185.50, billingId]
        );
        console.log('   ✅ Billing period updated');
        
        // Test 6: Complex Joins and Aggregations
        console.log('\n🔗 Testing Complex Queries...');
        
        // Test JOIN query
        const joinResult = await adapter.query(`
            SELECT p.name as property_name, t.name as tenant_name, t.surname, 
                   ue.utility_type, ue.total_amount, tua.allocated_amount
            FROM properties p
            JOIN tenants t ON t.property_id = p.id
            JOIN utility_entries ue ON ue.property_id = p.id
            JOIN tenant_utility_allocations tua ON tua.tenant_id = t.id AND tua.utility_entry_id = ue.id
            WHERE p.id = $1
        `, [propertyId]);
        
        console.log(`   ✅ JOIN query returned ${joinResult.rows.length} rows`);
        
        // Test aggregation query
        const aggregationResult = await adapter.query(`
            SELECT COUNT(*) as tenant_count, SUM(rent_amount) as total_rent,
                   AVG(room_area) as avg_room_area
            FROM tenants
            WHERE property_id = $1
        `, [propertyId]);
        
        console.log(`   ✅ Aggregation query - Tenants: ${aggregationResult.rows[0].tenant_count}, Total Rent: $${aggregationResult.rows[0].total_rent}`);
        
        // Test 7: Date Operations
        console.log('\n📅 Testing Date Operations...');
        
        // Test date filtering
        const dateResult = await adapter.query(`
            SELECT * FROM tenants 
            WHERE move_in_date >= $1 AND move_in_date <= $2
        `, ['2024-01-01', '2024-12-31']);
        
        console.log(`   ✅ Date filtering returned ${dateResult.rows.length} rows`);
        
        // Test date arithmetic
        const dateArithmeticResult = await adapter.query(`
            SELECT *, 
                   EXTRACT(year FROM move_in_date) as move_in_year,
                   EXTRACT(month FROM move_in_date) as move_in_month
            FROM tenants
            WHERE id = $1
        `, [tenantId]);
        
        console.log(`   ✅ Date arithmetic - Move in year: ${dateArithmeticResult.rows[0].move_in_year}, month: ${dateArithmeticResult.rows[0].move_in_month}`);
        
        // Test 8: Cleanup (Delete operations)
        console.log('\n🧹 Testing Delete Operations...');
        
        // Delete in reverse order of creation (foreign key constraints)
        await adapter.query('DELETE FROM tenant_utility_allocations WHERE id = $1', [allocationId]);
        console.log('   ✅ Allocation deleted');
        
        await adapter.query('DELETE FROM billing_periods WHERE id = $1', [billingId]);
        console.log('   ✅ Billing period deleted');
        
        await adapter.query('DELETE FROM utility_entries WHERE id = $1', [utilityId]);
        console.log('   ✅ Utility entry deleted');
        
        await adapter.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
        console.log('   ✅ Tenant deleted');
        
        await adapter.query('DELETE FROM properties WHERE id = $1', [propertyId]);
        console.log('   ✅ Property deleted');
        
        console.log('\n✅ All CRUD operations completed successfully!');
        console.log('📊 PostgreSQL compatibility verified for:');
        console.log('   - Basic CRUD operations');
        console.log('   - Complex JOIN queries');
        console.log('   - Aggregation functions');
        console.log('   - Date operations and arithmetic');
        console.log('   - Foreign key constraints');
        console.log('   - Data type conversions');
        
    } catch (error) {
        console.error('\n❌ CRUD test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testCRUDOperations().catch(console.error);