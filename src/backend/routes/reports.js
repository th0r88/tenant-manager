import express from 'express';
import db from '../database/db.js';
import { generateTenantReport } from '../services/pdfService.js';
import { calculateProportionalRent } from '../services/proportionalCalculationService.js';
import precisionMath from '../utils/precisionMath.js';
import archiver from 'archiver';
import path from 'path';
import { promisify } from 'util';

// Helper function to sum utilities (proration is already handled in calculationService)
function calculateProportionalUtilities(tenant, utilities, prevYear, prevMonth) {
    let utilities_total = 0;
    
    if (utilities && utilities.length > 0) {
        // Simply sum up all utility allocations - they are already correctly calculated
        // with proper per-person/per-sqm logic and proration applied in calculationService
        utilities_total = utilities.reduce((sum, utility) => sum + (parseFloat(utility.allocated_amount) || 0), 0);
    }
    
    return {
        utilities_total: Math.round(utilities_total * 100) / 100,
        utilities_prorated: false, // Proration was already applied during initial calculation
        utilities_original: utilities || []
    };
}

// Helper: compute adjustment for a tenant's previous month payment
// Invoice for month M = rent(M) + utilities(M-1)
// So invoice for prevMonth = rent(prevMonth) + utilities(prevPrevMonth)
async function computeAdjustment(tenantId, tenant, prevMonth, prevYear) {
    const adjResult = await db.query(
        'SELECT amount_paid FROM payment_adjustments WHERE tenant_id = $1 AND month = $2 AND year = $3',
        [tenantId, prevMonth, prevYear]
    );
    if (adjResult.rows.length === 0) return null;

    // Compute rent for prevMonth
    const prevRentCalc = calculateProportionalRent(tenant.rent_amount, tenant.move_in_date, tenant.move_out_date, prevYear, prevMonth);
    const prevRent = prevRentCalc.isFullMonth ? prevRentCalc.monthlyRent : prevRentCalc.proRatedAmount;

    // The invoice for prevMonth included utilities from prevPrevMonth
    let prevPrevMonth = prevMonth - 1;
    let prevPrevYear = prevYear;
    if (prevPrevMonth === 0) {
        prevPrevMonth = 12;
        prevPrevYear = prevYear - 1;
    }

    const prevPrevUtilResult = await db.query(
        `SELECT SUM(tua.allocated_amount) as total
         FROM tenant_utility_allocations tua
         JOIN utility_entries ue ON tua.utility_entry_id = ue.id
         WHERE tua.tenant_id = $1 AND ue.month = $2 AND ue.year = $3`,
        [tenantId, prevPrevMonth, prevPrevYear]
    );
    const prevPrevUtilities = parseFloat(prevPrevUtilResult.rows[0]?.total) || 0;

    const prevTotalDue = precisionMath.toNumber(precisionMath.add(prevRent, prevPrevUtilities));
    const amountPaid = parseFloat(adjResult.rows[0].amount_paid);
    const adjustmentAmount = precisionMath.toNumber(precisionMath.subtract(amountPaid, prevTotalDue));

    if (Math.abs(adjustmentAmount) < 0.005) return null;
    return { amount: adjustmentAmount, month: prevMonth, year: prevYear };
}

const router = express.Router();

// Summary route must come BEFORE the parameterized route
router.get('/summary/:month/:year', async (req, res) => {
    try {
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
        const tenantsResult = await db.query(
            `SELECT id, name, surname, rent_amount, move_in_date, move_out_date, room_area
             FROM tenants 
             WHERE property_id = $1`,
            [propertyId]
        );
        const tenants = tenantsResult.rows;
        
        if (tenants.length === 0) {
            return res.json([]);
        }
        
        const tenantIds = tenants.map(t => t.id);
        
        // Get previous month utilities for these tenants
        let utilities = [];
        if (tenantIds.length > 0) {
            const placeholders = tenantIds.map((_, index) => `$${index + 3}`).join(', ');
            const utilitiesResult = await db.query(
                `SELECT tua.tenant_id, SUM(tua.allocated_amount) as utilities_total
                 FROM tenant_utility_allocations tua
                 INNER JOIN utility_entries ue ON tua.utility_entry_id = ue.id 
                 WHERE ue.month = $1 AND ue.year = $2 AND tua.tenant_id IN (${placeholders})
                 GROUP BY tua.tenant_id`,
                [prevMonth, prevYear, ...tenantIds]
            );
            utilities = utilitiesResult.rows;
        }
        
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

        // Compute prev_total_due per tenant (what was invoiced in prevMonth)
        // Invoice for prevMonth = rent(prevMonth) + utilities(prevPrevMonth)
        let prevPrevMonth = prevMonth - 1;
        let prevPrevYear = prevYear;
        if (prevPrevMonth === 0) {
            prevPrevMonth = 12;
            prevPrevYear = prevYear - 1;
        }

        let prevPrevUtilities = [];
        if (tenantIds.length > 0) {
            const pp = tenantIds.map((_, index) => `$${index + 3}`).join(', ');
            const ppResult = await db.query(
                `SELECT tua.tenant_id, SUM(tua.allocated_amount) as utilities_total
                 FROM tenant_utility_allocations tua
                 INNER JOIN utility_entries ue ON tua.utility_entry_id = ue.id
                 WHERE ue.month = $1 AND ue.year = $2 AND tua.tenant_id IN (${pp})
                 GROUP BY tua.tenant_id`,
                [prevPrevMonth, prevPrevYear, ...tenantIds]
            );
            prevPrevUtilities = ppResult.rows;
        }
        const prevPrevUtilMap = {};
        prevPrevUtilities.forEach(u => {
            prevPrevUtilMap[u.tenant_id] = parseFloat(u.utilities_total) || 0;
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
            
            // Get utilities total from previous month (already prorated by calculationService)
            const utilities_total = utilitiesMap[tenant.id] || 0;
            
            // Calculate final amounts
            const currentMonthRent = rentCalculation.isFullMonth ? 
                rentCalculation.monthlyRent : 
                rentCalculation.proRatedAmount;
            
            // Compute previous month's total_due for adjustment calculation
            const prevRentCalc = calculateProportionalRent(
                tenant.rent_amount, tenant.move_in_date, tenant.move_out_date,
                prevYear, prevMonth
            );
            const prevMonthRent = prevRentCalc.isFullMonth ? prevRentCalc.monthlyRent : prevRentCalc.proRatedAmount;
            const prevMonthUtilities = prevPrevUtilMap[tenant.id] || 0;
            const prev_total_due = parseFloat(prevMonthRent) + prevMonthUtilities;

            return {
                ...tenant,
                rent_amount: currentMonthRent,
                utilities_total: Math.round(utilities_total * 100) / 100,
                total_due: parseFloat(currentMonthRent) + parseFloat(utilities_total),
                prev_total_due: Math.round(prev_total_due * 100) / 100,
                is_rent_prorated: !rentCalculation.isFullMonth,
                occupied_days_current: rentCalculation.occupiedDays,
                total_days_current: rentCalculation.totalDaysInMonth
            };
        });
        
        res.json(result);
    } catch (err) {
        console.error('Error fetching report summary:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:tenantId/:month/:year', async (req, res) => {
    try {
        const { tenantId, month, year } = req.params;
        const { lang = 'sl' } = req.query;
        
        // Calculate previous month and year for utilities
        let prevMonth = parseInt(month) - 1;
        let prevYear = parseInt(year);
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = parseInt(year) - 1;
        }
        
        const tenantResult = await db.query('SELECT t.*, p.name as property_name FROM tenants t JOIN properties p ON t.property_id = p.id WHERE t.id = $1', [tenantId]);
        const tenant = tenantResult.rows[0];
        
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        
        // Get utilities from PREVIOUS month instead of current month
        const utilitiesResult = await db.query(
            `SELECT ue.utility_type, ue.total_amount, ue.allocation_method, tua.allocated_amount 
             FROM tenant_utility_allocations tua
             JOIN utility_entries ue ON tua.utility_entry_id = ue.id
             WHERE tua.tenant_id = $1 AND ue.month = $2 AND ue.year = $3`,
            [tenantId, prevMonth, prevYear]
        );
        const utilities = utilitiesResult.rows;
        
        // Calculate proportional utilities if tenant moved in during previous month
        const proportionalUtilities = calculateProportionalUtilities(tenant, utilities, prevYear, prevMonth);
        
        // Use already-correctly-prorated utilities (no double proration)
        const modifiedUtilities = utilities.map(utility => ({
            ...utility,
            allocated_amount: utility.allocated_amount  // Already prorated in calculationService
        }));
        
        // Look up payment adjustment for the previous month
        const adjustment = await computeAdjustment(tenantId, tenant, prevMonth, prevYear);

        // Generate PDF with current month but previous month utilities (proportionally adjusted)
        const pdfBuffer = await generateTenantReport(tenant, month, year, modifiedUtilities, {
            language: lang,
            utilitiesFromPreviousMonth: true, // Flag to indicate utilities are from previous month
            utilitiesProrated: proportionalUtilities.utilities_prorated,
            prevMonth,
            prevYear,
            adjustment
        });

        const safeName = tenant.name.replace(/[^a-zA-Z0-9]/g, '');
        const safeSurname = tenant.surname.replace(/[^a-zA-Z0-9]/g, '');
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="tenant-${safeName}-${safeSurname}-${month}-${year}.pdf"`
        });
        
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating tenant report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
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

    if (tenantIds.length > 50) {
        return res.status(400).json({ error: 'Maximum 50 tenants per batch export' });
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
                // Get tenant data with property name
                const tenantResult = await db.query('SELECT t.*, p.name as property_name FROM tenants t JOIN properties p ON t.property_id = p.id WHERE t.id = $1', [tenantId]);
                const tenant = tenantResult.rows[0];

                if (!tenant) {
                    errors.push(`Tenant with ID ${tenantId} not found`);
                    continue;
                }

                // Get tenant utilities from PREVIOUS month
                const utilitiesResult = await db.query(
                    `SELECT ue.utility_type, ue.total_amount, ue.allocation_method, tua.allocated_amount 
                     FROM tenant_utility_allocations tua
                     JOIN utility_entries ue ON tua.utility_entry_id = ue.id
                     WHERE tua.tenant_id = $1 AND ue.month = $2 AND ue.year = $3`,
                    [tenantId, prevMonth, prevYear]
                );
                const utilities = utilitiesResult.rows || [];

                // Calculate proportional utilities if tenant moved in during previous month
                const proportionalUtilities = calculateProportionalUtilities(tenant, utilities, prevYear, prevMonth);
                
                // Use already-correctly-prorated utilities (no double proration)
                const modifiedUtilities = utilities.map(utility => ({
                    ...utility,
                    allocated_amount: utility.allocated_amount  // Already prorated in calculationService
                }));

                // Look up payment adjustment for the previous month
                const adjustment = await computeAdjustment(tenantId, tenant, prevMonth, prevYear);

                // Generate PDF with previous month utilities (proportionally adjusted)
                const pdfBuffer = await generateTenantReport(tenant, month, year, modifiedUtilities, {
                    language,
                    utilitiesFromPreviousMonth: true,
                    utilitiesProrated: proportionalUtilities.utilities_prorated,
                    prevMonth,
                    prevYear,
                    adjustment
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
            res.status(500).json({ error: 'Internal server error' });
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

    if (tenantIds.length > 50) {
        return res.status(400).json({ error: 'Maximum 50 tenants per batch export' });
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

                // Get tenant data with property name
                const tenantResult = await db.query('SELECT t.*, p.name as property_name FROM tenants t JOIN properties p ON t.property_id = p.id WHERE t.id = $1', [tenantId]);
                const tenant = tenantResult.rows[0];

                if (!tenant) {
                    errors.push(`Tenant with ID ${tenantId} not found`);
                    processedCount++;
                    continue;
                }

                // Get tenant utilities from PREVIOUS month
                const utilitiesResult = await db.query(
                    `SELECT ue.utility_type, ue.total_amount, ue.allocation_method, tua.allocated_amount 
                     FROM tenant_utility_allocations tua
                     JOIN utility_entries ue ON tua.utility_entry_id = ue.id
                     WHERE tua.tenant_id = $1 AND ue.month = $2 AND ue.year = $3`,
                    [tenantId, prevMonth, prevYear]
                );
                const utilities = utilitiesResult.rows || [];

                // Calculate proportional utilities if tenant moved in during previous month
                const proportionalUtilities = calculateProportionalUtilities(tenant, utilities, prevYear, prevMonth);
                
                // Use already-correctly-prorated utilities (no double proration)
                const modifiedUtilities = utilities.map(utility => ({
                    ...utility,
                    allocated_amount: utility.allocated_amount  // Already prorated in calculationService
                }));

                // Look up payment adjustment for the previous month
                const adjustment = await computeAdjustment(tenantId, tenant, prevMonth, prevYear);

                // Generate PDF with previous month utilities (proportionally adjusted)
                const pdfBuffer = await generateTenantReport(tenant, month, year, modifiedUtilities, {
                    language,
                    utilitiesFromPreviousMonth: true,
                    utilitiesProrated: proportionalUtilities.utilities_prorated,
                    prevMonth,
                    prevYear,
                    adjustment
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
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Regenerate all PDFs for a specific month/year
router.post('/regenerate/:month/:year', async (req, res) => {
    try {
        const { month, year } = req.params;
        const { propertyId = 1, language = 'sl' } = req.body;

        // Calculate previous month and year for utilities
        let prevMonth = parseInt(month) - 1;
        let prevYear = parseInt(year);
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = parseInt(year) - 1;
        }

        // Get all tenants for the property
        const tenantsResult = await db.query(
            `SELECT t.*, p.name as property_name
             FROM tenants t
             JOIN properties p ON t.property_id = p.id
             WHERE t.property_id = $1`,
            [propertyId]
        );
        const tenants = tenantsResult.rows;

        if (tenants.length === 0) {
            return res.json({
                success: true,
                message: 'No tenants found for regeneration',
                regenerated: 0
            });
        }

        let regeneratedCount = 0;
        let errors = [];

        // Regenerate PDF for each tenant using direct function calls
        for (const tenant of tenants) {
            try {
                // Get tenant utilities from previous month
                const utilitiesResult = await db.query(
                    `SELECT ue.utility_type, ue.total_amount, ue.allocation_method, tua.allocated_amount
                     FROM tenant_utility_allocations tua
                     JOIN utility_entries ue ON tua.utility_entry_id = ue.id
                     WHERE tua.tenant_id = $1 AND ue.month = $2 AND ue.year = $3`,
                    [tenant.id, prevMonth, prevYear]
                );
                const utilities = utilitiesResult.rows || [];

                const proportionalUtilities = calculateProportionalUtilities(tenant, utilities, prevYear, prevMonth);

                const modifiedUtilities = utilities.map(utility => ({
                    ...utility,
                    allocated_amount: utility.allocated_amount
                }));

                const adjustment = await computeAdjustment(tenant.id, tenant, prevMonth, prevYear);

                // Generate PDF directly
                await generateTenantReport(tenant, month, year, modifiedUtilities, {
                    language,
                    utilitiesFromPreviousMonth: true,
                    utilitiesProrated: proportionalUtilities.utilities_prorated,
                    prevMonth,
                    prevYear,
                    adjustment
                });

                regeneratedCount++;
            } catch (error) {
                console.error(`Error regenerating PDF for tenant ${tenant.id}:`, error);
                errors.push(`Failed to regenerate PDF for ${tenant.name} ${tenant.surname}`);
            }
        }

        res.json({
            success: true,
            message: `Regeneration completed for ${month}/${year}`,
            regenerated: regeneratedCount,
            total: tenants.length,
            errors: errors
        });

    } catch (error) {
        console.error('PDF regeneration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;