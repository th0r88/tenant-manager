import express from 'express';
import db from '../database/db.js';
import { generateTenantReport } from '../services/pdfService.js';
import archiver from 'archiver';
import path from 'path';
import { promisify } from 'util';

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
                    
                    const safeName = tenant.name.replace(/[^a-zA-Z0-9]/g, '');
                    const safeSurname = tenant.surname.replace(/[^a-zA-Z0-9]/g, '');
                    res.set({
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `attachment; filename="tenant-${safeName}-${safeSurname}-${month}-${year}.pdf"`
                    });
                    
                    res.send(pdfBuffer);
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            }
        );
    });
});

// Batch export route for multiple tenant reports as ZIP
router.post('/batch-export', async (req, res) => {
    const { tenantIds, month, year } = req.body;
    
    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
        return res.status(400).json({ error: 'tenantIds array is required' });
    }
    
    if (!month || !year) {
        return res.status(400).json({ error: 'month and year are required' });
    }

    try {
        // Set up streaming response
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="batch-reports-${month}-${year}.zip"`);
        res.setHeader('Transfer-Encoding', 'chunked');

        // Create ZIP archive
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        // Handle archive warnings/errors
        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                console.warn('Archive warning:', err);
            } else {
                throw err;
            }
        });

        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to create ZIP archive' });
            }
        });

        // Pipe archive to response
        archive.pipe(res);

        // Process each tenant
        let processedCount = 0;
        const totalCount = tenantIds.length;
        const errors = [];

        for (const tenantId of tenantIds) {
            try {
                // Get tenant data
                const tenant = await new Promise((resolve, reject) => {
                    db.get('SELECT * FROM tenants WHERE id = ?', [tenantId], (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });

                if (!tenant) {
                    errors.push(`Tenant with ID ${tenantId} not found`);
                    continue;
                }

                // Get tenant utilities
                const utilities = await new Promise((resolve, reject) => {
                    db.all(
                        `SELECT ue.utility_type, ue.total_amount, ue.allocation_method, tua.allocated_amount 
                         FROM tenant_utility_allocations tua
                         JOIN utility_entries ue ON tua.utility_entry_id = ue.id
                         WHERE tua.tenant_id = ? AND ue.month = ? AND ue.year = ?`,
                        [tenantId, month, year],
                        (err, result) => {
                            if (err) reject(err);
                            else resolve(result || []);
                        }
                    );
                });

                // Generate PDF
                const pdfBuffer = await generateTenantReport(tenant, month, year, utilities);
                
                // Create safe filename
                const safeName = tenant.name.replace(/[^a-zA-Z0-9]/g, '');
                const safeSurname = tenant.surname.replace(/[^a-zA-Z0-9]/g, '');
                const filename = `${safeName}_${safeSurname}_${month}_${year}.pdf`;
                
                // Add PDF to archive
                archive.append(pdfBuffer, { name: filename });
                
                processedCount++;
                console.log(`Processed ${processedCount}/${totalCount}: ${tenant.name} ${tenant.surname}`);

            } catch (error) {
                console.error(`Error processing tenant ${tenantId}:`, error);
                errors.push(`Failed to generate report for tenant ID ${tenantId}: ${error.message}`);
                processedCount++;
            }
        }

        // Add summary file if there were errors
        if (errors.length > 0) {
            const errorSummary = `Batch Export Summary - ${month}/${year}\n\nErrors encountered:\n${errors.map((err, i) => `${i + 1}. ${err}`).join('\n')}\n\nSuccessfully processed: ${processedCount - errors.length}/${totalCount} reports`;
            archive.append(Buffer.from(errorSummary), { name: 'export_summary.txt' });
        }

        // Finalize archive
        await archive.finalize();
        
        console.log(`Batch export completed: ${processedCount}/${totalCount} reports processed`);

    } catch (error) {
        console.error('Batch export error:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Batch export failed', 
                details: error.message 
            });
        }
    }
});

// Streaming batch export with progress updates
router.post('/batch-export-stream', async (req, res) => {
    const { tenantIds, month, year } = req.body;
    
    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
        return res.status(400).json({ error: 'tenantIds array is required' });
    }
    
    if (!month || !year) {
        return res.status(400).json({ error: 'month and year are required' });
    }

    try {
        // Set up Server-Sent Events for progress updates
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const sendProgress = (current, total, message = '') => {
            const progressData = JSON.stringify({
                type: 'progress',
                progress: { current, total },
                message
            });
            res.write(progressData + '\n');
        };

        const sendComplete = (downloadUrl, filename) => {
            const completeData = JSON.stringify({
                type: 'complete',
                downloadUrl,
                filename
            });
            res.write(completeData + '\n');
            res.end();
        };

        const sendError = (message) => {
            const errorData = JSON.stringify({
                type: 'error',
                message
            });
            res.write(errorData + '\n');
            res.end();
        };

        // Create temporary ZIP file in memory
        const chunks = [];
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        archive.on('data', chunk => chunks.push(chunk));
        archive.on('error', err => sendError(err.message));

        let processedCount = 0;
        const totalCount = tenantIds.length;
        const errors = [];

        sendProgress(0, totalCount, 'Starting batch export...');

        // Process each tenant
        for (const tenantId of tenantIds) {
            try {
                sendProgress(processedCount, totalCount, `Processing tenant ${tenantId}...`);

                // Get tenant data
                const tenant = await new Promise((resolve, reject) => {
                    db.get('SELECT * FROM tenants WHERE id = ?', [tenantId], (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });

                if (!tenant) {
                    errors.push(`Tenant with ID ${tenantId} not found`);
                    processedCount++;
                    continue;
                }

                // Get tenant utilities
                const utilities = await new Promise((resolve, reject) => {
                    db.all(
                        `SELECT ue.utility_type, ue.total_amount, ue.allocation_method, tua.allocated_amount 
                         FROM tenant_utility_allocations tua
                         JOIN utility_entries ue ON tua.utility_entry_id = ue.id
                         WHERE tua.tenant_id = ? AND ue.month = ? AND ue.year = ?`,
                        [tenantId, month, year],
                        (err, result) => {
                            if (err) reject(err);
                            else resolve(result || []);
                        }
                    );
                });

                // Generate PDF
                const pdfBuffer = await generateTenantReport(tenant, month, year, utilities);
                
                // Create safe filename
                const safeName = tenant.name.replace(/[^a-zA-Z0-9]/g, '');
                const safeSurname = tenant.surname.replace(/[^a-zA-Z0-9]/g, '');
                const filename = `${safeName}_${safeSurname}_${month}_${year}.pdf`;
                
                // Add PDF to archive
                archive.append(pdfBuffer, { name: filename });
                
                processedCount++;
                sendProgress(processedCount, totalCount, `Completed ${tenant.name} ${tenant.surname}`);

            } catch (error) {
                console.error(`Error processing tenant ${tenantId}:`, error);
                errors.push(`Failed to generate report for tenant ID ${tenantId}: ${error.message}`);
                processedCount++;
                sendProgress(processedCount, totalCount, `Error processing tenant ${tenantId}`);
            }
        }

        // Add error summary if needed
        if (errors.length > 0) {
            const errorSummary = `Batch Export Summary - ${month}/${year}\n\nErrors encountered:\n${errors.map((err, i) => `${i + 1}. ${err}`).join('\n')}\n\nSuccessfully processed: ${processedCount - errors.length}/${totalCount} reports`;
            archive.append(Buffer.from(errorSummary), { name: 'export_summary.txt' });
        }

        // Finalize and create download
        await archive.finalize();
        
        const zipBuffer = Buffer.concat(chunks);
        const filename = `batch-reports-${month}-${year}.zip`;
        
        // For this demo, we'll send the buffer as base64
        // In production, you'd want to save to a temp file and return a download URL
        const base64Data = zipBuffer.toString('base64');
        const downloadUrl = `data:application/zip;base64,${base64Data}`;
        
        sendComplete(downloadUrl, filename);

    } catch (error) {
        console.error('Streaming batch export error:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Streaming batch export failed', 
                details: error.message 
            });
        }
    }
});

export default router;