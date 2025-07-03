import express from 'express';
import db from '../database/db.js';
import { trackTenantUpdate, trackOccupancyChange } from '../services/occupancyTrackingService.js';
import { validateTenant } from '../middleware/validationMiddleware.js';
import { safeDbOperation } from '../middleware/errorHandler.js';
import errorRecovery from '../utils/errorRecovery.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Helper function to get current tenant count for a property
const getTenantCount = (propertyId, callback) => {
    db.get('SELECT COUNT(*) as count FROM tenants WHERE property_id = ?', [propertyId], callback);
};

// Helper function to get property capacity
const getPropertyCapacity = (propertyId, callback) => {
    db.get('SELECT number_of_tenants FROM properties WHERE id = ?', [propertyId], callback);
};

router.get('/', (req, res) => {
    const propertyId = req.query.property_id || 1;
    db.all('SELECT * FROM tenants WHERE property_id = ? ORDER BY created_at DESC', [propertyId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/', validateTenant, (req, res) => {
    const { property_id = 1, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people = 1, move_in_date, move_out_date, occupancy_status } = req.body;
    
    // Check property capacity before adding tenant
    getPropertyCapacity(property_id, (err, property) => {
        if (err) return res.status(500).json({ error: 'Failed to check property capacity' });
        
        // If property has no capacity limit (null), allow addition
        if (!property || property.number_of_tenants === null) {
            insertTenant();
            return;
        }
        
        // Check current tenant count
        getTenantCount(property_id, (err, result) => {
            if (err) return res.status(500).json({ error: 'Failed to count existing tenants' });
            
            const currentCount = result.count;
            const maxCapacity = property.number_of_tenants;
            
            if (currentCount >= maxCapacity) {
                return res.status(400).json({ 
                    error: `Cannot add tenant. Property capacity (${maxCapacity}) reached. Current tenants: ${currentCount}/${maxCapacity}` 
                });
            }
            
            insertTenant();
        });
    });
    
    function insertTenant() {
        db.run(
            'INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date, move_out_date, occupancy_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date || new Date().toISOString().split('T')[0], move_out_date || null, occupancy_status || 'active'],
            async function(err) {
                if (err) return res.status(400).json({ error: err.message });
                
                // Track occupancy change for new tenant
                try {
                    await trackOccupancyChange({
                        tenant_id: this.lastID,
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
                
                res.json({ id: this.lastID, ...req.body });
            }
        );
    }
});

router.put('/:id', (req, res) => {
    const { name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date, move_out_date, occupancy_status } = req.body;
    
    // Get previous tenant data for tracking changes
    db.get('SELECT * FROM tenants WHERE id = ?', [req.params.id], async (err, previousData) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!previousData) return res.status(404).json({ error: 'Tenant not found' });
        
        db.run(
            'UPDATE tenants SET name=?, surname=?, address=?, emso=?, tax_number=?, rent_amount=?, lease_duration=?, room_area=?, number_of_people=?, move_in_date=?, move_out_date=?, occupancy_status=? WHERE id=?',
            [name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, number_of_people, move_in_date, move_out_date, occupancy_status, req.params.id],
            async function(err) {
                if (err) return res.status(400).json({ error: err.message });
                
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
            }
        );
    });
});

router.delete('/:id', (req, res) => {
    db.run('DELETE FROM tenants WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

export default router;