import express from 'express';
import db from '../database/db.js';
import { validateProperty } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.get('/', (req, res) => {
    const query = `
        SELECT 
            p.*,
            COUNT(t.id) as current_tenant_count
        FROM properties p
        LEFT JOIN tenants t ON p.id = t.property_id
        GROUP BY p.id
        ORDER BY p.created_at ASC
    `;
    
    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Add capacity status to each property
        const propertiesWithCapacity = rows.map(property => ({
            ...property,
            max_capacity: property.number_of_tenants,
            capacity_status: property.number_of_tenants === null ? 'unlimited' :
                           property.current_tenant_count >= property.number_of_tenants ? 'at_capacity' :
                           property.current_tenant_count / property.number_of_tenants > 0.8 ? 'near_capacity' : 'available'
        }));
        
        res.json(propertiesWithCapacity);
    });
});

router.post('/', validateProperty, (req, res) => {
    const { name, address, property_type, house_area, number_of_tenants } = req.body;
    
    // Validate number_of_tenants if provided
    if (number_of_tenants !== undefined && number_of_tenants !== null && number_of_tenants !== '') {
        const tenantCount = parseInt(number_of_tenants);
        if (isNaN(tenantCount) || tenantCount < 0) {
            return res.status(400).json({ error: 'Number of tenants must be a non-negative integer' });
        }
    }
    
    db.run(
        'INSERT INTO properties (name, address, property_type, house_area, number_of_tenants) VALUES (?, ?, ?, ?, ?)',
        [name, address, property_type, house_area, number_of_tenants || null],
        function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ id: this.lastID, ...req.body });
        }
    );
});

router.put('/:id', validateProperty, (req, res) => {
    const { name, address, property_type, house_area, number_of_tenants } = req.body;
    
    // Validate number_of_tenants if provided
    if (number_of_tenants !== undefined && number_of_tenants !== null && number_of_tenants !== '') {
        const tenantCount = parseInt(number_of_tenants);
        if (isNaN(tenantCount) || tenantCount < 0) {
            return res.status(400).json({ error: 'Number of tenants must be a non-negative integer' });
        }
    }
    
    db.run(
        'UPDATE properties SET name=?, address=?, property_type=?, house_area=?, number_of_tenants=? WHERE id=?',
        [name, address, property_type, house_area, number_of_tenants || null, req.params.id],
        function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ id: req.params.id, ...req.body });
        }
    );
});

router.delete('/:id', (req, res) => {
    db.run('DELETE FROM properties WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

export default router;