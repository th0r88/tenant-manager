import express from 'express';
import db from '../database/db.js';
import { calculateAllocations } from '../services/calculationService.js';

const router = express.Router();

router.get('/', (req, res) => {
    const propertyId = req.query.property_id || 1;
    db.all('SELECT * FROM utility_entries WHERE property_id = ? ORDER BY year DESC, month DESC', [propertyId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/', async (req, res) => {
    const { property_id = 1, month, year, utility_type, total_amount, allocation_method } = req.body;
    
    db.run(
        'INSERT INTO utility_entries (property_id, month, year, utility_type, total_amount, allocation_method) VALUES (?, ?, ?, ?, ?, ?)',
        [property_id, month, year, utility_type, total_amount, allocation_method],
        async function(err) {
            if (err) return res.status(400).json({ error: err.message });
            
            try {
                await calculateAllocations(this.lastID);
                res.json({ id: this.lastID, ...req.body });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );
});

router.put('/:id', async (req, res) => {
    const { month, year, utility_type, total_amount, allocation_method } = req.body;
    
    db.run('DELETE FROM tenant_utility_allocations WHERE utility_entry_id = ?', [req.params.id]);
    
    db.run(
        'UPDATE utility_entries SET month=?, year=?, utility_type=?, total_amount=?, allocation_method=? WHERE id=?',
        [month, year, utility_type, total_amount, allocation_method, req.params.id],
        async function(err) {
            if (err) return res.status(400).json({ error: err.message });
            
            try {
                await calculateAllocations(req.params.id);
                res.json({ id: req.params.id, ...req.body });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );
});

router.delete('/:id', (req, res) => {
    db.run('DELETE FROM tenant_utility_allocations WHERE utility_entry_id = ?', [req.params.id]);
    db.run('DELETE FROM utility_entries WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

router.get('/:month/:year', (req, res) => {
    db.all(
        `SELECT ue.*, tua.tenant_id, tua.allocated_amount, t.name, t.surname 
         FROM utility_entries ue 
         LEFT JOIN tenant_utility_allocations tua ON ue.id = tua.utility_entry_id 
         LEFT JOIN tenants t ON tua.tenant_id = t.id 
         WHERE ue.month = ? AND ue.year = ?`,
        [req.params.month, req.params.year],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

export default router;