import express from 'express';
import db from '../database/db.js';
import { generateTenantReport } from '../services/pdfService.js';

const router = express.Router();

// Summary route must come BEFORE the parameterized route
router.get('/summary/:month/:year', (req, res) => {
    const { month, year } = req.params;
    const propertyId = req.query.property_id || 1;
    
    db.all(
        `SELECT t.id, t.name, t.surname, t.rent_amount,
                SUM(tua.allocated_amount) as utilities_total
         FROM tenants t
         INNER JOIN tenant_utility_allocations tua ON t.id = tua.tenant_id
         INNER JOIN utility_entries ue ON tua.utility_entry_id = ue.id 
         WHERE ue.month = ? AND ue.year = ? AND t.property_id = ?
         GROUP BY t.id`,
        [month, year, propertyId],
        (err, summary) => {
            if (err) return res.status(500).json({ error: err.message });
            
            console.log(`Summary for ${month}/${year}:`, summary);
            
            const result = summary.map(tenant => ({
                ...tenant,
                total_due: tenant.rent_amount + tenant.utilities_total
            }));
            
            res.json(result);
        }
    );
});

router.get('/:tenantId/:month/:year', (req, res) => {
    const { tenantId, month, year } = req.params;
    
    db.get('SELECT * FROM tenants WHERE id = ?', [tenantId], (err, tenant) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
        
        db.all(
            `SELECT ue.utility_type, tua.allocated_amount 
             FROM tenant_utility_allocations tua
             JOIN utility_entries ue ON tua.utility_entry_id = ue.id
             WHERE tua.tenant_id = ? AND ue.month = ? AND ue.year = ?`,
            [tenantId, month, year],
            async (err, utilities) => {
                if (err) return res.status(500).json({ error: err.message });
                
                try {
                    const pdfBuffer = await generateTenantReport(tenant, month, year, utilities);
                    
                    res.set({
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `attachment; filename="tenant-${tenant.name}-${tenant.surname}-${month}-${year}.pdf"`
                    });
                    
                    res.send(pdfBuffer);
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            }
        );
    });
});

export default router;