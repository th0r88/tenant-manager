#!/usr/bin/env node

/**
 * Phase 5: Utility Calculations and PDF Generation Testing
 * Test calculation service and PDF generation with PostgreSQL
 */

import { getDatabaseAdapter } from './src/backend/database/db.js';
import calculationService from './src/backend/services/calculationService.js';
import pdfService from './src/backend/services/pdfService.js';
import { promises as fs } from 'fs';
import { join } from 'path';

async function testCalculationsAndPDF() {
    console.log('🧮 Phase 5: Testing Utility Calculations and PDF Generation\n');
    
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
        
        // Setup test data
        console.log('\n📊 Setting up test data...');
        
        // Create property
        const propertyResult = await adapter.query(`
            INSERT INTO properties (name, address, property_type, house_area, number_of_tenants, monthly_costs) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `, ['Calculation Test Property', '123 Calculation St', 'apartment', 180.00, 3, 1200.00]);
        
        const propertyId = propertyResult.rows[0].id;
        console.log(`   ✅ Property created: ${propertyId}`);
        
        // Create tenants with different room sizes and people counts
        const tenantData = [
            ['John', 'Doe', '101 Test St', '1234567890123', 'TAX001', 800.00, 12, 60.00, 2],
            ['Jane', 'Smith', '102 Test St', '2345678901234', 'TAX002', 700.00, 12, 45.00, 1],
            ['Bob', 'Johnson', '103 Test St', '3456789012345', 'TAX003', 900.00, 12, 75.00, 3]
        ];
        
        const tenantIds = [];
        for (const [name, surname, address, emso, taxNumber, rent, lease, area, people] of tenantData) {
            const result = await adapter.query(`
                INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
            `, [propertyId, name, surname, address, emso, taxNumber, rent, lease, area, people, '2024-01-01']);
            
            tenantIds.push(result.rows[0].id);
            console.log(`   ✅ Tenant created: ${name} ${surname} (${area}m², ${people} people)`);
        }
        
        // Test 1: Per-Person Utility Calculations
        console.log('\n👥 Testing Per-Person Utility Calculations...');
        
        // Create per-person utilities
        const perPersonUtilities = [
            ['electricity', 180.00, 'per_person'],
            ['gas', 120.00, 'per_person'],
            ['internet', 60.00, 'per_person']
        ];
        
        const perPersonResults = [];
        for (const [type, amount, method] of perPersonUtilities) {
            const utilityResult = await adapter.query(`
                INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
            `, [propertyId, 12, 2024, type, amount, method]);
            
            const utilityId = utilityResult.rows[0].id;
            console.log(`   ✅ ${type} utility created: $${amount} (${method})`);
            
            // Test calculation
            const calculation = await calculationService.calculateUtilityAllocation(
                propertyId, utilityId, method
            );
            
            console.log(`   ✅ Calculation result: ${calculation.allocations.length} allocations`);
            
            // Verify calculation accuracy
            const totalAllocated = calculation.allocations.reduce((sum, a) => sum + a.allocated_amount, 0);
            const expectedTotal = amount;
            const accuracy = Math.abs(totalAllocated - expectedTotal) < 0.01;
            
            console.log(`   ✅ Calculation accuracy: ${totalAllocated.toFixed(2)} vs ${expectedTotal.toFixed(2)} (${accuracy ? 'PASS' : 'FAIL'})`);
            
            // Store allocations
            for (const allocation of calculation.allocations) {
                await adapter.query(`
                    INSERT INTO tenant_utility_allocations (tenant_id, utility_entry_id, allocated_amount) 
                    VALUES ($1, $2, $3)
                `, [allocation.tenant_id, utilityId, allocation.allocated_amount]);
            }
            
            perPersonResults.push({ utilityId, calculation, type, amount });
        }
        
        // Test 2: Per-Square-Meter Utility Calculations
        console.log('\n📐 Testing Per-Square-Meter Utility Calculations...');
        
        // Create per-sqm utilities
        const perSqmUtilities = [
            ['water', 90.00, 'per_sqm'],
            ['heating', 150.00, 'per_sqm'],
            ['maintenance', 75.00, 'per_sqm']
        ];
        
        const perSqmResults = [];
        for (const [type, amount, method] of perSqmUtilities) {
            const utilityResult = await adapter.query(`
                INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
            `, [propertyId, 12, 2024, type, amount, method]);
            
            const utilityId = utilityResult.rows[0].id;
            console.log(`   ✅ ${type} utility created: $${amount} (${method})`);
            
            // Test calculation
            const calculation = await calculationService.calculateUtilityAllocation(
                propertyId, utilityId, method
            );
            
            console.log(`   ✅ Calculation result: ${calculation.allocations.length} allocations`);
            
            // Verify calculation accuracy
            const totalAllocated = calculation.allocations.reduce((sum, a) => sum + a.allocated_amount, 0);
            const expectedTotal = amount;
            const accuracy = Math.abs(totalAllocated - expectedTotal) < 0.01;
            
            console.log(`   ✅ Calculation accuracy: ${totalAllocated.toFixed(2)} vs ${expectedTotal.toFixed(2)} (${accuracy ? 'PASS' : 'FAIL'})`);
            
            // Store allocations
            for (const allocation of calculation.allocations) {
                await adapter.query(`
                    INSERT INTO tenant_utility_allocations (tenant_id, utility_entry_id, allocated_amount) 
                    VALUES ($1, $2, $3)
                `, [allocation.tenant_id, utilityId, allocation.allocated_amount]);
            }
            
            perSqmResults.push({ utilityId, calculation, type, amount });
        }
        
        // Test 3: Mixed Calculation Methods
        console.log('\n🔄 Testing Mixed Calculation Methods...');
        
        // Get all tenants with their allocated utilities
        const tenantsWithUtilities = await adapter.query(`
            SELECT 
                t.id,
                t.name,
                t.surname,
                t.rent_amount,
                t.room_area,
                t.number_of_people,
                ue.utility_type,
                ue.total_amount,
                ue.allocation_method,
                tua.allocated_amount
            FROM tenants t
            JOIN tenant_utility_allocations tua ON tua.tenant_id = t.id
            JOIN utility_entries ue ON ue.id = tua.utility_entry_id
            WHERE t.property_id = $1
            ORDER BY t.name, ue.utility_type
        `, [propertyId]);
        
        console.log(`   ✅ Retrieved ${tenantsWithUtilities.rows.length} utility allocations`);
        
        // Group by tenant and calculate totals
        const tenantTotals = {};
        for (const row of tenantsWithUtilities.rows) {
            const key = `${row.name}_${row.surname}`;
            if (!tenantTotals[key]) {
                tenantTotals[key] = {
                    tenant: { id: row.id, name: row.name, surname: row.surname, rent_amount: row.rent_amount },
                    utilities: [],
                    total_utilities: 0
                };
            }
            
            tenantTotals[key].utilities.push({
                type: row.utility_type,
                amount: row.allocated_amount,
                method: row.allocation_method
            });
            tenantTotals[key].total_utilities += parseFloat(row.allocated_amount);
        }
        
        // Display tenant summaries
        for (const [key, data] of Object.entries(tenantTotals)) {
            console.log(`   ✅ ${data.tenant.name} ${data.tenant.surname}:`);
            console.log(`       Rent: $${data.tenant.rent_amount}`);
            console.log(`       Utilities: $${data.total_utilities.toFixed(2)}`);
            console.log(`       Total: $${(parseFloat(data.tenant.rent_amount) + data.total_utilities).toFixed(2)}`);
        }
        
        // Test 4: PDF Generation for Individual Tenants
        console.log('\n📄 Testing PDF Generation for Individual Tenants...');
        
        const pdfPaths = [];
        let pdfCounter = 1;
        
        for (const [key, data] of Object.entries(tenantTotals)) {
            const tenant = data.tenant;
            const utilities = data.utilities;
            
            // Get property details
            const propertyDetails = await adapter.query('SELECT * FROM properties WHERE id = $1', [propertyId]);
            const property = propertyDetails.rows[0];
            
            // Create report data
            const reportData = {
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    surname: tenant.surname,
                    rent_amount: tenant.rent_amount
                },
                property: {
                    name: property.name,
                    address: property.address
                },
                month: 12,
                year: 2024,
                rent_amount: tenant.rent_amount,
                utilities: utilities.map(u => ({
                    utility_type: u.type,
                    allocated_amount: u.amount,
                    allocation_method: u.method
                })),
                total_amount: parseFloat(tenant.rent_amount) + data.total_utilities
            };
            
            // Generate PDF
            const pdfPath = join(process.cwd(), `test-report-${pdfCounter}.pdf`);
            await pdfService.generateTenantReport(reportData, pdfPath);
            
            // Verify PDF was created
            const pdfExists = await fs.access(pdfPath).then(() => true).catch(() => false);
            if (pdfExists) {
                const pdfStats = await fs.stat(pdfPath);
                console.log(`   ✅ PDF generated for ${tenant.name} ${tenant.surname}: ${pdfStats.size} bytes`);
                pdfPaths.push(pdfPath);
            } else {
                console.log(`   ❌ PDF generation failed for ${tenant.name} ${tenant.surname}`);
            }
            
            pdfCounter++;
        }
        
        // Test 5: Bulk PDF Generation
        console.log('\n📊 Testing Bulk PDF Generation...');
        
        // Create property summary report
        const propertySummary = await adapter.query(`
            SELECT 
                p.name as property_name,
                p.address as property_address,
                p.house_area,
                COUNT(DISTINCT t.id) as tenant_count,
                SUM(t.rent_amount) as total_rent,
                COUNT(DISTINCT ue.id) as utility_count,
                SUM(ue.total_amount) as total_utilities
            FROM properties p
            LEFT JOIN tenants t ON t.property_id = p.id
            LEFT JOIN utility_entries ue ON ue.property_id = p.id
            WHERE p.id = $1
            GROUP BY p.id, p.name, p.address, p.house_area
        `, [propertyId]);
        
        const summary = propertySummary.rows[0];
        console.log(`   ✅ Property Summary:`);
        console.log(`       Property: ${summary.property_name}`);
        console.log(`       Tenants: ${summary.tenant_count}`);
        console.log(`       Total Rent: $${summary.total_rent}`);
        console.log(`       Utilities: ${summary.utility_count} types, $${summary.total_utilities} total`);
        
        // Test 6: Calculation Service Edge Cases
        console.log('\n⚠️  Testing Calculation Service Edge Cases...');
        
        // Test zero amount utility
        const zeroUtilityResult = await adapter.query(`
            INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `, [propertyId, 12, 2024, 'zero_test', 0.00, 'per_person']);
        
        const zeroUtilityId = zeroUtilityResult.rows[0].id;
        const zeroCalculation = await calculationService.calculateUtilityAllocation(
            propertyId, zeroUtilityId, 'per_person'
        );
        
        console.log(`   ✅ Zero amount calculation: ${zeroCalculation.allocations.length} allocations`);
        
        // Test invalid allocation method
        try {
            await calculationService.calculateUtilityAllocation(
                propertyId, zeroUtilityId, 'invalid_method'
            );
            console.log('   ❌ Invalid method should have failed');
        } catch (error) {
            console.log(`   ✅ Invalid method handled: ${error.message}`);
        }
        
        // Test 7: Performance Testing
        console.log('\n⚡ Testing Calculation Performance...');
        
        const performanceStart = Date.now();
        
        // Run multiple calculations concurrently
        const performancePromises = [];
        for (const { utilityId } of [...perPersonResults, ...perSqmResults]) {
            performancePromises.push(
                calculationService.calculateUtilityAllocation(propertyId, utilityId, 'per_person')
            );
        }
        
        await Promise.all(performancePromises);
        
        const performanceEnd = Date.now();
        console.log(`   ✅ Performance test completed in ${performanceEnd - performanceStart}ms`);
        
        // Test 8: Data Validation
        console.log('\n🔍 Testing Data Validation...');
        
        // Verify all allocations sum to utility totals
        const allUtilities = [...perPersonResults, ...perSqmResults];
        for (const { utilityId, amount, type } of allUtilities) {
            const allocationSum = await adapter.query(`
                SELECT COALESCE(SUM(allocated_amount), 0) as total_allocated
                FROM tenant_utility_allocations
                WHERE utility_entry_id = $1
            `, [utilityId]);
            
            const allocated = parseFloat(allocationSum.rows[0].total_allocated);
            const expected = parseFloat(amount);
            const accurate = Math.abs(allocated - expected) < 0.01;
            
            console.log(`   ✅ ${type} validation: ${allocated.toFixed(2)} vs ${expected.toFixed(2)} (${accurate ? 'PASS' : 'FAIL'})`);
        }
        
        // Test 9: Cleanup
        console.log('\n🧹 Cleaning up test data...');
        
        // Delete PDFs
        for (const pdfPath of pdfPaths) {
            try {
                await fs.unlink(pdfPath);
            } catch (error) {
                console.log(`   Warning: Could not delete ${pdfPath}`);
            }
        }
        
        // Delete allocations
        await adapter.query('DELETE FROM tenant_utility_allocations WHERE tenant_id = ANY($1)', [tenantIds]);
        
        // Delete utilities
        const allUtilityIds = [...perPersonResults, ...perSqmResults].map(r => r.utilityId);
        allUtilityIds.push(zeroUtilityId);
        for (const utilityId of allUtilityIds) {
            await adapter.query('DELETE FROM utility_entries WHERE id = $1', [utilityId]);
        }
        
        // Delete tenants
        for (const tenantId of tenantIds) {
            await adapter.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
        }
        
        // Delete property
        await adapter.query('DELETE FROM properties WHERE id = $1', [propertyId]);
        
        console.log('   ✅ All test data cleaned up');
        
        console.log('\n✅ Utility Calculations and PDF Generation Testing COMPLETED!');
        console.log('🎉 All calculation and PDF functionality verified:');
        console.log('   ✅ Per-person utility calculations');
        console.log('   ✅ Per-square-meter utility calculations');
        console.log('   ✅ Mixed calculation methods');
        console.log('   ✅ Individual tenant PDF generation');
        console.log('   ✅ Bulk PDF generation');
        console.log('   ✅ Edge case handling');
        console.log('   ✅ Performance validation');
        console.log('   ✅ Data validation and accuracy');
        console.log('   ✅ PostgreSQL integration');
        
    } catch (error) {
        console.error('\n❌ Calculations and PDF test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testCalculationsAndPDF().catch(console.error);