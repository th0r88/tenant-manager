import PDFDocument from 'pdfkit';

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
            
            // Tenant Info
            doc.fontSize(12)
               .text(`Tenant: ${tenant.name} ${tenant.surname}`, 50, 100)
               .text(`Address: ${tenant.address}`, 50, 120)
               .text(`EMŠO: ${tenant.emso}`, 50, 140)
               .text(`Period: ${month}/${year}`, 50, 160);
            
            // Charges
            doc.fontSize(14).text('CHARGES:', 50, 200);
            doc.fontSize(12).text(`Monthly Rent: €${tenant.rent_amount.toFixed(2)}`, 70, 220);
            
            let yPos = 240;
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
            const total = tenant.rent_amount + utilitiesTotal;
            doc.text(`TOTAL DUE: €${total.toFixed(2)}`, 50, yPos + 20);
            
            // Footer
            doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 700);
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}