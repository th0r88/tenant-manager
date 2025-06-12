import express from 'express';
import db from '../database/db.js';

const router = express.Router();

// Overview statistics across all properties
router.get('/overview', (req, res) => {
    const queries = {
        properties: 'SELECT COUNT(*) as count FROM properties',
        tenants: 'SELECT COUNT(*) as count FROM tenants',
        totalRent: 'SELECT SUM(rent_amount) as total FROM tenants',
        avgOccupancy: `SELECT 
            AVG(tenant_count * 1.0 / CASE WHEN tenant_count = 0 THEN 1 ELSE tenant_count END) as avg_occupancy
            FROM (
                SELECT p.id, COUNT(t.id) as tenant_count
                FROM properties p
                LEFT JOIN tenants t ON p.id = t.property_id
                GROUP BY p.id
            )`
    };

    const results = {};
    let completed = 0;
    const total = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, query]) => {
        db.get(query, (err, row) => {
            if (err) {
                console.error(`Error in ${key} query:`, err);
                results[key] = 0;
            } else {
                results[key] = row.count || row.total || row.avg_occupancy || 0;
            }
            
            completed++;
            if (completed === total) {
                res.json(results);
            }
        });
    });
});

// Property-wise breakdown
router.get('/properties-breakdown', (req, res) => {
    db.all(
        `SELECT 
            p.id,
            p.name,
            p.address,
            p.property_type,
            COUNT(t.id) as tenant_count,
            COALESCE(SUM(t.rent_amount), 0) as total_rent,
            COALESCE(SUM(t.room_area), 0) as total_area
         FROM properties p
         LEFT JOIN tenants t ON p.id = t.property_id
         GROUP BY p.id, p.name, p.address, p.property_type
         ORDER BY p.name`,
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// Recent activity across all properties
router.get('/recent-activity', (req, res) => {
    const limit = req.query.limit || 10;
    
    db.all(
        `SELECT 
            'tenant' as type,
            t.name || ' ' || t.surname as description,
            p.name as property_name,
            t.created_at as timestamp
         FROM tenants t
         JOIN properties p ON t.property_id = p.id
         UNION ALL
         SELECT 
            'utility' as type,
            ue.utility_type || ' (' || ue.month || '/' || ue.year || ')' as description,
            p.name as property_name,
            ue.created_at as timestamp
         FROM utility_entries ue
         JOIN properties p ON ue.property_id = p.id
         ORDER BY timestamp DESC
         LIMIT ?`,
        [limit],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// Monthly revenue trends across all properties
router.get('/revenue-trends/:months', (req, res) => {
    const months = parseInt(req.params.months) || 6;
    
    db.all(
        `SELECT 
            ue.month,
            ue.year,
            SUM(t.rent_amount) as rent_revenue,
            SUM(ue.total_amount) as utility_revenue,
            SUM(t.rent_amount + COALESCE(tua.allocated_amount, 0)) as total_revenue
         FROM utility_entries ue
         JOIN properties p ON ue.property_id = p.id
         JOIN tenants t ON t.property_id = p.id
         LEFT JOIN tenant_utility_allocations tua ON tua.utility_entry_id = ue.id AND tua.tenant_id = t.id
         WHERE datetime(ue.year || '-' || printf('%02d', ue.month) || '-01') >= datetime('now', '-${months} months')
         GROUP BY ue.month, ue.year
         ORDER BY ue.year DESC, ue.month DESC`,
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// Utility costs breakdown across properties
router.get('/utility-breakdown/:months', (req, res) => {
    const months = parseInt(req.params.months) || 3;
    
    db.all(
        `SELECT 
            ue.utility_type,
            COUNT(*) as entry_count,
            SUM(ue.total_amount) as total_amount,
            AVG(ue.total_amount) as avg_amount,
            COUNT(DISTINCT ue.property_id) as properties_count
         FROM utility_entries ue
         WHERE datetime(ue.year || '-' || printf('%02d', ue.month) || '-01') >= datetime('now', '-${months} months')
         GROUP BY ue.utility_type
         ORDER BY total_amount DESC`,
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

export default router;