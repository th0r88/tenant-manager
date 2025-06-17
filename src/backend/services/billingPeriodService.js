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
    return new Promise((resolve, reject) => {
        const { notes = '', force = false } = options;
        
        // Check if billing period already exists and is finalized
        db.get(
            'SELECT * FROM billing_periods WHERE property_id = ? AND month = ? AND year = ?',
            [propertyId, month, year],
            (err, existing) => {
                if (err) return reject(err);
                
                if (existing && existing.calculation_status === 'finalized' && !force) {
                    return reject(new Error('Billing period is already finalized. Use force=true to override.'));
                }
                
                // Get all tenants for the property in this period
                db.all(
                    'SELECT * FROM tenants WHERE property_id = ?',
                    [propertyId],
                    (err, tenants) => {
                        if (err) return reject(err);
                        
                        // Calculate total rent for the period
                        let totalRentCalculated = 0;
                        tenants.forEach(tenant => {
                            const rentCalc = calculateProportionalRent(
                                tenant.rent_amount,
                                tenant.move_in_date,
                                tenant.move_out_date,
                                year,
                                month
                            );
                            totalRentCalculated += rentCalc.proRatedAmount;
                        });
                        
                        // Get utilities for this period
                        db.all(
                            'SELECT * FROM utility_entries WHERE property_id = ? AND month = ? AND year = ?',
                            [propertyId, month, year],
                            (err, utilities) => {
                                if (err) return reject(err);
                                
                                const totalUtilitiesCalculated = utilities.reduce((sum, u) => sum + u.total_amount, 0);
                                
                                // Insert or update billing period
                                const query = existing 
                                    ? 'UPDATE billing_periods SET total_rent_calculated = ?, total_utilities_calculated = ?, calculation_status = ?, calculation_date = CURRENT_TIMESTAMP, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
                                    : 'INSERT INTO billing_periods (property_id, month, year, total_rent_calculated, total_utilities_calculated, calculation_status, calculation_date, notes) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)';
                                
                                const params = existing
                                    ? [totalRentCalculated, totalUtilitiesCalculated, 'calculated', notes, existing.id]
                                    : [propertyId, month, year, totalRentCalculated, totalUtilitiesCalculated, 'calculated', notes];
                                
                                db.run(query, params, function(err) {
                                    if (err) return reject(err);
                                    
                                    const billingPeriodId = existing ? existing.id : this.lastID;
                                    
                                    // Create audit trail entry
                                    createAuditTrail(billingPeriodId, 'billing_period_calculated', {
                                        total_rent: totalRentCalculated,
                                        total_utilities: totalUtilitiesCalculated,
                                        tenant_count: tenants.length,
                                        utility_count: utilities.length
                                    });
                                    
                                    resolve({
                                        id: billingPeriodId,
                                        property_id: propertyId,
                                        month,
                                        year,
                                        total_rent_calculated: totalRentCalculated,
                                        total_utilities_calculated: totalUtilitiesCalculated,
                                        calculation_status: 'calculated',
                                        notes
                                    });
                                });
                            }
                        );
                    }
                );
            }
        );
    });
};

/**
 * Finalize a billing period (prevent further changes)
 * @param {number} billingPeriodId - Billing period ID
 * @param {string} notes - Optional finalization notes
 * @returns {Promise<Object>} - Updated billing period
 */
export const finalizeBillingPeriod = async (billingPeriodId, notes = '') => {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE billing_periods SET calculation_status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['finalized', notes, billingPeriodId],
            function(err) {
                if (err) return reject(err);
                
                if (this.changes === 0) {
                    return reject(new Error('Billing period not found'));
                }
                
                // Create audit trail
                createAuditTrail(billingPeriodId, 'billing_period_finalized', { notes });
                
                // Get updated billing period
                db.get(
                    'SELECT * FROM billing_periods WHERE id = ?',
                    [billingPeriodId],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row);
                    }
                );
            }
        );
    });
};

/**
 * Get billing periods with filtering and pagination
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} - Billing periods
 */
export const getBillingPeriods = async (filters = {}) => {
    return new Promise((resolve, reject) => {
        const { propertyId, status, year, limit = 50, offset = 0 } = filters;
        
        let query = `
            SELECT bp.*, p.name as property_name 
            FROM billing_periods bp
            JOIN properties p ON bp.property_id = p.id
            WHERE 1=1
        `;
        const params = [];
        
        if (propertyId) {
            query += ' AND bp.property_id = ?';
            params.push(propertyId);
        }
        
        if (status) {
            query += ' AND bp.calculation_status = ?';
            params.push(status);
        }
        
        if (year) {
            query += ' AND bp.year = ?';
            params.push(year);
        }
        
        query += ' ORDER BY bp.year DESC, bp.month DESC, bp.property_id LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        db.all(query, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

/**
 * Create an audit trail entry
 * @param {number} billingPeriodId - Billing period ID
 * @param {string} action - Action type
 * @param {Object} details - Action details
 */
const createAuditTrail = (billingPeriodId, action, details = {}) => {
    // Create audit trail table if it doesn't exist
    db.run(`
        CREATE TABLE IF NOT EXISTS billing_audit_trail (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            billing_period_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (billing_period_id) REFERENCES billing_periods (id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('Error creating audit trail table:', err);
            return;
        }
        
        // Insert audit trail entry
        db.run(
            'INSERT INTO billing_audit_trail (billing_period_id, action, details) VALUES (?, ?, ?)',
            [billingPeriodId, action, JSON.stringify(details)],
            (err) => {
                if (err) {
                    console.error('Error creating audit trail entry:', err);
                }
            }
        );
    });
};

/**
 * Get audit trail for a billing period
 * @param {number} billingPeriodId - Billing period ID
 * @returns {Promise<Array>} - Audit trail entries
 */
export const getBillingAuditTrail = async (billingPeriodId) => {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM billing_audit_trail WHERE billing_period_id = ? ORDER BY created_at DESC',
            [billingPeriodId],
            (err, rows) => {
                if (err) return reject(err);
                
                // Parse details JSON
                const auditTrail = rows.map(row => ({
                    ...row,
                    details: JSON.parse(row.details || '{}')
                }));
                
                resolve(auditTrail);
            }
        );
    });
};

/**
 * Recalculate billing period (retroactive adjustment)
 * @param {number} billingPeriodId - Billing period ID
 * @param {Object} adjustments - Manual adjustments
 * @returns {Promise<Object>} - Updated billing period
 */
export const recalculateBillingPeriod = async (billingPeriodId, adjustments = {}) => {
    return new Promise((resolve, reject) => {
        // Get existing billing period
        db.get(
            'SELECT * FROM billing_periods WHERE id = ?',
            [billingPeriodId],
            async (err, billingPeriod) => {
                if (err) return reject(err);
                if (!billingPeriod) return reject(new Error('Billing period not found'));
                
                if (billingPeriod.calculation_status === 'finalized') {
                    return reject(new Error('Cannot recalculate finalized billing period'));
                }
                
                try {
                    // Create audit trail for recalculation
                    createAuditTrail(billingPeriodId, 'billing_period_recalculated', {
                        previous_rent: billingPeriod.total_rent_calculated,
                        previous_utilities: billingPeriod.total_utilities_calculated,
                        adjustments
                    });
                    
                    // Recalculate using createBillingPeriod with force=true
                    const updated = await createBillingPeriod(
                        billingPeriod.property_id,
                        billingPeriod.month,
                        billingPeriod.year,
                        { force: true, notes: `Recalculated: ${adjustments.reason || 'Manual adjustment'}` }
                    );
                    
                    resolve(updated);
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
};

export default {
    createBillingPeriod,
    finalizeBillingPeriod,
    getBillingPeriods,
    getBillingAuditTrail,
    recalculateBillingPeriod
};