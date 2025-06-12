import React, { useState, useEffect } from 'react';

export default function UtilityForm({ onSubmit, initialData = {}, onCancel, selectedProperty }) {
    const [formData, setFormData] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        utility_type: '',
        total_amount: '',
        allocation_method: 'per_person'
    });

    useEffect(() => {
        if (initialData && initialData.id) {
            setFormData(initialData);
        } else {
            setFormData({
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                utility_type: '',
                total_amount: '',
                allocation_method: 'per_person'
            });
        }
    }, [initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            month: parseInt(formData.month),
            year: parseInt(formData.year),
            total_amount: parseFloat(formData.total_amount),
            property_id: selectedProperty?.id || 1
        });
        setFormData({
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            utility_type: '',
            total_amount: '',
            allocation_method: 'per_person'
        });
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="card bg-base-100 shadow-xl mb-6">
            <div className="card-body">
                <h2 className="card-title">{initialData?.id ? 'Edit Utility Cost' : 'Add Utility Cost'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text">Month *</span>
                            </label>
                            <select 
                                name="month" 
                                value={formData.month} 
                                onChange={handleChange} 
                                className="select select-bordered w-full" 
                                required
                            >
                                {[...Array(12)].map((_, i) => (
                                    <option key={i + 1} value={i + 1}>
                                        {new Date(0, i).toLocaleString('default', { month: 'long' })}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text">Year *</span>
                            </label>
                            <select 
                                name="year" 
                                value={formData.year} 
                                onChange={handleChange} 
                                className="select select-bordered w-full" 
                                required
                            >
                                {Array.from({ length: 26 }, (_, i) => 2025 + i).map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text">Utility Type *</span>
                            </label>
                            <select 
                                name="utility_type" 
                                value={formData.utility_type} 
                                onChange={handleChange} 
                                className="select select-bordered w-full" 
                                required
                            >
                                <option value="">Select utility type</option>
                                <option value="Elektrika">Elektrika</option>
                                <option value="Voda">Voda</option>
                                <option value="Ogrevanje">Ogrevanje</option>
                                <option value="Internet">Internet</option>
                                <option value="TV + RTV prispevek">TV + RTV prispevek</option>
                                <option value="Snaga">Snaga</option>
                                <option value="Ostalo">Ostalo</option>
                            </select>
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text">Total Amount (€) *</span>
                            </label>
                            <input 
                                name="total_amount" 
                                type="number" 
                                step="any" 
                                value={formData.total_amount} 
                                onChange={handleChange} 
                                className="input input-bordered w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                required 
                            />
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text">Allocation Method *</span>
                            </label>
                            <select 
                                name="allocation_method" 
                                value={formData.allocation_method} 
                                onChange={handleChange} 
                                className="select select-bordered w-full" 
                                required
                            >
                                <option value="per_person">Per Person</option>
                                <option value="per_sqm">Per Square Meter</option>
                            </select>
                        </div>
                    </div>
                    <div className="card-actions justify-end mt-6">
                        {initialData?.id && (
                            <button type="button" className="btn btn-ghost" onClick={onCancel}>
                                Cancel
                            </button>
                        )}
                        <button type="submit" className="btn btn-primary">
                            {initialData?.id ? 'Update Utility' : 'Add Utility'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}