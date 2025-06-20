import emsoValidator from '../utils/emsoValidator.js';
import precisionMath from '../utils/precisionMath.js';

/**
 * Comprehensive validation middleware for API endpoints
 * Provides schema-based validation with detailed error reporting
 */

export class ValidationMiddleware {
    constructor() {
        this.validationRules = {
            // Property validation rules
            property: {
                name: {
                    required: true,
                    type: 'string',
                    minLength: 2,
                    maxLength: 100,
                    sanitize: true
                },
                address: {
                    required: true,
                    type: 'string',
                    minLength: 5,
                    maxLength: 200,
                    sanitize: true
                },
                property_type: {
                    required: true,
                    type: 'string',
                    enum: ['Room', 'Apartment', 'House']
                },
                house_area: {
                    required: false,
                    type: 'number',
                    min: 1,
                    max: 10000,
                    precision: 2
                },
                number_of_tenants: {
                    required: false,
                    type: 'integer',
                    min: 1,
                    max: 100
                }
            },

            // Tenant validation rules
            tenant: {
                property_id: {
                    required: true,
                    type: 'integer',
                    min: 1
                },
                name: {
                    required: true,
                    type: 'string',
                    minLength: 2,
                    maxLength: 50,
                    pattern: /^[a-zA-ZšđčćžŠĐČĆŽ\s'-]+$/,
                    sanitize: true
                },
                surname: {
                    required: true,
                    type: 'string',
                    minLength: 2,
                    maxLength: 50,
                    pattern: /^[a-zA-ZšđčćžŠĐČĆŽ\s'-]+$/,
                    sanitize: true
                },
                address: {
                    required: true,
                    type: 'string',
                    minLength: 5,
                    maxLength: 200,
                    sanitize: true
                },
                emso: {
                    required: true,
                    type: 'string',
                    custom: 'emso'
                },
                tax_number: {
                    required: true,
                    type: 'string',
                    minLength: 8,
                    maxLength: 20,
                    pattern: /^[A-Z0-9]+$/,
                    sanitize: true
                },
                rent_amount: {
                    required: true,
                    type: 'currency',
                    min: 1,
                    max: 50000
                },
                lease_duration: {
                    required: true,
                    type: 'integer',
                    min: 1,
                    max: 120
                },
                room_area: {
                    required: true,
                    type: 'number',
                    min: 1,
                    max: 1000,
                    precision: 2
                },
                move_in_date: {
                    required: true,
                    type: 'date',
                    custom: 'move_in_date'
                },
                move_out_date: {
                    required: false,
                    type: 'date',
                    custom: 'move_out_date'
                },
                occupancy_status: {
                    required: true,
                    type: 'string',
                    enum: ['active', 'moved_out', 'pending']
                }
            },

            // Utility entry validation rules
            utility: {
                property_id: {
                    required: true,
                    type: 'integer',
                    min: 1
                },
                month: {
                    required: true,
                    type: 'integer',
                    min: 1,
                    max: 12
                },
                year: {
                    required: true,
                    type: 'integer',
                    min: 2000,
                    max: 2100
                },
                utility_type: {
                    required: true,
                    type: 'string',
                    enum: ['electricity', 'water', 'heating', 'internet', 'maintenance', 'gas', 'waste', 'cleaning']
                },
                total_amount: {
                    required: true,
                    type: 'currency',
                    min: 0.01,
                    max: 100000
                },
                allocation_method: {
                    required: true,
                    type: 'string',
                    enum: ['per_person', 'per_sqm', 'per_person_weighted', 'per_sqm_weighted']
                }
            }
        };
    }

    /**
     * Create validation middleware for specific entity type
     */
    validate(entityType, options = {}) {
        return (req, res, next) => {
            try {
                const rules = this.validationRules[entityType];
                if (!rules) {
                    throw new Error(`No validation rules found for entity type: ${entityType}`);
                }

                const data = req.body;
                const errors = [];
                const sanitizedData = {};

                // Validate each field
                for (const [fieldName, rule] of Object.entries(rules)) {
                    const value = data[fieldName];
                    const fieldErrors = this.validateField(fieldName, value, rule, data);
                    
                    if (fieldErrors.length > 0) {
                        errors.push(...fieldErrors);
                    } else if (value !== undefined) {
                        sanitizedData[fieldName] = this.sanitizeValue(value, rule);
                    }
                }

                // If validation fails, return errors
                if (errors.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: {
                            type: 'VALIDATION_ERROR',
                            message: 'Validation failed',
                            details: errors,
                            timestamp: new Date().toISOString()
                        }
                    });
                }

                // Replace body with sanitized data
                req.body = { ...data, ...sanitizedData };
                next();

            } catch (error) {
                next(error);
            }
        };
    }

    /**
     * Validate individual field
     */
    validateField(fieldName, value, rule, allData = {}) {
        const errors = [];

        // Check required fields
        if (rule.required && (value === undefined || value === null || value === '')) {
            errors.push({
                field: fieldName,
                code: 'REQUIRED',
                message: `${fieldName} is required`
            });
            return errors;
        }

        // Skip validation if value is not provided and not required
        if (!rule.required && (value === undefined || value === null || value === '')) {
            return errors;
        }

        // Type validation
        const typeError = this.validateType(fieldName, value, rule);
        if (typeError) {
            errors.push(typeError);
            return errors; // Don't continue if type is wrong
        }

        // Length validation for strings
        if (rule.type === 'string') {
            if (rule.minLength && value.length < rule.minLength) {
                errors.push({
                    field: fieldName,
                    code: 'MIN_LENGTH',
                    message: `${fieldName} must be at least ${rule.minLength} characters long`
                });
            }
            if (rule.maxLength && value.length > rule.maxLength) {
                errors.push({
                    field: fieldName,
                    code: 'MAX_LENGTH',
                    message: `${fieldName} must be no more than ${rule.maxLength} characters long`
                });
            }

            // Pattern validation
            if (rule.pattern && !rule.pattern.test(value)) {
                errors.push({
                    field: fieldName,
                    code: 'PATTERN',
                    message: `${fieldName} format is invalid`
                });
            }
        }

        // Numeric range validation
        if (rule.type === 'number' || rule.type === 'integer' || rule.type === 'currency') {
            const numValue = parseFloat(value);
            if (rule.min !== undefined && numValue < rule.min) {
                errors.push({
                    field: fieldName,
                    code: 'MIN_VALUE',
                    message: `${fieldName} must be at least ${rule.min}`
                });
            }
            if (rule.max !== undefined && numValue > rule.max) {
                errors.push({
                    field: fieldName,
                    code: 'MAX_VALUE',
                    message: `${fieldName} must be no more than ${rule.max}`
                });
            }
        }

        // Enum validation
        if (rule.enum && !rule.enum.includes(value)) {
            errors.push({
                field: fieldName,
                code: 'INVALID_ENUM',
                message: `${fieldName} must be one of: ${rule.enum.join(', ')}`
            });
        }

        // Custom validation
        if (rule.custom) {
            const customError = this.validateCustom(fieldName, value, rule.custom, allData);
            if (customError) {
                errors.push(customError);
            }
        }

        return errors;
    }

    /**
     * Validate data types
     */
    validateType(fieldName, value, rule) {
        switch (rule.type) {
            case 'string':
                if (typeof value !== 'string') {
                    return {
                        field: fieldName,
                        code: 'INVALID_TYPE',
                        message: `${fieldName} must be a string`
                    };
                }
                break;

            case 'number':
                if (typeof value !== 'number' && isNaN(parseFloat(value))) {
                    return {
                        field: fieldName,
                        code: 'INVALID_TYPE',
                        message: `${fieldName} must be a number`
                    };
                }
                break;

            case 'integer':
                if (!Number.isInteger(Number(value))) {
                    return {
                        field: fieldName,
                        code: 'INVALID_TYPE',
                        message: `${fieldName} must be an integer`
                    };
                }
                break;

            case 'currency':
                try {
                    precisionMath.validateCurrency(value);
                } catch (error) {
                    return {
                        field: fieldName,
                        code: 'INVALID_CURRENCY',
                        message: `${fieldName} must be a valid currency amount`
                    };
                }
                break;

            case 'date':
                if (!(value instanceof Date) && isNaN(Date.parse(value))) {
                    return {
                        field: fieldName,
                        code: 'INVALID_DATE',
                        message: `${fieldName} must be a valid date`
                    };
                }
                break;
        }

        return null;
    }

    /**
     * Custom validation functions
     */
    validateCustom(fieldName, value, customType, allData) {
        switch (customType) {
            case 'emso':
                const emsoValidation = emsoValidator.validate(value);
                if (!emsoValidation.isValid) {
                    return {
                        field: fieldName,
                        code: 'INVALID_EMSO',
                        message: `Invalid EMŠO: ${emsoValidation.errors.join(', ')}`
                    };
                }
                break;

            case 'move_in_date':
                const moveInDate = new Date(value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // Allow future dates for planning purposes, but warn if too far
                const oneYearFromNow = new Date();
                oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
                
                if (moveInDate > oneYearFromNow) {
                    return {
                        field: fieldName,
                        code: 'DATE_TOO_FAR',
                        message: 'Move-in date cannot be more than one year in the future'
                    };
                }
                break;

            case 'move_out_date':
                if (allData.move_in_date) {
                    const moveInDate = new Date(allData.move_in_date);
                    const moveOutDate = new Date(value);
                    
                    if (moveOutDate <= moveInDate) {
                        return {
                            field: fieldName,
                            code: 'INVALID_DATE_RANGE',
                            message: 'Move-out date must be after move-in date'
                        };
                    }
                }
                break;
        }

        return null;
    }

    /**
     * Sanitize values based on rules
     */
    sanitizeValue(value, rule) {
        if (rule.sanitize && typeof value === 'string') {
            // Basic string sanitization
            return value.trim()
                .replace(/\s+/g, ' ') // Normalize whitespace
                .replace(/[^\w\s\-''.,]/g, ''); // Remove special characters except basic punctuation
        }

        if (rule.type === 'currency') {
            return precisionMath.toNumber(precisionMath.toCurrency(value));
        }

        if (rule.type === 'number') {
            const num = parseFloat(value);
            return rule.precision ? 
                precisionMath.toNumber(precisionMath.round(num, rule.precision)) : 
                num;
        }

        return value;
    }

    /**
     * Quick validation for single values
     */
    validateValue(value, rules) {
        const errors = this.validateField('value', value, rules);
        return {
            isValid: errors.length === 0,
            errors: errors,
            sanitized: errors.length === 0 ? this.sanitizeValue(value, rules) : value
        };
    }
}

// Export middleware functions for common entities
const validator = new ValidationMiddleware();

export const validateProperty = validator.validate('property');
export const validateTenant = validator.validate('tenant');
export const validateUtility = validator.validate('utility');

export default validator;