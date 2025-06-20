/**
 * Test file for validation utilities
 * Run with: npm test src/backend/tests/validation.test.js
 */

import { describe, it, expect } from 'vitest';
import emsoValidator from '../utils/emsoValidator.js';
import precisionMath from '../utils/precisionMath.js';
import dateValidator from '../utils/dateValidator.js';
import validator from '../middleware/validationMiddleware.js';

describe('EMŠO Validation', () => {
    it('should validate correct EMŠO', () => {
        // Valid EMŠO with correct checksum
        const validEmso = '1505006500006';
        const result = emsoValidator.validate(validEmso);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.details).toBeDefined();
    });

    it('should reject invalid EMŠO format', () => {
        const invalidEmso = '123456789012';
        const result = emsoValidator.validate(invalidEmso);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject EMŠO with wrong checksum', () => {
        const wrongChecksum = '1505006500007';
        const result = emsoValidator.validate(wrongChecksum);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid checksum digit');
    });
});

describe('Precision Math', () => {
    it('should handle decimal arithmetic correctly', () => {
        const result = precisionMath.add(0.1, 0.2);
        expect(precisionMath.toString(result)).toBe('0.30');
    });

    it('should allocate utility costs per person correctly', () => {
        const totalCost = 100;
        const tenantCount = 3;
        const perPerson = precisionMath.allocateUtilityPerPerson(totalCost, tenantCount);
        
        expect(precisionMath.toString(perPerson)).toBe('33.33');
    });

    it('should allocate utility costs per area correctly', () => {
        const totalCost = 300;
        const areas = [20, 30, 50]; // Total: 100m²
        const allocations = precisionMath.allocateUtilityPerArea(totalCost, areas);
        
        expect(precisionMath.toString(allocations[0])).toBe('60.00'); // 20% of 300
        expect(precisionMath.toString(allocations[1])).toBe('90.00'); // 30% of 300
        expect(precisionMath.toString(allocations[2])).toBe('150.00'); // 50% of 300
    });

    it('should validate currency amounts', () => {
        expect(() => precisionMath.validateCurrency(100)).not.toThrow();
        expect(() => precisionMath.validateCurrency(-50)).toThrow('Amount cannot be negative');
        expect(() => precisionMath.validateCurrency(0, false)).toThrow('Amount cannot be zero');
    });
});

describe('Date Validation', () => {
    it('should validate correct dates', () => {
        const date = '2024-01-15';
        const result = dateValidator.validateDate(date);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should detect leap year correctly', () => {
        expect(dateValidator.isLeapYear(2024)).toBe(true);
        expect(dateValidator.isLeapYear(2023)).toBe(false);
        expect(dateValidator.isLeapYear(2000)).toBe(true);
        expect(dateValidator.isLeapYear(1900)).toBe(false);
    });

    it('should validate date ranges correctly', () => {
        const startDate = '2024-01-01';
        const endDate = '2024-01-31';
        const result = dateValidator.validateDateRange(startDate, endDate);
        
        expect(result.isValid).toBe(true);
        expect(result.duration.days).toBe(30);
    });

    it('should reject invalid date ranges', () => {
        const startDate = '2024-01-31';
        const endDate = '2024-01-01';
        const result = dateValidator.validateDateRange(startDate, endDate);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('End date must be after start date');
    });

    it('should calculate occupancy days correctly', () => {
        const moveIn = new Date('2024-01-15');
        const moveOut = new Date('2024-01-25');
        const days = dateValidator.getOccupancyDays(moveIn, moveOut, 2024, 1);
        
        expect(days).toBe(11); // 15th to 25th inclusive
    });
});

describe('Validation Middleware', () => {
    it('should validate tenant data correctly', () => {
        const validTenant = {
            property_id: 1,
            name: 'Janez',
            surname: 'Novak',
            address: 'Trubarjeva 1, Ljubljana',
            emso: '1505006500006',
            tax_number: 'SI12345678',
            rent_amount: 500,
            lease_duration: 12,
            room_area: 25,
            move_in_date: '2024-01-01',
            occupancy_status: 'active'
        };

        const nameValidation = validator.validateValue(validTenant.name, {
            required: true,
            type: 'string',
            minLength: 2,
            maxLength: 50
        });

        expect(nameValidation.isValid).toBe(true);
    });

    it('should reject invalid tenant data', () => {
        const invalidName = validator.validateValue('', {
            required: true,
            type: 'string',
            minLength: 2
        });

        expect(invalidName.isValid).toBe(false);
        expect(invalidName.errors[0].code).toBe('REQUIRED');
    });

    it('should validate currency amounts', () => {
        const validAmount = validator.validateValue(500, {
            type: 'currency',
            min: 1,
            max: 50000
        });

        expect(validAmount.isValid).toBe(true);

        const invalidAmount = validator.validateValue(-100, {
            type: 'currency',
            min: 1
        });

        expect(invalidAmount.isValid).toBe(false);
    });
});

describe('Financial Calculation Precision', () => {
    it('should maintain precision in complex calculations', () => {
        // Test scenario: Utility cost of €123.45 split among 3 tenants
        const totalCost = 123.45;
        const tenantCount = 3;
        
        const allocations = [];
        for (let i = 0; i < tenantCount; i++) {
            allocations.push(precisionMath.allocateUtilityPerPerson(totalCost, tenantCount));
        }
        
        const totalAllocated = precisionMath.add(...allocations);
        expect(precisionMath.toString(totalAllocated)).toBe('123.45');
    });

    it('should handle proportional allocation correctly', () => {
        const totalAmount = 1000;
        const allocations = { tenant1: 40, tenant2: 35, tenant3: 25 }; // Percentages
        
        const result = precisionMath.proportionalAllocation(totalAmount, allocations);
        const total = precisionMath.add(...Object.values(result));
        
        expect(precisionMath.toString(total)).toBe('1000.00');
    });
});