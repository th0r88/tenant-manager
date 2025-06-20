import React, { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';

export default function TenantList({ tenants, onEdit, onDelete }) {
    const { t, formatCurrency, formatDate } = useTranslation();
    const [deleteModal, setDeleteModal] = useState(null);
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
                        <table className="table table-zebra table-fixed">
                            <thead>
                                <tr>
                                    <th>{t('common.name')}</th>
                                    <th className="w-32">{t('common.address')}</th>
                                    <th>{t('tenants.emso')}</th>
                                    <th>{t('tenants.taxNumber')}</th>
                                    <th className="w-20">{t('common.rent')}</th>
                                    <th className="w-16">{t('common.area')}</th>
                                    <th className="w-20">{t('tenants.occupancy')}</th>
                                    <th>{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tenants.map((tenant) => (
                                    <tr key={tenant.id}>
                                        <td>
                                            <div className="font-bold">{tenant.name} {tenant.surname}</div>
                                        </td>
                                        <td className="w-32">
                                            <div className="tooltip" data-tip={tenant.address}>
                                                <div className="truncate max-w-28 cursor-help">
                                                    {tenant.address}
                                                </div>
                                            </div>
                                        </td>
                                        <td>{tenant.emso}</td>
                                        <td>{tenant.tax_number || t('common.none')}</td>
                                        <td className="w-20">
                                            <div className="font-bold text-success text-sm">{formatCurrency(tenant.rent_amount)}{t('dashboard.perMonth')}</div>
                                        </td>
                                        <td className="w-16 text-center">{tenant.room_area}m²</td>
                                        <td className="w-20">
                                            <div className="text-center">
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
                                                <div className="tooltip" data-tip={t('tenants.editTenantDetails')}>
                                                    <button 
                                                        className="btn btn-sm btn-outline" 
                                                        onClick={() => onEdit(tenant)}
                                                    >
                                                        {t('common.edit')}
                                                    </button>
                                                </div>
                                                <div className="tooltip" data-tip={t('tenants.deleteTenantTooltip')}>
                                                    <button 
                                                        className="btn btn-sm btn-error" 
                                                        onClick={() => setDeleteModal(tenant)}
                                                    >
                                                        {t('common.delete')}
                                                    </button>
                                                </div>
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
                                                <span className="font-medium opacity-70">{t('tenants.lease')}:</span>
                                                <div>{tenant.lease_duration} {t('tenants.months')}</div>
                                            </div>
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
                                            className="btn btn-sm btn-outline flex-1" 
                                            onClick={() => onEdit(tenant)}
                                        >
                                            {t('common.edit')}
                                        </button>
                                        <button 
                                            className="btn btn-sm btn-error flex-1" 
                                            onClick={() => setDeleteModal(tenant)}
                                        >
                                            {t('common.delete')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            
            {/* Delete Confirmation Modal */}
            {deleteModal && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg">{t('tenants.deleteTenant')}</h3>
                        <p className="py-4">
                            {t('tenants.confirmDelete', { name: `${deleteModal.name} ${deleteModal.surname}` })}
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