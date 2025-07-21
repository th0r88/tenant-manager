import express from 'express';
import { 
    createBillingPeriod, 
    getBillingPeriods, 
    getBillingAuditTrail, 
    getBillingSummary 
} from '../services/billingPeriodService.js';

const router = express.Router();

// Get billing periods with filtering
router.get('/', async (req, res) => {
    try {
        const filters = {
            propertyId: req.query.property_id ? parseInt(req.query.property_id) : undefined,
            status: req.query.status,
            year: req.query.year ? parseInt(req.query.year) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            offset: req.query.offset ? parseInt(req.query.offset) : 0
        };
        
        const billingPeriods = await getBillingPeriods(filters);
        res.json(billingPeriods);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create or update billing period
router.post('/', async (req, res) => {
    try {
        const { property_id, month, year, notes, force } = req.body;
        
        if (!property_id || !month || !year) {
            return res.status(400).json({ error: 'Property ID, month, and year are required' });
        }
        
        if (month < 1 || month > 12) {
            return res.status(400).json({ error: 'Month must be between 1 and 12' });
        }
        
        const billingPeriod = await createBillingPeriod(property_id, month, year, { notes, force });
        res.json(billingPeriod);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Finalize billing period (TODO: implement finalize functionality)
router.put('/:id/finalize', async (req, res) => {
    try {
        // For now, just return success - finalize functionality not yet implemented
        res.json({ success: true, message: 'Finalize functionality coming soon' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Recalculate billing period (TODO: implement recalculate functionality)
router.put('/:id/recalculate', async (req, res) => {
    try {
        // For now, just return success - recalculate functionality not yet implemented
        res.json({ success: true, message: 'Recalculate functionality coming soon' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get audit trail for billing period
router.get('/:id/audit', async (req, res) => {
    try {
        const auditTrail = await getBillingAuditTrail(parseInt(req.params.id));
        res.json(auditTrail);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;