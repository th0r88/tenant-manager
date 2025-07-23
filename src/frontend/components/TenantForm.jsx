import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

export default function TenantForm({ onSubmit, initialData = {}, onCancel, selectedProperty }) {
    const { t } = useTranslation();
    const [capacityWarning, setCapacityWarning] = useState('');
    const [validationErrors, setValidationErrors] = useState({});
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

    const validateField = (fieldName, value) => {
        const validationRules = {
            name: {
                required: true,
                minLength: 2,
                maxLength: 50,
                pattern: /^[a-zA-ZšđčćžŠĐČĆŽ\s'-]+$/,
                errorKey: 'name'
            },
            surname: {
                required: true,
                minLength: 2,
                maxLength: 50,
                pattern: /^[a-zA-ZšđčćžŠĐČĆŽ\s'-]+$/,
                errorKey: 'surname'
            },
            address: {
                required: true,
                minLength: 5,
                maxLength: 200,
                errorKey: 'address'
            },
            tax_number: {
                required: true,
                minLength: 8,
                maxLength: 20,
                pattern: /^[A-Z0-9]+$/,
                errorKey: 'tax_number'
            },
            rent_amount: {
                required: true,
                type: 'number',
                min: 0,
                max: 50000,
                errorKey: 'rent_amount'
            },
            lease_duration: {
                required: true,
                type: 'integer',
                min: 1,
                max: 999,
                errorKey: 'lease_duration'
            },
            room_area: {
                required: true,
                type: 'number',
                min: 1,
                max: 1000,
                errorKey: 'room_area'
            },
            number_of_people: {
                required: true,
                type: 'integer',
                min: 1,
                max: 10,
                errorKey: 'number_of_people'
            }
        };

        const rules = validationRules[fieldName];
        if (!rules) return null;

        // Required field check
        if (rules.required && (!value || value.toString().trim() === '')) {
            return t('tenants.validation.required', { field: t(`tenants.validation.fields.${rules.errorKey}`) });
        }

        // Skip other validations if field is empty and not required
        if (!value || value.toString().trim() === '') return null;

        // String length validations
        if (rules.minLength && value.length < rules.minLength) {
            return t('tenants.validation.minLength', { 
                field: t(`tenants.validation.fields.${rules.errorKey}`), 
                min: rules.minLength 
            });
        }
        if (rules.maxLength && value.length > rules.maxLength) {
            return t('tenants.validation.maxLength', { 
                field: t(`tenants.validation.fields.${rules.errorKey}`), 
                max: rules.maxLength 
            });
        }

        // Pattern validations
        if (rules.pattern && !rules.pattern.test(value)) {
            return t(`tenants.validation.pattern.${rules.errorKey}`);
        }

        // Number validations
        if (rules.type === 'number' || rules.type === 'integer') {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                return t('tenants.validation.invalidNumber', { field: t(`tenants.validation.fields.${rules.errorKey}`) });
            }
            if (rules.type === 'integer' && !Number.isInteger(numValue)) {
                return t('tenants.validation.mustBeInteger', { field: t(`tenants.validation.fields.${rules.errorKey}`) });
            }
            if (rules.min !== undefined && numValue < rules.min) {
                return t('tenants.validation.minValue', { 
                    field: t(`tenants.validation.fields.${rules.errorKey}`), 
                    min: rules.min 
                });
            }
            if (rules.max !== undefined && numValue > rules.max) {
                return t('tenants.validation.maxValue', { 
                    field: t(`tenants.validation.fields.${rules.errorKey}`), 
                    max: rules.max 
                });
            }
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
        
        // Allow move-in date up to 3 months in the future
        const maxFutureDate = new Date(today);
        maxFutureDate.setMonth(maxFutureDate.getMonth() + 3);
        
        if (moveIn > maxFutureDate && !initialData?.id) {
            return t('tenants.validation.moveInTooFarFuture');
        }
        
        return null;
    };

    const validateAllFields = () => {
        const errors = {};
        
        // Validate each field
        ['name', 'surname', 'address', 'tax_number', 'rent_amount', 'lease_duration', 'room_area', 'number_of_people'].forEach(field => {
            const error = validateField(field, formData[field]);
            if (error) {
                errors[field] = error;
            }
        });

        // Validate EMŠO
        const emsoError = validateEMSO(formData.emso);
        if (emsoError) {
            errors.emso = emsoError;
        }

        // Validate dates
        const dateError = validateDates();
        if (dateError) {
            errors.dates = dateError;
        }

        return errors;
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
        
        // Validate all fields before submission
        const errors = validateAllFields();
        setValidationErrors(errors);
        
        // If there are validation errors, don't submit
        if (Object.keys(errors).length > 0) {
            return;
        }
        
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
            setValidationErrors({});
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        
        // Clear validation error for this field when user starts typing
        if (validationErrors[name]) {
            setValidationErrors({ ...validationErrors, [name]: null });
        }
        
        // Real-time validation for immediate feedback
        const error = validateField(name, value);
        if (error) {
            setValidationErrors({ ...validationErrors, [name]: error });
        }
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
                                className={`input input-bordered w-full ${validationErrors.name ? 'input-error' : ''}`}
                                required 
                            />
                            {validationErrors.name && (
                                <label className="label">
                                    <span className="label-text-alt text-error">{validationErrors.name}</span>
                                </label>
                            )}
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">{t('tenants.form.surnameRequired')}</span>
                            </label>
                            <input 
                                name="surname" 
                                value={formData.surname} 
                                onChange={handleChange} 
                                className={`input input-bordered w-full ${validationErrors.surname ? 'input-error' : ''}`}
                                required 
                            />
                            {validationErrors.surname && (
                                <label className="label">
                                    <span className="label-text-alt text-error">{validationErrors.surname}</span>
                                </label>
                            )}
                        </div>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text text-right">{t('tenants.form.addressRequired')}</span>
                            </label>
                            <input 
                                name="address" 
                                value={formData.address} 
                                onChange={handleChange} 
                                className={`input input-bordered w-full ${validationErrors.address ? 'input-error' : ''}`}
                                required 
                            />
                            {validationErrors.address && (
                                <label className="label">
                                    <span className="label-text-alt text-error">{validationErrors.address}</span>
                                </label>
                            )}
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
                                className={`input input-bordered w-full ${validationErrors.tax_number ? 'input-error' : ''}`}
                                required
                            />
                            {validationErrors.tax_number && (
                                <label className="label">
                                    <span className="label-text-alt text-error">{validationErrors.tax_number}</span>
                                </label>
                            )}
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
                                className={`input input-bordered w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${validationErrors.rent_amount ? 'input-error' : ''}`}
                                required 
                            />
                            {validationErrors.rent_amount && (
                                <label className="label">
                                    <span className="label-text-alt text-error">{validationErrors.rent_amount}</span>
                                </label>
                            )}
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
                                className={`input input-bordered w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${validationErrors.number_of_people ? 'input-error' : ''}`}
                                required 
                            />
                            {validationErrors.number_of_people && (
                                <label className="label">
                                    <span className="label-text-alt text-error">{validationErrors.number_of_people}</span>
                                </label>
                            )}
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
                                className={`input input-bordered w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${validationErrors.lease_duration ? 'input-error' : ''}`}
                                required 
                            />
                            {validationErrors.lease_duration && (
                                <label className="label">
                                    <span className="label-text-alt text-error">{validationErrors.lease_duration}</span>
                                </label>
                            )}
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
                                className={`input input-bordered w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${validationErrors.room_area ? 'input-error' : ''}`}
                                required 
                            />
                            {validationErrors.room_area && (
                                <label className="label">
                                    <span className="label-text-alt text-error">{validationErrors.room_area}</span>
                                </label>
                            )}
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
                                validateEMSO(formData.emso) !== null ||
                                Object.values(validationErrors).some(error => error !== null && error !== undefined)
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