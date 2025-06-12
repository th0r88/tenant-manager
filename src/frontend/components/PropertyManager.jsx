import React, { useState } from 'react';
import { propertyApi } from '../services/api';

export default function PropertyManager({ properties, onPropertyChange, onError, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        property_type: ''
    });
    const [editing, setEditing] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
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
            setFormData({ name: '', address: '', property_type: '' });
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
            property_type: property.property_type
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
        setFormData({ name: '', address: '', property_type: '' });
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
                                    className="input input-bordered"
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
                                    className="input input-bordered"
                                    required
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
                                    className="select select-bordered"
                                    required
                                >
                                    <option value="">Select property type</option>
                                    <option value="Apartment Building">Apartment Building</option>
                                    <option value="Office Building">Office Building</option>
                                    <option value="Commercial Space">Commercial Space</option>
                                    <option value="Mixed Use">Mixed Use</option>
                                    <option value="Single Family">Single Family</option>
                                    <option value="Other">Other</option>
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
                                        <p><span className="font-semibold">Created:</span> {new Date(property.created_at).toLocaleDateString()}</p>
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