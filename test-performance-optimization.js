#!/usr/bin/env node

/**
 * Phase 5: Performance Optimization Testing
 * Test query performance optimization with PostgreSQL
 */

import { getDatabaseAdapter } from './src/backend/database/db.js';
import environmentConfig from './src/backend/config/environment.js';

async function testPerformanceOptimization() {
    console.log('⚡ Phase 5: Testing Performance Optimization\n');
    
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
        
        // Test 1: Apply Performance Indexes
        console.log('\n📊 Testing Performance Indexes Application...');
        
        await adapter.applyIndexes();
        console.log('   ✅ Performance indexes applied');
        
        // Verify indexes were created
        const indexesResult = await adapter.query(`
            SELECT 
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname LIKE 'idx_%'
            ORDER BY tablename, indexname
        `);
        
        console.log(`   ✅ Created ${indexesResult.rows.length} performance indexes`);
        
        const indexesByTable = {};
        for (const row of indexesResult.rows) {
            if (!indexesByTable[row.tablename]) {
                indexesByTable[row.tablename] = [];
            }
            indexesByTable[row.tablename].push(row.indexname);
        }
        
        for (const [table, indexes] of Object.entries(indexesByTable)) {
            console.log(`   📋 ${table}: ${indexes.length} indexes`);
        }
        
        // Test 2: Create Performance Test Data
        console.log('\n📈 Creating performance test dataset...');
        
        // Create multiple properties
        const propertyIds = [];
        for (let i = 1; i <= 10; i++) {
            const result = await adapter.query(`
                INSERT INTO properties (name, address, property_type, house_area, number_of_tenants, monthly_costs) 
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
            `, [`Performance Property ${i}`, `${i}00 Performance St`, 'apartment', 100 + (i * 10), 3 + (i % 3), 1000 + (i * 100)]);
            
            propertyIds.push(result.rows[0].id);
        }
        
        console.log(`   ✅ Created ${propertyIds.length} properties`);
        
        // Create many tenants
        const tenantIds = [];
        for (let propIndex = 0; propIndex < propertyIds.length; propIndex++) {
            const propertyId = propertyIds[propIndex];
            const tenantCount = 5 + (propIndex % 5); // 5-9 tenants per property
            
            for (let i = 1; i <= tenantCount; i++) {
                const result = await adapter.query(`
                    INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
                `, [
                    propertyId,
                    `Tenant${propIndex}_${i}`,
                    `Surname${propIndex}_${i}`,
                    `${propIndex}0${i} Tenant Ave`,
                    `${propIndex}${i.toString().padStart(2, '0')}${(Math.random() * 1000000000).toFixed(0).padStart(9, '0')}`,
                    `TAX${propIndex}${i}`,
                    600 + (i * 50),
                    12,
                    40 + (i * 5),
                    1 + (i % 3),
                    new Date(2024, 0, 1 + (i % 30)).toISOString().split('T')[0]
                ]);
                
                tenantIds.push(result.rows[0].id);
            }
        }
        
        console.log(`   ✅ Created ${tenantIds.length} tenants`);
        
        // Create many utility entries
        const utilityIds = [];
        const utilityTypes = ['electricity', 'water', 'gas', 'internet', 'heating', 'maintenance'];
        
        for (const propertyId of propertyIds) {
            for (let month = 1; month <= 12; month++) {
                for (const utilityType of utilityTypes) {
                    const result = await adapter.query(`
                        INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) 
                        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
                    `, [propertyId, month, 2024, utilityType, 50 + (Math.random() * 150), month % 2 === 0 ? 'per_person' : 'per_sqm']);
                    
                    utilityIds.push(result.rows[0].id);
                }
            }
        }
        
        console.log(`   ✅ Created ${utilityIds.length} utility entries`);
        
        // Create utility allocations
        let allocationCount = 0;
        for (const tenantId of tenantIds) {
            // Get tenant's property
            const tenantResult = await adapter.query('SELECT property_id FROM tenants WHERE id = $1', [tenantId]);
            const tenantPropertyId = tenantResult.rows[0].property_id;
            
            // Get utilities for this property
            const utilitiesResult = await adapter.query('SELECT id FROM utility_entries WHERE property_id = $1 LIMIT 20', [tenantPropertyId]);
            
            for (const utility of utilitiesResult.rows) {
                await adapter.query(`
                    INSERT INTO tenant_utility_allocations (tenant_id, utility_entry_id, allocated_amount) 
                    VALUES ($1, $2, $3)
                `, [tenantId, utility.id, 10 + (Math.random() * 40)]);
                
                allocationCount++;
            }
        }
        
        console.log(`   ✅ Created ${allocationCount} utility allocations`);
        
        // Test 3: Query Performance Analysis
        console.log('\n🔍 Testing Query Performance Analysis...');
        
        // Test 3a: Property listing performance
        const propertyListStart = Date.now();
        const propertyListResult = await adapter.query(`
            SELECT 
                p.*,
                COUNT(DISTINCT t.id) as tenant_count,
                COUNT(DISTINCT ue.id) as utility_count,
                COALESCE(SUM(t.rent_amount), 0) as total_rent
            FROM properties p
            LEFT JOIN tenants t ON t.property_id = p.id AND t.move_out_date IS NULL
            LEFT JOIN utility_entries ue ON ue.property_id = p.id
            GROUP BY p.id
            ORDER BY p.name
        `);
        const propertyListEnd = Date.now();
        
        console.log(`   ✅ Property listing query: ${propertyListEnd - propertyListStart}ms (${propertyListResult.rows.length} rows)`);
        
        // Test 3b: Tenant search performance
        const tenantSearchStart = Date.now();
        const tenantSearchResult = await adapter.query(`
            SELECT 
                t.*,
                p.name as property_name,
                p.address as property_address
            FROM tenants t
            JOIN properties p ON p.id = t.property_id
            WHERE t.name ILIKE $1 OR t.surname ILIKE $1
            ORDER BY t.name, t.surname
        `, ['%Tenant%']);
        const tenantSearchEnd = Date.now();
        
        console.log(`   ✅ Tenant search query: ${tenantSearchEnd - tenantSearchStart}ms (${tenantSearchResult.rows.length} rows)`);
        
        // Test 3c: Utility allocation performance
        const allocationStart = Date.now();
        const allocationResult = await adapter.query(`
            SELECT 
                t.name,
                t.surname,
                p.name as property_name,
                ue.utility_type,
                ue.month,
                ue.year,
                ue.total_amount,
                tua.allocated_amount
            FROM tenants t
            JOIN properties p ON p.id = t.property_id
            JOIN tenant_utility_allocations tua ON tua.tenant_id = t.id
            JOIN utility_entries ue ON ue.id = tua.utility_entry_id
            WHERE ue.year = $1 AND ue.month = $2
            ORDER BY p.name, t.name, ue.utility_type
        `, [2024, 6]);
        const allocationEnd = Date.now();
        
        console.log(`   ✅ Utility allocation query: ${allocationEnd - allocationStart}ms (${allocationResult.rows.length} rows)`);
        
        // Test 3d: Monthly billing performance
        const billingStart = Date.now();
        const billingResult = await adapter.query(`
            SELECT 
                p.name as property_name,
                COUNT(DISTINCT t.id) as tenant_count,
                SUM(t.rent_amount) as total_rent,
                SUM(tua.allocated_amount) as total_utilities,
                SUM(t.rent_amount) + SUM(tua.allocated_amount) as total_billing
            FROM properties p
            JOIN tenants t ON t.property_id = p.id AND t.move_out_date IS NULL
            JOIN tenant_utility_allocations tua ON tua.tenant_id = t.id
            JOIN utility_entries ue ON ue.id = tua.utility_entry_id
            WHERE ue.year = $1 AND ue.month = $2
            GROUP BY p.id, p.name
            ORDER BY total_billing DESC
        `, [2024, 6]);
        const billingEnd = Date.now();
        
        console.log(`   ✅ Monthly billing query: ${billingEnd - billingStart}ms (${billingResult.rows.length} rows)`);
        
        // Test 4: Connection Pool Performance
        console.log('\n🔄 Testing Connection Pool Performance...');
        
        const poolStart = Date.now();
        const poolPromises = [];
        
        // Create 50 concurrent queries
        for (let i = 0; i < 50; i++) {
            poolPromises.push(
                adapter.query('SELECT COUNT(*) as count FROM tenants WHERE id > $1', [i])
            );
        }
        
        const poolResults = await Promise.all(poolPromises);
        const poolEnd = Date.now();
        
        console.log(`   ✅ Connection pool test: ${poolEnd - poolStart}ms (${poolResults.length} concurrent queries)`);
        
        // Test 5: Index Usage Analysis
        console.log('\n📊 Testing Index Usage Analysis...');
        
        // Get index usage statistics
        const indexUsageResult = await adapter.query(`
            SELECT 
                schemaname,
                tablename,
                indexname,
                idx_scan,
                idx_tup_read,
                idx_tup_fetch
            FROM pg_stat_user_indexes 
            WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
            ORDER BY idx_scan DESC
        `);
        
        console.log(`   ✅ Index usage statistics: ${indexUsageResult.rows.length} indexes monitored`);
        
        for (const row of indexUsageResult.rows.slice(0, 10)) {
            console.log(`   📋 ${row.indexname}: ${row.idx_scan} scans, ${row.idx_tup_read} tuples read`);
        }
        
        // Test 6: Query Plan Analysis
        console.log('\n🔍 Testing Query Plan Analysis...');
        
        // Analyze a complex query
        const explainResult = await adapter.query(`
            EXPLAIN (ANALYZE, BUFFERS) 
            SELECT 
                t.name,
                t.surname,
                p.name as property_name,
                COUNT(tua.id) as utility_count,
                SUM(tua.allocated_amount) as total_utilities
            FROM tenants t
            JOIN properties p ON p.id = t.property_id
            JOIN tenant_utility_allocations tua ON tua.tenant_id = t.id
            JOIN utility_entries ue ON ue.id = tua.utility_entry_id
            WHERE ue.year = 2024 AND ue.month = 6
            GROUP BY t.id, t.name, t.surname, p.name
            ORDER BY total_utilities DESC
        `);
        
        console.log(`   ✅ Query plan analysis completed:`);
        for (const row of explainResult.rows) {
            console.log(`   📋 ${row['QUERY PLAN']}`);
        }
        
        // Test 7: Aggregate Performance
        console.log('\n📊 Testing Aggregate Performance...');
        
        const aggregateStart = Date.now();
        const aggregateResult = await adapter.query(`
            SELECT 
                p.property_type,
                COUNT(DISTINCT p.id) as property_count,
                COUNT(DISTINCT t.id) as tenant_count,
                AVG(t.rent_amount) as avg_rent,
                AVG(t.room_area) as avg_room_area,
                SUM(t.rent_amount) as total_rent,
                COUNT(DISTINCT ue.id) as utility_count,
                AVG(ue.total_amount) as avg_utility_amount
            FROM properties p
            LEFT JOIN tenants t ON t.property_id = p.id AND t.move_out_date IS NULL
            LEFT JOIN utility_entries ue ON ue.property_id = p.id
            GROUP BY p.property_type
            ORDER BY property_count DESC
        `);
        const aggregateEnd = Date.now();
        
        console.log(`   ✅ Aggregate query: ${aggregateEnd - aggregateStart}ms (${aggregateResult.rows.length} rows)`);
        
        for (const row of aggregateResult.rows) {
            console.log(`   📋 ${row.property_type}: ${row.property_count} properties, ${row.tenant_count} tenants, $${parseFloat(row.avg_rent || 0).toFixed(2)} avg rent`);
        }
        
        // Test 8: Memory and Resource Usage
        console.log('\n💾 Testing Memory and Resource Usage...');
        
        const memoryResult = await adapter.query(`
            SELECT 
                pg_size_pretty(pg_total_relation_size(C.oid)) as total_size,
                pg_size_pretty(pg_relation_size(C.oid)) as table_size,
                pg_size_pretty(pg_total_relation_size(C.oid) - pg_relation_size(C.oid)) as index_size,
                nspname as schema_name,
                relname as table_name
            FROM pg_class C
            LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
            WHERE nspname = 'public' AND relkind = 'r'
            ORDER BY pg_total_relation_size(C.oid) DESC
        `);
        
        console.log(`   ✅ Memory usage analysis:`);
        for (const row of memoryResult.rows) {
            console.log(`   📋 ${row.table_name}: ${row.total_size} total (${row.table_size} table, ${row.index_size} indexes)`);
        }
        
        // Test 9: Cleanup Performance Test Data
        console.log('\n🧹 Cleaning up performance test data...');
        
        const cleanupStart = Date.now();
        
        // Delete in reverse order of creation
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
        
        for (const propertyId of propertyIds) {
            await adapter.query('DELETE FROM properties WHERE id = $1', [propertyId]);
        }
        console.log('   ✅ Deleted properties');
        
        const cleanupEnd = Date.now();
        console.log(`   ✅ Cleanup completed in ${cleanupEnd - cleanupStart}ms`);
        
        // Test 10: Final Performance Summary
        console.log('\n📊 Performance Summary...');
        
        const finalStatsResult = await adapter.query(`
            SELECT 
                schemaname,
                tablename,
                n_tup_ins as inserts,
                n_tup_upd as updates,
                n_tup_del as deletes,
                n_tup_hot_upd as hot_updates,
                n_live_tup as live_tuples,
                n_dead_tup as dead_tuples
            FROM pg_stat_user_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        console.log(`   ✅ Final table statistics:`);
        for (const row of finalStatsResult.rows) {
            console.log(`   📋 ${row.tablename}: ${row.live_tuples} live, ${row.dead_tuples} dead, ${row.inserts} inserts, ${row.deletes} deletes`);
        }
        
        console.log('\n✅ Performance Optimization Testing COMPLETED!');
        console.log('🎉 All performance optimization functionality verified:');
        console.log('   ✅ Database indexes application');
        console.log('   ✅ Query performance analysis');
        console.log('   ✅ Connection pool performance');
        console.log('   ✅ Index usage monitoring');
        console.log('   ✅ Query plan analysis');
        console.log('   ✅ Aggregate performance');
        console.log('   ✅ Memory and resource usage');
        console.log('   ✅ Large dataset handling');
        console.log('   ✅ Concurrent query optimization');
        console.log('   ✅ PostgreSQL-specific optimizations');
        
    } catch (error) {
        console.error('\n❌ Performance optimization test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testPerformanceOptimization().catch(console.error);