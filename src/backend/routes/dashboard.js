import express from 'express';
import db from '../database/db.js';
import { calculateOccupiedDays, getDaysInMonth } from '../services/proportionalCalculationService.js';

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
            )`,
        effectiveOccupancy: `SELECT 
            t.id, t.move_in_date, t.move_out_date, t.property_id
            FROM tenants t`
    };

    const results = {};
    let completed = 0;
    const total = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, query]) => {
        if (key === 'effectiveOccupancy') {
            db.all(query, (err, rows) => {
                if (err) {
                    console.error(`Error in ${key} query:`, err);
                    results[key] = 0;
                } else {
                    // Calculate effective occupancy based on current month
                    const currentDate = new Date();
                    const currentYear = currentDate.getFullYear();
                    const currentMonth = currentDate.getMonth() + 1;
                    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
                    
                    let totalOccupiedDays = 0;
                    let totalPossibleDays = 0;
                    
                    rows.forEach(tenant => {
                        const occupiedDays = calculateOccupiedDays(
                            tenant.move_in_date, 
                            tenant.move_out_date, 
                            currentYear, 
                            currentMonth
                        );
                        totalOccupiedDays += occupiedDays;
                        totalPossibleDays += daysInMonth;
                    });
                    
                    results[key] = totalPossibleDays > 0 ? totalOccupiedDays / totalPossibleDays : 0;
                }
                
                completed++;
                if (completed === total) {
                    res.json(results);
                }
            });
        } else {
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
        }
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

// Capacity metrics and warnings
router.get('/capacity-metrics', (req, res) => {
    const capacityQuery = `
        SELECT 
            p.id,
            p.name,
            p.number_of_tenants as max_capacity,
            COUNT(t.id) as current_tenants,
            CASE 
                WHEN p.number_of_tenants IS NULL THEN 'unlimited'
                WHEN COUNT(t.id) >= p.number_of_tenants THEN 'at_capacity'
                WHEN CAST(COUNT(t.id) AS FLOAT) / p.number_of_tenants > 0.8 THEN 'near_capacity'
                ELSE 'available'
            END as status
        FROM properties p
        LEFT JOIN tenants t ON p.id = t.property_id
        GROUP BY p.id, p.name, p.number_of_tenants
        ORDER BY p.name
    `;

    db.all(capacityQuery, (err, properties) => {
        if (err) return res.status(500).json({ error: err.message });

        // Calculate overall metrics
        const totalCapacity = properties
            .filter(p => p.max_capacity !== null)
            .reduce((sum, p) => sum + p.max_capacity, 0);
        
        const totalOccupied = properties.reduce((sum, p) => sum + p.current_tenants, 0);
        
        const availableSpaces = properties
            .filter(p => p.max_capacity !== null)
            .reduce((sum, p) => sum + Math.max(0, p.max_capacity - p.current_tenants), 0);

        // Filter warnings for properties approaching or at capacity
        const warnings = properties
            .filter(p => p.status === 'at_capacity' || p.status === 'near_capacity')
            .map(p => ({
                property_name: p.name,
                status: p.status,
                current: p.current_tenants,
                max: p.max_capacity
            }));

        const response = {
            totalCapacity: totalCapacity > 0 ? totalCapacity : null,
            totalOccupied,
            availableSpaces: totalCapacity > 0 ? availableSpaces : null,
            warnings,
            propertyUtilization: properties.map(p => ({
                name: p.name,
                current_tenants: p.current_tenants,
                max_capacity: p.max_capacity,
                status: p.status
            }))
        };

        res.json(response);
    });
});

export default router;