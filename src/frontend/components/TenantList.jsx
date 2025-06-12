import React, { useState } from 'react';

export default function TenantList({ tenants, onEdit, onDelete }) {
    const [deleteModal, setDeleteModal] = useState(null);
    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Tenants ({tenants.length})</h2>
            {tenants.length === 0 ? (
                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <p>No tenants yet. Add your first tenant above.</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="table table-zebra table-fixed">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th className="w-32">Address</th>
                                    <th>EMŠO</th>
                                    <th>Tax Number</th>
                                    <th className="w-20">Rent</th>
                                    <th className="w-16">Area</th>
                                    <th className="w-16">Lease</th>
                                    <th>Actions</th>
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
                                        <td>{tenant.tax_number || '-'}</td>
                                        <td className="w-20">
                                            <div className="font-bold text-success text-sm">€{tenant.rent_amount}/mo</div>
                                        </td>
                                        <td className="w-16 text-center">{tenant.room_area}m²</td>
                                        <td className="w-16 text-center">{tenant.lease_duration}mo</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <div className="tooltip" data-tip="Edit tenant details">
                                                    <button 
                                                        className="btn btn-sm btn-outline" 
                                                        onClick={() => onEdit(tenant)}
                                                    >
                                                        Edit
                                                    </button>
                                                </div>
                                                <div className="tooltip" data-tip="Delete tenant">
                                                    <button 
                                                        className="btn btn-sm btn-error" 
                                                        onClick={() => setDeleteModal(tenant)}
                                                    >
                                                        Delete
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
                                        <div className="badge badge-success font-bold">€{tenant.rent_amount}/mo</div>
                                    </div>
                                    
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="font-medium opacity-70">Address:</span>
                                            <div className="break-words">{tenant.address}</div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="font-medium opacity-70">EMŠO:</span>
                                                <div className="font-mono text-xs">{tenant.emso}</div>
                                            </div>
                                            <div>
                                                <span className="font-medium opacity-70">Tax:</span>
                                                <div className="font-mono text-xs">{tenant.tax_number || 'N/A'}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="font-medium opacity-70">Area:</span>
                                                <div>{tenant.room_area}m²</div>
                                            </div>
                                            <div>
                                                <span className="font-medium opacity-70">Lease:</span>
                                                <div>{tenant.lease_duration} months</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2 mt-4">
                                        <button 
                                            className="btn btn-sm btn-outline flex-1" 
                                            onClick={() => onEdit(tenant)}
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            className="btn btn-sm btn-error flex-1" 
                                            onClick={() => setDeleteModal(tenant)}
                                        >
                                            Delete
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
                        <h3 className="font-bold text-lg">Confirm Delete</h3>
                        <p className="py-4">
                            Are you sure you want to delete tenant <strong>{deleteModal.name} {deleteModal.surname}</strong>? 
                            This action cannot be undone.
                        </p>
                        <div className="modal-action">
                            <button 
                                className="btn btn-ghost" 
                                onClick={() => setDeleteModal(null)}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn btn-error" 
                                onClick={() => {
                                    onDelete(deleteModal.id);
                                    setDeleteModal(null);
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}