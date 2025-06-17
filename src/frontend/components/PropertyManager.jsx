import React, { useState } from 'react';
import { propertyApi } from '../services/api';

export default function PropertyManager({ properties, onPropertyChange, onError, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        property_type: '',
        house_area: '',
        number_of_tenants: ''
    });
    const [editing, setEditing] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);

    const handleChange = (e) => {
        let value = e.target.value;
        
        if (e.target.name === 'house_area') {
            value = e.target.value === '' ? '' : parseFloat(e.target.value) || '';
        } else if (e.target.name === 'number_of_tenants') {
            value = e.target.value === '' ? '' : parseInt(e.target.value) || '';
        }
        
        setFormData({
            ...formData,
            [e.target.name]: value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editing) {
                await propertyApi.update(editing.id, formData);
                onSuccess('Property updated successfully');
            } else {
                await propertyApi.create(formData);
                onSuccess('Property created successfully');
            }
            setFormData({ name: '', address: '', property_type: '', house_area: '', number_of_tenants: '' });
            setEditing(null);
            onPropertyChange();
        } catch (err) {
            onError('Failed to save property');
        }
    };

    const handleEdit = (property) => {
        setFormData({
            name: property.name,
            address: property.address,
            property_type: property.property_type,
            house_area: property.house_area || '',
            number_of_tenants: property.number_of_tenants || ''
        });
        setEditing(property);
    };

    const handleDelete = async (id) => {
        try {
            await propertyApi.delete(id);
            onSuccess('Property deleted successfully');
            onPropertyChange();
            setDeleteModal(null);
        } catch (err) {
            onError('Failed to delete property');
            setDeleteModal(null);
        }
    };

    const handleCancel = () => {
        setFormData({ name: '', address: '', property_type: '', house_area: '', number_of_tenants: '' });
        setEditing(null);
    };

    return (
        <div>
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">{editing ? 'Edit Property' : 'Add New Property'}</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Property Name *</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="e.g., Main Building, Apartment Complex A"
                                    className="input input-bordered w-full"
                                    required
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Address *</span>
                                </label>
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    placeholder="e.g., Trubarjeva 1, 1000 Ljubljana"
                                    className="input input-bordered w-full"
                                    required
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">House Area (m²)</span>
                                </label>
                                <input
                                    type="number"
                                    name="house_area"
                                    value={formData.house_area}
                                    onChange={handleChange}
                                    placeholder="e.g., 120"
                                    className="input input-bordered w-full"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Number of tenants</span>
                                </label>
                                <input
                                    type="number"
                                    name="number_of_tenants"
                                    value={formData.number_of_tenants}
                                    onChange={handleChange}
                                    placeholder="e.g., 3"
                                    className="input input-bordered w-full"
                                    min="0"
                                    step="1"
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Property Type *</span>
                                </label>
                                <select 
                                    name="property_type" 
                                    value={formData.property_type} 
                                    onChange={handleChange} 
                                    className="select select-bordered w-full"
                                    required
                                >
                                    <option value="">Select property type</option>
                                    <option value="Room">Room</option>
                                    <option value="Apartment">Apartment</option>
                                    <option value="House">House</option>
                                </select>
                            </div>
                        </div>
                        <div className="card-actions justify-end mt-6">
                            {editing && (
                                <button type="button" className="btn btn-ghost" onClick={handleCancel}>
                                    Cancel
                                </button>
                            )}
                            <button type="submit" className="btn btn-primary">
                                {editing ? 'Update Property' : 'Add Property'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-bold mb-4">Properties</h2>
                {properties.length === 0 ? (
                    <div className="card bg-base-100 shadow-xl">
                        <div className="card-body">
                            <p>No properties yet. Add your first property above.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {properties.map((property) => (
                            <div key={property.id} className="card bg-base-100 shadow-xl">
                                <div className="card-body">
                                    <h3 className="card-title">{property.name}</h3>
                                    <div className="space-y-2">
                                        <p><span className="font-semibold">Address:</span> {property.address}</p>
                                        <p><span className="font-semibold">Type:</span> {property.property_type}</p>
                                        <p><span className="font-semibold">House Area:</span> {property.house_area ? `${property.house_area} m²` : 'Not specified'}</p>
                                        <div className="mb-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-semibold">Tenants:</span>
                                                <span className={`text-sm font-medium ${
                                                    property.capacity_status === 'at_capacity' ? 'text-error' :
                                                    property.capacity_status === 'near_capacity' ? 'text-warning' :
                                                    property.capacity_status === 'unlimited' ? 'text-info' : 'text-success'
                                                }`}>
                                                    {property.number_of_tenants === null ? 
                                                        `${property.current_tenant_count || 0} (Unlimited)` :
                                                        `${property.current_tenant_count || 0}/${property.number_of_tenants}`
                                                    }
                                                </span>
                                            </div>
                                            {property.number_of_tenants !== null && (
                                                <div className="w-full bg-base-300 rounded-full h-2">
                                                    <div 
                                                        className={`h-2 rounded-full transition-all duration-300 ${
                                                            property.capacity_status === 'at_capacity' ? 'bg-error' :
                                                            property.capacity_status === 'near_capacity' ? 'bg-warning' : 'bg-success'
                                                        }`}
                                                        style={{ 
                                                            width: `${Math.min(100, ((property.current_tenant_count || 0) / property.number_of_tenants) * 100)}%` 
                                                        }}
                                                    ></div>
                                                </div>
                                            )}
                                            <div className="text-xs mt-1">
                                                <span className={`badge badge-sm ${
                                                    property.capacity_status === 'at_capacity' ? 'badge-error' :
                                                    property.capacity_status === 'near_capacity' ? 'badge-warning' :
                                                    property.capacity_status === 'unlimited' ? 'badge-info' : 'badge-success'
                                                }`}>
                                                    {property.capacity_status === 'at_capacity' ? 'At Capacity' :
                                                     property.capacity_status === 'near_capacity' ? 'Near Capacity' :
                                                     property.capacity_status === 'unlimited' ? 'Unlimited' : 'Available'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="card-actions justify-end mt-4">
                                        <div className="tooltip" data-tip="Edit property details">
                                            <button 
                                                className="btn btn-sm btn-outline" 
                                                onClick={() => handleEdit(property)}
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        <div className="tooltip" data-tip="Delete property and all data">
                                            <button 
                                                className="btn btn-sm btn-error" 
                                                onClick={() => setDeleteModal(property)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Delete Confirmation Modal */}
            {deleteModal && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg">Confirm Delete</h3>
                        <p className="py-4">
                            Are you sure you want to delete property <strong>{deleteModal.name}</strong>? 
                            This will also delete all associated tenants and utilities. This action cannot be undone.
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
                                onClick={() => handleDelete(deleteModal.id)}
                            >
                                Delete Property
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}