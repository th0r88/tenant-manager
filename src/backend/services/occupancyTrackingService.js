/**
 * Occupancy Change Tracking Service
 * Tracks all tenant occupancy changes with comprehensive history
 */

import db from '../database/db.js';
import { getDateFilterQuery } from '../database/queryAdapter.js';
import environmentConfig from '../config/environment.js';

/**
 * Initialize occupancy tracking table
 */
const initializeOccupancyTracking = () => {
    db.run(`
        CREATE TABLE IF NOT EXISTS occupancy_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            property_id INTEGER NOT NULL,
            change_type TEXT NOT NULL CHECK (change_type IN ('move_in', 'move_out', 'status_change', 'date_adjustment')),
            previous_move_in_date DATE,
            new_move_in_date DATE,
            previous_move_out_date DATE,
            new_move_out_date DATE,
            previous_status TEXT,
            new_status TEXT,
            reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
            FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('Error creating occupancy_changes table:', err);
        }
    });
};

// Initialize the table
initializeOccupancyTracking();

/**
 * Track occupancy change
 * @param {Object} change - Change details
 * @returns {Promise<number>} - Change record ID
 */
export const trackOccupancyChange = async (change) => {
    return new Promise((resolve, reject) => {
        const {
            tenant_id,
            property_id,
            change_type,
            previous_move_in_date,
            new_move_in_date,
            previous_move_out_date,
            new_move_out_date,
            previous_status,
            new_status,
            reason
        } = change;
        
        db.run(
            `INSERT INTO occupancy_changes 
             (tenant_id, property_id, change_type, previous_move_in_date, new_move_in_date, 
              previous_move_out_date, new_move_out_date, previous_status, new_status, reason) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                tenant_id, property_id, change_type,
                previous_move_in_date, new_move_in_date,
                previous_move_out_date, new_move_out_date,
                previous_status, new_status, reason
            ],
            function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
};

/**
 * Get occupancy history for a tenant
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Array>} - Occupancy change history
 */
export const getTenantOccupancyHistory = async (tenantId) => {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT oc.*, p.name as property_name, t.name || ' ' || t.surname as tenant_name
             FROM occupancy_changes oc
             JOIN properties p ON oc.property_id = p.id
             JOIN tenants t ON oc.tenant_id = t.id
             WHERE oc.tenant_id = ?
             ORDER BY oc.created_at DESC`,
            [tenantId],
            (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            }
        );
    });
};

/**
 * Get occupancy history for a property
 * @param {number} propertyId - Property ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} - Occupancy change history
 */
export const getPropertyOccupancyHistory = async (propertyId, filters = {}) => {
    return new Promise((resolve, reject) => {
        const { changeType, startDate, endDate, limit = 100 } = filters;
        
        let query = `
            SELECT oc.*, p.name as property_name, t.name || ' ' || t.surname as tenant_name
            FROM occupancy_changes oc
            JOIN properties p ON oc.property_id = p.id
            JOIN tenants t ON oc.tenant_id = t.id
            WHERE oc.property_id = ?
        `;
        const params = [propertyId];
        
        if (changeType) {
            query += ' AND oc.change_type = ?';
            params.push(changeType);
        }
        
        if (startDate) {
            query += ' AND oc.created_at >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND oc.created_at <= ?';
            params.push(endDate);
        }
        
        query += ' ORDER BY oc.created_at DESC LIMIT ?';
        params.push(limit);
        
        db.all(query, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

/**
 * Get occupancy statistics for a property and time period
 * @param {number} propertyId - Property ID
 * @param {number} year - Year
 * @param {number} month - Month (optional)
 * @returns {Promise<Object>} - Occupancy statistics
 */
export const getOccupancyStatistics = async (propertyId, year, month = null) => {
    return new Promise((resolve, reject) => {
        let query = `
            SELECT 
                COUNT(DISTINCT oc.tenant_id) as total_tenants_affected,
                COUNT(CASE WHEN oc.change_type = 'move_in' THEN 1 END) as move_ins,
                COUNT(CASE WHEN oc.change_type = 'move_out' THEN 1 END) as move_outs,
                COUNT(CASE WHEN oc.change_type = 'status_change' THEN 1 END) as status_changes,
                COUNT(CASE WHEN oc.change_type = 'date_adjustment' THEN 1 END) as date_adjustments
            FROM occupancy_changes oc
            WHERE oc.property_id = ? 
            AND ${getDateFilterQuery('oc.created_at', '%Y', environmentConfig.getDatabaseConfig().type)}
        `;
        const params = [propertyId, year.toString()];
        
        if (month) {
            query += ` AND ${getDateFilterQuery('oc.created_at', '%m', environmentConfig.getDatabaseConfig().type)}`;
            params.push(month.toString().padStart(2, '0'));
        }
        
        db.get(query, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
};

/**
 * Get comprehensive occupancy report for all properties
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} - Comprehensive occupancy report
 */
export const getComprehensiveOccupancyReport = async (filters = {}) => {
    return new Promise((resolve, reject) => {
        const { year, month, propertyId } = filters;
        
        let query = `
            SELECT 
                p.id as property_id,
                p.name as property_name,
                COUNT(DISTINCT oc.tenant_id) as total_tenants_affected,
                COUNT(CASE WHEN oc.change_type = 'move_in' THEN 1 END) as move_ins,
                COUNT(CASE WHEN oc.change_type = 'move_out' THEN 1 END) as move_outs,
                COUNT(CASE WHEN oc.change_type = 'status_change' THEN 1 END) as status_changes,
                COUNT(CASE WHEN oc.change_type = 'date_adjustment' THEN 1 END) as date_adjustments,
                MIN(oc.created_at) as first_change,
                MAX(oc.created_at) as last_change
            FROM properties p
            LEFT JOIN occupancy_changes oc ON p.id = oc.property_id
            WHERE 1=1
        `;
        const params = [];
        
        if (propertyId) {
            query += ' AND p.id = ?';
            params.push(propertyId);
        }
        
        if (year) {
            query += ` AND ${getDateFilterQuery('oc.created_at', '%Y', environmentConfig.getDatabaseConfig().type)}`;
            params.push(year.toString());
        }
        
        if (month) {
            query += ` AND ${getDateFilterQuery('oc.created_at', '%m', environmentConfig.getDatabaseConfig().type)}`;
            params.push(month.toString().padStart(2, '0'));
        }
        
        query += ' GROUP BY p.id, p.name ORDER BY p.name';
        
        db.all(query, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

/**
 * Track tenant update and create occupancy change record
 * @param {number} tenantId - Tenant ID
 * @param {Object} previousData - Previous tenant data
 * @param {Object} newData - New tenant data
 * @param {string} reason - Reason for change
 * @returns {Promise<number|null>} - Change record ID or null if no changes
 */
export const trackTenantUpdate = async (tenantId, previousData, newData, reason = 'Tenant data updated') => {
    // Determine what changed
    const changes = {};
    let hasChanges = false;
    
    if (previousData.move_in_date !== newData.move_in_date) {
        changes.previous_move_in_date = previousData.move_in_date;
        changes.new_move_in_date = newData.move_in_date;
        hasChanges = true;
    }
    
    if (previousData.move_out_date !== newData.move_out_date) {
        changes.previous_move_out_date = previousData.move_out_date;
        changes.new_move_out_date = newData.move_out_date;
        hasChanges = true;
    }
    
    if (previousData.occupancy_status !== newData.occupancy_status) {
        changes.previous_status = previousData.occupancy_status;
        changes.new_status = newData.occupancy_status;
        hasChanges = true;
    }
    
    if (!hasChanges) {
        return null;
    }
    
    // Determine change type
    let changeType = 'date_adjustment';
    if (changes.previous_status !== changes.new_status) {
        if (changes.new_status === 'active' && changes.previous_status !== 'active') {
            changeType = 'move_in';
        } else if (changes.new_status === 'moved_out' && changes.previous_status !== 'moved_out') {
            changeType = 'move_out';
        } else {
            changeType = 'status_change';
        }
    }
    
    const changeRecord = {
        tenant_id: tenantId,
        property_id: newData.property_id,
        change_type: changeType,
        reason,
        ...changes
    };
    
    return await trackOccupancyChange(changeRecord);
};

export default {
    trackOccupancyChange,
    getTenantOccupancyHistory,
    getPropertyOccupancyHistory,
    getOccupancyStatistics,
    getComprehensiveOccupancyReport,
    trackTenantUpdate
};