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
                <div className="overflow-x-auto">
                    <table className="table table-zebra">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Address</th>
                                <th>EMŠO</th>
                                <th>Tax Number</th>
                                <th>Rent</th>
                                <th>Area</th>
                                <th>Lease</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map((tenant) => (
                                <tr key={tenant.id}>
                                    <td>
                                        <div className="font-bold">{tenant.name} {tenant.surname}</div>
                                    </td>
                                    <td>{tenant.address}</td>
                                    <td>{tenant.emso}</td>
                                    <td>{tenant.tax_number || '-'}</td>
                                    <td>
                                        <div className="font-bold text-success">€{tenant.rent_amount}/month</div>
                                    </td>
                                    <td>{tenant.room_area}m²</td>
                                    <td>{tenant.lease_duration} months</td>
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