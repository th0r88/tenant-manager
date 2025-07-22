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
            effectiveOccupancy: `SELECT 
                t.id, t.move_in_date, t.move_out_date, t.property_id, t.number_of_people
                FROM tenants t`,
            capacityData: `SELECT 
                p.id, p.number_of_tenants as property_capacity
                FROM properties p`
        };

        const results = {};

        // Execute all queries in parallel
        const [
            propertiesResult,
            tenantsResult,
            totalRentResult,
            effectiveOccupancyResult,
            capacityResult
        ] = await Promise.all([
            db.query(queries.properties),
            db.query(queries.tenants),
            db.query(queries.totalRent),
            db.query(queries.effectiveOccupancy),
            db.query(queries.capacityData)
        ]);

        // Process simple results
        results.properties = propertiesResult.rows[0]?.count || 0;
        results.tenants = tenantsResult.rows[0]?.count || 0;
        results.totalRent = totalRentResult.rows[0]?.total || 0;

        // Calculate true effective occupancy based on actual people vs total capacity
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        
        // Calculate total capacity from all properties
        const totalCapacity = capacityResult.rows
            .filter(p => p.property_capacity !== null)
            .reduce((sum, p) => sum + parseInt(p.property_capacity), 0);
        
        // Calculate actual people living across all properties for current month
        let actualPeopleLiving = 0;
        effectiveOccupancyResult.rows.forEach(tenant => {
            const occupiedDays = calculateOccupiedDays(
                tenant.move_in_date, 
                tenant.move_out_date, 
                currentYear, 
                currentMonth
            );
            
            // If tenant is living there for any part of the current month, count their people
            if (occupiedDays > 0) {
                actualPeopleLiving += parseInt(tenant.number_of_people) || 1;
            }
        });
        
        // True effective occupancy = (actual people living) / (total capacity)
        results.effectiveOccupancy = totalCapacity > 0 ? actualPeopleLiving / totalCapacity : 0;
        results.avgOccupancy = results.effectiveOccupancy;

        res.json(results);
    } catch (err) {
        console.error('Dashboard overview error:', err);
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

// Properties breakdown - all properties as individual list items
router.get('/properties-breakdown', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT 
                p.id,
                p.name,
                p.address,
                p.property_type,
                p.house_area,
                COUNT(t.id) as tenant_count,
                COALESCE(SUM(t.rent_amount), 0) as total_rent,
                COALESCE(SUM(t.room_area), 0) as total_tenant_area
             FROM properties p
             LEFT JOIN tenants t ON p.id = t.property_id
             GROUP BY p.id, p.name, p.address, p.property_type, p.house_area
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
        
        // Generate month series for the last N months
        const monthSeries = [];
        const now = new Date();
        for (let i = 0; i < months; i++) {
            const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            monthSeries.push({
                month: targetDate.getMonth() + 1,
                year: targetDate.getFullYear()
            });
        }
        
        const result = [];
        
        // Calculate revenue for each month in the series
        for (const period of monthSeries) {
            // Get all tenants that were active during this period from all properties
            const tenantsQuery = `
                SELECT 
                    t.id, 
                    t.rent_amount, 
                    t.move_in_date, 
                    t.move_out_date
                FROM tenants t
                JOIN properties p ON t.property_id = p.id
                WHERE (
                    (t.move_in_date <= $1 AND (t.move_out_date IS NULL OR t.move_out_date >= $1))
                    OR
                    (t.move_in_date <= $2 AND (t.move_out_date IS NULL OR t.move_out_date >= $2))
                    OR
                    (t.move_in_date >= $1 AND t.move_in_date <= $2)
                )
            `;
            
            const startOfMonth = `${period.year}-${period.month.toString().padStart(2, '0')}-01`;
            const lastDayOfMonth = new Date(period.year, period.month, 0).getDate();
            const endOfMonth = `${period.year}-${period.month.toString().padStart(2, '0')}-${lastDayOfMonth.toString().padStart(2, '0')}`;
            
            const tenantsResult = await db.query(tenantsQuery, [startOfMonth, endOfMonth]);
            const tenants = tenantsResult.rows;
            
            // Calculate proportional rent for each tenant
            let rentRevenue = 0;
            for (const tenant of tenants) {
                const occupiedDays = calculateOccupiedDays(
                    tenant.move_in_date,
                    tenant.move_out_date,
                    period.year,
                    period.month
                );
                
                if (occupiedDays > 0) {
                    const daysInMonth = getDaysInMonth(period.year, period.month);
                    const proportionalRent = (occupiedDays / daysInMonth) * parseFloat(tenant.rent_amount);
                    rentRevenue += proportionalRent;
                }
            }
            
            // Get utility revenue for this month (previous month utilities)
            let prevMonth = period.month - 1;
            let prevYear = period.year;
            if (prevMonth === 0) {
                prevMonth = 12;
                prevYear = period.year - 1;
            }
            
            const utilityQuery = `
                SELECT 
                    COALESCE(SUM(tua.allocated_amount), 0) as utility_revenue
                FROM tenant_utility_allocations tua
                JOIN utility_entries ue ON tua.utility_entry_id = ue.id
                WHERE ue.month = $1 AND ue.year = $2
            `;
            
            const utilityResult = await db.query(utilityQuery, [prevMonth, prevYear]);
            const utilityRevenue = parseFloat(utilityResult.rows[0]?.utility_revenue || 0);
            
            result.push({
                month: period.month,
                year: period.year,
                rent_revenue: Math.round(rentRevenue * 100) / 100, // Round to 2 decimal places
                utility_revenue: Math.round(utilityRevenue * 100) / 100
            });
        }
        
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: `Database error: ${err.message}` });
    }
});

// Utility costs breakdown across all properties
router.get('/utility-breakdown/:months', async (req, res) => {
    try {
        const months = parseInt(req.params.months) || 3;
        
        const result = await db.query(
            `SELECT 
                ue.utility_type,
                COUNT(*) as entry_count,
                SUM(ue.total_amount) as total_amount,
                AVG(ue.total_amount) as avg_amount
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

// Capacity metrics and warnings across all properties
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

        // Calculate overall metrics across all properties
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