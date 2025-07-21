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
const initializeOccupancyTracking = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS occupancy_changes (
                id BIGSERIAL PRIMARY KEY,
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
                FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
            )
        `);
    } catch (err) {
        console.error('Error creating occupancy_changes table:', err);
    }
};

// Initialize the table
initializeOccupancyTracking().catch(err => console.error('Failed to initialize occupancy tracking:', err));

/**
 * Track occupancy change
 * @param {Object} change - Change details
 * @returns {Promise<number>} - Change record ID
 */
export const trackOccupancyChange = async (change) => {
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
    
    const result = await db.query(
        `INSERT INTO occupancy_changes 
         (tenant_id, property_id, change_type, previous_move_in_date, new_move_in_date, 
          previous_move_out_date, new_move_out_date, previous_status, new_status, reason) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
            tenant_id, property_id, change_type,
            previous_move_in_date, new_move_in_date,
            previous_move_out_date, new_move_out_date,
            previous_status, new_status, reason
        ]
    );
    
    return result.rows[0].id;
};

/**
 * Get occupancy history for a tenant
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Array>} - Occupancy change history
 */
export const getTenantOccupancyHistory = async (tenantId) => {
    const result = await db.query(
        `SELECT oc.*, p.name as property_name, t.name || ' ' || t.surname as tenant_name
         FROM occupancy_changes oc
         JOIN properties p ON oc.property_id = p.id
         JOIN tenants t ON oc.tenant_id = t.id
         WHERE oc.tenant_id = $1
         ORDER BY oc.created_at DESC`,
        [tenantId]
    );
    return result.rows;
};

/**
 * Get occupancy history for a property
 * @param {number} propertyId - Property ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} - Occupancy change history
 */
export const getPropertyOccupancyHistory = async (propertyId, filters = {}) => {
    const { changeType, startDate, endDate, limit = 100 } = filters;
    
    let query = `
        SELECT oc.*, p.name as property_name, t.name || ' ' || t.surname as tenant_name
        FROM occupancy_changes oc
        JOIN properties p ON oc.property_id = p.id
        JOIN tenants t ON oc.tenant_id = t.id
        WHERE oc.property_id = $1
    `;
    
    const params = [propertyId];
    let paramIndex = 1;
    
    if (changeType) {
        paramIndex++;
        query += ` AND oc.change_type = $${paramIndex}`;
        params.push(changeType);
    }
    
    if (startDate) {
        paramIndex++;
        query += ` AND oc.created_at >= $${paramIndex}`;
        params.push(startDate);
    }
    
    if (endDate) {
        paramIndex++;
        query += ` AND oc.created_at <= $${paramIndex}`;
        params.push(endDate);
    }
    
    query += ` ORDER BY oc.created_at DESC LIMIT $${paramIndex + 1}`;
    params.push(limit);
    
    const result = await db.query(query, params);
    return result.rows;
};

/**
 * Get current occupancy snapshot for a property
 * @param {number} propertyId - Property ID
 * @param {string} asOfDate - Date for snapshot (YYYY-MM-DD)
 * @returns {Promise<Object>} - Occupancy snapshot
 */
export const getOccupancySnapshot = async (propertyId, asOfDate = null) => {
    const dateFilter = asOfDate ? `AND oc.created_at <= $2` : '';
    const params = asOfDate ? [propertyId, asOfDate] : [propertyId];
    
    const query = `
        SELECT 
            oc.tenant_id,
            t.name || ' ' || t.surname as tenant_name,
            oc.new_move_in_date,
            oc.new_move_out_date,
            oc.new_status,
            oc.created_at as last_change
        FROM occupancy_changes oc
        JOIN tenants t ON oc.tenant_id = t.id
        WHERE oc.property_id = $1 ${dateFilter}
        AND oc.created_at = (
            SELECT MAX(created_at) 
            FROM occupancy_changes oc2 
            WHERE oc2.tenant_id = oc.tenant_id 
            AND oc2.property_id = $1 
            ${dateFilter}
        )
        ORDER BY oc.new_move_in_date
    `;
    
    const result = await db.query(query, params);
    return result.rows[0];
};

/**
 * Get monthly occupancy statistics
 * @param {number} propertyId - Property ID  
 * @param {number} months - Number of months to analyze
 * @returns {Promise<Array>} - Monthly statistics
 */
export const getMonthlyOccupancyStats = async (propertyId, months = 12) => {
    const dbType = environmentConfig.getDatabaseConfig().type;
    const dateFilter = getDateFilterQuery(months, dbType);
    
    const query = `
        SELECT 
            EXTRACT(YEAR FROM oc.created_at) as year,
            EXTRACT(MONTH FROM oc.created_at) as month,
            COUNT(*) as total_changes,
            COUNT(CASE WHEN oc.change_type = 'move_in' THEN 1 END) as move_ins,
            COUNT(CASE WHEN oc.change_type = 'move_out' THEN 1 END) as move_outs,
            COUNT(CASE WHEN oc.change_type = 'status_change' THEN 1 END) as status_changes
        FROM occupancy_changes oc
        WHERE oc.property_id = $1 ${dateFilter}
        GROUP BY EXTRACT(YEAR FROM oc.created_at), EXTRACT(MONTH FROM oc.created_at)
        ORDER BY year DESC, month DESC
    `;
    
    const result = await db.query(query, [propertyId]);
    return result.rows;
};

/**
 * Track tenant update with change detection
 * @param {number} tenantId - Tenant ID
 * @param {Object} previousData - Previous tenant data
 * @param {Object} newData - New tenant data  
 * @param {string} reason - Reason for change
 * @returns {Promise<number|null>} - Change record ID or null if no changes
 */
export const trackTenantUpdate = async (tenantId, previousData, newData, reason = '') => {
    const changes = [];
    
    // Check for move-in date changes
    if (previousData.move_in_date !== newData.move_in_date) {
        changes.push({
            change_type: 'date_adjustment',
            previous_move_in_date: previousData.move_in_date,
            new_move_in_date: newData.move_in_date
        });
    }
    
    // Check for move-out date changes  
    if (previousData.move_out_date !== newData.move_out_date) {
        changes.push({
            change_type: 'date_adjustment',
            previous_move_out_date: previousData.move_out_date,
            new_move_out_date: newData.move_out_date
        });
    }
    
    // Check for status changes
    if (previousData.occupancy_status !== newData.occupancy_status) {
        changes.push({
            change_type: 'status_change',
            previous_status: previousData.occupancy_status,
            new_status: newData.occupancy_status
        });
    }
    
    // Track all detected changes
    if (changes.length > 0) {
        const lastChangeId = await trackOccupancyChange({
            tenant_id: tenantId,
            property_id: newData.property_id,
            ...changes[changes.length - 1], // Use the last/most significant change
            reason
        });
        return lastChangeId;
    }
    
    return null;
};

export default {
    trackOccupancyChange,
    getTenantOccupancyHistory,
    getPropertyOccupancyHistory, 
    getOccupancySnapshot,
    getMonthlyOccupancyStats,
    trackTenantUpdate
};