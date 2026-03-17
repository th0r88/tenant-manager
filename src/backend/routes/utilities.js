import express from 'express';
import db from '../database/db.js';
import { calculateAllocations } from '../services/calculationService.js';
import { validateUtility } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const propertyId = req.query.property_id || 1;
        // Include utilities that are shared WITH this property (not just owned by it)
        const result = await db.query(
            `SELECT DISTINCT ue.* FROM utility_entries ue
             LEFT JOIN utility_shared_properties usp ON ue.id = usp.utility_entry_id
             WHERE ue.property_id = $1 OR usp.property_id = $1
             ORDER BY ue.year DESC, ue.month DESC`,
            [propertyId]
        );

        // Batch-fetch shared property links for all returned utilities
        const utilities = result.rows;
        if (utilities.length > 0) {
            const utilityIds = utilities.map(u => u.id);
            const placeholders = utilityIds.map((_, i) => `$${i + 1}`).join(', ');
            const sharedResult = await db.query(
                `SELECT utility_entry_id, property_id FROM utility_shared_properties WHERE utility_entry_id IN (${placeholders})`,
                utilityIds
            );

            // Build a map: utility_entry_id -> [property_ids]
            const sharedMap = {};
            for (const row of sharedResult.rows) {
                if (!sharedMap[row.utility_entry_id]) sharedMap[row.utility_entry_id] = [];
                sharedMap[row.utility_entry_id].push(row.property_id);
            }

            for (const utility of utilities) {
                const sharedIds = sharedMap[utility.id];
                if (sharedIds) {
                    utility.shared_property_ids = sharedIds;
                    utility.is_shared = true;
                } else {
                    utility.shared_property_ids = [];
                    utility.is_shared = false;
                }
            }
        }

        res.json(utilities);
    } catch (err) {
        console.error('Error fetching utilities:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', validateUtility, async (req, res) => {
    try {
        const { property_id = 1, month, year, utility_type, total_amount, allocation_method, shared_property_ids, assigned_tenant_id } = req.body;

        // Validate direct assignment
        if (allocation_method === 'direct') {
            if (utility_type !== 'electricity') {
                return res.status(400).json({ error: 'Direct assignment is only available for electricity' });
            }
            if (!assigned_tenant_id) {
                return res.status(400).json({ error: 'Tenant must be selected for direct assignment' });
            }
            const tenantCheck = await db.query('SELECT id, property_id FROM tenants WHERE id = $1', [assigned_tenant_id]);
            if (tenantCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Assigned tenant not found' });
            }
            if (tenantCheck.rows[0].property_id !== Number(property_id)) {
                return res.status(400).json({ error: 'Assigned tenant does not belong to this property' });
            }
        }

        // Validate shared property IDs before any writes
        let validatedSharedIds = null;
        if (shared_property_ids && Array.isArray(shared_property_ids) && shared_property_ids.length > 0) {
            validatedSharedIds = new Set(shared_property_ids.map(Number));
            validatedSharedIds.add(Number(property_id));

            const idsArray = [...validatedSharedIds];
            const placeholders = idsArray.map((_, i) => `$${i + 1}`).join(', ');
            const propCheck = await db.query(`SELECT id FROM properties WHERE id IN (${placeholders})`, idsArray);
            if (propCheck.rows.length !== idsArray.length) {
                return res.status(400).json({ error: 'One or more shared property IDs not found' });
            }
        }

        const result = await db.query(
            'INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method, assigned_tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [property_id, month, year, utility_type, total_amount, allocation_method, assigned_tenant_id || null]
        );

        const newId = result.rows[0].id;

        // Insert shared property links
        if (validatedSharedIds) {
            for (const pid of validatedSharedIds) {
                await db.query(
                    'INSERT INTO utility_shared_properties (utility_entry_id, property_id) VALUES ($1, $2)',
                    [newId, pid]
                );
            }
        }

        try {
            await calculateAllocations(newId);
            res.json({ id: newId, ...req.body });
        } catch (error) {
            console.error('Error calculating allocations for new utility:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    } catch (err) {
        res.status(400).json({ error: `Database error: ${err.message}` });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { month, year, utility_type, total_amount, allocation_method, shared_property_ids, assigned_tenant_id } = req.body;

        // Validate direct assignment
        if (allocation_method === 'direct') {
            if (utility_type !== 'electricity') {
                return res.status(400).json({ error: 'Direct assignment is only available for electricity' });
            }
            if (!assigned_tenant_id) {
                return res.status(400).json({ error: 'Tenant must be selected for direct assignment' });
            }
            const utilityForProp = await db.query('SELECT property_id FROM utility_entries WHERE id = $1', [req.params.id]);
            const propId = utilityForProp.rows[0]?.property_id;
            const tenantCheck = await db.query('SELECT id, property_id FROM tenants WHERE id = $1', [assigned_tenant_id]);
            if (tenantCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Assigned tenant not found' });
            }
            if (tenantCheck.rows[0].property_id !== Number(propId)) {
                return res.status(400).json({ error: 'Assigned tenant does not belong to this property' });
            }
        }

        // Validate shared property IDs before any destructive operations
        let validatedSharedIds = null;
        if (shared_property_ids && Array.isArray(shared_property_ids) && shared_property_ids.length > 0) {
            // Get the utility's primary property_id
            const utilityResult = await db.query('SELECT property_id FROM utility_entries WHERE id = $1', [req.params.id]);
            const primaryPropertyId = utilityResult.rows[0]?.property_id;
            if (!primaryPropertyId) {
                return res.status(404).json({ error: 'Utility entry not found' });
            }

            validatedSharedIds = new Set(shared_property_ids.map(Number));
            validatedSharedIds.add(Number(primaryPropertyId));

            const idsArray = [...validatedSharedIds];
            const placeholders = idsArray.map((_, i) => `$${i + 1}`).join(', ');
            const propCheck = await db.query(`SELECT id FROM properties WHERE id IN (${placeholders})`, idsArray);
            if (propCheck.rows.length !== idsArray.length) {
                return res.status(400).json({ error: 'One or more shared property IDs not found' });
            }
        }

        // Now safe to perform destructive operations
        await db.query('DELETE FROM tenant_utility_allocations WHERE utility_entry_id = $1', [req.params.id]);

        await db.query(
            'UPDATE utility_entries SET month=$1, year=$2, utility_type=$3, total_amount=$4, allocation_method=$5, assigned_tenant_id=$6 WHERE id=$7',
            [month, year, utility_type, total_amount, allocation_method, assigned_tenant_id || null, req.params.id]
        );

        // Update shared property links
        await db.query('DELETE FROM utility_shared_properties WHERE utility_entry_id = $1', [req.params.id]);

        if (validatedSharedIds) {
            for (const pid of validatedSharedIds) {
                await db.query(
                    'INSERT INTO utility_shared_properties (utility_entry_id, property_id) VALUES ($1, $2)',
                    [req.params.id, pid]
                );
            }
        }

        try {
            await calculateAllocations(req.params.id);
            res.json({ id: req.params.id, ...req.body });
        } catch (error) {
            console.error('Error recalculating allocations for utility:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    } catch (err) {
        res.status(400).json({ error: `Database error: ${err.message}` });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        // Delete allocations and shared links first
        await db.query('DELETE FROM tenant_utility_allocations WHERE utility_entry_id = $1', [req.params.id]);
        await db.query('DELETE FROM utility_shared_properties WHERE utility_entry_id = $1', [req.params.id]);

        // Delete utility entry
        const result = await db.query('DELETE FROM utility_entries WHERE id = $1', [req.params.id]);
        
        res.json({ deleted: result.rowCount });
    } catch (err) {
        console.error('Error deleting utility:', err);
        res.status(500).json({ error: 'Internal server error' });
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
        console.error('Error fetching utilities by month/year:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Recalculate allocations for all utilities (useful after calculation logic changes)
router.post('/recalculate-all', async (req, res) => {
    try {
        const { property_id = 1, month, year } = req.body;

        // Get utilities to recalculate, including shared utilities linked to this property
        let query = `SELECT DISTINCT ue.id, ue.utility_type, ue.month, ue.year FROM utility_entries ue
            LEFT JOIN utility_shared_properties usp ON ue.id = usp.utility_entry_id
            WHERE (ue.property_id = $1 OR usp.property_id = $1)`;
        let params = [property_id];

        if (month) {
            query += ' AND ue.month = $2';
            params.push(month);
        }
        if (year) {
            query += month ? ' AND ue.year = $3' : ' AND ue.year = $2';
            params.push(year);
        }

        query += ' ORDER BY ue.year, ue.month';
        
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;