import db from '../database/db.js';
import { calculatePersonDays, calculateSqmDays } from './proportionalCalculationService.js';
import precisionMath from '../utils/precisionMath.js';

export function calculateAllocations(utilityEntryId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM utility_entries WHERE id = ?', [utilityEntryId], (err, utility) => {
            if (err) return reject(err);
            
            // Get active tenants for the property during the utility period
            // Handle both NULL and empty string values for move_out_date
            const tenantQuery = `
                SELECT * FROM tenants 
                WHERE property_id = ? 
                AND occupancy_status = 'active'
                AND move_in_date <= date(? || '-' || printf('%02d', ?) || '-01', '+1 month', '-1 day')
                AND (move_out_date IS NULL OR move_out_date = '' OR move_out_date >= date(? || '-' || printf('%02d', ?) || '-01'))
            `;
            
            db.all(tenantQuery, [
                utility.property_id, 
                utility.year, utility.month,
                utility.year, utility.month
            ], (err, tenants) => {
                if (err) return reject(err);
                
                const allocations = [];
                
                if (utility.allocation_method === 'per_person') {
                    const totalPeople = tenants.reduce((sum, tenant) => sum + (tenant.number_of_people || 1), 0);
                    const amountPerPerson = precisionMath.allocateUtilityPerPerson(utility.total_amount, totalPeople);
                    tenants.forEach(tenant => {
                        const tenantPeople = tenant.number_of_people || 1;
                        const tenantAmount = precisionMath.multiply(amountPerPerson, tenantPeople);
                        allocations.push({
                            tenant_id: tenant.id,
                            utility_entry_id: utilityEntryId,
                            allocated_amount: precisionMath.toNumber(tenantAmount)
                        });
                    });
                } else if (utility.allocation_method === 'per_sqm') {
                    const tenantAreas = tenants.map(tenant => tenant.room_area);
                    const allocatedAmounts = precisionMath.allocateUtilityPerArea(utility.total_amount, tenantAreas);
                    
                    tenants.forEach((tenant, index) => {
                        allocations.push({
                            tenant_id: tenant.id,
                            utility_entry_id: utilityEntryId,
                            allocated_amount: precisionMath.toNumber(allocatedAmounts[index])
                        });
                    });
                } else if (utility.allocation_method === 'per_person_weighted') {
                    const tenantsWithPersonDays = calculatePersonDays(tenants, utility.year, utility.month);
                    const totalPersonDays = precisionMath.add(...tenantsWithPersonDays.map(t => t.personDays));
                    
                    if (precisionMath.isPositive(totalPersonDays)) {
                        tenantsWithPersonDays.forEach(tenant => {
                            const proportion = precisionMath.divide(tenant.personDays, totalPersonDays);
                            const weightedAmount = precisionMath.multiply(utility.total_amount, proportion);
                            allocations.push({
                                tenant_id: tenant.id,
                                utility_entry_id: utilityEntryId,
                                allocated_amount: precisionMath.toNumber(precisionMath.toCurrency(weightedAmount))
                            });
                        });
                    }
                } else if (utility.allocation_method === 'per_sqm_weighted') {
                    const tenantsWithSqmDays = calculateSqmDays(tenants, utility.year, utility.month);
                    const totalSqmDays = precisionMath.add(...tenantsWithSqmDays.map(t => t.sqmDays));
                    
                    if (precisionMath.isPositive(totalSqmDays)) {
                        tenantsWithSqmDays.forEach(tenant => {
                            const proportion = precisionMath.divide(tenant.sqmDays, totalSqmDays);
                            const weightedAmount = precisionMath.multiply(utility.total_amount, proportion);
                            allocations.push({
                                tenant_id: tenant.id,
                                utility_entry_id: utilityEntryId,
                                allocated_amount: precisionMath.toNumber(precisionMath.toCurrency(weightedAmount))
                            });
                        });
                    }
                }
                
                // Insert allocations into database
                if (allocations.length > 0) {
                    const stmt = db.prepare('INSERT INTO tenant_utility_allocations (tenant_id, utility_entry_id, allocated_amount) VALUES (?, ?, ?)');
                    
                    allocations.forEach(allocation => {
                        stmt.run([allocation.tenant_id, allocation.utility_entry_id, allocation.allocated_amount]);
                    });
                    
                    stmt.finalize((err) => {
                        if (err) reject(err);
                        else resolve(allocations);
                    });
                } else {
                    resolve([]);
                }
            });
        });
    });
}

/**
 * Calculate weighted allocations with detailed breakdown
 * @param {number} utilityEntryId - The utility entry ID
 * @returns {Promise} - Promise resolving to allocation details with breakdown
 */
export function calculateWeightedAllocations(utilityEntryId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM utility_entries WHERE id = ?', [utilityEntryId], (err, utility) => {
            if (err) return reject(err);
            
            const tenantQuery = `
                SELECT * FROM tenants 
                WHERE property_id = ? 
                AND occupancy_status = 'active'
                AND move_in_date <= date(? || '-' || printf('%02d', ?) || '-01', '+1 month', '-1 day')
                AND (move_out_date IS NULL OR move_out_date = '' OR move_out_date >= date(? || '-' || printf('%02d', ?) || '-01'))
            `;
            
            db.all(tenantQuery, [
                utility.property_id,
                utility.year, utility.month,
                utility.year, utility.month
            ], (err, tenants) => {
                if (err) return reject(err);
                
                let breakdown = {};
                
                if (utility.allocation_method === 'per_person_weighted') {
                    const tenantsWithPersonDays = calculatePersonDays(tenants, utility.year, utility.month);
                    const totalPersonDays = precisionMath.add(...tenantsWithPersonDays.map(t => t.personDays));
                    const ratePerPersonDay = precisionMath.isPositive(totalPersonDays) ? 
                        precisionMath.divide(utility.total_amount, totalPersonDays) : precisionMath.ZERO;
                    
                    breakdown = {
                        method: 'per_person_weighted',
                        totalPersonDays: precisionMath.toNumber(totalPersonDays),
                        totalAmount: utility.total_amount,
                        ratePerPersonDay: precisionMath.toNumber(ratePerPersonDay),
                        tenants: tenantsWithPersonDays.map(tenant => {
                            const proportion = precisionMath.isPositive(totalPersonDays) ?
                                precisionMath.divide(tenant.personDays, totalPersonDays) : precisionMath.ZERO;
                            const allocatedAmount = precisionMath.multiply(utility.total_amount, proportion);
                            
                            return {
                                ...tenant,
                                allocatedAmount: precisionMath.toNumber(precisionMath.toCurrency(allocatedAmount))
                            };
                        })
                    };
                } else if (utility.allocation_method === 'per_sqm_weighted') {
                    const tenantsWithSqmDays = calculateSqmDays(tenants, utility.year, utility.month);
                    const totalSqmDays = precisionMath.add(...tenantsWithSqmDays.map(t => t.sqmDays));
                    const ratePerSqmDay = precisionMath.isPositive(totalSqmDays) ?
                        precisionMath.divide(utility.total_amount, totalSqmDays) : precisionMath.ZERO;
                    
                    breakdown = {
                        method: 'per_sqm_weighted',
                        totalSqmDays: precisionMath.toNumber(totalSqmDays),
                        totalAmount: utility.total_amount,
                        ratePerSqmDay: precisionMath.toNumber(ratePerSqmDay),
                        tenants: tenantsWithSqmDays.map(tenant => {
                            const proportion = precisionMath.isPositive(totalSqmDays) ?
                                precisionMath.divide(tenant.sqmDays, totalSqmDays) : precisionMath.ZERO;
                            const allocatedAmount = precisionMath.multiply(utility.total_amount, proportion);
                            
                            return {
                                ...tenant,
                                allocatedAmount: precisionMath.toNumber(precisionMath.toCurrency(allocatedAmount))
                            };
                        })
                    };
                }
                
                resolve(breakdown);
            });
        });
    });
}

/**
 * Get available allocation methods with descriptions
 * @returns {Array} - Array of allocation method objects
 */
export function getAllocationMethods() {
    return [
        {
            value: 'per_person',
            label: 'Per Person (Equal Split)',
            description: 'Split equally among all tenants regardless of occupancy period'
        },
        {
            value: 'per_sqm',
            label: 'Per Square Meter (Area Based)',
            description: 'Split based on room area regardless of occupancy period'
        },
        {
            value: 'per_person_weighted',
            label: 'Per Person (Weighted by Occupancy)',
            description: 'Split based on actual person-days occupied during the month'
        },
        {
            value: 'per_sqm_weighted',
            label: 'Per Square Meter (Weighted by Occupancy)',
            description: 'Split based on square-meter-days occupied during the month'
        }
    ];
}