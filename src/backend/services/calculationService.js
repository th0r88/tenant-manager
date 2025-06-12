import db from '../database/db.js';

export function calculateAllocations(utilityEntryId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM utility_entries WHERE id = ?', [utilityEntryId], (err, utility) => {
            if (err) return reject(err);
            
            db.all('SELECT * FROM tenants WHERE property_id = ?', [utility.property_id], (err, tenants) => {
                if (err) return reject(err);
                
                const allocations = [];
                
                if (utility.allocation_method === 'per_person') {
                    const amountPerPerson = utility.total_amount / tenants.length;
                    tenants.forEach(tenant => {
                        allocations.push({
                            tenant_id: tenant.id,
                            utility_entry_id: utilityEntryId,
                            allocated_amount: amountPerPerson
                        });
                    });
                } else if (utility.allocation_method === 'per_sqm') {
                    const totalArea = tenants.reduce((sum, tenant) => sum + tenant.room_area, 0);
                    const amountPerSqm = utility.total_amount / totalArea;
                    tenants.forEach(tenant => {
                        allocations.push({
                            tenant_id: tenant.id,
                            utility_entry_id: utilityEntryId,
                            allocated_amount: amountPerSqm * tenant.room_area
                        });
                    });
                }
                
                const stmt = db.prepare('INSERT INTO tenant_utility_allocations (tenant_id, utility_entry_id, allocated_amount) VALUES (?, ?, ?)');
                
                allocations.forEach(allocation => {
                    stmt.run([allocation.tenant_id, allocation.utility_entry_id, allocation.allocated_amount]);
                });
                
                stmt.finalize((err) => {
                    if (err) reject(err);
                    else resolve(allocations);
                });
            });
        });
    });
}