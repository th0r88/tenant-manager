import express from 'express';
import db from '../database/db.js';

const router = express.Router();

router.get('/', (req, res) => {
    const propertyId = req.query.property_id || 1;
    db.all('SELECT * FROM tenants WHERE property_id = ? ORDER BY created_at DESC', [propertyId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/', (req, res) => {
    const { property_id = 1, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area } = req.body;
    
    db.run(
        'INSERT INTO tenants (property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [property_id, name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area],
        function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ id: this.lastID, ...req.body });
        }
    );
});

router.put('/:id', (req, res) => {
    const { name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area } = req.body;
    
    db.run(
        'UPDATE tenants SET name=?, surname=?, address=?, emso=?, tax_number=?, rent_amount=?, lease_duration=?, room_area=? WHERE id=?',
        [name, surname, address, emso, tax_number, rent_amount, lease_duration, room_area, req.params.id],
        function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ id: req.params.id, ...req.body });
        }
    );
});

router.delete('/:id', (req, res) => {
    db.run('DELETE FROM tenants WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

export default router;