import React, { useState, useEffect } from 'react';
import { reportApi } from '../services/api';
import DownloadButton from './DownloadButton';
import BatchExportModal from './BatchExportModal';
import { useTranslation } from '../hooks/useTranslation';

export default function ReportGenerator({ selectedProperty, tenants }) {
    const { t, formatCurrency, getMonthNames, currentLanguage } = useTranslation();
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [summary, setSummary] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pdfLanguage, setPdfLanguage] = useState(currentLanguage || 'sl');
    const [reportFilter, setReportFilter] = useState({
        tenant: ''
    });
    const [downloadingPdfs, setDownloadingPdfs] = useState(new Set());
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [selectedTenants, setSelectedTenants] = useState(new Set());

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

    const handleDownloadPdf = async (tenantId) => {
        setDownloadingPdfs(prev => new Set(prev).add(tenantId));
        try {
            await reportApi.downloadPdf(tenantId, month, year, pdfLanguage);
        } catch (error) {
            console.error('PDF download failed:', error);
        } finally {
            setDownloadingPdfs(prev => {
                const next = new Set(prev);
                next.delete(tenantId);
                return next;
            });
        }
    };

    const handleTenantSelection = (tenantId, selected) => {
        setSelectedTenants(prev => {
            const next = new Set(prev);
            if (selected) {
                next.add(tenantId);
            } else {
                next.delete(tenantId);
            }
            return next;
        });
    };

    const handleSelectAll = (filteredSummary) => {
        if (selectedTenants.size === filteredSummary.length) {
            setSelectedTenants(new Set());
        } else {
            setSelectedTenants(new Set(filteredSummary.map(t => t.id)));
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">{t('reports.monthlyReportsTitle')}</h2>
            
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h3 className="card-title">{t('reports.selectPeriod')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="form-control w-full">
                            <select 
                                className="select select-bordered w-full" 
                                value={month} 
                                onChange={(e) => setMonth(parseInt(e.target.value))}
                            >
                                {getMonthNames().map((monthName, i) => (
                                    <option key={i + 1} value={i + 1}>
                                        {monthName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-control w-full">
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
                        <div className="form-control w-full">
                            <select 
                                value={reportFilter.tenant} 
                                onChange={(e) => setReportFilter({...reportFilter, tenant: e.target.value})}
                                className="select select-bordered w-full"
                            >
                                <option value="">{t('reports.allTenants')}</option>
                                {tenants && tenants.map((tenant) => (
                                    <option key={tenant.id} value={tenant.id}>
                                        {tenant.name} {tenant.surname}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-control w-full">
                            <select 
                                className="select select-bordered w-full"
                                value={pdfLanguage} 
                                onChange={(e) => setPdfLanguage(e.target.value)}
                            >
                                <option value="sl">🇸🇮 {t('language.slovenian')}</option>
                                <option value="en">🇬🇧 {t('language.english')}</option>
                            </select>
                        </div>
                        <div className="form-control w-full">
                            <button 
                                className="btn btn-outline"
                                onClick={() => setReportFilter({tenant: ''})}
                            >
                                {t('reports.clearFilters')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <span className="loading loading-spinner loading-md"></span>
                            <span className="ml-2">{t('reports.loading')}</span>
                        </div>
                    ) : summary.length === 0 ? (
                        <div className="text-center py-8 opacity-50">
                            <p>{t('reports.noDataForPeriod')}</p>
                        </div>
                    ) : (() => {
                        const filteredSummary = summary.filter(tenant => {
                            const tenantMatch = !reportFilter.tenant || tenant.id.toString() === reportFilter.tenant;
                            return tenantMatch;
                        });

                        return filteredSummary.length === 0 ? (
                            <div className="text-center py-8 opacity-50">
                                <p>{t('reports.noReportsForFilters')}</p>
                                <p className="text-sm mt-2">{t('reports.adjustFiltersHelp')}</p>
                            </div>
                        ) : (
                            <div>
                                {/* Batch Actions Bar */}
                                <div className="bg-base-200 p-4 rounded-lg mb-4 flex flex-wrap gap-4 items-center justify-between min-h-[4rem]">
                                    <div className="flex items-center gap-4">
                                        <label className="label cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="checkbox checkbox-info" 
                                                checked={selectedTenants.size === filteredSummary.length && filteredSummary.length > 0}
                                                onChange={() => handleSelectAll(filteredSummary)}
                                            />
                                            <span className="label-text ml-2">
                                                {t('reports.selectAll')} ({selectedTenants.size} {t('reports.selected')})
                                            </span>
                                        </label>
                                    </div>
                                    <div className="flex gap-2 min-h-[2rem]">
                                        {selectedTenants.size > 0 && (
                                            <button 
                                                className="btn btn-info btn-sm"
                                                onClick={() => setShowBatchModal(true)}
                                            >
                                                📦 {t('reports.exportAsZip')} {selectedTenants.size} {t('reports.reportsCount')}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="overflow-hidden">
                                    <table className="table table-zebra w-full">
                                        <thead>
                                            <tr>
                                                <th className="w-12">
                                                    <input 
                                                        type="checkbox" 
                                                        className="checkbox checkbox-info checkbox-sm" 
                                                        checked={selectedTenants.size === filteredSummary.length && filteredSummary.length > 0}
                                                        onChange={() => handleSelectAll(filteredSummary)}
                                                    />
                                                </th>
                                                <th className="w-1/4 min-w-0">{t('reports.tenant')}</th>
                                                <th className="w-1/5">{t('reports.rent')}</th>
                                                <th className="w-1/5">{t('reports.utilitiesLabel')}</th>
                                                <th className="w-1/5">{t('reports.totalDue')}</th>
                                                <th className="w-1/6">{t('reports.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSummary.map((tenant) => (
                                            <tr key={tenant.id}>
                                                <td className="w-12">
                                                    <input 
                                                        type="checkbox" 
                                                        className="checkbox checkbox-info checkbox-sm" 
                                                        checked={selectedTenants.has(tenant.id)}
                                                        onChange={(e) => handleTenantSelection(tenant.id, e.target.checked)}
                                                    />
                                                </td>
                                                <td className="w-1/4 min-w-0">
                                                    <div className="font-bold truncate">{tenant.name} {tenant.surname}</div>
                                                </td>
                                                <td className="w-1/5">
                                                    <div className="font-medium">{formatCurrency(tenant.rent_amount)}</div>
                                                </td>
                                                <td className="w-1/5">
                                                    <div className="font-medium">{formatCurrency(tenant.utilities_total)}</div>
                                                </td>
                                                <td className="w-1/5">
                                                    <div className="font-bold text-info">{formatCurrency(tenant.total_due)}</div>
                                                </td>
                                                <td className="w-1/6">
                                                    <DownloadButton 
                                                        onDownload={() => handleDownloadPdf(tenant.id)}
                                                        isLoading={downloadingPdfs.has(tenant.id)}
                                                        tenantName={`${tenant.name} ${tenant.surname}`}
                                                        variant="info"
                                                    />
                                                </td>
                                            </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Batch Export Modal */}
            {showBatchModal && (
                <BatchExportModal 
                    isOpen={showBatchModal}
                    onClose={() => setShowBatchModal(false)}
                    selectedTenants={Array.from(selectedTenants)}
                    tenants={summary.filter(t => selectedTenants.has(t.id))}
                    month={month}
                    year={year}
                    pdfLanguage={pdfLanguage}
                />
            )}
        </div>
    );
}