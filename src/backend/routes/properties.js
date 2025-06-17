import express from 'express';
import db from '../database/db.js';

const router = express.Router();

router.get('/', (req, res) => {
    db.all('SELECT * FROM properties ORDER BY created_at ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/', (req, res) => {
    const { name, address, property_type, house_area } = req.body;
    
    db.run(
        'INSERT INTO properties (name, address, property_type, house_area) VALUES (?, ?, ?, ?)',
        [name, address, property_type, house_area],
        function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ id: this.lastID, ...req.body });
        }
    );
});

router.put('/:id', (req, res) => {
    const { name, address, property_type, house_area } = req.body;
    
    db.run(
        'UPDATE properties SET name=?, address=?, property_type=?, house_area=? WHERE id=?',
        [name, address, property_type, house_area, req.params.id],
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