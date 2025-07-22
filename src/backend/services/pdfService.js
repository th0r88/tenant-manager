import PDFDocument from 'pdfkit';
import { calculateProportionalRent, getOccupancyPeriodDescription } from './proportionalCalculationService.js';
import { PDF_STYLES, PDF_UTILS } from './pdfStyles.js';
import { t, getMonthName, translateUtilityType } from './translationService.js';
import { formatCurrency, formatDate, normalizeLanguage } from '../utils/formatters.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for font paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateTenantReport(tenant, month, year, utilities, options = {}) {
    const { streaming = false, progressCallback = null, language = 'sl', utilitiesFromPreviousMonth = false, utilitiesProrated = false, prevMonth = null, prevYear = null } = options;
    const lang = normalizeLanguage(language);
    
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
            let currentY = drawHeader(doc, tenant, month, year, lang);
            
            // Calculate proportional rent details
            if (progressCallback) progressCallback('calculating_rent', { tenantId: tenant.id });
            const rentCalculation = calculateProportionalRent(tenant.rent_amount, tenant.move_in_date, tenant.move_out_date, year, month);
            const occupancyPeriod = getOccupancyPeriodDescription(tenant.move_in_date, tenant.move_out_date, year, month);
            
            // Start content after header
            
            // Billing Details Section (single page)
            if (progressCallback) progressCallback('drawing_billing', { tenantId: tenant.id });
            currentY = drawBillingSection(doc, currentY, rentCalculation, utilities, month, lang, tenant, {
                utilitiesFromPreviousMonth,
                utilitiesProrated,
                prevMonth,
                prevYear
            });
            
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

// Simple header with essential information only
function drawHeader(doc, tenant, month, year, language = 'sl') {
    const pageMargin = PDF_STYLES.spacing.pageMargin;
    let currentY = pageMargin;
    
    // Property name (from properties table)
    const propertyName = tenant.property_name || 'PROPERTY MANAGEMENT';
    PDF_UTILS.addStyledText(doc, propertyName, pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.heading,
        color: PDF_STYLES.colors.primaryDark,
        font: PDF_STYLES.fonts.secondary
    });
    currentY += 35;
    
    // Statement date with localized formatting
    const today = new Date();
    const formattedDate = formatDate(today, language);
    PDF_UTILS.addStyledText(doc, `${t(language, 'pdf.statementDate')}: ${formattedDate}`, pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.body,
        color: PDF_STYLES.colors.text
    });
    currentY += 15;
    
    // Billing period
    PDF_UTILS.addStyledText(doc, `${t(language, 'pdf.billingPeriod')}: ${month}/${year}`, pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.body,
        color: PDF_STYLES.colors.text
    });
    currentY += 15;
    
    // Removed tenant name from header as requested
    // currentY += 25;
    
    return currentY;
}


// Simple billing section (single page optimized)
function drawBillingSection(doc, startY, rentCalculation, utilities, month, language = 'sl', tenant, options = {}) {
    const { pageMargin, section } = PDF_STYLES.spacing;
    const { subheading } = PDF_STYLES.fontSize;
    const { utilitiesFromPreviousMonth = false, utilitiesProrated = false, prevMonth = null, prevYear = null } = options;
    
    let currentY = startY;
    
    // Add spacing break before OBRAČUN section
    currentY += 20;
    
    // Enhanced section header with tenant name
    currentY = PDF_UTILS.drawSectionHeader(doc, pageMargin, currentY, `${t(language, 'pdf.chargesBreakdown')} - ${tenant.name} ${tenant.surname}`) - PDF_STYLES.spacing.section;
    
    currentY = PDF_UTILS.getNextY(currentY, section);
    
    // Monthly rent section header
    PDF_UTILS.addStyledText(doc, t(language, 'pdf.monthlyRent'), pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.bodyLarge,
        color: PDF_STYLES.colors.primary,
        font: PDF_STYLES.fonts.secondary
    });
    
    currentY = PDF_UTILS.getNextY(currentY, section);
    
    // Monthly rent in table format
    const rentAmount = rentCalculation.isFullMonth ? rentCalculation.monthlyRent : rentCalculation.proRatedAmount;
    
    const rentColumns = [
        { header: t(language, 'pdf.month'), key: 'description', width: 200 },
        { header: t(language, 'pdf.amount'), key: 'amount', width: 120, align: 'right', headerAlign: 'right', bold: true }
    ];
    
    const currentMonth = getMonthName(month - 1, language);
    
    const rentData = [{
        description: currentMonth,
        amount: formatCurrency(rentAmount, language)
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
        currentY = drawUtilitiesTableWithPaging(doc, currentY, utilities, language, {
            utilitiesFromPreviousMonth,
            utilitiesProrated,
            prevMonth,
            prevYear
        });
    }
    
    // Simple total amount
    currentY = drawSimpleTotal(doc, currentY, rentCalculation, utilities, language);
    
    return currentY;
}

// Simple utilities table (single page optimized)
function drawUtilitiesTableWithPaging(doc, startY, utilities, language = 'sl', options = {}) {
    const { pageMargin, section } = PDF_STYLES.spacing;
    const { utilitiesFromPreviousMonth = false, utilitiesProrated = false, prevMonth = null, prevYear = null } = options;
    
    let currentY = startY;
    
    // Simple utilities section header with month indication
    let utilitiesHeader = t(language, 'pdf.utilityCharges');
    if (utilitiesFromPreviousMonth && prevMonth && prevYear) {
        const prevMonthName = getMonthName(prevMonth - 1, language);
        utilitiesHeader += ` (${prevMonthName} ${prevYear})`;
        if (utilitiesProrated) {
            utilitiesHeader += ` - ${language === 'sl' ? 'Sorazmerno' : 'Proportional'}`;
        }
    }
    
    PDF_UTILS.addStyledText(doc, utilitiesHeader, pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.bodyLarge,
        color: PDF_STYLES.colors.primary,
        font: PDF_STYLES.fonts.secondary
    });
    
    currentY = PDF_UTILS.getNextY(currentY, section);
    
    // 3-column table with total and tenant share
    const columns = [
        { header: t(language, 'pdf.utilityType'), key: 'utility_type', width: 140 },
        { header: t(language, 'pdf.totalAmount'), key: 'total_amount', width: 90, align: 'right', headerAlign: 'right' },
        { header: t(language, 'pdf.yourShare'), key: 'allocated_amount', width: 90, align: 'right', headerAlign: 'right', bold: true }
    ];
    
    const tableData = utilities.map(utility => {
        const totalAmount = parseFloat(utility.total_amount) || 0;
        const allocatedAmount = parseFloat(utility.allocated_amount) || 0;
        
        return {
            utility_type: translateUtilityType(utility.utility_type, language),
            total_amount: formatCurrency(totalAmount, language),
            allocated_amount: formatCurrency(allocatedAmount, language)
        };
    });
    
    // Calculate total of "Tvoj delež" column
    const utilitiesTotal = utilities.reduce((sum, utility) => {
        return sum + (parseFloat(utility.allocated_amount) || 0);
    }, 0);
    
    // Add total row to table data  
    tableData.push({
        utility_type: t(language, 'pdf.total') + ':',
        total_amount: '',
        allocated_amount: formatCurrency(utilitiesTotal, language),
        isTotal: true  // Flag to identify total row for special styling
    });
    
    currentY = PDF_UTILS.drawTable(doc, pageMargin, currentY, columns, tableData, {
        fontSize: PDF_STYLES.fontSize.small,
        headerColor: PDF_STYLES.colors.primaryDark,
        evenRowColor: PDF_STYLES.colors.white,
        oddRowColor: PDF_STYLES.colors.backgroundDark,
        totalRowSeparator: true  // Flag to add double line before total row
    });
    
    return currentY;
}

// Helper function to draw utilities table (original, for overflow handling)
function drawUtilitiesTable(doc, startY, utilities, language = 'sl') {
    const { pageMargin, section } = PDF_STYLES.spacing;
    
    let currentY = startY;
    
    // Simple 2-column table
    const columns = [
        { header: t(language, 'pdf.utilityType'), key: 'utility_type', width: 200 },
        { header: t(language, 'pdf.amount'), key: 'allocated_amount', width: 120, align: 'right', bold: true }
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
function drawSimpleTotal(doc, startY, rentCalculation, utilities, language = 'sl') {
    const { pageMargin, section } = PDF_STYLES.spacing;
    
    let currentY = startY + section;
    
    // Calculate total
    const rentAmount = rentCalculation.isFullMonth ? rentCalculation.monthlyRent : rentCalculation.proRatedAmount;
    const utilitiesTotal = utilities.reduce((sum, utility) => sum + (parseFloat(utility.allocated_amount) || 0), 0);
    const grandTotal = parseFloat(rentAmount) + utilitiesTotal;
    
    // Simple total amount line
    PDF_UTILS.addStyledText(doc, `${t(language, 'pdf.totalAmountDue')}:`, pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.heading,
        color: PDF_STYLES.colors.primaryDark,
        font: PDF_STYLES.fonts.secondary
    });
    
    // Calculate table width (140 + 90 + 90 = 320) and right-align the total
    const tableWidth = 320;
    const totalAmountText = formatCurrency(grandTotal, language);
    const totalAmountWidth = doc.widthOfString(totalAmountText);
    const totalAmountX = pageMargin + tableWidth - totalAmountWidth;
    
    PDF_UTILS.addStyledText(doc, totalAmountText, totalAmountX, currentY, {
        fontSize: PDF_STYLES.fontSize.heading,
        color: PDF_STYLES.colors.primary,
        font: PDF_STYLES.fonts.secondary
    });
    
    return currentY + 30;
}


