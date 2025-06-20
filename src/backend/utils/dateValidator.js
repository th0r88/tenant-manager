/**
 * Comprehensive date validation and handling utility
 * Handles edge cases, leap years, month boundaries, and timezone issues
 */

export class DateValidator {
    constructor() {
        this.monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        this.monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    }

    /**
     * Validate date with comprehensive checks
     */
    validateDate(dateValue, options = {}) {
        const result = {
            isValid: false,
            errors: [],
            normalized: null,
            details: null
        };

        // Handle different input types
        let date;
        try {
            if (dateValue instanceof Date) {
                date = new Date(dateValue);
            } else if (typeof dateValue === 'string') {
                // Handle YYYY-MM-DD format specifically
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                    const [year, month, day] = dateValue.split('-').map(Number);
                    date = new Date(year, month - 1, day); // Month is 0-indexed in JS
                } else {
                    date = new Date(dateValue);
                }
            } else if (typeof dateValue === 'number') {
                date = new Date(dateValue);
            } else {
                result.errors.push('Invalid date format');
                return result;
            }
        } catch (error) {
            result.errors.push('Unable to parse date');
            return result;
        }

        // Check if date is valid
        if (isNaN(date.getTime())) {
            result.errors.push('Invalid date value');
            return result;
        }

        // Validate date components
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // Convert back to 1-indexed
        const day = date.getDate();

        // Year validation
        const currentYear = new Date().getFullYear();
        const minYear = options.minYear || 1900;
        const maxYear = options.maxYear || currentYear + 10;

        if (year < minYear || year > maxYear) {
            result.errors.push(`Year must be between ${minYear} and ${maxYear}`);
        }

        // Month validation
        if (month < 1 || month > 12) {
            result.errors.push('Month must be between 1 and 12');
        }

        // Day validation with leap year consideration
        const maxDaysInMonth = this.getDaysInMonth(month, year);
        if (day < 1 || day > maxDaysInMonth) {
            result.errors.push(`Day must be between 1 and ${maxDaysInMonth} for ${this.monthNames[month - 1]} ${year}`);
        }

        // Business logic validations
        if (options.allowFuture === false) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (date > today) {
                result.errors.push('Date cannot be in the future');
            }
        }

        if (options.allowPast === false) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (date < today) {
                result.errors.push('Date cannot be in the past');
            }
        }

        if (options.minDate) {
            const minDate = new Date(options.minDate);
            if (date < minDate) {
                result.errors.push(`Date must be after ${this.formatDate(minDate)}`);
            }
        }

        if (options.maxDate) {
            const maxDate = new Date(options.maxDate);
            if (date > maxDate) {
                result.errors.push(`Date must be before ${this.formatDate(maxDate)}`);
            }
        }

        // Set result
        result.isValid = result.errors.length === 0;
        
        if (result.isValid) {
            result.normalized = this.normalizeDate(date);
            result.details = {
                year,
                month,
                day,
                dayOfWeek: date.getDay(),
                dayOfYear: this.getDayOfYear(date),
                weekOfYear: this.getWeekOfYear(date),
                isLeapYear: this.isLeapYear(year),
                quarterOfYear: Math.ceil(month / 3),
                formatted: {
                    iso: this.formatISO(date),
                    european: this.formatEuropean(date),
                    american: this.formatAmerican(date),
                    slovenian: this.formatSlovenian(date)
                }
            };
        }

        return result;
    }

    /**
     * Validate date range
     */
    validateDateRange(startDate, endDate, options = {}) {
        const result = {
            isValid: false,
            errors: [],
            duration: null
        };

        const startValidation = this.validateDate(startDate, options.startOptions);
        const endValidation = this.validateDate(endDate, options.endOptions);

        if (!startValidation.isValid) {
            result.errors.push(...startValidation.errors.map(err => `Start date: ${err}`));
        }

        if (!endValidation.isValid) {
            result.errors.push(...endValidation.errors.map(err => `End date: ${err}`));
        }

        if (startValidation.isValid && endValidation.isValid) {
            const start = startValidation.normalized;
            const end = endValidation.normalized;

            if (start >= end) {
                result.errors.push('End date must be after start date');
            } else {
                result.duration = this.calculateDuration(start, end);
            }
        }

        result.isValid = result.errors.length === 0;
        return result;
    }

    /**
     * Check if year is leap year
     */
    isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    /**
     * Get number of days in a month
     */
    getDaysInMonth(month, year) {
        if (month === 2 && this.isLeapYear(year)) {
            return 29;
        }
        return this.monthDays[month - 1];
    }

    /**
     * Get day of year (1-366)
     */
    getDayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 1);
        const diff = date - start;
        return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    }

    /**
     * Get week of year (1-53)
     */
    getWeekOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date - start) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + start.getDay() + 1) / 7);
    }

    /**
     * Normalize date to remove time component
     */
    normalizeDate(date) {
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        return normalized;
    }

    /**
     * Calculate duration between dates
     */
    calculateDuration(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = end - start;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return {
            days: diffDays,
            weeks: Math.floor(diffDays / 7),
            months: this.getMonthsDifference(start, end),
            years: Math.floor(diffDays / 365.25)
        };
    }

    /**
     * Calculate months difference accounting for different month lengths
     */
    getMonthsDifference(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        let months = (end.getFullYear() - start.getFullYear()) * 12;
        months += end.getMonth() - start.getMonth();
        
        // Adjust for day differences
        if (end.getDate() < start.getDate()) {
            months--;
        }
        
        return months;
    }

    /**
     * Format date in ISO format (YYYY-MM-DD)
     */
    formatISO(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * Format date in European format (DD.MM.YYYY)
     */
    formatEuropean(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    /**
     * Format date in American format (MM/DD/YYYY)
     */
    formatAmerican(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    }

    /**
     * Format date in Slovenian format (D. M. YYYY)
     */
    formatSlovenian(date) {
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        return `${day}. ${month}. ${year}`;
    }

    /**
     * Format date for display
     */
    formatDate(date, format = 'iso') {
        switch (format) {
            case 'european':
                return this.formatEuropean(date);
            case 'american':
                return this.formatAmerican(date);
            case 'slovenian':
                return this.formatSlovenian(date);
            default:
                return this.formatISO(date);
        }
    }

    /**
     * Get occupancy days for a tenant in a specific month
     */
    getOccupancyDays(moveInDate, moveOutDate, year, month) {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0); // Last day of month
        
        const occupancyStart = moveInDate > monthStart ? moveInDate : monthStart;
        const occupancyEnd = (moveOutDate && moveOutDate < monthEnd) ? moveOutDate : monthEnd;
        
        if (occupancyStart > occupancyEnd) {
            return 0;
        }
        
        const diffTime = occupancyEnd - occupancyStart;
        return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    /**
     * Validate billing period (month/year combination)
     */
    validateBillingPeriod(month, year) {
        const result = {
            isValid: false,
            errors: [],
            details: null
        };

        // Validate month
        if (!Number.isInteger(month) || month < 1 || month > 12) {
            result.errors.push('Month must be an integer between 1 and 12');
        }

        // Validate year
        const currentYear = new Date().getFullYear();
        if (!Number.isInteger(year) || year < 2000 || year > currentYear + 5) {
            result.errors.push(`Year must be an integer between 2000 and ${currentYear + 5}`);
        }

        // Check if billing period is in the future (warning, not error)
        const billingDate = new Date(year, month - 1, 1);
        const today = new Date();
        const isFuture = billingDate > today;

        result.isValid = result.errors.length === 0;
        
        if (result.isValid) {
            result.details = {
                month,
                year,
                monthName: this.monthNames[month - 1],
                daysInMonth: this.getDaysInMonth(month, year),
                isLeapYear: this.isLeapYear(year),
                isFuture,
                periodStart: new Date(year, month - 1, 1),
                periodEnd: new Date(year, month, 0),
                formatted: `${this.monthNames[month - 1]} ${year}`
            };
        }

        return result;
    }

    /**
     * Get date boundaries for safe database queries
     */
    getDateBoundaries(date) {
        const normalized = this.normalizeDate(date);
        return {
            start: new Date(normalized),
            end: new Date(normalized.getTime() + 24 * 60 * 60 * 1000 - 1) // End of day
        };
    }

    /**
     * Check if two dates are the same day
     */
    isSameDay(date1, date2) {
        const d1 = this.normalizeDate(date1);
        const d2 = this.normalizeDate(date2);
        return d1.getTime() === d2.getTime();
    }

    /**
     * Add safe date arithmetic
     */
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    addMonths(date, months) {
        const result = new Date(date);
        result.setMonth(result.getMonth() + months);
        return result;
    }

    addYears(date, years) {
        const result = new Date(date);
        result.setFullYear(result.getFullYear() + years);
        return result;
    }
}

// Export singleton instance
export default new DateValidator();