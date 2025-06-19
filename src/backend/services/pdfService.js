import PDFDocument from 'pdfkit';
import { calculateProportionalRent, getOccupancyPeriodDescription } from './proportionalCalculationService.js';
import { PDF_STYLES, PDF_UTILS } from './pdfStyles.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for font paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateTenantReport(tenant, month, year, utilities, options = {}) {
    const { streaming = false, progressCallback = null } = options;
    
    return new Promise(async (resolve, reject) => {
        try {
            if (progressCallback) progressCallback('tenant_start', { tenantId: tenant.id, name: `${tenant.name} ${tenant.surname}` });
            // Generate optimized filename
            const filename = PDF_UTILS.generateFileName(tenant, month, year);
            
            const doc = new PDFDocument({
                size: 'A4',
                margins: {
                    top: PDF_STYLES.spacing.pageMargin,
                    bottom: PDF_STYLES.spacing.pageMargin,
                    left: PDF_STYLES.spacing.pageMargin,
                    right: PDF_STYLES.spacing.pageMargin
                },
                bufferPages: true,
                info: {
                    Title: `Monthly Statement - ${tenant.name} ${tenant.surname} - ${month}/${year}`,
                    Author: 'Property Management System',
                    Subject: 'Monthly Tenant Billing Statement',
                    Creator: 'Property Management System v1.0',
                    Keywords: `tenant,billing,rent,utilities,${tenant.name},${tenant.surname},${month},${year},statement`,
                    Producer: 'Property Management System v1.0',
                    CreationDate: new Date(),
                    ModDate: new Date(),
                    Language: 'sl-SI'
                },
                compress: true
            });

            // Register DejaVu Sans fonts for Slovenian character support
            const fontDir = path.join(__dirname, '../fonts');
            try {
                doc.registerFont('DejaVuSans', path.join(fontDir, 'DejaVuSans.ttf'));
                doc.registerFont('DejaVuSans-Bold', path.join(fontDir, 'DejaVuSans-Bold.ttf'));
            } catch (error) {
                console.warn('Failed to load DejaVu fonts, falling back to system fonts:', error.message);
            }
            const buffers = [];
            
            if (streaming) {
                // For streaming mode, return doc instance for external handling
                resolve(doc);
                return;
            }
            
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                if (progressCallback) progressCallback('tenant_complete', { tenantId: tenant.id, size: pdfData.length });
                resolve(pdfData);
            });
            
            // Simple Header
            let currentY = drawHeader(doc, tenant, month, year);
            
            // Calculate proportional rent details
            if (progressCallback) progressCallback('calculating_rent', { tenantId: tenant.id });
            const rentCalculation = calculateProportionalRent(tenant.rent_amount, tenant.move_in_date, tenant.move_out_date, year, month);
            const occupancyPeriod = getOccupancyPeriodDescription(tenant.move_in_date, tenant.move_out_date, year, month);
            
            // Start content after header
            
            // Billing Details Section (single page)
            if (progressCallback) progressCallback('drawing_billing', { tenantId: tenant.id });
            currentY = drawBillingSection(doc, currentY, rentCalculation, utilities, month);
            
            // Simple footer
            drawFooter(doc);
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

// Simple header with essential information only
function drawHeader(doc, tenant, month, year) {
    const pageMargin = PDF_STYLES.spacing.pageMargin;
    let currentY = pageMargin;
    
    // Property name (from properties table)
    const propertyName = tenant.property_name || 'PROPERTY MANAGEMENT';
    PDF_UTILS.addStyledText(doc, propertyName, pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.heading,
        color: PDF_STYLES.colors.primaryDark,
        font: PDF_STYLES.fonts.secondary
    });
    currentY += 20;
    
    // Statement date in DD. MM. YYYY format (no leading zero for month)
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const currentMonth = (today.getMonth() + 1).toString(); // No leading zero for month
    const currentYear = today.getFullYear();
    const formattedDate = `${day}. ${currentMonth}. ${currentYear}`;
    PDF_UTILS.addStyledText(doc, `Statement Date: ${formattedDate}`, pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.body,
        color: PDF_STYLES.colors.text
    });
    currentY += 15;
    
    // Billing period
    PDF_UTILS.addStyledText(doc, `Billing Period: ${month}/${year}`, pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.body,
        color: PDF_STYLES.colors.text
    });
    currentY += 15;
    
    // Tenant full name
    PDF_UTILS.addStyledText(doc, `Tenant: ${tenant.name} ${tenant.surname}`, pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.body,
        color: PDF_STYLES.colors.text
    });
    currentY += 25;
    
    return currentY;
}


// Simple billing section (single page optimized)
function drawBillingSection(doc, startY, rentCalculation, utilities, month) {
    const { pageMargin, section } = PDF_STYLES.spacing;
    const { subheading } = PDF_STYLES.fontSize;
    
    let currentY = startY;
    
    // Enhanced section header
    currentY = PDF_UTILS.drawSectionHeader(doc, pageMargin, currentY, 'CHARGES BREAKDOWN') - PDF_STYLES.spacing.section;
    
    currentY = PDF_UTILS.getNextY(currentY, section);
    
    // Monthly rent section header
    PDF_UTILS.addStyledText(doc, 'MONTHLY RENT', pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.bodyLarge,
        color: PDF_STYLES.colors.primary,
        font: PDF_STYLES.fonts.secondary
    });
    
    currentY = PDF_UTILS.getNextY(currentY, section);
    
    // Monthly rent in table format
    const rentAmount = rentCalculation.isFullMonth ? rentCalculation.monthlyRent : rentCalculation.proRatedAmount;
    
    const rentColumns = [
        { header: 'Monthly Rent', key: 'description', width: 200 },
        { header: 'Amount', key: 'amount', width: 120, align: 'right', bold: true }
    ];
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonth = monthNames[month - 1];
    
    const rentData = [{
        description: currentMonth,
        amount: `${rentAmount.toFixed(2)}€`
    }];
    
    currentY = PDF_UTILS.drawTable(doc, pageMargin, currentY, rentColumns, rentData, {
        fontSize: PDF_STYLES.fontSize.small,
        headerColor: PDF_STYLES.colors.primaryDark,
        evenRowColor: PDF_STYLES.colors.white,
        oddRowColor: PDF_STYLES.colors.backgroundDark
    });
    
    currentY += 15;
    
    // Simple utilities table (single page)
    if (utilities.length > 0) {
        currentY = drawUtilitiesTableWithPaging(doc, currentY, utilities);
    }
    
    // Simple total amount
    currentY = drawSimpleTotal(doc, currentY, rentCalculation, utilities);
    
    return currentY;
}

// Simple utilities table (single page optimized)
function drawUtilitiesTableWithPaging(doc, startY, utilities) {
    const { pageMargin, section } = PDF_STYLES.spacing;
    
    let currentY = startY;
    
    // Simple utilities section header
    PDF_UTILS.addStyledText(doc, 'UTILITY CHARGES', pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.bodyLarge,
        color: PDF_STYLES.colors.primary,
        font: PDF_STYLES.fonts.secondary
    });
    
    currentY = PDF_UTILS.getNextY(currentY, section);
    
    // 3-column table with total and tenant share
    const columns = [
        { header: 'Utility Type', key: 'utility_type', width: 140 },
        { header: 'Total Amount', key: 'total_amount', width: 90, align: 'right' },
        { header: 'Your Share', key: 'allocated_amount', width: 90, align: 'right', bold: true }
    ];
    
    const tableData = utilities.map(utility => {
        const totalAmount = parseFloat(utility.total_amount) || 0;
        const allocatedAmount = parseFloat(utility.allocated_amount) || 0;
        
        return {
            utility_type: utility.utility_type,
            total_amount: `${totalAmount.toFixed(2)}€`,
            allocated_amount: `${allocatedAmount.toFixed(2)}€`
        };
    });
    
    currentY = PDF_UTILS.drawTable(doc, pageMargin, currentY, columns, tableData, {
        fontSize: PDF_STYLES.fontSize.small,
        headerColor: PDF_STYLES.colors.primaryDark,
        evenRowColor: PDF_STYLES.colors.white,
        oddRowColor: PDF_STYLES.colors.backgroundDark
    });
    
    return currentY;
}

// Helper function to draw utilities table (original, for overflow handling)
function drawUtilitiesTable(doc, startY, utilities) {
    const { pageMargin, section } = PDF_STYLES.spacing;
    
    let currentY = startY;
    
    // Simple 2-column table
    const columns = [
        { header: 'Utility Type', key: 'utility_type', width: 200 },
        { header: 'Amount', key: 'allocated_amount', width: 120, align: 'right', bold: true }
    ];
    
    const tableData = utilities.map(utility => {
        const allocatedAmount = parseFloat(utility.allocated_amount) || 0;
        
        return {
            utility_type: utility.utility_type,
            allocated_amount: `${allocatedAmount.toFixed(2)}€`
        };
    });
    
    currentY = PDF_UTILS.drawTable(doc, pageMargin, currentY, columns, tableData, {
        fontSize: PDF_STYLES.fontSize.small,
        headerColor: PDF_STYLES.colors.primaryDark,
        evenRowColor: PDF_STYLES.colors.white,
        oddRowColor: PDF_STYLES.colors.backgroundDark
    });
    
    return currentY;
}

// Helper function to draw highlighted summary section
function drawSimpleTotal(doc, startY, rentCalculation, utilities) {
    const { pageMargin, section } = PDF_STYLES.spacing;
    
    let currentY = startY + section;
    
    // Calculate total
    const rentAmount = rentCalculation.isFullMonth ? rentCalculation.monthlyRent : rentCalculation.proRatedAmount;
    const utilitiesTotal = utilities.reduce((sum, utility) => sum + (parseFloat(utility.allocated_amount) || 0), 0);
    const grandTotal = rentAmount + utilitiesTotal;
    
    // Simple total amount line
    PDF_UTILS.addStyledText(doc, 'TOTAL AMOUNT DUE:', pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.heading,
        color: PDF_STYLES.colors.primaryDark,
        font: PDF_STYLES.fonts.secondary
    });
    
    // Calculate table width (140 + 90 + 90 = 320) and right-align the total
    const tableWidth = 320;
    const totalAmountText = `${grandTotal.toFixed(2)}€`;
    const totalAmountWidth = doc.widthOfString(totalAmountText);
    const totalAmountX = pageMargin + tableWidth - totalAmountWidth;
    
    PDF_UTILS.addStyledText(doc, totalAmountText, totalAmountX, currentY, {
        fontSize: PDF_STYLES.fontSize.heading,
        color: PDF_STYLES.colors.primary,
        font: PDF_STYLES.fonts.secondary
    });
    
    return currentY + 30;
}

// Simple footer with generation info
function drawFooter(doc) {
    const footerY = PDF_STYLES.layout.pageHeight - PDF_STYLES.spacing.pageMargin - PDF_STYLES.layout.footerHeight;
    const { pageMargin } = PDF_STYLES.spacing;
    const { small, tiny } = PDF_STYLES.fontSize;
    
    // Footer background
    PDF_UTILS.drawCard(doc, pageMargin, footerY, PDF_STYLES.layout.contentWidth, PDF_STYLES.layout.footerHeight, {
        fillColor: PDF_STYLES.colors.background,
        borderColor: PDF_STYLES.colors.border
    });
    
    const footerPadding = 10;
    const leftX = pageMargin + footerPadding;
    const centerX = pageMargin + PDF_STYLES.layout.contentWidth / 2;
    const rightX = pageMargin + PDF_STYLES.layout.contentWidth - footerPadding;
    
    // Simple generation info
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const currentMonth = (today.getMonth() + 1).toString(); // No leading zero for month
    const currentYear = today.getFullYear();
    const footerFormattedDate = `${day}. ${currentMonth}. ${currentYear}`;
    PDF_UTILS.addStyledText(doc, `Generated: ${footerFormattedDate}`, leftX, footerY + footerPadding + 8, {
        fontSize: tiny,
        color: PDF_STYLES.colors.textLight
    });
    
    PDF_UTILS.addStyledText(doc, 'Property Management System', rightX - 120, footerY + footerPadding + 8, {
        fontSize: tiny,
        color: PDF_STYLES.colors.textLight,
        align: 'right'
    });
    
    PDF_UTILS.addStyledText(doc, 'Confidential Document', rightX - 80, footerY + footerPadding + 25, {
        fontSize: tiny,
        color: PDF_STYLES.colors.textLight,
        align: 'right'
    });
}

