import PDFDocument from 'pdfkit';
import { calculateProportionalRent, getOccupancyPeriodDescription } from './proportionalCalculationService.js';
import { PDF_STYLES, PDF_UTILS } from './pdfStyles.js';

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
            
            // Professional Header with Branding
            drawHeader(doc, month, year);
            
            // Calculate proportional rent details
            if (progressCallback) progressCallback('calculating_rent', { tenantId: tenant.id });
            const rentCalculation = calculateProportionalRent(tenant.rent_amount, tenant.move_in_date, tenant.move_out_date, year, month);
            const occupancyPeriod = getOccupancyPeriodDescription(tenant.move_in_date, tenant.move_out_date, year, month);
            
            // Tenant Information Section with Occupancy Timeline
            if (progressCallback) progressCallback('drawing_info', { tenantId: tenant.id });
            let currentY = drawTenantInfo(doc, tenant, occupancyPeriod);
            
            // Add occupancy timeline visualization
            currentY = PDF_UTILS.drawSectionHeader(doc, PDF_STYLES.spacing.pageMargin, currentY, 'OCCUPANCY TIMELINE', {
                icon: '📊'
            }) - PDF_STYLES.spacing.section;
            
            currentY = PDF_UTILS.drawOccupancyTimeline(
                doc, 
                PDF_STYLES.spacing.pageMargin, 
                currentY, 
                PDF_STYLES.layout.contentWidth, 
                tenant.move_in_date, 
                tenant.move_out_date, 
                month, 
                year
            );
            
            currentY += PDF_STYLES.spacing.section;
            
            // Billing Period Section
            currentY = drawBillingPeriod(doc, currentY, month, year, occupancyPeriod, rentCalculation);
            
            // Multi-page support for long utility lists
            const estimatedContentHeight = 200 + (utilities.length * 25);
            let pageNumber = 1;
            let totalPages = 1;
            
            // Calculate total pages needed
            if (utilities.length > 10) {
                totalPages = Math.ceil(utilities.length / 10) + 1;
            }
            
            if (PDF_UTILS.needsNewPage(doc, currentY, estimatedContentHeight)) {
                currentY = PDF_UTILS.addNewPage(doc, ++pageNumber);
            }
            
            // Enhanced Billing Details Section with Visualizations
            if (progressCallback) progressCallback('drawing_billing', { tenantId: tenant.id });
            currentY = drawBillingSection(doc, currentY, rentCalculation, utilities, pageNumber, totalPages);
            
            // Generate payment QR code
            if (progressCallback) progressCallback('generating_qr', { tenantId: tenant.id });
            const rentAmount = rentCalculation.isFullMonth ? rentCalculation.monthlyRent : rentCalculation.proRatedAmount;
            const utilitiesTotal = utilities.reduce((sum, utility) => sum + (utility.allocated_amount || 0), 0);
            const grandTotal = rentAmount + utilitiesTotal;
            
            const statementId = `${year}${month.toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            const bankDetails = { iban: 'SI56 1234 5678 9012 345' };
            
            try {
                const qrCodeData = await PDF_UTILS.generatePaymentQR(
                    grandTotal.toFixed(2),
                    statementId,
                    bankDetails
                );
                
                if (qrCodeData) {
                    // Add QR code to footer
                    drawFooterWithQR(doc, qrCodeData, grandTotal.toFixed(2), statementId, totalPages, totalPages);
                } else {
                    drawFooter(doc, totalPages, totalPages);
                }
            } catch (error) {
                console.error('QR code generation failed:', error);
                drawFooter(doc, totalPages, totalPages);
            }
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

// Helper function to draw professional header with company details
function drawHeader(doc, month, year) {
    const { pageMargin, section } = PDF_STYLES.spacing;
    const { title, subheading, body, small } = PDF_STYLES.fontSize;
    
    // Enhanced company letterhead with shadow
    PDF_UTILS.drawCardWithShadow(doc, pageMargin, pageMargin, PDF_STYLES.layout.contentWidth, PDF_STYLES.layout.headerHeight - 20, {
        fillColor: PDF_STYLES.colors.backgroundDark,
        borderColor: PDF_STYLES.colors.primaryDark,
        borderRadius: PDF_STYLES.effects.borderRadius.large
    });
    
    const headerPadding = 15;
    const leftX = pageMargin + headerPadding;
    const rightX = PDF_STYLES.layout.pageWidth - pageMargin - headerPadding;
    
    // Enhanced company name with icon
    PDF_UTILS.addStyledText(doc, '🏢 PROPERTY MANAGEMENT SYSTEM', leftX, pageMargin + headerPadding, {
        fontSize: PDF_STYLES.fontSize.display,
        color: PDF_STYLES.colors.primaryDark,
        font: PDF_STYLES.fonts.secondary
    });
    
    PDF_UTILS.addStyledText(doc, 'Monthly Billing Statement', leftX, pageMargin + headerPadding + 32, {
        fontSize: PDF_STYLES.fontSize.titleLarge,
        color: PDF_STYLES.colors.secondaryLight
    });
    
    // Company contact info (left side)
    PDF_UTILS.addStyledText(doc, 'Slovenia Property Management', leftX, pageMargin + headerPadding + 55, {
        fontSize: small,
        color: PDF_STYLES.colors.textLight
    });
    
    PDF_UTILS.addStyledText(doc, 'Tel: +386 1 234 5678 | Email: billing@propmanage.si', leftX, pageMargin + headerPadding + 68, {
        fontSize: small,
        color: PDF_STYLES.colors.textLight
    });
    
    // Statement details (right side)
    const detailsX = rightX - 180;
    PDF_UTILS.addStyledText(doc, '📊 STATEMENT DETAILS', detailsX, pageMargin + headerPadding, {
        fontSize: PDF_STYLES.fontSize.bodyLarge,
        color: PDF_STYLES.colors.primaryDark,
        font: PDF_STYLES.fonts.secondary
    });
    
    PDF_UTILS.addStyledText(doc, `Statement Date:`, detailsX, pageMargin + headerPadding + 20, {
        fontSize: small,
        color: PDF_STYLES.colors.textLight
    });
    PDF_UTILS.addStyledText(doc, new Date().toLocaleDateString(), detailsX + 80, pageMargin + headerPadding + 20, {
        fontSize: small,
        color: PDF_STYLES.colors.text,
        font: PDF_STYLES.fonts.secondary
    });
    
    PDF_UTILS.addStyledText(doc, `Billing Period:`, detailsX, pageMargin + headerPadding + 35, {
        fontSize: small,
        color: PDF_STYLES.colors.textLight
    });
    PDF_UTILS.addStyledText(doc, `${month}/${year}`, detailsX + 80, pageMargin + headerPadding + 35, {
        fontSize: small,
        color: PDF_STYLES.colors.accent,
        font: PDF_STYLES.fonts.secondary
    });
    
    PDF_UTILS.addStyledText(doc, `Statement #:`, detailsX, pageMargin + headerPadding + 50, {
        fontSize: small,
        color: PDF_STYLES.colors.textLight
    });
    const statementId = `${year}${month.toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    PDF_UTILS.addStyledText(doc, statementId, detailsX + 80, pageMargin + headerPadding + 50, {
        fontSize: small,
        color: PDF_STYLES.colors.text,
        font: PDF_STYLES.fonts.mono
    });
    
    // Header separator line
    PDF_UTILS.drawSectionSeparator(doc, pageMargin + PDF_STYLES.layout.headerHeight);
    
    return pageMargin + PDF_STYLES.layout.headerHeight + section;
}

// Helper function to draw tenant information section with card layout
function drawTenantInfo(doc, tenant, occupancyPeriod) {
    const startY = PDF_STYLES.spacing.pageMargin + PDF_STYLES.layout.headerHeight + PDF_STYLES.spacing.section;
    const { pageMargin, section } = PDF_STYLES.spacing;
    const { subheading } = PDF_STYLES.fontSize;
    
    let currentY = startY;
    
    // Enhanced section header with icon
    currentY = PDF_UTILS.drawSectionHeader(doc, pageMargin, currentY, 'TENANT INFORMATION', {
        icon: '👤'
    }) - PDF_STYLES.spacing.section;
    
    currentY = PDF_UTILS.getNextY(currentY, section);
    
    // Calculate card dimensions
    const cardWidth = (PDF_STYLES.layout.contentWidth - PDF_STYLES.layout.cardMargin) / 2;
    const leftCardX = pageMargin;
    const rightCardX = pageMargin + cardWidth + PDF_STYLES.layout.cardMargin;
    
    // Tenant Name Card
    currentY = PDF_UTILS.drawInfoCard(doc, leftCardX, currentY, cardWidth, 
        'TENANT NAME', 
        `${tenant.name} ${tenant.surname}`, {
            backgroundColor: PDF_STYLES.colors.background
        });
    
    // Tax Information Card (right side)
    PDF_UTILS.drawInfoCard(doc, rightCardX, currentY - 68, cardWidth, 
        'TAX NUMBER', 
        tenant.tax_number || 'Not provided', {
            backgroundColor: PDF_STYLES.colors.background
        });
    
    // Address Card (full width)
    currentY = PDF_UTILS.drawInfoCard(doc, leftCardX, currentY, PDF_STYLES.layout.contentWidth, 
        'PROPERTY ADDRESS', 
        tenant.address, {
            backgroundColor: PDF_STYLES.colors.white
        });
    
    // EMŠO Card
    currentY = PDF_UTILS.drawInfoCard(doc, leftCardX, currentY, cardWidth, 
        'EMŠO (Personal ID)', 
        tenant.emso, {
            backgroundColor: PDF_STYLES.colors.background
        });
    
    // Room Details Card (right side)
    PDF_UTILS.drawInfoCard(doc, rightCardX, currentY - 68, cardWidth, 
        'ROOM DETAILS', 
        `${tenant.room_area}m² • €${tenant.rent_amount}/month`, {
            backgroundColor: PDF_STYLES.colors.background
        });
    
    return currentY + section;
}

// Helper function to draw enhanced billing section with visualizations
function drawBillingSection(doc, startY, rentCalculation, utilities, pageNumber = 1, totalPages = 1) {
    const { pageMargin, section } = PDF_STYLES.spacing;
    const { subheading } = PDF_STYLES.fontSize;
    
    let currentY = startY;
    
    // Enhanced section header with icon
    currentY = PDF_UTILS.drawSectionHeader(doc, pageMargin, currentY, 'CHARGES BREAKDOWN', {
        icon: '💰'
    }) - PDF_STYLES.spacing.section;
    
    currentY = PDF_UTILS.getNextY(currentY, section);
    
    // Rent calculation with visual timeline
    currentY = drawRentCalculationWithTimeline(doc, currentY, rentCalculation);
    
    // Utilities table with allocation visualization and page break handling
    if (utilities.length > 0) {
        currentY = drawUtilitiesTableWithPaging(doc, currentY, utilities, pageNumber, totalPages);
    }
    
    // Summary section
    currentY = drawSummarySection(doc, currentY, rentCalculation, utilities);
    
    return currentY;
}

// Helper function to draw rent calculation with visual timeline
function drawRentCalculationWithTimeline(doc, startY, rentCalculation) {
    const { pageMargin, section } = PDF_STYLES.spacing;
    const { body, small } = PDF_STYLES.fontSize;
    
    let currentY = startY;
    
    // Enhanced rent section header with conditional formatting
    const rentStatus = rentCalculation.isFullMonth ? 'full' : 'partial';
    const rentIcon = rentCalculation.isFullMonth ? '🏠' : '📊';
    const rentColor = rentCalculation.isFullMonth ? PDF_STYLES.colors.accent : PDF_STYLES.colors.warning;
    
    PDF_UTILS.addStyledText(doc, `${rentIcon} RENT CHARGES`, pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.bodyLarge,
        color: rentColor,
        font: PDF_STYLES.fonts.secondary
    });
    
    // Status indicator
    const statusX = PDF_UTILS.drawStatusIndicator(doc, pageMargin + 150, currentY + 4, rentStatus);
    PDF_UTILS.addStyledText(doc, rentCalculation.isFullMonth ? 'Full Month' : 'Prorated', statusX, currentY, {
        fontSize: PDF_STYLES.fontSize.small,
        color: rentColor,
        font: PDF_STYLES.fonts.secondary
    });
    
    currentY = PDF_UTILS.getNextY(currentY, section);
    
    // Enhanced rent calculation card with conditional styling
    const cardHeight = rentCalculation.isFullMonth ? 80 : 140;
    const cardColor = rentCalculation.isFullMonth ? PDF_STYLES.colors.accent : PDF_STYLES.colors.warning;
    
    PDF_UTILS.drawCardWithShadow(doc, pageMargin, currentY, PDF_STYLES.layout.contentWidth, cardHeight, {
        fillColor: PDF_STYLES.colors.white,
        borderColor: cardColor
    });
    
    const cardPadding = 15;
    const cardX = pageMargin + cardPadding;
    const cardY = currentY + cardPadding;
    
    if (!rentCalculation.isFullMonth) {
        // Enhanced visual timeline for prorated period
        PDF_UTILS.addStyledText(doc, '📊 Prorated Rent Calculation', cardX, cardY, {
            fontSize: PDF_STYLES.fontSize.bodyLarge,
            color: PDF_STYLES.colors.warning,
            font: PDF_STYLES.fonts.secondary
        });
        
        // Timeline visualization
        const timelineY = cardY + 25;
        const timelineWidth = 300;
        PDF_UTILS.addStyledText(doc, 'Occupancy Timeline:', cardX, timelineY - 15, {
            fontSize: small,
            color: PDF_STYLES.colors.textLight
        });
        
        PDF_UTILS.drawTimeline(doc, cardX, timelineY, timelineWidth, rentCalculation.occupancyPercentage, {
            progressColor: PDF_STYLES.colors.warning,
            height: 16
        });
        
        // Calculation details
        const detailsY = timelineY + 35;
        const rightColumnX = cardX + 200;
        
        PDF_UTILS.addStyledText(doc, `Full Monthly Rent:`, cardX, detailsY, {
            fontSize: small,
            color: PDF_STYLES.colors.textLight
        });
        PDF_UTILS.addStyledText(doc, `€${rentCalculation.monthlyRent.toFixed(2)}`, rightColumnX, detailsY, {
            fontSize: small,
            color: PDF_STYLES.colors.text
        });
        
        PDF_UTILS.addStyledText(doc, `Days Occupied:`, cardX, detailsY + 15, {
            fontSize: small,
            color: PDF_STYLES.colors.textLight
        });
        PDF_UTILS.addStyledText(doc, `${rentCalculation.occupiedDays}/${rentCalculation.totalDaysInMonth} (${rentCalculation.occupancyPercentage}%)`, rightColumnX, detailsY + 15, {
            fontSize: small,
            color: PDF_STYLES.colors.warning
        });
        
        PDF_UTILS.addStyledText(doc, `Daily Rate:`, cardX, detailsY + 30, {
            fontSize: small,
            color: PDF_STYLES.colors.textLight
        });
        PDF_UTILS.addStyledText(doc, `€${rentCalculation.dailyRate.toFixed(2)}`, rightColumnX, detailsY + 30, {
            fontSize: small,
            color: PDF_STYLES.colors.text
        });
        
        PDF_UTILS.addStyledText(doc, `Prorated Amount:`, cardX, detailsY + 50, {
            fontSize: body,
            color: PDF_STYLES.colors.primary,
            font: PDF_STYLES.fonts.secondary
        });
        PDF_UTILS.addStyledText(doc, `€${rentCalculation.proRatedAmount.toFixed(2)}`, rightColumnX, detailsY + 50, {
            fontSize: body,
            color: PDF_STYLES.colors.accent,
            font: PDF_STYLES.fonts.secondary
        });
        
    } else {
        // Enhanced full month rent display
        PDF_UTILS.addStyledText(doc, '🏠 Monthly Rent - Full Period', cardX, cardY, {
            fontSize: PDF_STYLES.fontSize.bodyLarge,
            color: PDF_STYLES.colors.accent,
            font: PDF_STYLES.fonts.secondary
        });
        
        // Full occupancy timeline
        const timelineY = cardY + 25;
        PDF_UTILS.drawTimeline(doc, cardX, timelineY, 300, 100, {
            progressColor: PDF_STYLES.colors.accent,
            height: 16
        });
        
        PDF_UTILS.addStyledText(doc, `Amount:`, cardX, cardY + 55, {
            fontSize: body,
            color: PDF_STYLES.colors.textLight
        });
        PDF_UTILS.addStyledText(doc, `€${rentCalculation.monthlyRent.toFixed(2)}`, cardX + 200, cardY + 55, {
            fontSize: body,
            color: PDF_STYLES.colors.accent,
            font: PDF_STYLES.fonts.secondary
        });
    }
    
    currentY += cardHeight + section;
    
    return currentY;
}

// Helper function to draw utilities table with paging support
function drawUtilitiesTableWithPaging(doc, startY, utilities, pageNumber = 1, totalPages = 1) {
    const { pageMargin, section } = PDF_STYLES.spacing;
    const maxUtilitiesPerPage = 10;
    
    let currentY = startY;
    
    // Enhanced utilities section header with icon
    PDF_UTILS.addStyledText(doc, '🔌 UTILITY CHARGES', pageMargin, currentY, {
        fontSize: PDF_STYLES.fontSize.bodyLarge,
        color: PDF_STYLES.colors.primary,
        font: PDF_STYLES.fonts.secondary
    });
    
    currentY = PDF_UTILS.getNextY(currentY, section);
    
    // Group utilities by allocation method
    const utilitiesByMethod = utilities.reduce((acc, utility) => {
        const method = utility.allocation_method || 'per_person';
        if (!acc[method]) acc[method] = [];
        acc[method].push(utility);
        return acc;
    }, {});
    
    let processedUtilities = 0;
    let currentPageUtilities = 0;
    
    Object.entries(utilitiesByMethod).forEach(([method, methodUtilities]) => {
        // Check if we need to break to new page for this method
        if (currentPageUtilities > 0 && (currentPageUtilities + methodUtilities.length) > maxUtilitiesPerPage) {
            doc.addPage();
            currentY = PDF_STYLES.spacing.pageMargin + 30;
            currentPageUtilities = 0;
            pageNumber++;
            
            // Add continuation header
            PDF_UTILS.addStyledText(doc, '🔌 UTILITY CHARGES (Continued)', pageMargin, currentY, {
                fontSize: PDF_STYLES.fontSize.bodyLarge,
                color: PDF_STYLES.colors.primary,
                font: PDF_STYLES.fonts.secondary
            });
            currentY = PDF_UTILS.getNextY(currentY, section);
        }
        
        // Allocation method badge
        PDF_UTILS.drawAllocationBadge(doc, pageMargin, currentY, method);
        currentY += 30;
        
        // Split utilities if they exceed page limit
        const utilitiesToShow = methodUtilities.slice(0, maxUtilitiesPerPage - currentPageUtilities);
        
        // Utilities table for this method
        const columns = [
            { header: 'Utility Type', key: 'utility_type', width: 120 },
            { header: 'Total Amount', key: 'total_amount', width: 100, align: 'right' },
            { header: 'Your Share', key: 'allocated_amount', width: 100, align: 'right', bold: true },
            { header: 'Allocation %', key: 'allocation_percentage', width: 80, align: 'center' }
        ];
        
        const tableData = utilitiesToShow.map(utility => {
            const totalAmount = utility.total_amount || 0;
            const allocatedAmount = utility.allocated_amount || 0;
            const percentage = totalAmount > 0 ? ((allocatedAmount / totalAmount) * 100).toFixed(1) : '0';
            
            // Get utility-specific styling
            const utilityStyle = PDF_UTILS.getUtilityStyle(utility.utility_type);
            
            return {
                utility_type: `${utilityStyle.icon} ${utility.utility_type}`,
                total_amount: `€${totalAmount.toFixed(2)}`,
                allocated_amount: `€${allocatedAmount.toFixed(2)}`,
                allocation_percentage: `${percentage}%`
            };
        });
        
        currentY = PDF_UTILS.drawTable(doc, pageMargin, currentY, columns, tableData, {
            fontSize: PDF_STYLES.fontSize.small,
            headerColor: PDF_STYLES.colors.primaryDark,
            evenRowColor: PDF_STYLES.colors.white,
            oddRowColor: PDF_STYLES.colors.backgroundDark
        });
        
        currentPageUtilities += utilitiesToShow.length;
        processedUtilities += utilitiesToShow.length;
        
        // Handle remaining utilities if any
        if (utilitiesToShow.length < methodUtilities.length) {
            const remainingUtilities = methodUtilities.slice(utilitiesToShow.length);
            
            // Process remaining utilities on new page
            doc.addPage();
            currentY = PDF_STYLES.spacing.pageMargin + 30;
            pageNumber++;
            
            PDF_UTILS.addStyledText(doc, '🔌 UTILITY CHARGES (Continued)', pageMargin, currentY, {
                fontSize: PDF_STYLES.fontSize.bodyLarge,
                color: PDF_STYLES.colors.primary,
                font: PDF_STYLES.fonts.secondary
            });
            currentY = PDF_UTILS.getNextY(currentY, section);
            
            // Draw remaining utilities
            currentY = drawUtilitiesTable(doc, currentY, remainingUtilities);
        }
    });
    
    return currentY;
}

// Helper function to draw utilities table (original, for overflow handling)
function drawUtilitiesTable(doc, startY, utilities) {
    const { pageMargin, section } = PDF_STYLES.spacing;
    
    let currentY = startY;
    
    // Group utilities by allocation method
    const utilitiesByMethod = utilities.reduce((acc, utility) => {
        const method = utility.allocation_method || 'per_person';
        if (!acc[method]) acc[method] = [];
        acc[method].push(utility);
        return acc;
    }, {});
    
    Object.entries(utilitiesByMethod).forEach(([method, methodUtilities]) => {
        // Allocation method badge
        PDF_UTILS.drawAllocationBadge(doc, pageMargin, currentY, method);
        currentY += 30;
        
        // Utilities table for this method
        const columns = [
            { header: 'Utility Type', key: 'utility_type', width: 120 },
            { header: 'Total Amount', key: 'total_amount', width: 100, align: 'right' },
            { header: 'Your Share', key: 'allocated_amount', width: 100, align: 'right', bold: true },
            { header: 'Allocation %', key: 'allocation_percentage', width: 80, align: 'center' }
        ];
        
        const tableData = methodUtilities.map(utility => {
            const totalAmount = utility.total_amount || 0;
            const allocatedAmount = utility.allocated_amount || 0;
            const percentage = totalAmount > 0 ? ((allocatedAmount / totalAmount) * 100).toFixed(1) : '0';
            
            // Get utility-specific styling
            const utilityStyle = PDF_UTILS.getUtilityStyle(utility.utility_type);
            
            return {
                utility_type: `${utilityStyle.icon} ${utility.utility_type}`,
                total_amount: `€${totalAmount.toFixed(2)}`,
                allocated_amount: `€${allocatedAmount.toFixed(2)}`,
                allocation_percentage: `${percentage}%`
            };
        });
        
        currentY = PDF_UTILS.drawTable(doc, pageMargin, currentY, columns, tableData, {
            fontSize: PDF_STYLES.fontSize.small,
            headerColor: PDF_STYLES.colors.primaryDark,
            evenRowColor: PDF_STYLES.colors.white,
            oddRowColor: PDF_STYLES.colors.backgroundDark
        });
    });
    
    return currentY;
}

// Helper function to draw highlighted summary section
function drawSummarySection(doc, startY, rentCalculation, utilities) {
    const { pageMargin, section } = PDF_STYLES.spacing;
    const { subheading, body, small } = PDF_STYLES.fontSize;
    
    let currentY = startY;
    
    // Calculate totals
    const rentAmount = rentCalculation.isFullMonth ? rentCalculation.monthlyRent : rentCalculation.proRatedAmount;
    const utilitiesTotal = utilities.reduce((sum, utility) => sum + (utility.allocated_amount || 0), 0);
    const grandTotal = rentAmount + utilitiesTotal;
    
    // Enhanced summary section header
    currentY = PDF_UTILS.drawSectionHeader(doc, pageMargin, currentY, 'PAYMENT SUMMARY', {
        icon: '📄',
        color: PDF_STYLES.colors.primaryDark
    }) - PDF_STYLES.spacing.section;
    
    currentY = PDF_UTILS.getNextY(currentY, section);
    
    // Summary table
    const columns = [
        { header: 'Description', key: 'description', width: 250 },
        { header: 'Amount', key: 'amount', width: 100, align: 'right', bold: true },
        { header: 'Details', key: 'details', width: 145, align: 'center' }
    ];
    
    const summaryData = [
        {
            description: 'Rent Charges',
            amount: `€${rentAmount.toFixed(2)}`,
            details: rentCalculation.isFullMonth ? 'Full Month' : `${rentCalculation.occupancyPercentage}% Prorated`
        }
    ];
    
    if (utilities.length > 0) {
        summaryData.push({
            description: 'Utility Charges',
            amount: `€${utilitiesTotal.toFixed(2)}`,
            details: `${utilities.length} Utilities`
        });
    }
    
    currentY = PDF_UTILS.drawTable(doc, pageMargin, currentY, columns, summaryData, {
        fontSize: PDF_STYLES.fontSize.bodyLarge,
        headerColor: PDF_STYLES.colors.primaryDark,
        headerTextColor: PDF_STYLES.colors.white,
        evenRowColor: PDF_STYLES.colors.white,
        oddRowColor: PDF_STYLES.colors.backgroundDark
    });
    
    // Enhanced grand total section with shadow and gradient effect
    const totalCardHeight = 60;
    PDF_UTILS.drawCardWithShadow(doc, pageMargin, currentY, PDF_STYLES.layout.contentWidth, totalCardHeight, {
        fillColor: PDF_STYLES.colors.primaryDark,
        borderColor: PDF_STYLES.colors.primary,
        borderRadius: PDF_STYLES.effects.borderRadius.large
    });
    
    const totalCardPadding = 20;
    PDF_UTILS.addStyledText(doc, '💳 TOTAL AMOUNT DUE', pageMargin + totalCardPadding, currentY + totalCardPadding, {
        fontSize: PDF_STYLES.fontSize.titleLarge,
        color: PDF_STYLES.colors.white,
        font: PDF_STYLES.fonts.secondary
    });
    
    PDF_UTILS.addStyledText(doc, `€${grandTotal.toFixed(2)}`, pageMargin + PDF_STYLES.layout.contentWidth - totalCardPadding - 100, currentY + totalCardPadding, {
        fontSize: PDF_STYLES.fontSize.display,
        color: PDF_STYLES.colors.accentLight,
        font: PDF_STYLES.fonts.secondary,
        align: 'right'
    });
    
    currentY += totalCardHeight + section;
    
    // Notes section
    if (!rentCalculation.isFullMonth || utilities.length > 0) {
        currentY = PDF_UTILS.drawSectionHeader(doc, pageMargin, currentY, 'BILLING NOTES', {
            icon: '📝',
            fontSize: PDF_STYLES.fontSize.bodyLarge,
            backgroundColor: PDF_STYLES.colors.background
        }) - PDF_STYLES.spacing.section;
        
        currentY = PDF_UTILS.getNextY(currentY, 15);
        
        if (!rentCalculation.isFullMonth) {
            PDF_UTILS.addStyledText(doc, `• Rent prorated for ${rentCalculation.occupancyPercentage}% occupancy (${rentCalculation.occupiedDays}/${rentCalculation.totalDaysInMonth} days)`, pageMargin, currentY, {
                fontSize: small,
                color: PDF_STYLES.colors.textLight
            });
            currentY = PDF_UTILS.getNextY(currentY, 12);
        }
        
        if (utilities.length > 0) {
            const uniqueMethods = [...new Set(utilities.map(u => u.allocation_method))];
            PDF_UTILS.addStyledText(doc, `• Utilities allocated using: ${uniqueMethods.join(', ').replace(/_/g, ' ')}`, pageMargin, currentY, {
                fontSize: small,
                color: PDF_STYLES.colors.textLight
            });
            currentY = PDF_UTILS.getNextY(currentY, 12);
        }
        
        currentY = PDF_UTILS.getNextY(currentY, section);
    }
    
    return currentY;
}

// Helper function to draw billing period section
function drawBillingPeriod(doc, startY, month, year, occupancyPeriod, rentCalculation) {
    const { pageMargin, section } = PDF_STYLES.spacing;
    const { subheading, body, small } = PDF_STYLES.fontSize;
    
    let currentY = startY;
    
    // Enhanced section header with icon
    currentY = PDF_UTILS.drawSectionHeader(doc, pageMargin, currentY, 'BILLING PERIOD DETAILS', {
        icon: '📅'
    }) - PDF_STYLES.spacing.section;
    
    currentY = PDF_UTILS.getNextY(currentY, section);
    
    // Billing period card
    const cardHeight = 80;
    PDF_UTILS.drawCard(doc, pageMargin, currentY, PDF_STYLES.layout.contentWidth, cardHeight, {
        fillColor: PDF_STYLES.colors.white,
        borderColor: PDF_STYLES.colors.primary,
        borderWidth: PDF_STYLES.lines.normal
    });
    
    const cardPadding = 15;
    const leftColumn = pageMargin + cardPadding;
    const rightColumn = pageMargin + PDF_STYLES.layout.contentWidth / 2;
    
    // Left column - Period details
    PDF_UTILS.addStyledText(doc, 'Billing Period', leftColumn, currentY + cardPadding, {
        fontSize: small,
        color: PDF_STYLES.colors.textLight,
        font: PDF_STYLES.fonts.secondary
    });
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[month - 1];
    PDF_UTILS.addStyledText(doc, `${monthName} ${year}`, leftColumn, currentY + cardPadding + 15, {
        fontSize: body + 2,
        color: PDF_STYLES.colors.primary,
        font: PDF_STYLES.fonts.secondary
    });
    
    PDF_UTILS.addStyledText(doc, 'Occupancy Status', leftColumn, currentY + cardPadding + 40, {
        fontSize: small,
        color: PDF_STYLES.colors.textLight,
        font: PDF_STYLES.fonts.secondary
    });
    
    const occupancyStatus = rentCalculation.isFullMonth ? 'Full Month' : 'Partial Month';
    const occupancyColor = rentCalculation.isFullMonth ? PDF_STYLES.colors.accent : PDF_STYLES.colors.warning;
    PDF_UTILS.addStyledText(doc, occupancyStatus, leftColumn, currentY + cardPadding + 55, {
        fontSize: body,
        color: occupancyColor,
        font: PDF_STYLES.fonts.secondary
    });
    
    // Right column - Period breakdown
    PDF_UTILS.addStyledText(doc, 'Period Breakdown', rightColumn, currentY + cardPadding, {
        fontSize: small,
        color: PDF_STYLES.colors.textLight,
        font: PDF_STYLES.fonts.secondary
    });
    
    PDF_UTILS.addStyledText(doc, occupancyPeriod, rightColumn, currentY + cardPadding + 15, {
        fontSize: body,
        color: PDF_STYLES.colors.text
    });
    
    if (!rentCalculation.isFullMonth) {
        PDF_UTILS.addStyledText(doc, `Days: ${rentCalculation.occupiedDays}/${rentCalculation.totalDaysInMonth} (${rentCalculation.occupancyPercentage}%)`, rightColumn, currentY + cardPadding + 35, {
            fontSize: small,
            color: PDF_STYLES.colors.textLight
        });
    }
    
    currentY += cardHeight + section;
    
    // Section separator
    PDF_UTILS.drawSectionSeparator(doc, currentY);
    
    return PDF_UTILS.getNextY(currentY, section);
}

// Helper function to draw enhanced footer with page numbers and payment info
function drawFooter(doc, pageNumber = 1, totalPages = 1) {
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
    
    // Left - Generation info
    PDF_UTILS.addStyledText(doc, 'Document Generated', leftX, footerY + footerPadding, {
        fontSize: tiny,
        color: PDF_STYLES.colors.textLight,
        font: PDF_STYLES.fonts.secondary
    });
    
    PDF_UTILS.addStyledText(doc, `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, leftX, footerY + footerPadding + 12, {
        fontSize: tiny,
        color: PDF_STYLES.colors.textLight
    });
    
    // Center - Payment instructions
    PDF_UTILS.addStyledText(doc, 'PAYMENT DUE WITHIN 15 DAYS', centerX - 60, footerY + footerPadding, {
        fontSize: small,
        color: PDF_STYLES.colors.primary,
        font: PDF_STYLES.fonts.secondary
    });
    
    PDF_UTILS.addStyledText(doc, 'Bank Transfer: SI56 1234 5678 9012 345', centerX - 80, footerY + footerPadding + 15, {
        fontSize: tiny,
        color: PDF_STYLES.colors.textLight,
        font: PDF_STYLES.fonts.mono
    });
    
    PDF_UTILS.addStyledText(doc, 'Reference: Use Statement Number Above', centerX - 70, footerY + footerPadding + 28, {
        fontSize: tiny,
        color: PDF_STYLES.colors.textLight
    });
    
    // Right - Page info
    PDF_UTILS.addStyledText(doc, `Page ${pageNumber} of ${totalPages}`, rightX - 60, footerY + footerPadding, {
        fontSize: tiny,
        color: PDF_STYLES.colors.textLight,
        align: 'right'
    });
    
    PDF_UTILS.addStyledText(doc, 'Property Management System', rightX - 120, footerY + footerPadding + 12, {
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

// Helper function to draw footer with QR code for payments
function drawFooterWithQR(doc, qrCodeData, totalAmount, statementId, pageNumber = 1, totalPages = 1) {
    const footerY = PDF_STYLES.layout.pageHeight - PDF_STYLES.spacing.pageMargin - PDF_STYLES.layout.footerHeight - 40;
    const { pageMargin } = PDF_STYLES.spacing;
    const { small, tiny, body } = PDF_STYLES.fontSize;
    
    // Enhanced footer background with QR space
    const footerHeight = PDF_STYLES.layout.footerHeight + 40;
    PDF_UTILS.drawCard(doc, pageMargin, footerY, PDF_STYLES.layout.contentWidth, footerHeight, {
        fillColor: PDF_STYLES.colors.background,
        borderColor: PDF_STYLES.colors.border
    });
    
    const footerPadding = 15;
    const leftX = pageMargin + footerPadding;
    const rightX = pageMargin + PDF_STYLES.layout.contentWidth - footerPadding;
    
    // Left side - QR Code
    if (qrCodeData) {
        try {
            // Remove data URL prefix to get base64 data
            const base64Data = qrCodeData.replace(/^data:image\/[a-z]+;base64,/, '');
            const qrBuffer = Buffer.from(base64Data, 'base64');
            
            // Position QR code
            const qrSize = 60;
            const qrX = leftX;
            const qrY = footerY + footerPadding;
            
            doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
            
            // QR code label
            PDF_UTILS.addStyledText(doc, '📱 Scan to Pay', qrX + qrSize + 10, qrY + 5, {
                fontSize: small,
                color: PDF_STYLES.colors.primary,
                font: PDF_STYLES.fonts.secondary
            });
            
            PDF_UTILS.addStyledText(doc, `€${totalAmount}`, qrX + qrSize + 10, qrY + 20, {
                fontSize: body,
                color: PDF_STYLES.colors.accent,
                font: PDF_STYLES.fonts.secondary
            });
            
            PDF_UTILS.addStyledText(doc, `Ref: ${statementId}`, qrX + qrSize + 10, qrY + 35, {
                fontSize: tiny,
                color: PDF_STYLES.colors.textLight,
                font: PDF_STYLES.fonts.mono
            });
            
        } catch (error) {
            console.error('Failed to embed QR code in PDF:', error);
        }
    }
    
    // Right side - Payment details
    const detailsX = rightX - 200;
    PDF_UTILS.addStyledText(doc, 'PAYMENT DETAILS', detailsX, footerY + footerPadding, {
        fontSize: small,
        color: PDF_STYLES.colors.primary,
        font: PDF_STYLES.fonts.secondary
    });
    
    PDF_UTILS.addStyledText(doc, 'IBAN: SI56 1234 5678 9012 345', detailsX, footerY + footerPadding + 15, {
        fontSize: tiny,
        color: PDF_STYLES.colors.text,
        font: PDF_STYLES.fonts.mono
    });
    
    PDF_UTILS.addStyledText(doc, `Reference: ${statementId}`, detailsX, footerY + footerPadding + 27, {
        fontSize: tiny,
        color: PDF_STYLES.colors.text,
        font: PDF_STYLES.fonts.mono
    });
    
    PDF_UTILS.addStyledText(doc, `Amount: €${totalAmount}`, detailsX, footerY + footerPadding + 39, {
        fontSize: tiny,
        color: PDF_STYLES.colors.accent,
        font: PDF_STYLES.fonts.secondary
    });
    
    // Bottom row - Generation info and page numbers
    const bottomY = footerY + footerHeight - 15;
    
    PDF_UTILS.addStyledText(doc, `Generated: ${new Date().toLocaleDateString()}`, leftX, bottomY, {
        fontSize: tiny,
        color: PDF_STYLES.colors.textLight
    });
    
    PDF_UTILS.addStyledText(doc, `Page ${pageNumber} of ${totalPages}`, rightX - 60, bottomY, {
        fontSize: tiny,
        color: PDF_STYLES.colors.textLight,
        align: 'right'
    });
}