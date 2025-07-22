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
        // Calculate the actual last day of the month to avoid invalid dates like June 31st
        const lastDayOfMonth = new Date(utility.year, utility.month, 0).getDate();
        const endOfMonth = `${utility.year}-${utility.month.toString().padStart(2, '0')}-${lastDayOfMonth.toString().padStart(2, '0')}`;
        
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
            // Calculate person-days weighted allocation
            let totalPersonDays = 0;
            const tenantPersonDaysData = [];

            for (const tenant of tenants) {
                // Only include tenants who were present during the month
                const occupiedDays = calculateOccupiedDays(
                    tenant.move_in_date,
                    tenant.move_out_date,
                    utility.year,
                    utility.month
                );
                
                if (occupiedDays > 0) {
                    const numberOfPeople = tenant.number_of_people || 1;
                    const personDays = numberOfPeople * occupiedDays;
                    tenantPersonDaysData.push({ tenant, numberOfPeople, occupiedDays, personDays });
                    totalPersonDays += personDays;
                }
            }

            if (totalPersonDays === 0) {
                throw new Error('No person-days found for per-person allocation');
            }

            // Allocate based on person-days (ensures 100% cost allocation)
            const costPerPersonDay = precisionMath.divide(utility.total_amount, totalPersonDays);
            
            for (const { tenant, personDays } of tenantPersonDaysData) {
                const allocatedAmount = precisionMath.multiply(costPerPersonDay, personDays);
                
                allocations.push({
                    tenant_id: tenant.id,
                    utility_entry_id: utilityEntryId,
                    allocated_amount: parseFloat(allocatedAmount.toFixed(2))
                });
            }

        } else if (utility.allocation_method === 'per_sqm') {
            // Calculate per-sqm allocation: (HeatingCost ÷ HouseArea) × RoomArea × occupancy ratio
            const houseArea = parseFloat(tenants[0]?.house_area) || 0;
            
            if (houseArea === 0) {
                throw new Error('Property house area not found for per-sqm allocation');
            }
            
            // Calculate cost per square meter based on total house area
            const costPerSqm = precisionMath.divide(utility.total_amount, houseArea);
            
            for (const tenant of tenants) {
                const occupiedDays = calculateOccupiedDays(
                    tenant.move_in_date,
                    tenant.move_out_date,
                    utility.year,
                    utility.month
                );
                
                if (occupiedDays > 0) {
                    const tenantRoomArea = parseFloat(tenant.room_area) || 0;
                    const daysInMonth = new Date(utility.year, utility.month, 0).getDate();
                    
                    // Formula: (HeatingCost ÷ HouseArea) × RoomArea × (occupiedDays ÷ daysInMonth)
                    let allocatedAmount = precisionMath.multiply(costPerSqm, tenantRoomArea);
                    
                    // Apply proration if tenant was not there for the full month
                    if (occupiedDays < daysInMonth) {
                        const occupancyRatio = occupiedDays / daysInMonth;
                        allocatedAmount = precisionMath.multiply(allocatedAmount, occupancyRatio);
                    }
                    
                    allocations.push({
                        tenant_id: tenant.id,
                        utility_entry_id: utilityEntryId,
                        allocated_amount: parseFloat(allocatedAmount.toFixed(2))
                    });
                }
            }

        } else {
            throw new Error(`Unknown allocation method: ${utility.allocation_method}`);
        }

        // Validate 100% cost allocation
        const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0);
        const expectedTotal = parseFloat(utility.total_amount);
        const difference = Math.abs(totalAllocated - expectedTotal);
        
        if (difference > 0.01) { // Allow 1 cent tolerance for rounding
            console.warn(`Allocation mismatch: Expected ${expectedTotal}, got ${totalAllocated}, difference: ${difference}`);
        }

        // Insert all allocations
        for (const allocation of allocations) {
            await db.query(
                'INSERT INTO tenant_utility_allocations (tenant_id, utility_entry_id, allocated_amount) VALUES ($1, $2, $3)',
                [allocation.tenant_id, allocation.utility_entry_id, allocation.allocated_amount]
            );
        }

        console.log(`Allocated ${utility.total_amount} ${utility.utility_type} among ${tenants.length} tenants using ${utility.allocation_method} method (Total allocated: ${totalAllocated})`);
        
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