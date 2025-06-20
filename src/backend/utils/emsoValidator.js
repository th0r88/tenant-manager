/**
 * EMŠO (Enotna Matična Številka Občana) Validator
 * Slovenian Unique Master Citizen Number validation with checksum verification
 * 
 * Format: DDMMYYY50XXXC
 * - DD: Day (01-31)
 * - MM: Month (01-12) 
 * - YYY: Year (last 3 digits, 000-999)
 * - 50: Region code (50 for Slovenia)
 * - XXX: Serial number (000-999)
 * - C: Checksum digit (0-9)
 */

export class EmsoValidator {
    constructor() {
        // Checksum weights for positions 1-12
        this.weights = [7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    }

    /**
     * Validates EMŠO format and checksum
     * @param {string} emso - The EMŠO number to validate
     * @returns {Object} Validation result with isValid flag and details
     */
    validate(emso) {
        const result = {
            isValid: false,
            errors: [],
            details: null
        };

        // Basic format validation
        if (!emso || typeof emso !== 'string') {
            result.errors.push('EMŠO must be a string');
            return result;
        }

        // Remove any spaces or separators
        const cleanEmso = emso.replace(/[\s-]/g, '');

        // Length check
        if (cleanEmso.length !== 13) {
            result.errors.push('EMŠO must be exactly 13 digits');
            return result;
        }

        // Digit check
        if (!/^\d{13}$/.test(cleanEmso)) {
            result.errors.push('EMŠO must contain only digits');
            return result;
        }

        // Parse components
        const day = parseInt(cleanEmso.substring(0, 2));
        const month = parseInt(cleanEmso.substring(2, 4));
        const year = parseInt(cleanEmso.substring(4, 7));
        const region = cleanEmso.substring(7, 9);
        const serial = cleanEmso.substring(9, 12);
        const checksum = parseInt(cleanEmso.substring(12, 13));

        // Validate date components
        const dateValidation = this.validateDateComponents(day, month, year);
        if (!dateValidation.isValid) {
            result.errors.push(...dateValidation.errors);
        }

        // Validate region code
        if (region !== '50') {
            result.errors.push('Invalid region code (must be 50 for Slovenia)');
        }

        // Validate checksum
        const checksumValidation = this.validateChecksum(cleanEmso);
        if (!checksumValidation.isValid) {
            result.errors.push('Invalid checksum digit');
        }

        // Set final result
        result.isValid = result.errors.length === 0;
        
        if (result.isValid) {
            result.details = {
                birthDate: this.constructBirthDate(day, month, year),
                day,
                month,
                year: this.getFullYear(year),
                region,
                serial,
                checksum,
                formatted: this.formatEmso(cleanEmso)
            };
        }

        return result;
    }

    /**
     * Validates date components
     */
    validateDateComponents(day, month, year) {
        const result = { isValid: true, errors: [] };

        // Month validation
        if (month < 1 || month > 12) {
            result.isValid = false;
            result.errors.push('Invalid month (must be 01-12)');
        }

        // Day validation
        if (day < 1 || day > 31) {
            result.isValid = false;
            result.errors.push('Invalid day (must be 01-31)');
        }

        // More precise day validation based on month
        if (result.isValid) {
            const fullYear = this.getFullYear(year);
            const date = new Date(fullYear, month - 1, day);
            
            if (date.getDate() !== day || 
                date.getMonth() !== month - 1 || 
                date.getFullYear() !== fullYear) {
                result.isValid = false;
                result.errors.push('Invalid date combination');
            }
        }

        return result;
    }

    /**
     * Validates checksum using the official algorithm
     */
    validateChecksum(emso) {
        let sum = 0;
        
        // Calculate weighted sum for first 12 digits
        for (let i = 0; i < 12; i++) {
            sum += parseInt(emso[i]) * this.weights[i];
        }

        // Calculate checksum
        const remainder = sum % 11;
        let expectedChecksum;
        
        if (remainder === 0) {
            expectedChecksum = 0;
        } else if (remainder === 1) {
            // Special case: if remainder is 1, EMŠO is invalid
            return { isValid: false };
        } else {
            expectedChecksum = 11 - remainder;
        }

        const actualChecksum = parseInt(emso[12]);
        
        return {
            isValid: expectedChecksum === actualChecksum,
            expected: expectedChecksum,
            actual: actualChecksum
        };
    }

    /**
     * Constructs full year from 3-digit year
     */
    getFullYear(year) {
        const currentYear = new Date().getFullYear();
        const currentCentury = Math.floor(currentYear / 100) * 100;
        
        // Assume years 000-030 are in current century, others in previous
        if (year <= 30) {
            return currentCentury + year;
        } else {
            return currentCentury - 100 + year;
        }
    }

    /**
     * Constructs birth date from components
     */
    constructBirthDate(day, month, year) {
        const fullYear = this.getFullYear(year);
        return new Date(fullYear, month - 1, day);
    }

    /**
     * Formats EMŠO with separators for display
     */
    formatEmso(emso) {
        return `${emso.substring(0, 2)}.${emso.substring(2, 4)}.${emso.substring(4, 7)}.${emso.substring(7, 9)}.${emso.substring(9, 12)}.${emso.substring(12)}`;
    }

    /**
     * Calculates age from EMŠO
     */
    calculateAge(emso) {
        const validation = this.validate(emso);
        if (!validation.isValid) {
            throw new Error('Invalid EMŠO');
        }

        const birthDate = validation.details.birthDate;
        const today = new Date();
        
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }

    /**
     * Quick validation for API usage
     */
    isValid(emso) {
        return this.validate(emso).isValid;
    }

    /**
     * Extract gender from EMŠO (based on serial number)
     * Serial numbers 000-499 are typically male, 500-999 female
     */
    extractGender(emso) {
        const validation = this.validate(emso);
        if (!validation.isValid) {
            throw new Error('Invalid EMŠO');
        }

        const serial = parseInt(validation.details.serial);
        return serial < 500 ? 'M' : 'F';
    }
}

// Export singleton instance
export default new EmsoValidator();