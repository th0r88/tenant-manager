import express from 'express';
import db from '../database/db.js';

const router = express.Router();

// GET /api/adjustments?month=M&year=Y&property_id=P
router.get('/', async (req, res) => {
    try {
        const { month, year, property_id } = req.query;

        if (!month || !year) {
            return res.status(400).json({ error: 'month and year are required' });
        }

        let query = `
            SELECT pa.*, t.name as tenant_name, t.surname as tenant_surname
            FROM payment_adjustments pa
            JOIN tenants t ON pa.tenant_id = t.id
            WHERE pa.month = $1 AND pa.year = $2
        `;
        const params = [parseInt(month), parseInt(year)];

        if (property_id) {
            query += ` AND t.property_id = $${params.length + 1}`;
            params.push(parseInt(property_id));
        }

        query += ' ORDER BY t.surname, t.name';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching adjustments:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/adjustments — upsert
router.put('/', async (req, res) => {
    try {
        const { tenant_id, month, year, amount_paid, note } = req.body;

        if (!tenant_id || !month || !year || amount_paid === undefined || amount_paid === null) {
            return res.status(400).json({ error: 'tenant_id, month, year, and amount_paid are required' });
        }

        // Validate tenant_id is a positive integer
        const parsedTenantId = parseInt(tenant_id);
        if (!Number.isInteger(parsedTenantId) || parsedTenantId <= 0) {
            return res.status(400).json({ error: 'tenant_id must be a positive integer' });
        }

        // Validate month is 1-12
        const parsedMonth = parseInt(month);
        if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
            return res.status(400).json({ error: 'month must be between 1 and 12' });
        }

        // Validate year is 2000-2100
        const parsedYear = parseInt(year);
        if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
            return res.status(400).json({ error: 'year must be between 2000 and 2100' });
        }

        // Validate amount_paid is a non-negative number
        if (typeof amount_paid !== 'number' && typeof amount_paid !== 'string' || isNaN(parseFloat(amount_paid))) {
            return res.status(400).json({ error: 'amount_paid must be a valid number' });
        }

        if (parseFloat(amount_paid) < 0) {
            return res.status(400).json({ error: 'amount_paid cannot be negative' });
        }

        // Validate note is a string with max 500 characters (or null/undefined)
        if (note !== undefined && note !== null) {
            if (typeof note !== 'string') {
                return res.status(400).json({ error: 'note must be a string' });
            }
            if (note.length > 500) {
                return res.status(400).json({ error: 'note must be 500 characters or fewer' });
            }
        }

        // Check if record exists
        const existing = await db.query(
            'SELECT id FROM payment_adjustments WHERE tenant_id = $1 AND month = $2 AND year = $3',
            [tenant_id, parseInt(month), parseInt(year)]
        );

        let result;
        if (existing.rows.length > 0) {
            result = await db.query(
                `UPDATE payment_adjustments
                 SET amount_paid = $1, note = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE tenant_id = $3 AND month = $4 AND year = $5
                 RETURNING *`,
                [parseFloat(amount_paid), note || null, tenant_id, parseInt(month), parseInt(year)]
            );
        } else {
            result = await db.query(
                `INSERT INTO payment_adjustments (tenant_id, month, year, amount_paid, note)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [tenant_id, parseInt(month), parseInt(year), parseFloat(amount_paid), note || null]
            );
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error upserting adjustment:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/adjustments/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM payment_adjustments WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting adjustment:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
