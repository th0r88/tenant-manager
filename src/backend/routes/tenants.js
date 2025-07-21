import express from 'express';
import db from '../database/db.js';
import { trackTenantUpdate, trackOccupancyChange } from '../services/occupancyTrackingService.js';
import { validateTenant } from '../middleware/validationMiddleware.js';
import { safeDbOperation } from '../middleware/errorHandler.js';
import errorRecovery from '../utils/errorRecovery.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Helper function to get current tenant count for a property
const getTenantCount = async (propertyId) => {
    const result = await db.query('SELECT COUNT(*) as count FROM tenants WHERE property_id = $1', [propertyId]);
    return result.rows[0];
};

// Helper function to get property capacity
const getPropertyCapacity = async (propertyId) => {
    const result = await db.query('SELECT number_of_tenants FROM properties WHERE id = $1', [propertyId]);
    return result.rows[0];
};

router.get('/', async (req, res) => {
    try {
        const propertyId = req.query.property_id || 1;
        const result = await db.query('SELECT * FROM tenants WHERE property_id = $1 ORDER BY created_at DESC', [propertyId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

router.post('/', validateTenant, async (req, res) => {
    try {
        const { property_id = 1, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people = 1, move_in_date, move_out_date, occupancy_status } = req.body;
        
        // Check property capacity before adding tenant
        const property = await getPropertyCapacity(property_id);
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }
        
        // If property has no capacity limit (null), allow addition
        if (property.number_of_tenants !== null) {
            // Check current tenant count
            const tenantCountResult = await getTenantCount(property_id);
            const currentCount = parseInt(tenantCountResult.count);
            const maxCapacity = parseInt(property.number_of_tenants);
            
            if (currentCount >= maxCapacity) {
                return res.status(400).json({ 
                    error: `Cannot add tenant. Property capacity (${maxCapacity}) reached. Current tenants: ${currentCount}/${maxCapacity}` 
                });
            }
        }
        
        // Insert tenant
        const result = await db.query(
            'INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date, move_out_date, occupancy_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id',
            [property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date || new Date().toISOString().split('T')[0], move_out_date || null, occupancy_status || 'active']
        );
        
        const newTenantId = result.rows[0].id;
        
        // Track occupancy change for new tenant
        try {
            await trackOccupancyChange({
                tenant_id: newTenantId,
                property_id,
                change_type: 'move_in',
                new_move_in_date: move_in_date || new Date().toISOString().split('T')[0],
                new_move_out_date: move_out_date || null,
                new_status: occupancy_status || 'active',
                reason: 'New tenant added'
            });
        } catch (trackError) {
            console.error('Error tracking occupancy change:', trackError);
        }
        
        res.json({ id: newTenantId, ...req.body });
    } catch (err) {
        res.status(400).json({ error: `Database error: ${err.message}` });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date, move_out_date, occupancy_status } = req.body;
        
        // Get previous tenant data for tracking changes
        const previousResult = await db.query('SELECT * FROM tenants WHERE id = $1', [req.params.id]);
        if (previousResult.rows.length === 0) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        
        const previousData = previousResult.rows[0];
        
        // Update tenant
        await db.query(
            'UPDATE tenants SET name=$1, surname=$2, address=$3, emso=$4, tax_number=$5, rent_amount=$6, lease_duration=$7, room_area=$8, number_of_people=$9, move_in_date=$10, move_out_date=$11, occupancy_status=$12 WHERE id=$13',
            [name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date, move_out_date, occupancy_status, req.params.id]
        );
        
        // Track occupancy changes
        try {
            const newData = {
                ...req.body,
                property_id: previousData.property_id
            };
            
            await trackTenantUpdate(parseInt(req.params.id), previousData, newData, 'Tenant data updated');
        } catch (trackError) {
            console.error('Error tracking tenant update:', trackError);
        }
        
        res.json({ id: req.params.id, ...req.body });
    } catch (err) {
        res.status(400).json({ error: `Database error: ${err.message}` });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query('DELETE FROM tenants WHERE id = $1', [req.params.id]);
        res.json({ deleted: result.rowCount });
    } catch (err) {
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

export default router;