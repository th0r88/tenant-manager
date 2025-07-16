#!/usr/bin/env node

/**
 * Test PostgreSQL trigger functionality
 * Run this to verify Phase 3 trigger implementation
 */

import { getDatabaseAdapter } from './src/backend/database/db.js';
import environmentConfig from './src/backend/config/environment.js';

async function testTriggerFunctionality() {
    console.log('🔍 Testing PostgreSQL trigger functionality...\n');
    
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
        
        // Test 1: Property Validation Triggers
        console.log('\n🏠 Testing Property Validation Triggers...');
        
        // Create valid property first
        const propertyResult = await adapter.query(
            'INSERT INTO properties (name, address, property_type, house_area, number_of_tenants) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            ['Valid Property', '123 Test Street', 'apartment', 100.50, 2]
        );
        const propertyId = propertyResult.rows[0].id;
        console.log('   ✅ Valid property created');
        
        // Test negative house area validation
        try {
            await adapter.query(
                'INSERT INTO properties (name, address, property_type, house_area, number_of_tenants) VALUES ($1, $2, $3, $4, $5)',
                ['Invalid Property', '456 Test Street', 'apartment', -50.0, 1]
            );
            throw new Error('Should have failed due to negative house area');
        } catch (error) {
            if (error.message.includes('House area must be positive')) {
                console.log('   ✅ Negative house area validation triggered');
            } else {
                throw error;
            }
        }
        
        // Test negative tenant count validation
        try {
            await adapter.query(
                'INSERT INTO properties (name, address, property_type, house_area, number_of_tenants) VALUES ($1, $2, $3, $4, $5)',
                ['Invalid Property', '789 Test Street', 'apartment', 75.0, -1]
            );
            throw new Error('Should have failed due to negative tenant count');
        } catch (error) {
            if (error.message.includes('Number of tenants must be positive')) {
                console.log('   ✅ Negative tenant count validation triggered');
            } else {
                throw error;
            }
        }
        
        // Test 2: Tenant Validation Triggers
        console.log('\n👥 Testing Tenant Validation Triggers...');
        
        // Test negative rent amount validation
        try {
            await adapter.query(
                `INSERT INTO tenants (property_id, name, surname, address, emso, rent_amount, lease_duration, room_area, number_of_people) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [propertyId, 'John', 'Doe', '123 Test Address', '1234567890123', -100.00, 12, 45.50, 2]
            );
            throw new Error('Should have failed due to negative rent amount');
        } catch (error) {
            if (error.message.includes('Rent amount must be positive')) {
                console.log('   ✅ Negative rent amount validation triggered');
            } else {
                throw error;
            }
        }
        
        // Test negative room area validation
        try {
            await adapter.query(
                `INSERT INTO tenants (property_id, name, surname, address, emso, rent_amount, lease_duration, room_area, number_of_people) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [propertyId, 'Jane', 'Smith', '456 Test Address', '9876543210987', 800.00, 12, -25.0, 1]
            );
            throw new Error('Should have failed due to negative room area');
        } catch (error) {
            if (error.message.includes('Room area must be positive')) {
                console.log('   ✅ Negative room area validation triggered');
            } else {
                throw error;
            }
        }
        
        // Test invalid EMŠO format validation
        try {
            await adapter.query(
                `INSERT INTO tenants (property_id, name, surname, address, emso, rent_amount, lease_duration, room_area, number_of_people) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [propertyId, 'Invalid', 'EMSO', '789 Test Address', '123456789012', 750.00, 12, 40.0, 1]
            );
            throw new Error('Should have failed due to invalid EMŠO format');
        } catch (error) {
            if (error.message.includes('EMŠO must be exactly 13 digits')) {
                console.log('   ✅ Invalid EMŠO format validation triggered');
            } else {
                throw error;
            }
        }
        
        // Test invalid move out date validation
        try {
            await adapter.query(
                `INSERT INTO tenants (property_id, name, surname, address, emso, rent_amount, lease_duration, room_area, number_of_people, move_in_date, move_out_date) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [propertyId, 'Invalid', 'Dates', '101 Test Address', '5555555555555', 700.00, 12, 35.0, 1, '2024-06-01', '2024-03-01']
            );
            throw new Error('Should have failed due to move out date before move in date');
        } catch (error) {
            if (error.message.includes('Move out date must be after move in date')) {
                console.log('   ✅ Invalid move out date validation triggered');
            } else {
                throw error;
            }
        }
        
        // Create valid tenant for further tests
        const tenantResult = await adapter.query(
            `INSERT INTO tenants (property_id, name, surname, address, emso, rent_amount, lease_duration, room_area, number_of_people, move_in_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [propertyId, 'Valid', 'Tenant', '123 Test Address', '1234567890123', 850.00, 12, 45.50, 2, '2024-01-01']
        );
        const tenantId = tenantResult.rows[0].id;
        console.log('   ✅ Valid tenant created');
        
        // Test 3: Utility Entry Validation Triggers
        console.log('\n⚡ Testing Utility Entry Validation Triggers...');
        
        // Test negative utility amount validation
        try {
            await adapter.query(
                `INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [propertyId, 12, 2024, 'electricity', -50.00, 'per_person']
            );
            throw new Error('Should have failed due to negative utility amount');
        } catch (error) {
            if (error.message.includes('Utility amount must be positive')) {
                console.log('   ✅ Negative utility amount validation triggered');
            } else {
                throw error;
            }
        }
        
        // Test invalid month validation
        try {
            await adapter.query(
                `INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [propertyId, 13, 2024, 'water', 75.00, 'per_person']
            );
            throw new Error('Should have failed due to invalid month');
        } catch (error) {
            if (error.message.includes('Month must be between 1 and 12')) {
                console.log('   ✅ Invalid month validation triggered');
            } else {
                throw error;
            }
        }
        
        // Test invalid year validation
        try {
            await adapter.query(
                `INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [propertyId, 6, 1999, 'gas', 100.00, 'per_sqm']
            );
            throw new Error('Should have failed due to invalid year');
        } catch (error) {
            if (error.message.includes('Year must be between 2000 and 2100')) {
                console.log('   ✅ Invalid year validation triggered');
            } else {
                throw error;
            }
        }
        
        // Create valid utility entry for further tests
        const utilityResult = await adapter.query(
            `INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [propertyId, 12, 2024, 'electricity', 150.75, 'per_person']
        );
        const utilityId = utilityResult.rows[0].id;
        console.log('   ✅ Valid utility entry created');
        
        // Test 4: Tenant Utility Allocation Validation Triggers
        console.log('\n🔄 Testing Allocation Validation Triggers...');
        
        // Test negative allocation amount validation
        try {
            await adapter.query(
                `INSERT INTO tenant_utility_allocations (tenant_id, utility_entry_id, allocated_amount) 
                 VALUES ($1, $2, $3)`,
                [tenantId, utilityId, -25.00]
            );
            throw new Error('Should have failed due to negative allocation amount');
        } catch (error) {
            if (error.message.includes('Allocated amount cannot be negative')) {
                console.log('   ✅ Negative allocation amount validation triggered');
            } else {
                throw error;
            }
        }
        
        // Test 5: Billing Period Validation Triggers
        console.log('\n📋 Testing Billing Period Validation Triggers...');
        
        // Test invalid billing period month validation
        try {
            await adapter.query(
                `INSERT INTO billing_periods (property_id, month, year, total_rent_calculated, total_utilities_calculated) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [propertyId, 0, 2024, 850.00, 150.75]
            );
            throw new Error('Should have failed due to invalid billing month');
        } catch (error) {
            if (error.message.includes('Month must be between 1 and 12')) {
                console.log('   ✅ Invalid billing month validation triggered');
            } else {
                throw error;
            }
        }
        
        // Test negative billing amounts validation
        try {
            await adapter.query(
                `INSERT INTO billing_periods (property_id, month, year, total_rent_calculated, total_utilities_calculated) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [propertyId, 12, 2024, -100.00, 150.75]
            );
            throw new Error('Should have failed due to negative billing amount');
        } catch (error) {
            if (error.message.includes('Calculated amounts cannot be negative')) {
                console.log('   ✅ Negative billing amount validation triggered');
            } else {
                throw error;
            }
        }
        
        // Test 6: Update Timestamp Trigger
        console.log('\n⏰ Testing Update Timestamp Trigger...');
        
        // Create billing period
        const billingResult = await adapter.query(
            `INSERT INTO billing_periods (property_id, month, year, total_rent_calculated, total_utilities_calculated) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, updated_at`,
            [propertyId, 12, 2024, 850.00, 150.75]
        );
        const billingId = billingResult.rows[0].id;
        const originalUpdatedAt = billingResult.rows[0].updated_at;
        console.log('   ✅ Billing period created');
        
        // Wait a moment to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update billing period
        await adapter.query(
            'UPDATE billing_periods SET calculation_status = $1 WHERE id = $2',
            ['calculated', billingId]
        );
        
        // Check if updated_at changed
        const updatedBilling = await adapter.query(
            'SELECT updated_at FROM billing_periods WHERE id = $1',
            [billingId]
        );
        const newUpdatedAt = updatedBilling.rows[0].updated_at;
        
        if (new Date(newUpdatedAt) > new Date(originalUpdatedAt)) {
            console.log('   ✅ Updated timestamp trigger working correctly');
        } else {
            throw new Error('Updated timestamp trigger not working');
        }
        
        // Test 7: Cleanup
        console.log('\n🧹 Cleaning up test data...');
        
        await adapter.query('DELETE FROM billing_periods WHERE id = $1', [billingId]);
        await adapter.query('DELETE FROM utility_entries WHERE id = $1', [utilityId]);
        await adapter.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
        await adapter.query('DELETE FROM properties WHERE id = $1', [propertyId]);
        
        console.log('   ✅ Test data cleaned up');
        
        console.log('\n✅ All trigger functionality tests passed!');
        console.log('🔧 PostgreSQL triggers verified:');
        console.log('   - Property validation triggers');
        console.log('   - Tenant validation triggers');
        console.log('   - Utility entry validation triggers');
        console.log('   - Allocation validation triggers');
        console.log('   - Billing period validation triggers');
        console.log('   - Update timestamp trigger');
        console.log('   - EMŠO format validation');
        console.log('   - Date validation logic');
        console.log('   - Business rule enforcement');
        
    } catch (error) {
        console.error('\n❌ Trigger test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testTriggerFunctionality().catch(console.error);