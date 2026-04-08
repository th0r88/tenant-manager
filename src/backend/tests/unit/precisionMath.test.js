import { describe, it, expect } from 'vitest';
import precisionMath, { PrecisionMath } from '../../utils/precisionMath.js';

describe('PrecisionMath', () => {
  describe('decimal()', () => {
    it('returns ZERO for null, undefined, empty string', () => {
      expect(precisionMath.decimal(null).toNumber()).toBe(0);
      expect(precisionMath.decimal(undefined).toNumber()).toBe(0);
      expect(precisionMath.decimal('').toNumber()).toBe(0);
    });

    it('throws for invalid values', () => {
      expect(() => precisionMath.decimal('abc')).toThrow('Invalid numeric value');
    });
  });

  describe('Basic arithmetic', () => {
    it('add(0.1, 0.2) === 0.3', () => {
      expect(precisionMath.add(0.1, 0.2).toNumber()).toBe(0.3);
    });

    it('multiply(19.99, 3) === 59.97', () => {
      expect(precisionMath.multiply(19.99, 3).toNumber()).toBe(59.97);
    });

    it('divide(100, 3) preserves precision', () => {
      const result = precisionMath.divide(100, 3);
      // Should not lose precision like native JS
      expect(result.toFixed(10)).toBe('33.3333333333');
    });

    it('subtract works correctly', () => {
      expect(precisionMath.subtract(100, 33.33).toNumber()).toBe(66.67);
    });
  });

  describe('Division by zero', () => {
    it('throws on division by zero', () => {
      expect(() => precisionMath.divide(100, 0)).toThrow('Division by zero');
    });
  });

  describe('toCurrency / rounding', () => {
    it('toCurrency(33.335) = 33.34 (ROUND_HALF_UP)', () => {
      expect(precisionMath.toCurrency(33.335).toNumber()).toBe(33.34);
    });

    it('toCurrency(33.334) = 33.33', () => {
      expect(precisionMath.toCurrency(33.334).toNumber()).toBe(33.33);
    });

    it('round to custom decimal places', () => {
      expect(precisionMath.round(3.14159, 3).toNumber()).toBe(3.142);
    });
  });

  describe('proportionalAllocation', () => {
    it('allocates 100 among 3 equal keys — sum === 100.00 exactly', () => {
      const result = precisionMath.proportionalAllocation(100, { a: 1, b: 1, c: 1 });
      const sum = Object.values(result).reduce((s, v) => s + v.toNumber(), 0);
      expect(sum).toBe(100);
    });

    it('single key gets full amount', () => {
      const result = precisionMath.proportionalAllocation(250, { only: 1 });
      expect(result.only.toNumber()).toBe(250);
    });

    it('throws when total allocation is zero', () => {
      expect(() => precisionMath.proportionalAllocation(100, { a: 0, b: 0 }))
        .toThrow('Total allocation cannot be zero');
    });

    it('weighted allocation distributes correctly', () => {
      const result = precisionMath.proportionalAllocation(100, { a: 1, b: 3 });
      expect(result.a.toNumber()).toBe(25);
      expect(result.b.toNumber()).toBe(75);
    });
  });

  describe('allocateUtilityPerPerson', () => {
    it('divides 100 among 3 tenants', () => {
      const result = precisionMath.allocateUtilityPerPerson(100, 3);
      expect(result.toNumber()).toBe(33.33);
    });

    it('throws for zero tenant count', () => {
      expect(() => precisionMath.allocateUtilityPerPerson(100, 0))
        .toThrow('Tenant count must be positive');
    });

    it('zero cost returns 0', () => {
      expect(precisionMath.allocateUtilityPerPerson(0, 5).toNumber()).toBe(0);
    });
  });

  describe('allocateUtilityPerArea', () => {
    it('allocates 300 by areas [20, 30, 50]', () => {
      const result = precisionMath.allocateUtilityPerArea(300, [20, 30, 50]);
      expect(result.map(r => r.toNumber())).toEqual([60, 90, 150]);
    });

    it('throws when total area is zero', () => {
      expect(() => precisionMath.allocateUtilityPerArea(300, [0, 0]))
        .toThrow('Total area cannot be zero');
    });
  });

  describe('calculateProratedRent', () => {
    it('full month returns full rent', () => {
      expect(precisionMath.calculateProratedRent(1000, 31, 31).toNumber()).toBe(1000);
    });

    it('partial month prorates correctly', () => {
      // 15 out of 30 days = half rent
      expect(precisionMath.calculateProratedRent(900, 30, 15).toNumber()).toBe(450);
    });

    it('zero occupied days returns zero', () => {
      expect(precisionMath.calculateProratedRent(1000, 31, 0).toNumber()).toBe(0);
    });

    it('throws for invalid day counts', () => {
      expect(() => precisionMath.calculateProratedRent(1000, 0, 5)).toThrow('Invalid day counts');
      expect(() => precisionMath.calculateProratedRent(1000, 30, -1)).toThrow('Invalid day counts');
    });
  });

  describe('Tax calculations', () => {
    it('calculateTax(100, 22) = 22', () => {
      expect(precisionMath.calculateTax(100, 22).toNumber()).toBe(22);
    });

    it('addTax(100, 22) = 122', () => {
      expect(precisionMath.addTax(100, 22).toNumber()).toBe(122);
    });

    it('removeTax(122, 22) = 100', () => {
      expect(precisionMath.removeTax(122, 22).toNumber()).toBe(100);
    });
  });

  describe('Comparison and utility methods', () => {
    it('isZero', () => {
      expect(precisionMath.isZero(0)).toBe(true);
      expect(precisionMath.isZero(1)).toBe(false);
    });

    it('isPositive / isNegative', () => {
      expect(precisionMath.isPositive(5)).toBe(true);
      expect(precisionMath.isNegative(-5)).toBe(true);
    });

    it('compare', () => {
      expect(precisionMath.compare(10, 5)).toBe(1);
      expect(precisionMath.compare(5, 10)).toBe(-1);
      expect(precisionMath.compare(5, 5)).toBe(0);
    });

    it('abs', () => {
      expect(precisionMath.abs(-42).toNumber()).toBe(42);
    });
  });

  describe('validateCurrency', () => {
    it('rejects negative amounts', () => {
      expect(() => precisionMath.validateCurrency(-10)).toThrow('cannot be negative');
    });

    it('rejects zero when not allowed', () => {
      expect(() => precisionMath.validateCurrency(0, false)).toThrow('cannot be zero');
    });

    it('rejects amounts over 1M', () => {
      expect(() => precisionMath.validateCurrency(1000001)).toThrow('exceeds maximum');
    });

    it('accepts valid amounts', () => {
      expect(precisionMath.validateCurrency(500).toNumber()).toBe(500);
    });
  });

  describe('formatCurrency', () => {
    it('EUR format', () => {
      expect(precisionMath.formatCurrency(123.45, 'EUR')).toBe('€123.45');
    });

    it('USD format', () => {
      expect(precisionMath.formatCurrency(123.45, 'USD')).toBe('$123.45');
    });

    it('other currency', () => {
      expect(precisionMath.formatCurrency(123.45, 'GBP')).toBe('123.45 GBP');
    });
  });
});
