import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

export default function UtilityForm({ onSubmit, initialData = {}, onCancel, selectedProperty }) {
    const { t, getMonthNames, getUtilityTypes } = useTranslation();
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
                <h2 className="card-title">{initialData?.id ? t('utilities.editUtility') : t('utilities.addUtilityCost')}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text">{t('common.month')} *</span>
                            </label>
                            <select 
                                name="month" 
                                value={formData.month} 
                                onChange={handleChange} 
                                className="select select-bordered w-full" 
                                required
                            >
                                {getMonthNames().map((monthName, i) => (
                                    <option key={i + 1} value={i + 1}>
                                        {monthName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text">{t('common.year')} *</span>
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
                                <span className="label-text">{t('utilities.utilityType')} *</span>
                            </label>
                            <select 
                                name="utility_type" 
                                value={formData.utility_type} 
                                onChange={handleChange} 
                                className="select select-bordered w-full" 
                                required
                            >
                                <option value="">{t('forms.selectUtilityType')}</option>
                                {getUtilityTypes().map(({ key, label }) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text">{t('utilities.totalAmount')} (€) *</span>
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
                                <span className="label-text">{t('utilities.allocationMethod')} *</span>
                            </label>
                            <select 
                                name="allocation_method" 
                                value={formData.allocation_method} 
                                onChange={handleChange} 
                                className="select select-bordered w-full" 
                                required
                            >
                                <option value="per_person">{t('utilities.perPerson')}</option>
                                <option value="per_square_meter">{t('utilities.perSquareMeter')}</option>
                            </select>
                        </div>
                    </div>
                    <div className="card-actions justify-end mt-6">
                        {initialData?.id && (
                            <button type="button" className="btn btn-ghost" onClick={onCancel}>
                                {t('common.cancel')}
                            </button>
                        )}
                        <button type="submit" className="btn btn-primary">
                            {initialData?.id ? t('utilities.updateUtility') : t('utilities.addUtility')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}