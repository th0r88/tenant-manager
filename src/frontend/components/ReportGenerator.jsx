import React, { useState, useEffect } from 'react';
import { reportApi } from '../services/api';

export default function ReportGenerator({ selectedProperty, tenants }) {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [summary, setSummary] = useState([]);
    const [loading, setLoading] = useState(false);
    const [reportFilter, setReportFilter] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        tenant: ''
    });

    useEffect(() => {
        if (selectedProperty) {
            loadSummary();
        }
    }, [month, year, selectedProperty]);

    const loadSummary = async () => {
        if (!selectedProperty) return;
        try {
            setLoading(true);
            const data = await reportApi.getSummary(month, year, selectedProperty.id);
            setSummary(data);
        } catch (error) {
            console.error('Error loading summary:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = (tenantId) => {
        reportApi.downloadPdf(tenantId, month, year);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Monthly Reports</h2>
            
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h3 className="card-title">Select Period</h3>
                    <div className="flex gap-2 w-1/2">
                        <div className="form-control flex-1">
                            <label className="label">
                                <span className="label-text">Month</span>
                            </label>
                            <select 
                                className="select select-bordered w-full" 
                                value={month} 
                                onChange={(e) => setMonth(parseInt(e.target.value))}
                            >
                                {[...Array(12)].map((_, i) => (
                                    <option key={i + 1} value={i + 1}>
                                        {new Date(0, i).toLocaleString('default', { month: 'long' })}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-control flex-1">
                            <label className="label">
                                <span className="label-text">Year</span>
                            </label>
                            <select 
                                className="select select-bordered w-full"
                                value={year} 
                                onChange={(e) => setYear(parseInt(e.target.value))}
                            >
                                {Array.from({ length: 26 }, (_, i) => 2025 + i).map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h3 className="card-title">Report Summary</h3>
                    
                    {/* Filter Controls */}
                    <div className="card bg-base-100 shadow-md mb-4">
                        <div className="card-body p-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="form-control w-full">
                                    <select 
                                        value={reportFilter.month} 
                                        onChange={(e) => setReportFilter({...reportFilter, month: parseInt(e.target.value)})}
                                        className="select select-bordered w-full"
                                    >
                                        <option value="">All Months</option>
                                        {[...Array(12)].map((_, i) => (
                                            <option key={i + 1} value={i + 1}>
                                                {new Date(0, i).toLocaleString('default', { month: 'long' })}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-control w-full">
                                    <select 
                                        value={reportFilter.year} 
                                        onChange={(e) => setReportFilter({...reportFilter, year: parseInt(e.target.value)})}
                                        className="select select-bordered w-full"
                                    >
                                        <option value="">All Years</option>
                                        {Array.from({ length: 26 }, (_, i) => 2025 + i)
                                            .sort((a, b) => b - a)
                                            .map(year => (
                                                <option key={year} value={year}>{year}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                                <div className="form-control w-full">
                                    <select 
                                        value={reportFilter.tenant} 
                                        onChange={(e) => setReportFilter({...reportFilter, tenant: e.target.value})}
                                        className="select select-bordered w-full"
                                    >
                                        <option value="">All Tenants</option>
                                        {tenants && tenants.map((tenant) => (
                                            <option key={tenant.id} value={tenant.id}>
                                                {tenant.name} {tenant.surname}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-control w-full">
                                    <button 
                                        className="btn btn-outline"
                                        onClick={() => setReportFilter({month: '', year: '', tenant: ''})}
                                    >
                                        Clear Filters
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <span className="loading loading-spinner loading-md"></span>
                            <span className="ml-2">Loading...</span>
                        </div>
                    ) : summary.length === 0 ? (
                        <div className="text-center py-8 opacity-50">
                            <p>No data for this month/year. Make sure you have tenants and utility entries for this period.</p>
                        </div>
                    ) : (() => {
                        const filteredSummary = summary.filter(tenant => {
                            const monthMatch = !reportFilter.month || month === reportFilter.month;
                            const yearMatch = !reportFilter.year || year === reportFilter.year;
                            const tenantMatch = !reportFilter.tenant || tenant.id.toString() === reportFilter.tenant;
                            return monthMatch && yearMatch && tenantMatch;
                        });

                        return filteredSummary.length === 0 ? (
                            <div className="text-center py-8 opacity-50">
                                <p>No reports found for the selected filters.</p>
                                <p className="text-sm mt-2">Try adjusting your filters or clear all filters to see all reports.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="table table-zebra">
                                    <thead>
                                        <tr>
                                            <th>Tenant</th>
                                            <th>Rent</th>
                                            <th>Utilities</th>
                                            <th>Total Due</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSummary.map((tenant) => (
                                        <tr key={tenant.id}>
                                            <td>
                                                <div className="font-bold">{tenant.name} {tenant.surname}</div>
                                            </td>
                                            <td>
                                                <div className="font-medium">€{tenant.rent_amount.toFixed(2)}</div>
                                            </td>
                                            <td>
                                                <div className="font-medium">€{tenant.utilities_total.toFixed(2)}</div>
                                            </td>
                                            <td>
                                                <div className="font-bold text-primary">€{tenant.total_due.toFixed(2)}</div>
                                            </td>
                                            <td>
                                                <div className="tooltip" data-tip="Download detailed PDF report">
                                                    <button 
                                                        className="btn btn-sm btn-primary" 
                                                        onClick={() => handleDownloadPdf(tenant.id)}
                                                    >
                                                        Download PDF
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}