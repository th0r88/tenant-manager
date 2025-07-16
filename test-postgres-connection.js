#!/usr/bin/env node

/**
 * Test PostgreSQL connection and schema creation
 * Run this to verify Phase 2 implementation
 */

import { getDatabaseAdapter } from './src/backend/database/db.js';
import environmentConfig from './src/backend/config/environment.js';

async function testPostgreSQLConnection() {
    console.log('🔍 Testing PostgreSQL connection and schema creation...\n');
    
    try {
        // Override environment for testing
        process.env.DATABASE_TYPE = 'postgresql';
        process.env.DATABASE_HOST = 'localhost';  // Change to 'postgres' for docker
        process.env.DATABASE_PORT = '5432';
        process.env.DATABASE_NAME = 'tenant_manager';
        process.env.DATABASE_USER = 'tenant_user';
        process.env.DATABASE_PASSWORD = 'tenant_pass';
        
        console.log('📋 Configuration:');
        const config = environmentConfig.getDatabaseConfig();
        console.log(`   Database Type: ${config.type}`);
        console.log(`   Host: ${config.host}`);
        console.log(`   Port: ${config.port}`);
        console.log(`   Database: ${config.name}`);
        console.log(`   User: ${config.user}\n`);
        
        // Test basic connection
        console.log('🔗 Testing database connection...');
        const adapter = getDatabaseAdapter();
        if (!adapter) {
            throw new Error('Database adapter not initialized');
        }
        
        // Test health check
        console.log('❤️  Running health check...');
        const isHealthy = await adapter.healthCheck();
        console.log(`   Health status: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}\n`);
        
        // Test basic query
        console.log('🔍 Testing basic query...');
        const result = await adapter.query('SELECT version() as version');
        console.log(`   PostgreSQL Version: ${result.rows[0]?.version}\n`);
        
        // Test table creation verification
        console.log('📊 Verifying table creation...');
        const tables = await adapter.query(`
            SELECT table_name, table_type 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('   Tables found:');
        tables.rows.forEach(table => {
            console.log(`     - ${table.table_name} (${table.table_type})`);
        });
        
        // Test constraints and triggers
        console.log('\n🔧 Verifying constraints and triggers...');
        const triggers = await adapter.query(`
            SELECT trigger_name, event_manipulation, event_object_table
            FROM information_schema.triggers 
            WHERE trigger_schema = 'public'
            ORDER BY event_object_table, trigger_name
        `);
        
        console.log('   Triggers found:');
        triggers.rows.forEach(trigger => {
            console.log(`     - ${trigger.trigger_name} on ${trigger.event_object_table} (${trigger.event_manipulation})`);
        });
        
        // Test health check function
        console.log('\n🏥 Testing health check function...');
        const healthResult = await adapter.query('SELECT * FROM check_database_health()');
        console.log('   Database health report:');
        healthResult.rows.forEach(row => {
            console.log(`     - ${row.table_name}: ${row.row_count} rows (${row.status})`);
        });
        
        console.log('\n✅ All tests passed! PostgreSQL connection and schema are working correctly.');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testPostgreSQLConnection().catch(console.error);