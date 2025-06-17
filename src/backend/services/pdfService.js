import PDFDocument from 'pdfkit';
import { calculateProportionalRent, getOccupancyPeriodDescription } from './proportionalCalculationService.js';

export function generateTenantReport(tenant, month, year, utilities) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument();
            const buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            
            // Header
            doc.fontSize(20).text('Monthly Tenant Report', 50, 50);
            
            // Calculate proportional rent details
            const rentCalculation = calculateProportionalRent(tenant.rent_amount, tenant.move_in_date, tenant.move_out_date, year, month);
            const occupancyPeriod = getOccupancyPeriodDescription(tenant.move_in_date, tenant.move_out_date, year, month);
            
            // Tenant Info
            doc.fontSize(12)
               .text(`Tenant: ${tenant.name} ${tenant.surname}`, 50, 100)
               .text(`Address: ${tenant.address}`, 50, 120)
               .text(`EMŠO: ${tenant.emso}`, 50, 140)
               .text(`Period: ${month}/${year}`, 50, 160)
               .text(`Occupancy: ${occupancyPeriod}`, 50, 180);
            
            // Charges
            doc.fontSize(14).text('CHARGES:', 50, 220);
            
            let yPos = 240;
            
            // Rent calculation breakdown
            if (!rentCalculation.isFullMonth) {
                doc.fontSize(12)
                   .text(`Full Monthly Rent: €${rentCalculation.monthlyRent.toFixed(2)}`, 70, yPos)
                   .text(`Days in Month: ${rentCalculation.totalDaysInMonth}`, 70, yPos + 15)
                   .text(`Days Occupied: ${rentCalculation.occupiedDays}`, 70, yPos + 30)
                   .text(`Daily Rate: €${rentCalculation.dailyRate.toFixed(2)}`, 70, yPos + 45)
                   .text(`Prorated Rent (${rentCalculation.occupancyPercentage}%): €${rentCalculation.proRatedAmount.toFixed(2)}`, 70, yPos + 60);
                yPos += 95;
            } else {
                doc.fontSize(12).text(`Monthly Rent: €${rentCalculation.monthlyRent.toFixed(2)}`, 70, yPos);
                yPos += 25;
            }
            let utilitiesTotal = 0;
            
            if (utilities.length > 0) {
                doc.text('Utilities:', 70, yPos);
                yPos += 20;
                
                utilities.forEach(utility => {
                    doc.text(`${utility.utility_type}: €${utility.allocated_amount.toFixed(2)}`, 90, yPos);
                    utilitiesTotal += utility.allocated_amount;
                    yPos += 20;
                });
                
                doc.text(`Utilities Total: €${utilitiesTotal.toFixed(2)}`, 70, yPos);
                yPos += 20;
            }
            
            // Total
            doc.fontSize(14);
            const rentAmount = rentCalculation.isFullMonth ? rentCalculation.monthlyRent : rentCalculation.proRatedAmount;
            const total = rentAmount + utilitiesTotal;
            doc.text(`TOTAL DUE: €${total.toFixed(2)}`, 50, yPos + 20);
            
            // Occupancy summary
            if (!rentCalculation.isFullMonth) {
                doc.fontSize(10)
                   .text(`Note: Rent prorated for partial month occupancy (${rentCalculation.occupancyPercentage}% of month)`, 50, yPos + 50);
            }
            
            // Footer
            doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 700);
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}