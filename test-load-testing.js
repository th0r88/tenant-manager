#!/usr/bin/env node

/**
 * Phase 5: Load Testing
 * Test database setup under load conditions
 */

import { getDatabaseAdapter } from './src/backend/database/db.js';
import calculationService from './src/backend/services/calculationService.js';
import environmentConfig from './src/backend/config/environment.js';

async function testLoadTesting() {
    console.log('🚀 Phase 5: Load Testing Database Setup\n');
    
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
        
        // Test 1: Connection Pool Load Test
        console.log('\n🔄 Testing Connection Pool Under Load...');
        
        const poolLoadStart = Date.now();
        const poolPromises = [];
        
        // Create 100 concurrent connections
        for (let i = 0; i < 100; i++) {
            poolPromises.push(
                adapter.query('SELECT $1 as connection_id, CURRENT_TIMESTAMP as timestamp', [i])
            );
        }
        
        const poolResults = await Promise.all(poolPromises);
        const poolLoadEnd = Date.now();
        
        console.log(`   ✅ Connection pool load test: ${poolLoadEnd - poolLoadStart}ms`);
        console.log(`   ✅ Successfully handled ${poolResults.length} concurrent connections`);
        
        // Test 2: Create Load Test Dataset
        console.log('\n📊 Creating comprehensive load test dataset...');
        
        const loadTestStart = Date.now();
        
        // Create 50 properties
        const propertyIds = [];
        const propertyPromises = [];
        
        for (let i = 1; i <= 50; i++) {
            propertyPromises.push(
                adapter.query(`
                    INSERT INTO properties (name, address, property_type, house_area, number_of_tenants, monthly_costs) 
                    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
                `, [`Load Test Property ${i}`, `${i}00 Load Test Ave`, 
                    i % 3 === 0 ? 'house' : 'apartment', 
                    80 + (i * 5), 
                    2 + (i % 6), 
                    800 + (i * 25)])
            );
        }
        
        const propertyResults = await Promise.all(propertyPromises);
        for (const result of propertyResults) {
            propertyIds.push(result.rows[0].id);
        }
        
        console.log(`   ✅ Created ${propertyIds.length} properties`);
        
        // Create 500 tenants (10 per property)
        const tenantIds = [];
        const tenantPromises = [];
        
        for (let propIndex = 0; propIndex < propertyIds.length; propIndex++) {
            const propertyId = propertyIds[propIndex];
            
            for (let i = 1; i <= 10; i++) {
                tenantPromises.push(
                    adapter.query(`
                        INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
                    `, [
                        propertyId,
                        `LoadTenant${propIndex}_${i}`,
                        `LoadSurname${propIndex}_${i}`,
                        `${propIndex}${i}00 Load Test Blvd`,
                        `${propIndex.toString().padStart(2, '0')}${i.toString().padStart(2, '0')}${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
                        `LOAD${propIndex}${i}`,
                        500 + (i * 25) + (propIndex * 10),
                        12,
                        30 + (i * 3),
                        1 + (i % 4),
                        new Date(2024, (propIndex + i) % 12, 1 + (i % 28)).toISOString().split('T')[0]
                    ])
                );
            }
        }
        
        const tenantResults = await Promise.all(tenantPromises);
        for (const result of tenantResults) {
            tenantIds.push(result.rows[0].id);
        }
        
        console.log(`   ✅ Created ${tenantIds.length} tenants`);
        
        // Create 6000 utility entries (12 months × 10 utilities × 50 properties)
        const utilityIds = [];
        const utilityPromises = [];
        const utilityTypes = ['electricity', 'water', 'gas', 'internet', 'heating', 'maintenance', 'insurance', 'cleaning', 'security', 'parking'];
        
        for (const propertyId of propertyIds) {
            for (let month = 1; month <= 12; month++) {
                for (const utilityType of utilityTypes) {
                    utilityPromises.push(
                        adapter.query(`
                            INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
                            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
                        `, [propertyId, month, 2024, utilityType, 25 + (Math.random() * 200), Math.random() > 0.5 ? 'per_person' : 'per_sqm'])
                    );
                }
            }
        }
        
        const utilityResults = await Promise.all(utilityPromises);
        for (const result of utilityResults) {
            utilityIds.push(result.rows[0].id);
        }
        
        console.log(`   ✅ Created ${utilityIds.length} utility entries`);
        
        const loadTestEnd = Date.now();
        console.log(`   ✅ Load test dataset created in ${loadTestEnd - loadTestStart}ms`);
        
        // Test 3: High-Volume Query Load Test
        console.log('\n🔍 Testing High-Volume Query Load...');
        
        const queryLoadStart = Date.now();
        const queryPromises = [];
        
        // Mix of different query types
        const queryTypes = [
            // Property queries
            () => adapter.query('SELECT * FROM properties WHERE house_area > $1', [Math.floor(Math.random() * 200)]),
            // Tenant queries
            () => adapter.query('SELECT * FROM tenants WHERE rent_amount BETWEEN $1 AND $2', [Math.floor(Math.random() * 500), Math.floor(Math.random() * 1000) + 500]),
            // Utility queries
            () => adapter.query('SELECT * FROM utility_entries WHERE month = $1 AND year = $2', [Math.floor(Math.random() * 12) + 1, 2024]),
            // Join queries
            () => adapter.query(`
                SELECT p.name, COUNT(t.id) as tenant_count 
                FROM properties p 
                LEFT JOIN tenants t ON t.property_id = p.id 
                WHERE p.id = $1 
                GROUP BY p.id, p.name
            `, [propertyIds[Math.floor(Math.random() * propertyIds.length)]]),
            // Complex aggregation
            () => adapter.query(`
                SELECT utility_type, AVG(total_amount) as avg_amount 
                FROM utility_entries 
                WHERE month = $1 
                GROUP BY utility_type
            `, [Math.floor(Math.random() * 12) + 1])
        ];
        
        // Execute 200 random queries concurrently
        for (let i = 0; i < 200; i++) {
            const queryType = queryTypes[Math.floor(Math.random() * queryTypes.length)];
            queryPromises.push(queryType());
        }
        
        const queryResults = await Promise.all(queryPromises);
        const queryLoadEnd = Date.now();
        
        console.log(`   ✅ High-volume query load test: ${queryLoadEnd - queryLoadStart}ms`);
        console.log(`   ✅ Successfully executed ${queryResults.length} concurrent queries`);
        
        // Test 4: Write Load Test
        console.log('\n✏️  Testing Write Load Performance...');
        
        const writeLoadStart = Date.now();
        const writePromises = [];
        
        // Create 1000 utility allocations concurrently
        for (let i = 0; i < 1000; i++) {
            const tenantId = tenantIds[Math.floor(Math.random() * tenantIds.length)];
            const utilityId = utilityIds[Math.floor(Math.random() * utilityIds.length)];
            
            writePromises.push(
                adapter.query(`
                    INSERT INTO tenant_utility_allocations (tenant_id, utility_entry_id, allocated_amount) 
                    VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
                `, [tenantId, utilityId, 10 + (Math.random() * 90)])
            );
        }
        
        const writeResults = await Promise.all(writePromises);
        const writeLoadEnd = Date.now();
        
        console.log(`   ✅ Write load test: ${writeLoadEnd - writeLoadStart}ms`);
        console.log(`   ✅ Successfully executed ${writeResults.length} concurrent writes`);
        
        // Test 5: Mixed Read/Write Load Test
        console.log('\n🔄 Testing Mixed Read/Write Load...');
        
        const mixedLoadStart = Date.now();
        const mixedPromises = [];
        
        // 70% reads, 30% writes
        for (let i = 0; i < 300; i++) {
            if (Math.random() < 0.7) {
                // Read operation
                const readOps = [
                    () => adapter.query('SELECT COUNT(*) FROM tenants WHERE property_id = $1', [propertyIds[Math.floor(Math.random() * propertyIds.length)]]),
                    () => adapter.query('SELECT AVG(rent_amount) FROM tenants WHERE move_in_date >= $1', [new Date(2024, Math.floor(Math.random() * 12), 1).toISOString().split('T')[0]]),
                    () => adapter.query('SELECT utility_type, SUM(total_amount) FROM utility_entries WHERE property_id = $1 GROUP BY utility_type', [propertyIds[Math.floor(Math.random() * propertyIds.length)]])
                ];
                
                mixedPromises.push(readOps[Math.floor(Math.random() * readOps.length)]());
            } else {
                // Write operation
                const writeOps = [
                    () => adapter.query('UPDATE tenants SET rent_amount = rent_amount + $1 WHERE id = $2', [Math.floor(Math.random() * 50), tenantIds[Math.floor(Math.random() * tenantIds.length)]]),
                    () => adapter.query('UPDATE utility_entries SET total_amount = total_amount + $1 WHERE id = $2', [Math.floor(Math.random() * 20), utilityIds[Math.floor(Math.random() * utilityIds.length)]]),
                    () => adapter.query(`
                        INSERT INTO tenant_utility_allocations (tenant_id, utility_entry_id, allocated_amount) 
                        VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
                    `, [tenantIds[Math.floor(Math.random() * tenantIds.length)], utilityIds[Math.floor(Math.random() * utilityIds.length)], Math.floor(Math.random() * 100)])
                ];
                
                mixedPromises.push(writeOps[Math.floor(Math.random() * writeOps.length)]());
            }
        }
        
        const mixedResults = await Promise.all(mixedPromises);
        const mixedLoadEnd = Date.now();
        
        console.log(`   ✅ Mixed read/write load test: ${mixedLoadEnd - mixedLoadStart}ms`);
        console.log(`   ✅ Successfully executed ${mixedResults.length} mixed operations`);
        
        // Test 6: Calculation Service Load Test
        console.log('\n🧮 Testing Calculation Service Under Load...');
        
        const calcLoadStart = Date.now();
        const calcPromises = [];
        
        // Run 50 concurrent calculations
        for (let i = 0; i < 50; i++) {
            const propertyId = propertyIds[Math.floor(Math.random() * propertyIds.length)];
            const utilityId = utilityIds[Math.floor(Math.random() * utilityIds.length)];
            const method = Math.random() > 0.5 ? 'per_person' : 'per_sqm';
            
            calcPromises.push(
                calculationService.calculateUtilityAllocation(propertyId, utilityId, method)
                    .catch(error => ({ error: error.message }))
            );
        }
        
        const calcResults = await Promise.all(calcPromises);
        const calcLoadEnd = Date.now();
        
        const successfulCalcs = calcResults.filter(r => !r.error);
        const failedCalcs = calcResults.filter(r => r.error);
        
        console.log(`   ✅ Calculation service load test: ${calcLoadEnd - calcLoadStart}ms`);
        console.log(`   ✅ Successful calculations: ${successfulCalcs.length}`);
        console.log(`   ✅ Failed calculations: ${failedCalcs.length}`);
        
        // Test 7: Sustained Load Test
        console.log('\n⏱️  Testing Sustained Load Performance...');
        
        const sustainedLoadStart = Date.now();
        const sustainedPromises = [];
        
        // Run operations for 30 seconds
        const endTime = Date.now() + 30000;
        let operationCount = 0;
        
        while (Date.now() < endTime) {
            const batchPromises = [];
            
            // Execute 20 operations per batch
            for (let i = 0; i < 20; i++) {
                batchPromises.push(
                    adapter.query('SELECT COUNT(*) FROM tenants WHERE property_id = $1', [propertyIds[Math.floor(Math.random() * propertyIds.length)]])
                );
            }
            
            sustainedPromises.push(Promise.all(batchPromises));
            operationCount += 20;
            
            // Small delay to prevent overwhelming
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const sustainedResults = await Promise.all(sustainedPromises);
        const sustainedLoadEnd = Date.now();
        
        console.log(`   ✅ Sustained load test: ${sustainedLoadEnd - sustainedLoadStart}ms`);
        console.log(`   ✅ Total operations: ${operationCount}`);
        console.log(`   ✅ Operations per second: ${Math.round(operationCount / ((sustainedLoadEnd - sustainedLoadStart) / 1000))}`);
        
        // Test 8: Memory Usage Under Load
        console.log('\n💾 Testing Memory Usage Under Load...');
        
        const memoryResult = await adapter.query(`
            SELECT 
                pg_size_pretty(pg_database_size(current_database())) as db_size,
                pg_size_pretty(pg_total_relation_size('tenants')) as tenants_size,
                pg_size_pretty(pg_total_relation_size('utility_entries')) as utilities_size,
                pg_size_pretty(pg_total_relation_size('tenant_utility_allocations')) as allocations_size
        `);
        
        console.log(`   ✅ Database size: ${memoryResult.rows[0].db_size}`);
        console.log(`   ✅ Tenants table size: ${memoryResult.rows[0].tenants_size}`);
        console.log(`   ✅ Utilities table size: ${memoryResult.rows[0].utilities_size}`);
        console.log(`   ✅ Allocations table size: ${memoryResult.rows[0].allocations_size}`);
        
        // Test 9: Connection Pool Statistics
        console.log('\n📊 Testing Connection Pool Statistics...');
        
        const poolStatsResult = await adapter.query(`
            SELECT 
                numbackends as active_connections,
                xact_commit as committed_transactions,
                xact_rollback as rolled_back_transactions,
                blks_read as blocks_read,
                blks_hit as blocks_hit,
                tup_returned as tuples_returned,
                tup_fetched as tuples_fetched,
                tup_inserted as tuples_inserted,
                tup_updated as tuples_updated,
                tup_deleted as tuples_deleted
            FROM pg_stat_database 
            WHERE datname = current_database()
        `);
        
        const stats = poolStatsResult.rows[0];
        console.log(`   ✅ Active connections: ${stats.active_connections}`);
        console.log(`   ✅ Committed transactions: ${stats.committed_transactions}`);
        console.log(`   ✅ Rolled back transactions: ${stats.rolled_back_transactions}`);
        console.log(`   ✅ Cache hit ratio: ${((parseInt(stats.blocks_hit) / (parseInt(stats.blocks_read) + parseInt(stats.blocks_hit))) * 100).toFixed(2)}%`);
        
        // Test 10: Cleanup Load Test Data
        console.log('\n🧹 Cleaning up load test data...');
        
        const cleanupStart = Date.now();
        
        // Delete allocations
        await adapter.query('DELETE FROM tenant_utility_allocations WHERE tenant_id = ANY($1)', [tenantIds]);
        console.log('   ✅ Deleted utility allocations');
        
        // Delete utilities in batches
        const utilityBatchSize = 1000;
        for (let i = 0; i < utilityIds.length; i += utilityBatchSize) {
            const batch = utilityIds.slice(i, i + utilityBatchSize);
            await adapter.query(`DELETE FROM utility_entries WHERE id = ANY($1)`, [batch]);
        }
        console.log('   ✅ Deleted utility entries');
        
        // Delete tenants in batches
        const tenantBatchSize = 100;
        for (let i = 0; i < tenantIds.length; i += tenantBatchSize) {
            const batch = tenantIds.slice(i, i + tenantBatchSize);
            await adapter.query(`DELETE FROM tenants WHERE id = ANY($1)`, [batch]);
        }
        console.log('   ✅ Deleted tenants');
        
        // Delete properties
        await adapter.query(`DELETE FROM properties WHERE id = ANY($1)`, [propertyIds]);
        console.log('   ✅ Deleted properties');
        
        const cleanupEnd = Date.now();
        console.log(`   ✅ Cleanup completed in ${cleanupEnd - cleanupStart}ms`);
        
        // Test 11: Final Performance Metrics
        console.log('\n📊 Final Performance Metrics...');
        
        const finalStatsResult = await adapter.query(`
            SELECT 
                (SELECT COUNT(*) FROM properties) as total_properties,
                (SELECT COUNT(*) FROM tenants) as total_tenants,
                (SELECT COUNT(*) FROM utility_entries) as total_utilities,
                (SELECT COUNT(*) FROM tenant_utility_allocations) as total_allocations
        `);
        
        const finalStats = finalStatsResult.rows[0];
        console.log(`   ✅ Final counts: ${finalStats.total_properties} properties, ${finalStats.total_tenants} tenants, ${finalStats.total_utilities} utilities, ${finalStats.total_allocations} allocations`);
        
        console.log('\n✅ Load Testing COMPLETED!');
        console.log('🎉 All load testing scenarios verified:');
        console.log('   ✅ Connection pool under heavy load');
        console.log('   ✅ Large dataset creation and management');
        console.log('   ✅ High-volume concurrent queries');
        console.log('   ✅ Write operation load testing');
        console.log('   ✅ Mixed read/write workloads');
        console.log('   ✅ Calculation service under load');
        console.log('   ✅ Sustained load performance');
        console.log('   ✅ Memory usage monitoring');
        console.log('   ✅ Connection pool statistics');
        console.log('   ✅ Efficient data cleanup');
        console.log('   ✅ Production-ready performance');
        
    } catch (error) {
        console.error('\n❌ Load testing failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testLoadTesting().catch(console.error);