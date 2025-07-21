/**
 * Billing Period Management Service
 * Handles billing period creation, tracking, and audit trails
 */

import db from '../database/db.js';
import { calculateProportionalRent, calculatePersonDays, calculateSqmDays } from './proportionalCalculationService.js';
import { calculateAllocations } from './calculationService.js';

/**
 * Create or update a billing period for a property and month
 * @param {number} propertyId - Property ID
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @param {Object} options - Billing options
 * @returns {Promise<Object>} - Billing period details
 */
export const createBillingPeriod = async (propertyId, month, year, options = {}) => {
    const { notes = '', force = false } = options;
    
    try {
        // Check if billing period already exists
        const existingResult = await db.query(
            'SELECT id FROM billing_periods WHERE property_id = $1 AND month = $2 AND year = $3',
            [propertyId, month, year]
        );
        
        if (existingResult.rows.length > 0 && !force) {
            throw new Error(`Billing period already exists for ${month}/${year}`);
        }
        
        // Get all tenants for this property during the billing period
        const tenantsResult = await db.query(
            `SELECT t.*, 
                    p.house_area,
                    CASE 
                        WHEN t.move_in_date <= $3 AND (t.move_out_date IS NULL OR t.move_out_date >= $2) 
                        THEN true 
                        ELSE false 
                    END as was_present
             FROM tenants t
             JOIN properties p ON t.property_id = p.id  
             WHERE t.property_id = $1`,
            [propertyId, `${year}-${month.toString().padStart(2, '0')}-01`, `${year}-${month.toString().padStart(2, '0')}-${new Date(year, month, 0).getDate().toString().padStart(2, '0')}`]
        );
        
        const tenants = tenantsResult.rows.filter(t => t.was_present);
        
        // Get utility entries for this billing period
        const utilitiesResult = await db.query(
            `SELECT ue.*, COUNT(tua.id) as allocation_count
             FROM utility_entries ue
             LEFT JOIN tenant_utility_allocations tua ON ue.id = tua.utility_entry_id
             WHERE ue.property_id = $1 AND ue.month = $2 AND ue.year = $3
             GROUP BY ue.id`,
            [propertyId, month, year]
        );
        const utilities = utilitiesResult.rows;
        
        // Calculate billing details
        const billingDetails = {
            property_id: propertyId,
            month,
            year, 
            tenant_count: tenants.length,
            total_rent: tenants.reduce((sum, t) => {
                const rentCalc = calculateProportionalRent(t.rent_amount, t.move_in_date, t.move_out_date, year, month);
                return sum + (rentCalc.isFullMonth ? rentCalc.monthlyRent : rentCalc.proRatedAmount);
            }, 0),
            total_utilities: utilities.reduce((sum, u) => sum + parseFloat(u.total_amount), 0),
            notes,
            created_at: new Date().toISOString()
        };
        
        // Insert or update billing period
        const query = existingResult.rows.length > 0 
            ? 'UPDATE billing_periods SET tenant_count=$2, total_rent=$3, total_utilities=$4, notes=$5, updated_at=CURRENT_TIMESTAMP WHERE property_id=$1 AND month=$6 AND year=$7 RETURNING id'
            : 'INSERT INTO billing_periods (property_id, month, year, tenant_count, total_rent, total_utilities, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id';
            
        const params = existingResult.rows.length > 0
            ? [propertyId, billingDetails.tenant_count, billingDetails.total_rent, billingDetails.total_utilities, notes, month, year]
            : [propertyId, month, year, billingDetails.tenant_count, billingDetails.total_rent, billingDetails.total_utilities, notes];
            
        const result = await db.query(query, params);
        const billingPeriodId = result.rows[0].id;
        
        // Create audit trail
        await createAuditTrail(billingPeriodId, existingResult.rows.length > 0 ? 'updated' : 'created', {
            tenant_count: billingDetails.tenant_count,
            total_rent: billingDetails.total_rent,
            total_utilities: billingDetails.total_utilities,
            force_update: force
        });
        
        // Ensure all utilities have allocations calculated
        for (const utility of utilities) {
            if (utility.allocation_count === 0) {
                await calculateAllocations(utility.id);
            }
        }
        
        return {
            id: billingPeriodId,
            ...billingDetails,
            tenants,
            utilities
        };
        
    } catch (error) {
        console.error('Error creating billing period:', error);
        throw error;
    }
};

/**
 * Get billing periods for a property
 * @param {number} propertyId - Property ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Billing periods
 */
export const getBillingPeriods = async (propertyId, options = {}) => {
    const { limit = 12, includeDetails = false } = options;
    
    let query = `
        SELECT bp.*, p.name as property_name
        FROM billing_periods bp
        JOIN properties p ON bp.property_id = p.id
        WHERE bp.property_id = $1
        ORDER BY bp.year DESC, bp.month DESC
        LIMIT $2
    `;
    
    const result = await db.query(query, [propertyId, limit]);
    
    if (!includeDetails) {
        return result.rows;
    }
    
    // Include tenant and utility details for each billing period
    const periodsWithDetails = await Promise.all(
        result.rows.map(async (period) => {
            // Get tenants for this billing period
            const tenantsResult = await db.query(
                `SELECT t.*
                 FROM tenants t
                 WHERE t.property_id = $1
                 AND t.move_in_date <= $2
                 AND (t.move_out_date IS NULL OR t.move_out_date >= $3)`,
                [
                    propertyId,
                    `${period.year}-${period.month.toString().padStart(2, '0')}-${new Date(period.year, period.month, 0).getDate().toString().padStart(2, '0')}`,
                    `${period.year}-${period.month.toString().padStart(2, '0')}-01`
                ]
            );
            
            // Get utilities for this billing period
            const utilitiesResult = await db.query(
                `SELECT ue.*
                 FROM utility_entries ue
                 WHERE ue.property_id = $1 AND ue.month = $2 AND ue.year = $3`,
                [propertyId, period.month, period.year]
            );
            
            return {
                ...period,
                tenants: tenantsResult.rows,
                utilities: utilitiesResult.rows
            };
        })
    );
    
    return periodsWithDetails;
};

/**
 * Create audit trail entry
 * @param {number} billingPeriodId - Billing period ID
 * @param {string} action - Action taken
 * @param {Object} details - Action details
 */
const createAuditTrail = async (billingPeriodId, action, details = {}) => {
    try {
        // Create audit trail table if it doesn't exist
        await db.query(`
            CREATE TABLE IF NOT EXISTS billing_audit_trail (
                id BIGSERIAL PRIMARY KEY,
                billing_period_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (billing_period_id) REFERENCES billing_periods (id) ON DELETE CASCADE
            )
        `);
        
        // Insert audit trail entry
        await db.query(
            'INSERT INTO billing_audit_trail (billing_period_id, action, details) VALUES ($1, $2, $3)',
            [billingPeriodId, action, JSON.stringify(details)]
        );
    } catch (err) {
        console.error('Error creating audit trail:', err);
    }
};

/**
 * Get audit trail for billing periods
 * @param {number} propertyId - Property ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Audit trail entries
 */
export const getBillingAuditTrail = async (propertyId, options = {}) => {
    const { limit = 50 } = options;
    
    const result = await db.query(
        `SELECT bat.*, bp.month, bp.year, p.name as property_name
         FROM billing_audit_trail bat
         JOIN billing_periods bp ON bat.billing_period_id = bp.id
         JOIN properties p ON bp.property_id = p.id
         WHERE bp.property_id = $1
         ORDER BY bat.created_at DESC
         LIMIT $2`,
        [propertyId, limit]
    );
    
    return result.rows.map(row => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : {}
    }));
};

/**
 * Get billing summary for a specific period
 * @param {number} propertyId - Property ID
 * @param {number} month - Month
 * @param {number} year - Year
 * @returns {Promise<Object>} - Billing summary
 */
export const getBillingSummary = async (propertyId, month, year) => {
    const result = await db.query(
        `SELECT bp.*, p.name as property_name, p.house_area
         FROM billing_periods bp
         JOIN properties p ON bp.property_id = p.id
         WHERE bp.property_id = $1 AND bp.month = $2 AND bp.year = $3`,
        [propertyId, month, year]
    );
    
    if (result.rows.length === 0) {
        return null;
    }
    
    return result.rows[0];
};

export default {
    createBillingPeriod,
    getBillingPeriods,
    getBillingAuditTrail,
    getBillingSummary
};