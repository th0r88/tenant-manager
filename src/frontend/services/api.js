const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export const propertyApi = {
    getAll: () => fetch(`${API_BASE}/properties`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
    }),
    create: (property) => fetch(`${API_BASE}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(property)
    }).then(r => r.json()),
    update: (id, property) => fetch(`${API_BASE}/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
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
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(tenant)
    }).then(r => r.json()),
    update: (id, tenant) => fetch(`${API_BASE}/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
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
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(utility)
    }).then(r => r.json()),
    update: (id, utility) => fetch(`${API_BASE}/utilities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(utility)
    }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
    }),
    delete: (id) => fetch(`${API_BASE}/utilities/${id}`, {
        method: 'DELETE'
    }).then(r => r.json()),
    getByMonth: (month, year) => fetch(`${API_BASE}/utilities/${month}/${year}`).then(r => r.json())
};

export const reportApi = {
    getSummary: (month, year, propertyId = 1) => fetch(`${API_BASE}/reports/summary/${month}/${year}?property_id=${propertyId}`).then(r => r.json()),
    
    downloadPdf: async (tenantId, month, year, language = 'sl') => {
        const response = await fetch(`${API_BASE}/reports/${tenantId}/${month}/${year}?lang=${language}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tenant-report-${month}-${year}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    },

    batchExport: async (tenantIds, month, year, language = 'sl', progressCallback) => {
        try {
            const response = await fetch(`${API_BASE}/reports/batch-export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({
                    tenantIds,
                    month,
                    year,
                    language
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Check if it's a streaming response
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                // Streaming progress updates
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.trim()) {
                            try {
                                const data = JSON.parse(line);
                                if (data.type === 'progress' && progressCallback) {
                                    progressCallback(data.progress);
                                } else if (data.type === 'complete') {
                                    return {
                                        success: true,
                                        downloadUrl: data.downloadUrl,
                                        filename: data.filename
                                    };
                                } else if (data.type === 'error') {
                                    return {
                                        success: false,
                                        errors: [data.message]
                                    };
                                }
                            } catch (e) {
                                console.warn('Failed to parse streaming response:', line);
                            }
                        }
                    }
                }
            } else {
                // Direct blob download
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const filename = `batch-reports-${month}-${year}.zip`;
                
                return {
                    success: true,
                    downloadUrl: url,
                    filename
                };
            }
        } catch (error) {
            return {
                success: false,
                errors: [error.message || 'Batch export failed']
            };
        }
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
    }),
    getCapacityMetrics: () => fetch(`${API_BASE}/dashboard/capacity-metrics`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
    })
};