import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

export default function UtilityForm({ onSubmit, initialData = {}, onCancel, selectedProperty, onUtilityAdded, properties = [], tenants = [] }) {
    const { t, getMonthNames, getUtilityTypes } = useTranslation();
    
    // Helper function to get previous month
    const getPreviousMonth = () => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;
        
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = currentYear - 1;
        }
        
        return { month: prevMonth, year: prevYear };
    };
    
    const [formData, setFormData] = useState(() => {
        const { month, year } = getPreviousMonth();
        return {
            month,
            year,
            utility_type: '',
            total_amount: '',
            allocation_method: 'per_person'
        };
    });
    const [isShared, setIsShared] = useState(false);
    const [sharedPropertyIds, setSharedPropertyIds] = useState([]);

    useEffect(() => {
        if (initialData && initialData.id) {
            setFormData(initialData);
            if (initialData.shared_property_ids && initialData.shared_property_ids.length > 0) {
                setIsShared(true);
                setSharedPropertyIds(initialData.shared_property_ids.map(Number));
            } else {
                setIsShared(false);
                setSharedPropertyIds([]);
            }
        } else {
            const { month, year } = getPreviousMonth();
            setFormData({
                month,
                year,
                utility_type: '',
                total_amount: '',
                allocation_method: 'per_person'
            });
            setIsShared(false);
            setSharedPropertyIds([]);
        }
    }, [initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const submittedData = {
            ...formData,
            month: parseInt(formData.month),
            year: parseInt(formData.year),
            total_amount: parseFloat(formData.total_amount),
            property_id: selectedProperty?.id || 1
        };

        if (isShared && sharedPropertyIds.length > 0) {
            submittedData.shared_property_ids = sharedPropertyIds;
        }

        if (formData.allocation_method === 'direct' && formData.assigned_tenant_id) {
            submittedData.assigned_tenant_id = parseInt(formData.assigned_tenant_id);
        }
        
        onSubmit(submittedData);
        
        // Notify parent about the added utility for filter update
        if (!initialData?.id && onUtilityAdded) {
            onUtilityAdded(submittedData);
        }
        
        // Keep the same month and year, reset other fields
        if (!initialData?.id) {
            setFormData({
                month: formData.month, // Keep selected month
                year: formData.year,   // Keep selected year
                utility_type: '',
                total_amount: '',
                allocation_method: 'per_person'
            });
            setIsShared(false);
            setSharedPropertyIds([]);
        }
    };

    const handleChange = (e) => {
        const updates = { [e.target.name]: e.target.value };
        if (e.target.name === 'allocation_method' && e.target.value !== 'direct') {
            updates.assigned_tenant_id = '';
        }
        if (e.target.name === 'utility_type') {
            if (e.target.value !== 'electricity' && formData.allocation_method === 'direct') {
                updates.allocation_method = 'per_person';
                updates.assigned_tenant_id = '';
            }
            if (e.target.value !== 'waste' && formData.allocation_method === 'per_apartment') {
                updates.allocation_method = 'per_person';
            }
        }
        setFormData({ ...formData, ...updates });
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
                                <option value="per_sqm">{t('utilities.perSquareMeter')}</option>
                                {formData.utility_type === 'electricity' && (
                                    <option value="direct">{t('utilities.directAssignment')}</option>
                                )}
                                {formData.utility_type === 'waste' && (
                                    <option value="per_apartment">{t('utilities.perApartment')}</option>
                                )}
                            </select>
                        </div>
                        {formData.allocation_method === 'direct' && (
                            <div className="form-control w-full">
                                <label className="label">
                                    <span className="label-text">{t('utilities.assignToTenant')} *</span>
                                </label>
                                <select
                                    name="assigned_tenant_id"
                                    value={formData.assigned_tenant_id || ''}
                                    onChange={handleChange}
                                    className="select select-bordered w-full"
                                    required
                                >
                                    <option value="">{t('utilities.selectTenant')}</option>
                                    {tenants.map(tenant => (
                                        <option key={tenant.id} value={tenant.id}>
                                            {tenant.name} {tenant.surname}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    {properties.length > 1 && (
                        <div className="mt-4">
                            <div className="form-control">
                                <label className="label cursor-pointer justify-start gap-3">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary"
                                        checked={isShared}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setIsShared(checked);
                                            if (checked) {
                                                // Pre-select current property
                                                setSharedPropertyIds([selectedProperty?.id].filter(Boolean));
                                            } else {
                                                setSharedPropertyIds([]);
                                            }
                                        }}
                                    />
                                    <span className="label-text font-semibold">{t('utilities.sharedUtility')}</span>
                                </label>
                            </div>
                            {isShared && (
                                <div className="ml-10 mt-2 space-y-1">
                                    <p className="text-sm opacity-70 mb-2">{t('utilities.selectProperties')}</p>
                                    {properties.map(prop => {
                                        const isCurrentProperty = prop.id === selectedProperty?.id;
                                        const isChecked = sharedPropertyIds.includes(prop.id);
                                        return (
                                            <label key={prop.id} className="label cursor-pointer justify-start gap-3 py-1">
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-sm"
                                                    checked={isChecked || isCurrentProperty}
                                                    disabled={isCurrentProperty}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSharedPropertyIds([...sharedPropertyIds, prop.id]);
                                                        } else {
                                                            setSharedPropertyIds(sharedPropertyIds.filter(id => id !== prop.id));
                                                        }
                                                    }}
                                                />
                                                <span className="label-text">{prop.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
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