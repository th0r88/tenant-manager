import React, { useState, useEffect } from 'react';

export default function TenantForm({ onSubmit, initialData = {}, onCancel, selectedProperty }) {
    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        address: '',
        emso: '',
        tax_number: '',
        rent_amount: '',
        lease_duration: '',
        room_area: ''
    });

    useEffect(() => {
        if (initialData && initialData.id) {
            setFormData(initialData);
        } else {
            setFormData({
                name: '',
                surname: '',
                address: '',
                emso: '',
                tax_number: '',
                rent_amount: '',
                lease_duration: '',
                room_area: ''
            });
        }
    }, [initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const submissionData = {
            ...formData,
            property_id: selectedProperty?.id || 1
        };
        onSubmit(submissionData);
        if (!initialData?.id) {
            setFormData({
                name: '',
                surname: '',
                address: '',
                emso: '',
                tax_number: '',
                rent_amount: '',
                lease_duration: '',
                room_area: ''
            });
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCancel = () => {
        if (onCancel) onCancel();
        setFormData({
            name: '',
            surname: '',
            address: '',
            emso: '',
            tax_number: '',
            rent_amount: '',
            lease_duration: '',
            room_area: ''
        });
    };

    return (
        <div className="card bg-base-100 shadow-xl mb-6">
            <div className="card-body">
                <h2 className="card-title">{initialData?.id ? 'Edit Tenant' : 'Add New Tenant'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-end">
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">Name *</span>
                            </label>
                            <input 
                                name="name" 
                                value={formData.name} 
                                onChange={handleChange} 
                                className="input input-bordered w-full" 
                                required 
                            />
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">Surname *</span>
                            </label>
                            <input 
                                name="surname" 
                                value={formData.surname} 
                                onChange={handleChange} 
                                className="input input-bordered w-full" 
                                required 
                            />
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">Address *</span>
                            </label>
                            <input 
                                name="address" 
                                value={formData.address} 
                                onChange={handleChange} 
                                className="input input-bordered w-full" 
                                required 
                            />
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">EMŠO *</span>
                            </label>
                            <input 
                                name="emso" 
                                value={formData.emso} 
                                onChange={handleChange} 
                                className="input input-bordered w-full" 
                                required 
                            />
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">Tax Number</span>
                            </label>
                            <input 
                                name="tax_number" 
                                value={formData.tax_number} 
                                onChange={handleChange} 
                                className="input input-bordered w-full" 
                            />
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">Rent Amount (€) *</span>
                            </label>
                            <input 
                                name="rent_amount" 
                                type="number" 
                                step="any" 
                                value={formData.rent_amount} 
                                onChange={handleChange} 
                                className="input input-bordered w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                required 
                            />
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">Lease Duration (months) *</span>
                            </label>
                            <input 
                                name="lease_duration" 
                                type="number" 
                                value={formData.lease_duration} 
                                onChange={handleChange} 
                                className="input input-bordered w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                required 
                            />
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">Room Area (m²) *</span>
                            </label>
                            <input 
                                name="room_area" 
                                type="number" 
                                step="any" 
                                value={formData.room_area} 
                                onChange={handleChange} 
                                className="input input-bordered w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                required 
                            />
                        </div>
                    </div>
                    <div className="card-actions justify-end mt-6">
                        {initialData?.id && (
                            <button type="button" className="btn btn-ghost" onClick={handleCancel}>
                                Cancel
                            </button>
                        )}
                        <button type="submit" className="btn btn-primary">
                            {initialData?.id ? 'Update Tenant' : 'Add Tenant'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}