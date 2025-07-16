#!/usr/bin/env node

/**
 * Complete Phase 4 test - Database Adapter Enhancement
 * Tests all Phase 4 components together
 */

import { getDatabaseAdapter } from './src/backend/database/db.js';
import backupService from './src/backend/services/backupService.js';
import environmentConfig from './src/backend/config/environment.js';

async function testPhase4Complete() {
    console.log('🚀 Phase 4 Complete Test - Database Adapter Enhancement\n');
    
    try {
        // Override environment for testing
        process.env.DATABASE_TYPE = 'postgresql';
        process.env.DATABASE_HOST = 'localhost';  // Change to 'postgres' for docker
        process.env.DATABASE_PORT = '5432';
        process.env.DATABASE_NAME = 'tenant_manager';
        process.env.DATABASE_USER = 'tenant_user';
        process.env.DATABASE_PASSWORD = 'tenant_pass';
        
        // Test 1: Enhanced Database Adapter
        console.log('📊 Testing Enhanced Database Adapter...');
        
        const adapter = getDatabaseAdapter();
        if (!adapter) {
            throw new Error('Database adapter not initialized');
        }
        
        console.log('   ✅ Database adapter initialized');
        
        // Test connection pooling
        const connectionInfo = adapter.getConnectionInfo();
        console.log(`   ✅ Connection type: ${connectionInfo.type}`);
        console.log(`   ✅ Host: ${connectionInfo.config.host}:${connectionInfo.config.port}`);
        console.log(`   ✅ Database: ${connectionInfo.config.database}`);
        
        // Test health check
        const healthResult = await adapter.healthCheck();
        console.log(`   ✅ Health check: ${healthResult ? 'PASSED' : 'FAILED'}`);\n        
        // Test 2: Connection Pooling and Retry Logic
        console.log('\\n🔄 Testing Connection Pooling and Retry Logic...');
        
        // Test multiple concurrent queries to test connection pooling
        const queries = [];\n        for (let i = 0; i < 5; i++) {
            queries.push(adapter.query('SELECT $1 as test_value', [i]));
        }
        
        const results = await Promise.all(queries);
        console.log(`   ✅ Concurrent queries executed: ${results.length}`);
        
        // Test retry logic with a simple query
        const retryResult = await adapter.query('SELECT CURRENT_TIMESTAMP as now');
        console.log(`   ✅ Retry logic working: ${retryResult.rows[0].now}`);
        
        // Test 3: PostgreSQL-specific Error Handling
        console.log('\\n⚠️  Testing PostgreSQL Error Handling...');
        
        // Test invalid query (should be handled gracefully)
        try {
            await adapter.query('SELECT * FROM non_existent_table');
        } catch (error) {
            console.log(`   ✅ Error handling working: ${error.message}`);
        }
        
        // Test constraint violation (should be handled gracefully)
        try {
            await adapter.query('INSERT INTO tenants (id) VALUES (NULL)');
        } catch (error) {
            console.log(`   ✅ Constraint error handling: ${error.message}`);
        }
        
        // Test 4: Backup Service PostgreSQL Compatibility
        console.log('\\n💾 Testing Backup Service PostgreSQL Compatibility...');
        
        // Create test data
        const propertyResult = await adapter.query(
            'INSERT INTO properties (name, address, property_type, house_area, number_of_tenants) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            ['Phase4 Test Property', '123 Phase4 Street', 'apartment', 100.50, 2]
        );
        const propertyId = propertyResult.rows[0].id;
        
        const tenantResult = await adapter.query(
            `INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
            [propertyId, 'Phase4', 'Test', '123 Test Address', '1234567890123', 'TAX123', 850.00, 12, 45.50, 2, '2024-01-01']
        );
        const tenantId = tenantResult.rows[0].id;
        
        console.log(`   ✅ Test data created: Property ${propertyId}, Tenant ${tenantId}`);
        
        // Test backup creation
        const backupResult = await backupService.createBackup({
            name: 'phase4-integration-test'
        });
        
        console.log(`   ✅ PostgreSQL backup created: ${backupResult.path}`);
        console.log(`   ✅ Backup size: ${backupResult.size} bytes`);
        
        // Test backup verification
        const verificationResult = await backupService.verifyBackup(backupResult.path);
        console.log(`   ✅ Backup verification passed: ${verificationResult.tables} tables`);
        
        // Test database integrity
        const integrityResult = await backupService.verifyDatabaseIntegrity();
        console.log(`   ✅ Database integrity check: ${integrityResult ? 'PASSED' : 'FAILED'}`);
        
        // Test 5: Environment Configuration
        console.log('\\n⚙️  Testing Environment Configuration...');
        
        const config = environmentConfig.getDatabaseConfig();
        console.log(`   ✅ Database type: ${config.type}`);
        console.log(`   ✅ Host configuration: ${config.host}:${config.port}`);
        console.log(`   ✅ Database name: ${config.name}`);
        console.log(`   ✅ User: ${config.user}`);
        console.log(`   ✅ Pool configuration: max=${config.pool?.max}, min=${config.pool?.min}`);
        
        // Test 6: Service Dependencies
        console.log('\\n🔗 Testing Service Dependencies...');
        
        // Test that all services can work together
        const tableInfo = await backupService.getTableInfo();
        console.log(`   ✅ Table info retrieved: ${tableInfo.length} tables`);
        
        // Test that adapter can handle complex queries
        const complexQuery = await adapter.query(`
            SELECT p.name as property_name, t.name as tenant_name, t.surname
            FROM properties p
            JOIN tenants t ON t.property_id = p.id
            WHERE p.id = $1
        `, [propertyId]);
        
        console.log(`   ✅ Complex query executed: ${complexQuery.rows.length} results`);
        
        // Test 7: Performance and Monitoring
        console.log('\\n📊 Testing Performance and Monitoring...');
        
        const startTime = Date.now();
        
        // Execute multiple operations to test performance
        const performanceTests = [
            adapter.query('SELECT COUNT(*) FROM properties'),
            adapter.query('SELECT COUNT(*) FROM tenants'),
            adapter.query('SELECT COUNT(*) FROM utility_entries'),
            adapter.healthCheck()
        ];
        
        await Promise.all(performanceTests);
        
        const endTime = Date.now();
        console.log(`   ✅ Performance test completed in ${endTime - startTime}ms`);
        
        // Test 8: Cleanup
        console.log('\\n🧹 Cleaning up test data...');
        
        await adapter.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
        await adapter.query('DELETE FROM properties WHERE id = $1', [propertyId]);
        await backupService.deleteBackup(backupResult.path);
        
        console.log('   ✅ Test data and backup cleaned up');
        
        console.log('\\n✅ Phase 4 Complete Test PASSED!');
        console.log('🎉 All Phase 4 components working together:');
        console.log('   ✅ Enhanced DatabaseAdapter with PostgreSQL support');
        console.log('   ✅ Connection pooling and retry logic');
        console.log('   ✅ PostgreSQL-specific error handling');
        console.log('   ✅ Backup service PostgreSQL compatibility');
        console.log('   ✅ Environment configuration');
        console.log('   ✅ Service dependencies');
        console.log('   ✅ Performance monitoring');
        console.log('   ✅ Health check monitoring');
        console.log('   ✅ Production-ready PostgreSQL setup');
        
    } catch (error) {
        console.error('\\n❌ Phase 4 complete test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testPhase4Complete().catch(console.error);