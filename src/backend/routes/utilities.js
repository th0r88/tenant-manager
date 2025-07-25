import express from 'express';
import db from '../database/db.js';
import { calculateAllocations } from '../services/calculationService.js';
import { validateUtility } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const propertyId = req.query.property_id || 1;
        const result = await db.query('SELECT * FROM utility_entries WHERE property_id = $1 ORDER BY year DESC, month DESC', [propertyId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

router.post('/', validateUtility, async (req, res) => {
    try {
        const { property_id = 1, month, year, utility_type, total_amount, allocation_method } = req.body;
        
        const result = await db.query(
            'INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [property_id, month, year, utility_type, total_amount, allocation_method]
        );
        
        const newId = result.rows[0].id;
        
        try {
            await calculateAllocations(newId);
            res.json({ id: newId, ...req.body });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } catch (err) {
        res.status(400).json({ error: `Database error: ${err.message}` });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { month, year, utility_type, total_amount, allocation_method } = req.body;
        
        // Delete existing allocations
        await db.query('DELETE FROM tenant_utility_allocations WHERE utility_entry_id = $1', [req.params.id]);
        
        // Update utility entry
        await db.query(
            'UPDATE utility_entries SET month=$1, year=$2, utility_type=$3, total_amount=$4, allocation_method=$5 WHERE id=$6',
            [month, year, utility_type, total_amount, allocation_method, req.params.id]
        );
        
        try {
            await calculateAllocations(req.params.id);
            res.json({ id: req.params.id, ...req.body });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } catch (err) {
        res.status(400).json({ error: `Database error: ${err.message}` });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        // Delete allocations first
        await db.query('DELETE FROM tenant_utility_allocations WHERE utility_entry_id = $1', [req.params.id]);
        
        // Delete utility entry
        const result = await db.query('DELETE FROM utility_entries WHERE id = $1', [req.params.id]);
        
        res.json({ deleted: result.rowCount });
    } catch (err) {
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

router.get('/:month/:year', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT ue.*, tua.tenant_id, tua.allocated_amount, t.name, t.surname 
             FROM utility_entries ue 
             LEFT JOIN tenant_utility_allocations tua ON ue.id = tua.utility_entry_id 
             LEFT JOIN tenants t ON tua.tenant_id = t.id 
             WHERE ue.month = $1 AND ue.year = $2`,
            [req.params.month, req.params.year]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

// Recalculate allocations for all utilities (useful after calculation logic changes)
router.post('/recalculate-all', async (req, res) => {
    try {
        const { property_id = 1, month, year } = req.body;
        
        // Get utilities to recalculate (can filter by property, month, year)
        let query = 'SELECT id, utility_type, month, year FROM utility_entries WHERE property_id = $1';
        let params = [property_id];
        
        if (month) {
            query += ' AND month = $2';
            params.push(month);
        }
        if (year) {
            query += month ? ' AND year = $3' : ' AND year = $2';
            params.push(year);
        }
        
        query += ' ORDER BY year, month';
        
        const utilitiesResult = await db.query(query, params);
        const utilities = utilitiesResult.rows;
        
        let recalculated = 0;
        let errors = [];
        
        for (const utility of utilities) {
            try {
                await calculateAllocations(utility.id);
                recalculated++;
                console.log(`Recalculated ${utility.utility_type} for ${utility.month}/${utility.year}`);
            } catch (error) {
                console.error(`Failed to recalculate utility ${utility.id}:`, error);
                errors.push(`${utility.utility_type} ${utility.month}/${utility.year}: ${error.message}`);
            }
        }
        
        res.json({
            success: true,
            message: `Recalculation completed for property ${property_id}`,
            recalculated,
            total: utilities.length,
            errors
        });
        
    } catch (error) {
        console.error('Bulk recalculation error:', error);
        res.status(500).json({ 
            error: 'Bulk recalculation failed', 
            details: error.message 
        });
    }
});

export default router;