#!/usr/bin/env node

/**
 * Verification Script: Check Utility Allocation Correctness
 * 
 * This script verifies that utility allocations sum to 100% of utility bills
 * and identifies any entries that may need recalculation.
 */

import db from '../src/backend/database/db.js';

async function verifyAllocations() {
    console.log('🔍 Verifying utility allocation correctness...\n');
    
    try {
        // Get all utility entries with their allocations
        const result = await db.query(`
            SELECT 
                ue.id,
                ue.month,
                ue.year,
                ue.utility_type,
                ue.total_amount,
                ue.property_id,
                COUNT(tua.id) as allocation_count,
                COALESCE(SUM(tua.allocated_amount), 0) as total_allocated,
                ROUND(ABS(ue.total_amount - COALESCE(SUM(tua.allocated_amount), 0)), 2) as difference
            FROM utility_entries ue
            LEFT JOIN tenant_utility_allocations tua ON ue.id = tua.utility_entry_id
            GROUP BY ue.id, ue.month, ue.year, ue.utility_type, ue.total_amount, ue.property_id
            ORDER BY ue.year DESC, ue.month DESC, ue.utility_type
        `);
        
        const entries = result.rows;
        
        if (entries.length === 0) {
            console.log('ℹ️  No utility entries found in database');
            return;
        }
        
        console.log(`📊 Found ${entries.length} utility entries\n`);
        
        let correctCount = 0;
        let issueCount = 0;
        let unallocatedCount = 0;
        
        entries.forEach(entry => {
            const status = entry.allocation_count === 0 ? 'UNALLOCATED' : 
                          entry.difference <= 0.01 ? 'CORRECT' : 'ISSUE';
            
            const icon = status === 'CORRECT' ? '✅' : 
                        status === 'UNALLOCATED' ? '⚠️ ' : '❌';
            
            console.log(`${icon} ${entry.utility_type} ${entry.month}/${entry.year}`);
            console.log(`   Bill: €${entry.total_amount} | Allocated: €${entry.total_allocated} | Diff: €${entry.difference}`);
            console.log(`   Tenants: ${entry.allocation_count} | Property: ${entry.property_id}\n`);
            
            if (status === 'CORRECT') correctCount++;
            else if (status === 'ISSUE') issueCount++;
            else unallocatedCount++;
        });
        
        // Summary
        console.log('📋 Summary:');
        console.log(`✅ Correct allocations: ${correctCount}`);
        console.log(`❌ Problematic allocations: ${issueCount}`);
        console.log(`⚠️  Unallocated entries: ${unallocatedCount}`);
        
        if (issueCount > 0) {
            console.log(`\n🔧 Recommendation: Run 'node scripts/recalculate-utility-allocations.js' to fix allocation issues`);
        }
        
        if (unallocatedCount > 0) {
            console.log(`\n💡 Note: Unallocated entries need to be processed through the utility allocation system`);
        }
        
        if (issueCount === 0 && unallocatedCount === 0) {
            console.log(`\n🎉 All utility allocations are correct!`);
        }
        
    } catch (error) {
        console.error('💥 Verification failed:', error);
        process.exit(1);
    }
}

// Execute verification
verifyAllocations()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Verification failed:', error);
        process.exit(1);
    });