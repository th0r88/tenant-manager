import express from 'express';
import db from '../database/db.js';
import { validateProperty } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT 
                p.*,
                COUNT(t.id) as current_tenant_count
            FROM properties p
            LEFT JOIN tenants t ON p.id = t.property_id
            GROUP BY p.id
            ORDER BY p.created_at ASC
        `;
        
        const result = await db.query(query);
        
        // Add capacity status to each property
        const propertiesWithCapacity = result.rows.map(property => ({
            ...property,
            max_capacity: property.number_of_tenants,
            capacity_status: property.number_of_tenants === null ? 'unlimited' :
                           property.current_tenant_count >= property.number_of_tenants ? 'at_capacity' :
                           property.current_tenant_count / property.number_of_tenants > 0.8 ? 'near_capacity' : 'available'
        }));
        
        res.json(propertiesWithCapacity);
    } catch (err) {
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

router.post('/', validateProperty, async (req, res) => {
    try {
        const { name, address, property_type, house_area, number_of_tenants } = req.body;
        
        // Validate number_of_tenants if provided
        if (number_of_tenants !== undefined && number_of_tenants !== null && number_of_tenants !== '') {
            const tenantCount = parseInt(number_of_tenants);
            if (isNaN(tenantCount) || tenantCount < 0) {
                return res.status(400).json({ error: 'Number of tenants must be a non-negative integer' });
            }
        }
        
        const result = await db.query(
            'INSERT INTO properties (name, address, property_type, house_area, number_of_tenants) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, address, property_type, house_area, number_of_tenants || null]
        );
        
        const newId = result.rows[0].id;
        res.json({ id: newId, ...req.body });
    } catch (err) {
        res.status(400).json({ error: `Database error: ${err.message}` });
    }
});

router.put('/:id', validateProperty, async (req, res) => {
    try {
        const { name, address, property_type, house_area, number_of_tenants } = req.body;
        
        // Validate number_of_tenants if provided
        if (number_of_tenants !== undefined && number_of_tenants !== null && number_of_tenants !== '') {
            const tenantCount = parseInt(number_of_tenants);
            if (isNaN(tenantCount) || tenantCount < 0) {
                return res.status(400).json({ error: 'Number of tenants must be a non-negative integer' });
            }
        }
        
        await db.query(
            'UPDATE properties SET name=$1, address=$2, property_type=$3, house_area=$4, number_of_tenants=$5 WHERE id=$6',
            [name, address, property_type, house_area, number_of_tenants || null, req.params.id]
        );
        
        res.json({ id: req.params.id, ...req.body });
    } catch (err) {
        res.status(400).json({ error: `Database error: ${err.message}` });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query('DELETE FROM properties WHERE id = $1', [req.params.id]);
        res.json({ deleted: result.rowCount });
    } catch (err) {
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

export default router;