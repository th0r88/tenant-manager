import React, { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';

export default function TenantList({ tenants, onEdit, onDelete }) {
    const { t, formatCurrency, formatDate } = useTranslation();
    const [deleteModal, setDeleteModal] = useState(null);
    const [viewModal, setViewModal] = useState(null);
    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">{t('tenants.title')} ({tenants.length})</h2>
            {tenants.length === 0 ? (
                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <p>{t('tenants.noTenantsYet')}</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr>
                                    <th>{t('common.name')}</th>
                                    <th>{t('common.rent')}</th>
                                    <th>{t('tenants.occupancy')}</th>
                                    <th>{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tenants.map((tenant) => (
                                    <tr key={tenant.id}>
                                        <td>
                                            <div className="font-bold">{tenant.name} {tenant.surname}</div>
                                        </td>
                                        <td>
                                            <div className="font-bold text-success text-sm">{formatCurrency(tenant.rent_amount)}{t('dashboard.perMonth')}</div>
                                        </td>
                                        <td>
                                            <div>
                                                <div className={`badge badge-sm ${
                                                    tenant.occupancy_status === 'active' ? 'badge-success' :
                                                    tenant.occupancy_status === 'pending' ? 'badge-warning' : 'badge-error'
                                                }`}>
                                                    {t(`tenants.occupancyStatuses.${tenant.occupancy_status}`)}
                                                </div>
                                                <div className="text-xs mt-1 opacity-70">
                                                    {tenant.move_in_date ? formatDate(new Date(tenant.move_in_date)) : t('common.none')}
                                                    {tenant.move_out_date && ` - ${formatDate(new Date(tenant.move_out_date))}`}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button 
                                                    className="btn btn-sm btn-info" 
                                                    onClick={() => setViewModal(tenant)}
                                                >
                                                    {t('common.view')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="lg:hidden space-y-4">
                        {tenants.map((tenant) => (
                            <div key={tenant.id} className="card bg-base-100 shadow-md">
                                <div className="card-body p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-bold text-lg">{tenant.name} {tenant.surname}</h3>
                                        <div className="badge badge-success font-bold">{formatCurrency(tenant.rent_amount)}{t('dashboard.perMonth')}</div>
                                    </div>
                                    
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="font-medium opacity-70">{t('common.address')}:</span>
                                            <div className="break-words">{tenant.address}</div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="font-medium opacity-70">{t('tenants.emso')}:</span>
                                                <div className="font-mono text-xs">{tenant.emso}</div>
                                            </div>
                                            <div>
                                                <span className="font-medium opacity-70">{t('tenants.taxNumber')}:</span>
                                                <div className="font-mono text-xs">{tenant.tax_number || t('common.none')}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="font-medium opacity-70">{t('common.area')}:</span>
                                                <div>{tenant.room_area}m²</div>
                                            </div>
                                            <div>
                                                <span className="font-medium opacity-70">{t('tenants.numberOfPeople')}:</span>
                                                <div>{tenant.number_of_people || 1}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="font-medium opacity-70">{t('tenants.lease')}:</span>
                                                <div>{tenant.lease_duration} {t('tenants.months')}</div>
                                            </div>
                                            <div></div>
                                        </div>
                                        
                                        <div className="mt-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-medium opacity-70">{t('common.status')}:</span>
                                                <div className={`badge badge-sm ${
                                                    tenant.occupancy_status === 'active' ? 'badge-success' :
                                                    tenant.occupancy_status === 'pending' ? 'badge-warning' : 'badge-error'
                                                }`}>
                                                    {t(`tenants.occupancyStatuses.${tenant.occupancy_status}`)}
                                                </div>
                                            </div>
                                            <div className="text-xs opacity-70">
                                                <div><span className="font-medium">{t('tenants.moveIn')}:</span> {tenant.move_in_date ? formatDate(new Date(tenant.move_in_date)) : t('common.none')}</div>
                                                {tenant.move_out_date && (
                                                    <div><span className="font-medium">{t('tenants.moveOut')}:</span> {formatDate(new Date(tenant.move_out_date))}</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2 mt-4">
                                        <button 
                                            className="btn btn-sm btn-info w-full" 
                                            onClick={() => setViewModal(tenant)}
                                        >
                                            {t('common.view')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            
            {/* View Tenant Modal */}
            {viewModal && (
                <div className="modal modal-open">
                    <div className="modal-box w-11/12 max-w-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg">{t('tenants.tenantDetails')}</h3>
                            <button 
                                className="btn btn-sm btn-circle" 
                                onClick={() => setViewModal(null)}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium opacity-70">{t('common.name')}</label>
                                    <div className="text-lg font-bold">{viewModal.name} {viewModal.surname}</div>
                                </div>
                                
                                <div>
                                    <label className="text-sm font-medium opacity-70">{t('common.address')}</label>
                                    <div>{viewModal.address}</div>
                                </div>
                                
                                <div>
                                    <label className="text-sm font-medium opacity-70">{t('tenants.emso')}</label>
                                    <div className="font-mono">{viewModal.emso}</div>
                                </div>
                                
                                <div>
                                    <label className="text-sm font-medium opacity-70">{t('tenants.taxNumber')}</label>
                                    <div className="font-mono">{viewModal.tax_number || t('common.none')}</div>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium opacity-70">{t('tenants.rentAmount')}</label>
                                    <div className="text-lg font-bold text-success">{formatCurrency(viewModal.rent_amount)}{t('dashboard.perMonth')}</div>
                                </div>
                                
                                <div>
                                    <label className="text-sm font-medium opacity-70">{t('tenants.roomArea')}</label>
                                    <div>{viewModal.room_area}m²</div>
                                </div>
                                
                                <div>
                                    <label className="text-sm font-medium opacity-70">{t('tenants.numberOfPeople')}</label>
                                    <div>{viewModal.number_of_people || 1}</div>
                                </div>
                                
                                <div>
                                    <label className="text-sm font-medium opacity-70">{t('tenants.lease')}</label>
                                    <div>{viewModal.lease_duration} {t('tenants.months')}</div>
                                </div>
                                
                                <div>
                                    <label className="text-sm font-medium opacity-70">{t('tenants.occupancy')}</label>
                                    <div className="flex items-center gap-2">
                                        <div className={`badge badge-sm ${
                                            viewModal.occupancy_status === 'active' ? 'badge-success' :
                                            viewModal.occupancy_status === 'pending' ? 'badge-warning' : 'badge-error'
                                        }`}>
                                            {t(`tenants.occupancyStatuses.${viewModal.occupancy_status}`)}
                                        </div>
                                    </div>
                                    <div className="text-xs mt-1 opacity-70">
                                        <div><span className="font-medium">{t('tenants.moveIn')}:</span> {viewModal.move_in_date ? formatDate(new Date(viewModal.move_in_date)) : t('common.none')}</div>
                                        {viewModal.move_out_date && (
                                            <div><span className="font-medium">{t('tenants.moveOut')}:</span> {formatDate(new Date(viewModal.move_out_date))}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="modal-action">
                            <button 
                                className="btn btn-outline" 
                                onClick={() => {
                                    setViewModal(null);
                                    onEdit(viewModal);
                                }}
                            >
                                {t('common.edit')}
                            </button>
                            <button 
                                className="btn btn-error" 
                                onClick={() => {
                                    setViewModal(null);
                                    setDeleteModal(viewModal);
                                }}
                            >
                                {t('common.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Delete Confirmation Modal */}
            {deleteModal && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg">{t('tenants.deleteTenant')}</h3>
                        <p className="py-4">
                            {t('tenants.confirmDelete')}
                        </p>
                        <div className="modal-action">
                            <button 
                                className="btn btn-ghost" 
                                onClick={() => setDeleteModal(null)}
                            >
                                {t('common.cancel')}
                            </button>
                            <button 
                                className="btn btn-error" 
                                onClick={() => {
                                    onDelete(deleteModal.id);
                                    setDeleteModal(null);
                                }}
                            >
                                {t('common.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}