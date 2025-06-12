const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export const propertyApi = {
    getAll: () => fetch(`${API_BASE}/properties`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
    }),
    create: (property) => fetch(`${API_BASE}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(property)
    }).then(r => r.json()),
    update: (id, property) => fetch(`${API_BASE}/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(property)
    }).then(r => r.json()),
    delete: (id) => fetch(`${API_BASE}/properties/${id}`, {
        method: 'DELETE'
    }).then(r => r.json())
};

export const tenantApi = {
    getAll: (propertyId = 1) => fetch(`${API_BASE}/tenants?property_id=${propertyId}`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
    }),
    create: (tenant) => fetch(`${API_BASE}/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenant)
    }).then(r => r.json()),
    update: (id, tenant) => fetch(`${API_BASE}/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenant)
    }).then(r => r.json()),
    delete: (id) => fetch(`${API_BASE}/tenants/${id}`, {
        method: 'DELETE'
    }).then(r => r.json())
};

export const utilityApi = {
    getAll: (propertyId = 1) => fetch(`${API_BASE}/utilities?property_id=${propertyId}`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
    }),
    create: (utility) => fetch(`${API_BASE}/utilities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(utility)
    }).then(r => r.json()),
    update: (id, utility) => fetch(`${API_BASE}/utilities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(utility)
    }).then(r => r.json()),
    delete: (id) => fetch(`${API_BASE}/utilities/${id}`, {
        method: 'DELETE'
    }).then(r => r.json()),
    getByMonth: (month, year) => fetch(`${API_BASE}/utilities/${month}/${year}`).then(r => r.json())
};

export const reportApi = {
    getSummary: (month, year, propertyId = 1) => fetch(`${API_BASE}/reports/summary/${month}/${year}?property_id=${propertyId}`).then(r => r.json()),
    downloadPdf: (tenantId, month, year) => {
        const url = `${API_BASE}/reports/${tenantId}/${month}/${year}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = `tenant-report-${month}-${year}.pdf`;
        link.click();
    }
};

export const dashboardApi = {
    getOverview: () => fetch(`${API_BASE}/dashboard/overview`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
    }),
    getPropertiesBreakdown: () => fetch(`${API_BASE}/dashboard/properties-breakdown`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
    }),
    getRecentActivity: (limit = 10) => fetch(`${API_BASE}/dashboard/recent-activity?limit=${limit}`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
    }),
    getRevenueTrends: (months = 6) => fetch(`${API_BASE}/dashboard/revenue-trends/${months}`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
    }),
    getUtilityBreakdown: (months = 3) => fetch(`${API_BASE}/dashboard/utility-breakdown/${months}`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
    })
};