import Decimal from 'decimal.js';

/**
 * Precision Mathematics Utility
 * Handles all financial calculations with decimal precision to avoid floating-point errors
 */

// Configure Decimal.js for financial calculations
Decimal.set({
    precision: 28,          // High precision for calculations
    rounding: Decimal.ROUND_HALF_UP,  // Standard financial rounding
    toExpNeg: -7,          // Use exponential notation for very small numbers
    toExpPos: 21,          // Use exponential notation for very large numbers
    modulo: Decimal.ROUND_FLOOR,
    crypto: false          // Don't use crypto for performance
});

export class PrecisionMath {
    constructor() {
        this.ZERO = new Decimal(0);
        this.ONE = new Decimal(1);
        this.HUNDRED = new Decimal(100);
    }

    /**
     * Create a new Decimal from various input types
     */
    decimal(value) {
        if (value === null || value === undefined || value === '') {
            return this.ZERO;
        }
        
        try {
            return new Decimal(value);
        } catch (error) {
            throw new Error(`Invalid numeric value: ${value}`);
        }
    }

    /**
     * Safely add numbers with precision
     */
    add(...values) {
        return values.reduce((sum, value) => {
            return sum.plus(this.decimal(value));
        }, this.ZERO);
    }

    /**
     * Safely subtract numbers with precision
     */
    subtract(a, b) {
        return this.decimal(a).minus(this.decimal(b));
    }

    /**
     * Safely multiply numbers with precision
     */
    multiply(...values) {
        return values.reduce((product, value) => {
            return product.times(this.decimal(value));
        }, this.ONE);
    }

    /**
     * Safely divide numbers with precision
     */
    divide(dividend, divisor) {
        const divisorDecimal = this.decimal(divisor);
        
        if (divisorDecimal.isZero()) {
            throw new Error('Division by zero');
        }
        
        return this.decimal(dividend).dividedBy(divisorDecimal);
    }

    /**
     * Calculate percentage of a value
     */
    percentage(value, percent) {
        return this.multiply(value, percent).dividedBy(this.HUNDRED);
    }

    /**
     * Round to specified decimal places (default 2 for currency)
     */
    round(value, decimalPlaces = 2) {
        return this.decimal(value).toDecimalPlaces(decimalPlaces);
    }

    /**
     * Round to currency precision (2 decimal places)
     */
    toCurrency(value) {
        return this.round(value, 2);
    }

    /**
     * Convert to number for database storage (use with caution)
     */
    toNumber(value) {
        return this.decimal(value).toNumber();
    }

    /**
     * Convert to string for display
     */
    toString(value, decimalPlaces = 2) {
        return this.round(value, decimalPlaces).toString();
    }

    /**
     * Check if value is zero
     */
    isZero(value) {
        return this.decimal(value).isZero();
    }

    /**
     * Check if value is positive
     */
    isPositive(value) {
        return this.decimal(value).isPositive();
    }

    /**
     * Check if value is negative
     */
    isNegative(value) {
        return this.decimal(value).isNegative();
    }

    /**
     * Compare two values (-1: a < b, 0: a = b, 1: a > b)
     */
    compare(a, b) {
        return this.decimal(a).comparedTo(this.decimal(b));
    }

    /**
     * Get the absolute value
     */
    abs(value) {
        return this.decimal(value).abs();
    }

    /**
     * Financial calculation: compound interest
     */
    compoundInterest(principal, rate, periods) {
        const rateDecimal = this.divide(rate, 100);
        const onePlusRate = this.add(1, rateDecimal);
        return this.multiply(principal, this.power(onePlusRate, periods));
    }

    /**
     * Power function (for compound calculations)
     */
    power(base, exponent) {
        return this.decimal(base).pow(this.decimal(exponent));
    }

    /**
     * Calculate proportional allocation
     * Distributes total amount based on allocation ratios
     */
    proportionalAllocation(totalAmount, allocations) {
        const total = this.decimal(totalAmount);
        const allocationSum = this.add(...Object.values(allocations));
        
        if (this.isZero(allocationSum)) {
            throw new Error('Total allocation cannot be zero');
        }

        const result = {};
        let distributedSum = this.ZERO;
        const keys = Object.keys(allocations);
        
        // Calculate proportional amounts
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const allocation = this.decimal(allocations[key]);
            
            if (i === keys.length - 1) {
                // Last item gets the remainder to ensure exact total
                result[key] = this.toCurrency(total.minus(distributedSum));
            } else {
                const proportional = this.divide(this.multiply(total, allocation), allocationSum);
                const rounded = this.toCurrency(proportional);
                result[key] = rounded;
                distributedSum = distributedSum.plus(rounded);
            }
        }
        
        return result;
    }

    /**
     * Calculate utility cost allocation per person
     */
    allocateUtilityPerPerson(totalCost, tenantCount) {
        if (tenantCount <= 0) {
            throw new Error('Tenant count must be positive');
        }
        
        const costPerPerson = this.divide(totalCost, tenantCount);
        return this.toCurrency(costPerPerson);
    }

    /**
     * Calculate utility cost allocation per square meter
     */
    allocateUtilityPerArea(totalCost, tenantAreas) {
        const totalArea = this.add(...tenantAreas);
        
        if (this.isZero(totalArea)) {
            throw new Error('Total area cannot be zero');
        }
        
        return tenantAreas.map(area => {
            const proportion = this.divide(area, totalArea);
            const allocation = this.multiply(totalCost, proportion);
            return this.toCurrency(allocation);
        });
    }

    /**
     * Calculate monthly rent with prorated periods
     */
    calculateProratedRent(monthlyRent, daysInMonth, daysOccupied) {
        if (daysInMonth <= 0 || daysOccupied < 0) {
            throw new Error('Invalid day counts');
        }
        
        if (daysOccupied >= daysInMonth) {
            return this.toCurrency(monthlyRent);
        }
        
        const dailyRate = this.divide(monthlyRent, daysInMonth);
        const proratedAmount = this.multiply(dailyRate, daysOccupied);
        return this.toCurrency(proratedAmount);
    }

    /**
     * Validate currency amount
     */
    validateCurrency(amount, allowZero = true) {
        const decimal = this.decimal(amount);
        
        if (!allowZero && this.isZero(decimal)) {
            throw new Error('Amount cannot be zero');
        }
        
        if (this.isNegative(decimal)) {
            throw new Error('Amount cannot be negative');
        }
        
        // Check for reasonable currency limits (up to 1 million)
        const maxAmount = new Decimal(1000000);
        if (decimal.greaterThan(maxAmount)) {
            throw new Error('Amount exceeds maximum limit');
        }
        
        return decimal;
    }

    /**
     * Format currency for display
     */
    formatCurrency(amount, currency = 'EUR') {
        const decimal = this.toCurrency(amount);
        
        switch (currency) {
            case 'EUR':
                return `€${decimal.toString()}`;
            case 'USD':
                return `$${decimal.toString()}`;
            default:
                return `${decimal.toString()} ${currency}`;
        }
    }

    /**
     * Calculate tax amount
     */
    calculateTax(amount, taxRate) {
        const taxAmount = this.percentage(amount, taxRate);
        return this.toCurrency(taxAmount);
    }

    /**
     * Calculate amount with tax included
     */
    addTax(amount, taxRate) {
        const tax = this.calculateTax(amount, taxRate);
        return this.toCurrency(this.add(amount, tax));
    }

    /**
     * Calculate amount without tax (reverse calculation)
     */
    removeTax(amountWithTax, taxRate) {
        const divisor = this.add(100, taxRate).dividedBy(100);
        const amountWithoutTax = this.divide(amountWithTax, divisor);
        return this.toCurrency(amountWithoutTax);
    }
}

// Export singleton instance
export default new PrecisionMath();