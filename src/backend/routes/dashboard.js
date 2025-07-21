import express from 'express';
import db from '../database/db.js';
import { getDashboardDateFilterQuery } from '../database/queryAdapter.js';
import environmentConfig from '../config/environment.js';
import { calculateOccupiedDays, getDaysInMonth } from '../services/proportionalCalculationService.js';

const router = express.Router();

// Overview statistics across all properties
router.get('/overview', async (req, res) => {
    try {
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

        // Execute all queries in parallel
        const [
            propertiesResult,
            tenantsResult,
            totalRentResult,
            avgOccupancyResult,
            effectiveOccupancyResult
        ] = await Promise.all([
            db.query(queries.properties),
            db.query(queries.tenants),
            db.query(queries.totalRent),
            db.query(queries.avgOccupancy),
            db.query(queries.effectiveOccupancy)
        ]);

        // Process simple results
        results.properties = propertiesResult.rows[0]?.count || 0;
        results.tenants = tenantsResult.rows[0]?.count || 0;
        results.totalRent = totalRentResult.rows[0]?.total || 0;
        results.avgOccupancy = avgOccupancyResult.rows[0]?.avg_occupancy || 0;

        // Calculate effective occupancy based on current month
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        const daysInMonth = getDaysInMonth(currentYear, currentMonth);
        
        let totalOccupiedDays = 0;
        let totalPossibleDays = 0;
        
        effectiveOccupancyResult.rows.forEach(tenant => {
            const occupiedDays = calculateOccupiedDays(
                tenant.move_in_date, 
                tenant.move_out_date, 
                currentYear, 
                currentMonth
            );
            totalOccupiedDays += occupiedDays;
            totalPossibleDays += daysInMonth;
        });
        
        results.effectiveOccupancy = totalPossibleDays > 0 ? totalOccupiedDays / totalPossibleDays : 0;

        res.json(results);
    } catch (err) {
        console.error('Dashboard overview error:', err);
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

// Property-wise breakdown
router.get('/properties-breakdown', async (req, res) => {
    try {
        const result = await db.query(
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
             ORDER BY p.name`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

// Recent activity across all properties
router.get('/recent-activity', async (req, res) => {
    try {
        const limit = req.query.limit || 10;
        
        const result = await db.query(
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
             LIMIT $1`,
            [limit]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

// Monthly revenue trends across all properties
router.get('/revenue-trends/:months', async (req, res) => {
    try {
        const months = parseInt(req.params.months) || 6;
        
        const result = await db.query(
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
             ${getDashboardDateFilterQuery(months, environmentConfig.getDatabaseConfig().type)}
             GROUP BY ue.month, ue.year
             ORDER BY ue.year DESC, ue.month DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

// Utility costs breakdown across properties
router.get('/utility-breakdown/:months', async (req, res) => {
    try {
        const months = parseInt(req.params.months) || 3;
        
        const result = await db.query(
            `SELECT 
                ue.utility_type,
                COUNT(*) as entry_count,
                SUM(ue.total_amount) as total_amount,
                AVG(ue.total_amount) as avg_amount,
                COUNT(DISTINCT ue.property_id) as properties_count
             FROM utility_entries ue
             ${getDashboardDateFilterQuery(months, environmentConfig.getDatabaseConfig().type)}
             GROUP BY ue.utility_type
             ORDER BY total_amount DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

// Capacity metrics and warnings
router.get('/capacity-metrics', async (req, res) => {
    try {
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

        const result = await db.query(capacityQuery);
        const properties = result.rows;

        // Calculate overall metrics
        const totalCapacity = properties
            .filter(p => p.max_capacity !== null)
            .reduce((sum, p) => sum + parseInt(p.max_capacity), 0);
        
        const totalOccupied = properties.reduce((sum, p) => sum + parseInt(p.current_tenants), 0);
        
        const availableSpaces = properties
            .filter(p => p.max_capacity !== null)
            .reduce((sum, p) => sum + Math.max(0, parseInt(p.max_capacity) - parseInt(p.current_tenants)), 0);

        // Filter warnings for properties approaching or at capacity
        const warnings = properties
            .filter(p => p.status === 'at_capacity' || p.status === 'near_capacity')
            .map(p => ({
                property_name: p.name,
                status: p.status,
                current: parseInt(p.current_tenants),
                max: parseInt(p.max_capacity)
            }));

        const response = {
            totalCapacity: totalCapacity > 0 ? totalCapacity : null,
            totalOccupied,
            availableSpaces: totalCapacity > 0 ? availableSpaces : null,
            warnings,
            propertyUtilization: properties.map(p => ({
                name: p.name,
                current_tenants: parseInt(p.current_tenants),
                max_capacity: p.max_capacity ? parseInt(p.max_capacity) : null,
                status: p.status
            }))
        };

        res.json(response);
    } catch (err) {
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

export default router;