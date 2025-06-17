import React, { useState } from 'react';
import { reportApi } from '../services/api';

export default function BatchExportModal({ isOpen, onClose, selectedTenants, tenants, month, year }) {
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
    const [exportStatus, setExportStatus] = useState('idle'); // idle, processing, success, error
    const [exportErrors, setExportErrors] = useState([]);

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleBatchExport = async () => {
        setIsExporting(true);
        setExportStatus('processing');
        setExportProgress({ current: 0, total: selectedTenants.length });
        setExportErrors([]);

        try {
            const result = await reportApi.batchExport(selectedTenants, month, year, (progress) => {
                setExportProgress(progress);
            });

            if (result.success) {
                setExportStatus('success');
                // Trigger download
                const link = document.createElement('a');
                link.href = result.downloadUrl;
                link.download = result.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                setExportStatus('error');
                setExportErrors(result.errors || ['Unknown error occurred']);
            }
        } catch (error) {
            setExportStatus('error');
            setExportErrors([error.message || 'Failed to export reports']);
        } finally {
            setIsExporting(false);
        }
    };

    const getEstimatedSize = () => {
        // Rough estimate: ~50KB per PDF
        const estimatedBytes = selectedTenants.length * 50 * 1024;
        return formatFileSize(estimatedBytes);
    };

    const getProgressPercentage = () => {
        if (exportProgress.total === 0) return 0;
        return Math.round((exportProgress.current / exportProgress.total) * 100);
    };

    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box w-11/12 max-w-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg">📦 Batch Export Reports</h3>
                    <button 
                        className="btn btn-sm btn-circle" 
                        onClick={onClose}
                        disabled={isExporting}
                    >
                        ✕
                    </button>
                </div>

                {/* Export Summary */}
                <div className="bg-base-200 p-4 rounded-lg mb-6">
                    <h4 className="font-semibold mb-3">Export Summary</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-base-content/70">Period:</span>
                            <span className="ml-2 font-medium">{month}/{year}</span>
                        </div>
                        <div>
                            <span className="text-base-content/70">Reports:</span>
                            <span className="ml-2 font-medium">{selectedTenants.length} tenants</span>
                        </div>
                        <div>
                            <span className="text-base-content/70">Estimated Size:</span>
                            <span className="ml-2 font-medium">{getEstimatedSize()}</span>
                        </div>
                        <div>
                            <span className="text-base-content/70">Format:</span>
                            <span className="ml-2 font-medium">ZIP Archive</span>
                        </div>
                    </div>
                </div>

                {/* Tenant List */}
                <div className="mb-6">
                    <h4 className="font-semibold mb-3">Selected Tenants</h4>
                    <div className="max-h-40 overflow-y-auto bg-base-100 p-3 rounded border">
                        {tenants.map((tenant, index) => (
                            <div key={tenant.id} className="flex justify-between items-center py-1">
                                <span className="text-sm">{tenant.name} {tenant.surname}</span>
                                <span className="text-xs text-base-content/60">€{tenant.total_due.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Progress Section */}
                {exportStatus === 'processing' && (
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Generating Reports...</span>
                            <span className="text-sm text-base-content/70">
                                {exportProgress.current} / {exportProgress.total}
                            </span>
                        </div>
                        <div className="w-full bg-base-300 rounded-full h-2">
                            <div 
                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                style={{ width: `${getProgressPercentage()}%` }}
                            ></div>
                        </div>
                        <div className="text-xs text-center mt-1 text-base-content/60">
                            {getProgressPercentage()}% complete
                        </div>
                    </div>
                )}

                {/* Success State */}
                {exportStatus === 'success' && (
                    <div className="alert alert-success mb-6">
                        <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <h3 className="font-bold">Export Successful!</h3>
                            <div className="text-xs">ZIP file has been downloaded to your computer.</div>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {exportStatus === 'error' && (
                    <div className="alert alert-error mb-6">
                        <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <h3 className="font-bold">Export Failed</h3>
                            <div className="text-xs">
                                {exportErrors.map((error, index) => (
                                    <div key={index}>• {error}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="modal-action">
                    <button 
                        className="btn btn-outline" 
                        onClick={onClose}
                        disabled={isExporting}
                    >
                        {exportStatus === 'success' ? 'Close' : 'Cancel'}
                    </button>
                    
                    {exportStatus !== 'success' && (
                        <button 
                            className={`btn btn-primary ${isExporting ? 'loading' : ''}`}
                            onClick={handleBatchExport}
                            disabled={isExporting || selectedTenants.length === 0}
                        >
                            {isExporting ? (
                                <span className="flex items-center gap-2">
                                    <span className="loading loading-spinner loading-xs"></span>
                                    Exporting...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Export as ZIP
                                </span>
                            )}
                        </button>
                    )}

                    {exportStatus === 'error' && (
                        <button 
                            className="btn btn-warning"
                            onClick={() => {
                                setExportStatus('idle');
                                setExportErrors([]);
                                setExportProgress({ current: 0, total: 0 });
                            }}
                        >
                            Try Again
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}