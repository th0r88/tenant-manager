import db from '../database/db.js';
import { calculatePersonDays, calculateSqmDays } from './proportionalCalculationService.js';

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
                    const amountPerPerson = utility.total_amount / tenants.length;
                    tenants.forEach(tenant => {
                        allocations.push({
                            tenant_id: tenant.id,
                            utility_entry_id: utilityEntryId,
                            allocated_amount: Math.round(amountPerPerson * 100) / 100
                        });
                    });
                } else if (utility.allocation_method === 'per_sqm') {
                    const totalArea = tenants.reduce((sum, tenant) => sum + tenant.room_area, 0);
                    const amountPerSqm = utility.total_amount / totalArea;
                    tenants.forEach(tenant => {
                        allocations.push({
                            tenant_id: tenant.id,
                            utility_entry_id: utilityEntryId,
                            allocated_amount: Math.round(amountPerSqm * tenant.room_area * 100) / 100
                        });
                    });
                } else if (utility.allocation_method === 'per_person_weighted') {
                    const tenantsWithPersonDays = calculatePersonDays(tenants, utility.year, utility.month);
                    const totalPersonDays = tenantsWithPersonDays.reduce((sum, t) => sum + t.personDays, 0);
                    
                    if (totalPersonDays > 0) {
                        tenantsWithPersonDays.forEach(tenant => {
                            const weightedAmount = (utility.total_amount * tenant.personDays) / totalPersonDays;
                            allocations.push({
                                tenant_id: tenant.id,
                                utility_entry_id: utilityEntryId,
                                allocated_amount: Math.round(weightedAmount * 100) / 100
                            });
                        });
                    }
                } else if (utility.allocation_method === 'per_sqm_weighted') {
                    const tenantsWithSqmDays = calculateSqmDays(tenants, utility.year, utility.month);
                    const totalSqmDays = tenantsWithSqmDays.reduce((sum, t) => sum + t.sqmDays, 0);
                    
                    if (totalSqmDays > 0) {
                        tenantsWithSqmDays.forEach(tenant => {
                            const weightedAmount = (utility.total_amount * tenant.sqmDays) / totalSqmDays;
                            allocations.push({
                                tenant_id: tenant.id,
                                utility_entry_id: utilityEntryId,
                                allocated_amount: Math.round(weightedAmount * 100) / 100
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
                    const totalPersonDays = tenantsWithPersonDays.reduce((sum, t) => sum + t.personDays, 0);
                    
                    breakdown = {
                        method: 'per_person_weighted',
                        totalPersonDays,
                        totalAmount: utility.total_amount,
                        ratePerPersonDay: totalPersonDays > 0 ? utility.total_amount / totalPersonDays : 0,
                        tenants: tenantsWithPersonDays.map(tenant => ({
                            ...tenant,
                            allocatedAmount: totalPersonDays > 0 ? 
                                Math.round((utility.total_amount * tenant.personDays / totalPersonDays) * 100) / 100 : 0
                        }))
                    };
                } else if (utility.allocation_method === 'per_sqm_weighted') {
                    const tenantsWithSqmDays = calculateSqmDays(tenants, utility.year, utility.month);
                    const totalSqmDays = tenantsWithSqmDays.reduce((sum, t) => sum + t.sqmDays, 0);
                    
                    breakdown = {
                        method: 'per_sqm_weighted',
                        totalSqmDays,
                        totalAmount: utility.total_amount,
                        ratePerSqmDay: totalSqmDays > 0 ? utility.total_amount / totalSqmDays : 0,
                        tenants: tenantsWithSqmDays.map(tenant => ({
                            ...tenant,
                            allocatedAmount: totalSqmDays > 0 ? 
                                Math.round((utility.total_amount * tenant.sqmDays / totalSqmDays) * 100) / 100 : 0
                        }))
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