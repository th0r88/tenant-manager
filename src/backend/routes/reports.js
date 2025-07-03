import express from 'express';
import db from '../database/db.js';
import { generateTenantReport } from '../services/pdfService.js';
import { calculateProportionalRent } from '../services/proportionalCalculationService.js';
import archiver from 'archiver';
import path from 'path';
import { promisify } from 'util';

// Helper function to calculate proportional utilities
function calculateProportionalUtilities(tenant, utilities, prevYear, prevMonth) {
    let utilities_total = 0;
    let utilities_prorated = false;
    
    if (utilities && utilities.length > 0) {
        // Sum up all utility allocations
        utilities_total = utilities.reduce((sum, utility) => sum + (parseFloat(utility.allocated_amount) || 0), 0);
        
        // Check if tenant moved in during the previous month
        const prevUtilityCalculation = calculateProportionalRent(
            1, // We use 1 as base to get the proportion ratio
            tenant.move_in_date, 
            tenant.move_out_date, 
            prevYear, 
            prevMonth
        );
        
        // If tenant wasn't there for the full previous month, prorate utilities
        if (!prevUtilityCalculation.isFullMonth && prevUtilityCalculation.occupiedDays > 0) {
            const proportionRatio = prevUtilityCalculation.occupiedDays / prevUtilityCalculation.totalDaysInMonth;
            utilities_total = utilities_total * proportionRatio;
            utilities_prorated = true;
        }
    }
    
    return {
        utilities_total: Math.round(utilities_total * 100) / 100,
        utilities_prorated,
        utilities_original: utilities || []
    };
}

const router = express.Router();

// Summary route must come BEFORE the parameterized route
router.get('/summary/:month/:year', (req, res) => {
    const { month, year } = req.params;
    const propertyId = req.query.property_id || 1;
    
    // Calculate previous month and year for utilities
    let prevMonth = parseInt(month) - 1;
    let prevYear = parseInt(year);
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = parseInt(year) - 1;
    }
    
    // Get all tenants for the property first
    db.all(
        `SELECT id, name, surname, rent_amount, move_in_date, move_out_date, room_area
         FROM tenants 
         WHERE property_id = ?`,
        [propertyId],
        (err, tenants) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (tenants.length === 0) {
                return res.json([]);
            }
            
            const tenantIds = tenants.map(t => t.id);
            
            // Debug: Check if utility entries exist for the previous month
            db.all(
                `SELECT id, month, year, utility_type, total_amount, allocation_method
                 FROM utility_entries 
                 WHERE month = ? AND year = ? AND property_id = ?`,
                [prevMonth, prevYear, propertyId],
                (err, utilityEntries) => {
                    if (!err) {
                        console.log(`DEBUG: Utility entries for ${prevMonth}/${prevYear}:`, utilityEntries);
                        
                        // Also check if allocations exist for these utilities
                        if (utilityEntries.length > 0) {
                            const utilityIds = utilityEntries.map(u => u.id);
                            db.all(
                                `SELECT tua.*, t.name, t.surname 
                                 FROM tenant_utility_allocations tua
                                 JOIN tenants t ON tua.tenant_id = t.id
                                 WHERE tua.utility_entry_id IN (${utilityIds.map(() => '?').join(',')})`,
                                utilityIds,
                                (err, allocations) => {
                                    if (!err) {
                                        console.log(`DEBUG: Utility allocations for ${prevMonth}/${prevYear}:`, allocations);
                                    }
                                }
                            );
                        }
                    }
                }
            );

            // Get previous month utilities for these tenants
            db.all(
                `SELECT tua.tenant_id, SUM(tua.allocated_amount) as utilities_total
                 FROM tenant_utility_allocations tua
                 INNER JOIN utility_entries ue ON tua.utility_entry_id = ue.id 
                 WHERE ue.month = ? AND ue.year = ? AND tua.tenant_id IN (${tenantIds.map(() => '?').join(',')})
                 GROUP BY tua.tenant_id`,
                [prevMonth, prevYear, ...tenantIds],
                (err, utilities) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    console.log(`Summary for ${month}/${year} (rent) + ${prevMonth}/${prevYear} (utilities):`, { 
                        requestedMonth: month, 
                        requestedYear: year, 
                        prevMonth, 
                        prevYear, 
                        tenantsCount: tenants.length, 
                        utilitiesCount: utilities.length,
                        tenantIds: tenants.map(t => t.id),
                        utilitiesData: utilities
                    });
                    
                    // Create a map of tenant utilities
                    const utilitiesMap = {};
                    utilities.forEach(util => {
                        utilitiesMap[util.tenant_id] = util.utilities_total || 0;
                    });
                    
                    const result = tenants
                        .filter(tenant => {
                            // Only include tenants who were actually living there during the current month
                            const rentCalculation = calculateProportionalRent(
                                tenant.rent_amount, 
                                tenant.move_in_date, 
                                tenant.move_out_date, 
                                parseInt(year), 
                                parseInt(month)
                            );
                            // Only show tenants who had at least 1 day of occupancy in the current month
                            return rentCalculation.occupiedDays > 0;
                        })
                        .map(tenant => {
                        // Calculate proportional rent for current month
                        const rentCalculation = calculateProportionalRent(
                            tenant.rent_amount, 
                            tenant.move_in_date, 
                            tenant.move_out_date, 
                            parseInt(year), 
                            parseInt(month)
                        );
                        
                        // Calculate proportional utilities from previous month
                        let utilities_total = utilitiesMap[tenant.id] || 0;
                        let utilities_prorated = false;
                        
                        if (utilities_total > 0) {
                            // Check if tenant moved in during the previous month
                            const prevUtilityCalculation = calculateProportionalRent(
                                1, // We use 1 as base to get the proportion ratio
                                tenant.move_in_date, 
                                tenant.move_out_date, 
                                prevYear, 
                                prevMonth
                            );
                            
                            // If tenant wasn't there for the full previous month, prorate utilities
                            if (!prevUtilityCalculation.isFullMonth && prevUtilityCalculation.occupiedDays > 0) {
                                const proportionRatio = prevUtilityCalculation.occupiedDays / prevUtilityCalculation.totalDaysInMonth;
                                utilities_total = utilities_total * proportionRatio;
                                utilities_prorated = true;
                            }
                        }
                        
                        // Calculate final amounts
                        const currentMonthRent = rentCalculation.isFullMonth ? 
                            rentCalculation.monthlyRent : 
                            rentCalculation.proRatedAmount;
                        
                        return {
                            ...tenant,
                            rent_amount: currentMonthRent,
                            utilities_total: Math.round(utilities_total * 100) / 100, // Round to 2 decimal places
                            total_due: currentMonthRent + utilities_total,
                            // Additional info for debugging
                            is_rent_prorated: !rentCalculation.isFullMonth,
                            is_utilities_prorated: utilities_prorated,
                            occupied_days_current: rentCalculation.occupiedDays,
                            total_days_current: rentCalculation.totalDaysInMonth
                        };
                    });
                    
                    res.json(result);
                }
            );
        }
    );
});

router.get('/:tenantId/:month/:year', (req, res) => {
    const { tenantId, month, year } = req.params;
    const { lang = 'sl' } = req.query;
    
    // Calculate previous month and year for utilities
    let prevMonth = parseInt(month) - 1;
    let prevYear = parseInt(year);
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = parseInt(year) - 1;
    }
    
    db.get('SELECT t.*, p.name as property_name FROM tenants t JOIN properties p ON t.property_id = p.id WHERE t.id = ?', [tenantId], (err, tenant) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
        
        // Get utilities from PREVIOUS month instead of current month
        db.all(
            `SELECT ue.utility_type, ue.total_amount, ue.allocation_method, tua.allocated_amount 
             FROM tenant_utility_allocations tua
             JOIN utility_entries ue ON tua.utility_entry_id = ue.id
             WHERE tua.tenant_id = ? AND ue.month = ? AND ue.year = ?`,
            [tenantId, prevMonth, prevYear],
            async (err, utilities) => {
                if (err) return res.status(500).json({ error: err.message });
                
                try {
                    // Calculate proportional utilities if tenant moved in during previous month
                    const proportionalUtilities = calculateProportionalUtilities(tenant, utilities, prevYear, prevMonth);
                    
                    // Create modified utilities array with proportional amounts
                    const originalTotal = utilities.reduce((sum, u) => sum + parseFloat(u.allocated_amount), 0);
                    const modifiedUtilities = utilities.map(utility => ({
                        ...utility,
                        allocated_amount: (proportionalUtilities.utilities_prorated && originalTotal > 0) ? 
                            (parseFloat(utility.allocated_amount) * 
                             (proportionalUtilities.utilities_total / originalTotal)
                            ).toFixed(2) : 
                            utility.allocated_amount
                    }));
                    
                    // Generate PDF with current month but previous month utilities (proportionally adjusted)
                    const pdfBuffer = await generateTenantReport(tenant, month, year, modifiedUtilities, { 
                        language: lang,
                        utilitiesFromPreviousMonth: true, // Flag to indicate utilities are from previous month
                        utilitiesProrated: proportionalUtilities.utilities_prorated,
                        prevMonth,
                        prevYear
                    });
                    
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
    const { tenantIds, month, year, language = 'sl' } = req.body;
    
    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
        return res.status(400).json({ error: 'tenantIds array is required' });
    }
    
    if (!month || !year) {
        return res.status(400).json({ error: 'month and year are required' });
    }

    // Calculate previous month and year for utilities
    let prevMonth = parseInt(month) - 1;
    let prevYear = parseInt(year);
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = parseInt(year) - 1;
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

                // Get tenant utilities from PREVIOUS month
                const utilities = await new Promise((resolve, reject) => {
                    db.all(
                        `SELECT ue.utility_type, ue.total_amount, ue.allocation_method, tua.allocated_amount 
                         FROM tenant_utility_allocations tua
                         JOIN utility_entries ue ON tua.utility_entry_id = ue.id
                         WHERE tua.tenant_id = ? AND ue.month = ? AND ue.year = ?`,
                        [tenantId, prevMonth, prevYear],
                        (err, result) => {
                            if (err) reject(err);
                            else resolve(result || []);
                        }
                    );
                });

                // Calculate proportional utilities if tenant moved in during previous month
                const proportionalUtilities = calculateProportionalUtilities(tenant, utilities, prevYear, prevMonth);
                
                // Create modified utilities array with proportional amounts
                const originalTotal = utilities.reduce((sum, u) => sum + parseFloat(u.allocated_amount), 0);
                const modifiedUtilities = utilities.map(utility => ({
                    ...utility,
                    allocated_amount: (proportionalUtilities.utilities_prorated && originalTotal > 0) ? 
                        (parseFloat(utility.allocated_amount) * 
                         (proportionalUtilities.utilities_total / originalTotal)
                        ).toFixed(2) : 
                        utility.allocated_amount
                }));

                // Generate PDF with previous month utilities (proportionally adjusted)
                const pdfBuffer = await generateTenantReport(tenant, month, year, modifiedUtilities, { 
                    language,
                    utilitiesFromPreviousMonth: true,
                    utilitiesProrated: proportionalUtilities.utilities_prorated,
                    prevMonth,
                    prevYear
                });
                
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
    const { tenantIds, month, year, language = 'sl' } = req.body;
    
    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
        return res.status(400).json({ error: 'tenantIds array is required' });
    }
    
    if (!month || !year) {
        return res.status(400).json({ error: 'month and year are required' });
    }

    // Calculate previous month and year for utilities
    let prevMonth = parseInt(month) - 1;
    let prevYear = parseInt(year);
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = parseInt(year) - 1;
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

                // Get tenant utilities from PREVIOUS month
                const utilities = await new Promise((resolve, reject) => {
                    db.all(
                        `SELECT ue.utility_type, ue.total_amount, ue.allocation_method, tua.allocated_amount 
                         FROM tenant_utility_allocations tua
                         JOIN utility_entries ue ON tua.utility_entry_id = ue.id
                         WHERE tua.tenant_id = ? AND ue.month = ? AND ue.year = ?`,
                        [tenantId, prevMonth, prevYear],
                        (err, result) => {
                            if (err) reject(err);
                            else resolve(result || []);
                        }
                    );
                });

                // Calculate proportional utilities if tenant moved in during previous month
                const proportionalUtilities = calculateProportionalUtilities(tenant, utilities, prevYear, prevMonth);
                
                // Create modified utilities array with proportional amounts
                const originalTotal = utilities.reduce((sum, u) => sum + parseFloat(u.allocated_amount), 0);
                const modifiedUtilities = utilities.map(utility => ({
                    ...utility,
                    allocated_amount: (proportionalUtilities.utilities_prorated && originalTotal > 0) ? 
                        (parseFloat(utility.allocated_amount) * 
                         (proportionalUtilities.utilities_total / originalTotal)
                        ).toFixed(2) : 
                        utility.allocated_amount
                }));

                // Generate PDF with previous month utilities (proportionally adjusted)
                const pdfBuffer = await generateTenantReport(tenant, month, year, modifiedUtilities, { 
                    language,
                    utilitiesFromPreviousMonth: true,
                    utilitiesProrated: proportionalUtilities.utilities_prorated,
                    prevMonth,
                    prevYear
                });
                
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