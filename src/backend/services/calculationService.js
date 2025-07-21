import db from '../database/db.js';
import { calculateOccupiedDays } from './proportionalCalculationService.js';
import precisionMath from '../utils/precisionMath.js';
import { getOccupancyDateRangeQuery } from '../database/queryAdapter.js';
import environmentConfig from '../config/environment.js';

export const calculateAllocations = async (utilityEntryId) => {
    try {
        // Get the utility entry details
        const utilityResult = await db.query('SELECT * FROM utility_entries WHERE id = $1', [utilityEntryId]);
        const utility = utilityResult.rows[0];
        
        if (!utility) {
            throw new Error('Utility entry not found');
        }

        // Delete existing allocations for this utility entry
        await db.query('DELETE FROM tenant_utility_allocations WHERE utility_entry_id = $1', [utilityEntryId]);

        // Get tenants for this property during the utility period
        const tenantQuery = `
            SELECT t.*, p.house_area
            FROM tenants t
            JOIN properties p ON t.property_id = p.id
            WHERE t.property_id = $1
            AND (
                (t.move_in_date <= $2 AND (t.move_out_date IS NULL OR t.move_out_date >= $2))
                OR
                (t.move_in_date <= $3 AND (t.move_out_date IS NULL OR t.move_out_date >= $3))
                OR
                (t.move_in_date >= $2 AND t.move_in_date <= $3)
            )
        `;
        
        const startOfMonth = `${utility.year}-${utility.month.toString().padStart(2, '0')}-01`;
        const endOfMonth = `${utility.year}-${utility.month.toString().padStart(2, '0')}-31`;
        
        const tenantsResult = await db.query(tenantQuery, [
            utility.property_id,
            startOfMonth,
            endOfMonth
        ]);
        const tenants = tenantsResult.rows;

        if (tenants.length === 0) {
            console.log('No tenants found for property during', utility.month, '/', utility.year);
            return [];
        }

        let allocations = [];

        if (utility.allocation_method === 'per_person') {
            // Calculate proportional person-days for each tenant
            let totalPersonDays = 0;
            const tenantPersonDays = [];

            for (const tenant of tenants) {
                const occupiedDays = calculateOccupiedDays(
                    tenant.move_in_date,
                    tenant.move_out_date,
                    utility.year,
                    utility.month
                );
                const personDays = occupiedDays * (tenant.number_of_people || 1);
                tenantPersonDays.push({ tenant, personDays });
                totalPersonDays += personDays;
            }

            if (totalPersonDays === 0) {
                throw new Error('No person-days found for per-person allocation');
            }

            // Allocate based on proportional person-days
            for (const { tenant, personDays } of tenantPersonDays) {
                const proportion = personDays / totalPersonDays;
                const allocatedAmount = precisionMath.multiply(utility.total_amount, proportion);
                
                allocations.push({
                    tenant_id: tenant.id,
                    utility_entry_id: utilityEntryId,
                    allocated_amount: parseFloat(allocatedAmount.toFixed(2))
                });
            }

        } else if (utility.allocation_method === 'per_sqm') {
            // Calculate proportional sqm-days for each tenant
            let totalSqmDays = 0;
            const tenantSqmDays = [];

            for (const tenant of tenants) {
                const occupiedDays = calculateOccupiedDays(
                    tenant.move_in_date,
                    tenant.move_out_date,
                    utility.year,
                    utility.month
                );
                const sqmDays = occupiedDays * (parseFloat(tenant.room_area) || 0);
                tenantSqmDays.push({ tenant, sqmDays });
                totalSqmDays += sqmDays;
            }

            if (totalSqmDays === 0) {
                throw new Error('No sqm-days found for per-sqm allocation');
            }

            // Allocate based on proportional sqm-days
            for (const { tenant, sqmDays } of tenantSqmDays) {
                const proportion = sqmDays / totalSqmDays;
                const allocatedAmount = precisionMath.multiply(utility.total_amount, proportion);
                
                allocations.push({
                    tenant_id: tenant.id,
                    utility_entry_id: utilityEntryId,
                    allocated_amount: parseFloat(allocatedAmount.toFixed(2))
                });
            }

        } else {
            throw new Error(`Unknown allocation method: ${utility.allocation_method}`);
        }

        // Insert all allocations
        for (const allocation of allocations) {
            await db.query(
                'INSERT INTO tenant_utility_allocations (tenant_id, utility_entry_id, allocated_amount) VALUES ($1, $2, $3)',
                [allocation.tenant_id, allocation.utility_entry_id, allocation.allocated_amount]
            );
        }

        console.log(`Allocated ${utility.total_amount} ${utility.utility_type} among ${tenants.length} tenants using ${utility.allocation_method} method`);
        
        return allocations;

    } catch (error) {
        console.error('Error calculating allocations:', error);
        throw error;
    }
};

export const recalculateAllAllocations = async (utilityEntryId) => {
    try {
        // Get the utility entry details  
        const utilityResult = await db.query('SELECT * FROM utility_entries WHERE id = $1', [utilityEntryId]);
        const utility = utilityResult.rows[0];
        
        if (!utility) {
            throw new Error('Utility entry not found');
        }

        // Recalculate using the standard method
        return await calculateAllocations(utilityEntryId);

    } catch (error) {
        console.error('Error recalculating allocations:', error);
        throw error;
    }
};

export default {
    calculateAllocations,
    recalculateAllAllocations
};