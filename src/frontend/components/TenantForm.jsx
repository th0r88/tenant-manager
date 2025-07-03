import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

export default function TenantForm({ onSubmit, initialData = {}, onCancel, selectedProperty }) {
    const { t } = useTranslation();
    const [capacityWarning, setCapacityWarning] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        address: '',
        emso: '',
        tax_number: '',
        rent_amount: '',
        lease_duration: '',
        room_area: '',
        number_of_people: 1,
        move_in_date: new Date().toISOString().split('T')[0],
        move_out_date: '',
        occupancy_status: 'active'
    });

    useEffect(() => {
        if (initialData && initialData.id) {
            setFormData({
                ...initialData,
                move_in_date: initialData.move_in_date || new Date().toISOString().split('T')[0],
                move_out_date: initialData.move_out_date || '',
                number_of_people: initialData.number_of_people || 1,
                occupancy_status: initialData.occupancy_status || 'active'
            });
        } else {
            setFormData({
                name: '',
                surname: '',
                address: '',
                emso: '',
                tax_number: '',
                rent_amount: '',
                lease_duration: '',
                room_area: '',
                number_of_people: 1,
                move_in_date: new Date().toISOString().split('T')[0],
                move_out_date: '',
                occupancy_status: 'active'
            });
        }
    }, [initialData]);

    useEffect(() => {
        if (selectedProperty && !initialData?.id) {
            checkCapacity();
        }
    }, [selectedProperty, initialData]);

    const validateEMSO = (emso) => {
        if (!emso || emso.trim() === '') return null;
        
        // Remove any spaces or non-digits
        const cleanEmso = emso.replace(/\D/g, '');
        
        // Only validate length if user has entered some digits and seems to be done typing
        if (cleanEmso.length > 0 && cleanEmso.length < 13) {
            if (cleanEmso.length < 7) {
                // Don't show error until they've entered at least some meaningful digits
                return null;
            }
            return 'EMŠO mora imeti točno 13 številk';
        }
        
        // EMŠO must be exactly 13 digits
        if (cleanEmso.length !== 13) {
            return 'EMŠO mora imeti točno 13 številk';
        }
        
        // Check if first 7 digits represent a valid date (DDMMYYY)
        const day = parseInt(cleanEmso.substring(0, 2));
        const month = parseInt(cleanEmso.substring(2, 4));
        const year = parseInt(cleanEmso.substring(4, 7));
        
        // Basic date validation
        if (day < 1 || day > 31 || month < 1 || month > 12) {
            return 'EMŠO vsebuje neveljaven datum rojstva';
        }
        
        // Calculate checksum using EMŠO algorithm
        const digits = cleanEmso.split('').map(Number);
        const weights = [7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
        
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            sum += digits[i] * weights[i];
        }
        
        const remainder = sum % 11;
        let checkDigit;
        
        if (remainder === 0) {
            checkDigit = 0;
        } else if (remainder === 1) {
            checkDigit = 1;
        } else {
            checkDigit = 11 - remainder;
        }
        
        // Special case: if calculated check digit is 10, EMŠO is invalid
        if (checkDigit === 10) {
            return 'EMŠO ima napačno kontrolno števko';
        }
        
        if (digits[12] !== checkDigit) {
            return `EMŠO ima napačno kontrolno števko (pričakovana: ${checkDigit}, podana: ${digits[12]})`;
        }
        
        return null;
    };

    const validateDates = () => {
        const moveIn = new Date(formData.move_in_date);
        const moveOut = formData.move_out_date ? new Date(formData.move_out_date) : null;
        
        if (moveOut && moveIn >= moveOut) {
            return t('tenants.validation.moveOutAfterMoveIn');
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (moveIn > today && !initialData?.id) {
            return t('tenants.validation.moveInNotFuture');
        }
        
        return null;
    };

    const checkCapacity = () => {
        if (!selectedProperty) {
            setCapacityWarning('');
            return;
        }

        const currentCount = selectedProperty.current_tenant_count || 0;
        const maxCapacity = selectedProperty.number_of_tenants;

        if (maxCapacity === null) {
            setCapacityWarning('');
            return;
        }

        if (currentCount >= maxCapacity) {
            setCapacityWarning(t('tenants.capacity.atCapacity', { current: currentCount, max: maxCapacity }));
        } else if (currentCount / maxCapacity > 0.8) {
            setCapacityWarning(t('tenants.capacity.nearCapacity', { current: currentCount, max: maxCapacity, remaining: maxCapacity - currentCount }));
        } else {
            setCapacityWarning('');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const submissionData = {
            ...formData,
            property_id: selectedProperty?.id || 1,
            move_out_date: formData.move_out_date || null
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
                room_area: '',
                number_of_people: 1,
                move_in_date: new Date().toISOString().split('T')[0],
                move_out_date: '',
                occupancy_status: 'active'
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
            room_area: '',
            number_of_people: 1,
            move_in_date: new Date().toISOString().split('T')[0],
            move_out_date: '',
            occupancy_status: 'active'
        });
    };

    return (
        <div className="card bg-base-100 shadow-xl mb-6">
            <div className="card-body">
                <h2 className="card-title">{initialData?.id ? t('tenants.editTenant') : t('tenants.addTenant')}</h2>
                
                {selectedProperty && (
                    <div className="mb-4 p-3 bg-base-200 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold">{t('tenants.capacity.selectedProperty')}</span>
                            <span className="text-sm">{selectedProperty.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">{t('tenants.capacity.capacity')}</span>
                            <span className={`text-sm font-medium ${
                                selectedProperty.capacity_status === 'at_capacity' ? 'text-error' :
                                selectedProperty.capacity_status === 'near_capacity' ? 'text-warning' :
                                selectedProperty.capacity_status === 'unlimited' ? 'text-info' : 'text-success'
                            }`}>
                                {selectedProperty.number_of_tenants === null ? 
                                    `${selectedProperty.current_tenant_count || 0} ${t('tenants.capacity.unlimited')}` :
                                    `${selectedProperty.current_tenant_count || 0}/${selectedProperty.number_of_tenants}`
                                }
                            </span>
                        </div>
                        {selectedProperty.number_of_tenants !== null && (
                            <div className="w-full bg-base-300 rounded-full h-2 mt-2">
                                <div 
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                        selectedProperty.capacity_status === 'at_capacity' ? 'bg-error' :
                                        selectedProperty.capacity_status === 'near_capacity' ? 'bg-warning' : 'bg-success'
                                    }`}
                                    style={{ 
                                        width: `${Math.min(100, ((selectedProperty.current_tenant_count || 0) / selectedProperty.number_of_tenants) * 100)}%` 
                                    }}
                                ></div>
                            </div>
                        )}
                    </div>
                )}
                
                {capacityWarning && (
                    <div className={`alert mb-4 ${
                        selectedProperty?.capacity_status === 'at_capacity' ? 'alert-error' : 'alert-warning'
                    }`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        {capacityWarning}
                    </div>
                )}
                
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-end">
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">{t('tenants.form.nameRequired')}</span>
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
                                <span className="label-text text-right">{t('tenants.form.surnameRequired')}</span>
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
                                <span className="label-text text-right">{t('tenants.form.addressRequired')}</span>
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
                                <span className="label-text text-right">{t('tenants.form.emsoRequired')}</span>
                            </label>
                            <input 
                                name="emso" 
                                value={formData.emso} 
                                onChange={handleChange} 
                                className={`input input-bordered w-full ${validateEMSO(formData.emso) ? 'input-error' : ''}`}
                                placeholder="0101970500111"
                                maxLength="13"
                                required 
                            />
                            {validateEMSO(formData.emso) && (
                                <label className="label">
                                    <span className="label-text-alt text-error">{validateEMSO(formData.emso)}</span>
                                </label>
                            )}
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">{t('tenants.form.taxNumberRequired')}</span>
                            </label>
                            <input 
                                name="tax_number" 
                                value={formData.tax_number} 
                                onChange={handleChange} 
                                className="input input-bordered w-full" 
                                required
                            />
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">{t('tenants.rentAmount')} (€) *</span>
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
                                <span className="label-text text-right">{t('tenants.form.numberOfPeopleRequired')}</span>
                            </label>
                            <input 
                                name="number_of_people" 
                                type="number" 
                                min="1"
                                max="10"
                                value={formData.number_of_people} 
                                onChange={handleChange} 
                                className="input input-bordered w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                required 
                            />
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">{t('tenants.form.leaseDurationRequired')}</span>
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
                                <span className="label-text text-right">{t('tenants.form.roomAreaRequired')}</span>
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
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">{t('tenants.form.moveInDateRequired')}</span>
                            </label>
                            <input 
                                name="move_in_date" 
                                type="date"
                                value={formData.move_in_date} 
                                onChange={handleChange} 
                                className="input input-bordered w-full" 
                                required 
                            />
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">{t('tenants.form.moveOutDateOptional')}</span>
                            </label>
                            <input 
                                name="move_out_date" 
                                type="date"
                                value={formData.move_out_date} 
                                onChange={handleChange} 
                                className="input input-bordered w-full" 
                            />
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">{t('tenants.form.occupancyStatusRequired')}</span>
                            </label>
                            <select
                                name="occupancy_status"
                                value={formData.occupancy_status}
                                onChange={handleChange}
                                className="select select-bordered w-full"
                                required
                            >
                                <option value="active">{t('tenants.occupancyStatuses.active')}</option>
                                <option value="pending">{t('tenants.occupancyStatuses.pending')}</option>
                                <option value="moved_out">{t('tenants.occupancyStatuses.moved_out')}</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* Date Validation Warning */}
                    {validateDates() && (
                        <div className="alert alert-warning mt-4">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            {validateDates()}
                        </div>
                    )}
                    
                    <div className="card-actions justify-end mt-6">
                        {initialData?.id && (
                            <button type="button" className="btn btn-ghost" onClick={handleCancel}>
                                {t('common.cancel')}
                            </button>
                        )}
                        <button 
                            type="submit" 
                            className="btn btn-primary"
                            disabled={
                                (!initialData?.id && selectedProperty?.capacity_status === 'at_capacity') ||
                                validateDates() !== null ||
                                validateEMSO(formData.emso) !== null
                            }
                        >
                            {initialData?.id ? t('tenants.form.updateTenant') : t('tenants.form.addTenant')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}