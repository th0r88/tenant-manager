import { describe, it, expect } from 'vitest';
import emsoValidator from '../../utils/emsoValidator.js';

describe('EmsoValidator', () => {
  // Pre-computed valid EMŠOs (verified checksums)
  // 0101000500012: born 01.01.2000, region 50 (Slovenia), serial 001, male
  const validEmso = '0101000500012';
  // 0101000505006: born 01.01.2000, region 50 (Slovenia), serial 500, female
  const femaleEmso = '0101000505006';

  describe('validate()', () => {
    it('valid EMŠO passes and returns correct details', () => {
      const result = emsoValidator.validate(validEmso);
      expect(result.isValid).toBe(true);
      expect(result.details).not.toBeNull();
      expect(result.details.region).toBe('50');
      expect(result.details.regionCountry).toBe('Slovenia');
      expect(result.details.day).toBe(1);
      expect(result.details.month).toBe(1);
    });

    it('wrong checksum fails', () => {
      // Change last digit
      const badEmso = '0101000500013';
      const result = emsoValidator.validate(badEmso);
      expect(result.isValid).toBe(false);
    });

    it('wrong length fails', () => {
      const result = emsoValidator.validate('12345');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/13 digits/);
    });

    it('non-digits fail', () => {
      const result = emsoValidator.validate('01019905000AB');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/only digits/);
    });

    it('invalid month fails', () => {
      // Month 13 — will always fail regardless of checksum
      const result = emsoValidator.validate('0113000500012');
      expect(result.isValid).toBe(false);
    });

    it('null/undefined/non-string fails', () => {
      expect(emsoValidator.validate(null).isValid).toBe(false);
      expect(emsoValidator.validate(undefined).isValid).toBe(false);
      expect(emsoValidator.validate(12345).isValid).toBe(false);
    });
  });

  describe('Region codes', () => {
    it('50-59 is Slovenia', () => {
      const result = emsoValidator.validate(validEmso);
      expect(result.isValid).toBe(true);
      expect(result.details.regionCountry).toBe('Slovenia');
    });

    it('region 65 (60-69 range) is rejected', () => {
      // Any EMŠO with region 65 should fail region validation
      const result = emsoValidator.validate('0101000650012');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Gender extraction', () => {
    it('serial 000-499 = male (M)', () => {
      expect(emsoValidator.extractGender(validEmso)).toBe('M');
    });

    it('serial 500-999 = female (F)', () => {
      expect(emsoValidator.extractGender(femaleEmso)).toBe('F');
    });
  });

  describe('isValid() shortcut', () => {
    it('returns true for valid EMŠO', () => {
      expect(emsoValidator.isValid(validEmso)).toBe(true);
    });

    it('returns false for invalid EMŠO', () => {
      expect(emsoValidator.isValid('0000000000000')).toBe(false);
    });
  });

  describe('calculateAge()', () => {
    it('returns a reasonable age', () => {
      const age = emsoValidator.calculateAge(validEmso);
      // Born 2000, so age should be around 26
      expect(age).toBeGreaterThan(20);
      expect(age).toBeLessThan(40);
    });

    it('throws for invalid EMŠO', () => {
      expect(() => emsoValidator.calculateAge('invalid')).toThrow();
    });
  });
});
