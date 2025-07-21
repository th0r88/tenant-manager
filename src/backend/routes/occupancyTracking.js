import express from 'express';
import { 
    getTenantOccupancyHistory, 
    getPropertyOccupancyHistory, 
    getOccupancySnapshot, 
    getMonthlyOccupancyStats 
} from '../services/occupancyTrackingService.js';

const router = express.Router();

// Get occupancy history for a specific tenant
router.get('/tenant/:id', async (req, res) => {
    try {
        const tenantId = parseInt(req.params.id);
        const history = await getTenantOccupancyHistory(tenantId);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get occupancy history for a specific property
router.get('/property/:id', async (req, res) => {
    try {
        const propertyId = parseInt(req.params.id);
        const filters = {
            changeType: req.query.change_type,
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            limit: req.query.limit ? parseInt(req.query.limit) : 100
        };
        
        const history = await getPropertyOccupancyHistory(propertyId, filters);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get occupancy statistics for a property
router.get('/statistics/:propertyId', async (req, res) => {
    try {
        const propertyId = parseInt(req.params.propertyId);
        const year = parseInt(req.query.year);
        const month = req.query.month ? parseInt(req.query.month) : null;
        
        if (!year) {
            return res.status(400).json({ error: 'Year parameter is required' });
        }
        
        const statistics = await getMonthlyOccupancyStats(propertyId, 12);
        res.json(statistics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get comprehensive occupancy report
router.get('/report', async (req, res) => {
    try {
        const filters = {
            year: req.query.year ? parseInt(req.query.year) : undefined,
            month: req.query.month ? parseInt(req.query.month) : undefined,
            propertyId: req.query.property_id ? parseInt(req.query.property_id) : undefined
        };
        
        // For now, use snapshot as placeholder for comprehensive report
        const report = await getOccupancySnapshot(filters.propertyId || 1);
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;