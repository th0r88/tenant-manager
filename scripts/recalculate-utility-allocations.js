#!/usr/bin/env node

/**
 * Migration Script: Recalculate Utility Allocations with Person-Days Weighted Method
 * 
 * This script fixes existing utility allocations that were calculated with the old buggy method
 * by recalculating them using the new person-days weighted allocation logic.
 */

import db from '../src/backend/database/db.js';
import { calculateAllocations } from '../src/backend/services/calculationService.js';

async function recalculateUtilityAllocations() {
    console.log('🔄 Starting utility allocations recalculation...');
    
    try {
        // Backup existing allocations before making changes
        console.log('📋 Creating backup of existing allocations...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS tenant_utility_allocations_backup AS 
            SELECT *, datetime('now') as backup_timestamp 
            FROM tenant_utility_allocations
        `);
        
        // Get all utility entries that have allocations
        const utilityEntriesResult = await db.query(`
            SELECT DISTINCT ue.id, ue.month, ue.year, ue.utility_type, ue.total_amount, ue.property_id
            FROM utility_entries ue
            INNER JOIN tenant_utility_allocations tua ON ue.id = tua.utility_entry_id
            ORDER BY ue.year DESC, ue.month DESC
        `);
        
        const utilityEntries = utilityEntriesResult.rows;
        console.log(`📊 Found ${utilityEntries.length} utility entries with existing allocations`);
        
        if (utilityEntries.length === 0) {
            console.log('✅ No utility allocations found to recalculate');
            return;
        }
        
        let recalculatedCount = 0;
        let errorCount = 0;
        
        // Process each utility entry
        for (const utilityEntry of utilityEntries) {
            try {
                console.log(`\n🔄 Recalculating ${utilityEntry.utility_type} for ${utilityEntry.month}/${utilityEntry.year} (Entry ID: ${utilityEntry.id})`);
                
                // Check if this utility has mid-month tenants (candidates for incorrect allocation)
                const tenantsResult = await db.query(`
                    SELECT t.id, t.name, t.surname, t.move_in_date, t.move_out_date, t.number_of_people
                    FROM tenants t
                    WHERE t.property_id = $1
                `, [utilityEntry.property_id]);
                
                const tenants = tenantsResult.rows;
                const hasPartialMonthTenants = tenants.some(tenant => {
                    const moveInDate = new Date(tenant.move_in_date);
                    const moveOutDate = tenant.move_out_date ? new Date(tenant.move_out_date) : null;
                    const utilityMonth = new Date(utilityEntry.year, utilityEntry.month - 1, 1);
                    
                    // Check if tenant moved in during the utility month (not on 1st)
                    return (moveInDate.getFullYear() === utilityEntry.year && 
                            moveInDate.getMonth() === utilityEntry.month - 1 && 
                            moveInDate.getDate() > 1) ||
                           (moveOutDate && 
                            moveOutDate.getFullYear() === utilityEntry.year && 
                            moveOutDate.getMonth() === utilityEntry.month - 1 && 
                            moveOutDate.getDate() < new Date(utilityEntry.year, utilityEntry.month, 0).getDate());
                });
                
                if (!hasPartialMonthTenants) {
                    console.log(`⏭️  Skipping ${utilityEntry.utility_type} - no partial month tenants detected`);
                    continue;
                }
                
                // Get current allocations for comparison
                const currentAllocationsResult = await db.query(`
                    SELECT tua.tenant_id, tua.allocated_amount, t.name, t.surname
                    FROM tenant_utility_allocations tua
                    JOIN tenants t ON tua.tenant_id = t.id
                    WHERE tua.utility_entry_id = $1
                    ORDER BY t.name
                `, [utilityEntry.id]);
                
                const currentAllocations = currentAllocationsResult.rows;
                console.log(`📋 Current allocations:`, currentAllocations.map(a => `${a.name} ${a.surname}: €${a.allocated_amount}`).join(', '));
                
                // Delete existing allocations
                await db.query('DELETE FROM tenant_utility_allocations WHERE utility_entry_id = $1', [utilityEntry.id]);
                
                // Recalculate with new person-days method
                const newAllocations = await calculateAllocations(utilityEntry.id);
                
                // Get new allocations for comparison
                const newAllocationsResult = await db.query(`
                    SELECT tua.tenant_id, tua.allocated_amount, t.name, t.surname
                    FROM tenant_utility_allocations tua
                    JOIN tenants t ON tua.tenant_id = t.id
                    WHERE tua.utility_entry_id = $1
                    ORDER BY t.name
                `, [utilityEntry.id]);
                
                const recalculatedAllocations = newAllocationsResult.rows;
                console.log(`✅ New allocations:`, recalculatedAllocations.map(a => `${a.name} ${a.surname}: €${a.allocated_amount}`).join(', '));
                
                // Show the differences
                const totalOld = currentAllocations.reduce((sum, a) => sum + parseFloat(a.allocated_amount), 0);
                const totalNew = recalculatedAllocations.reduce((sum, a) => sum + parseFloat(a.allocated_amount), 0);
                console.log(`💰 Total allocation: €${totalOld.toFixed(2)} → €${totalNew.toFixed(2)} (Expected: €${utilityEntry.total_amount})`);
                
                recalculatedCount++;
                
            } catch (error) {
                console.error(`❌ Error recalculating utility entry ${utilityEntry.id}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`\n🎯 Recalculation Summary:`);
        console.log(`✅ Successfully recalculated: ${recalculatedCount} utility entries`);
        console.log(`❌ Errors encountered: ${errorCount} utility entries`);
        console.log(`📋 Backup table: tenant_utility_allocations_backup`);
        
        if (errorCount === 0) {
            console.log(`\n🎉 All utility allocations have been successfully recalculated with person-days weighted method!`);
        } else {
            console.log(`\n⚠️  Some entries had errors. Check the logs above for details.`);
        }
        
    } catch (error) {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    }
}

// Execute the migration
recalculateUtilityAllocations()
    .then(() => {
        console.log('\n✨ Migration completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    });