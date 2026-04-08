import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateShort,
  formatNumber,
  formatMonthYear,
  formatPercentage,
  normalizeLanguage,
} from '../../utils/formatters.js';

describe('Formatters', () => {
  describe('formatCurrency()', () => {
    it('Slovenian format: 123,45 €', () => {
      expect(formatCurrency(123.45, 'sl')).toBe('123,45 €');
    });

    it('English format: €123.45', () => {
      expect(formatCurrency(123.45, 'en')).toBe('€123.45');
    });

    it('zero', () => {
      expect(formatCurrency(0, 'sl')).toBe('0,00 €');
      expect(formatCurrency(0, 'en')).toBe('€0.00');
    });

    it('negative number', () => {
      expect(formatCurrency(-50, 'sl')).toBe('-50,00 €');
    });

    it('large number', () => {
      expect(formatCurrency(1234567.89, 'en')).toBe('€1234567.89');
    });

    it('defaults to Slovenian', () => {
      expect(formatCurrency(10)).toBe('10,00 €');
    });
  });

  describe('formatDate()', () => {
    const date = new Date(2024, 5, 15); // June 15, 2024

    it('Slovenian format: DD. M. YYYY', () => {
      const result = formatDate(date, 'sl');
      expect(result).toBe('15. 6. 2024');
    });

    it('English format contains month name', () => {
      const result = formatDate(date, 'en');
      expect(result).toContain('June');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('accepts string dates', () => {
      const result = formatDate('2024-06-15', 'sl');
      expect(result).toContain('2024');
    });
  });

  describe('formatDateShort()', () => {
    const date = new Date(2024, 5, 5); // June 5, 2024

    it('Slovenian short: DD.MM.YYYY', () => {
      expect(formatDateShort(date, 'sl')).toBe('05.06.2024');
    });

    it('English short: MM/DD/YYYY', () => {
      const result = formatDateShort(date, 'en');
      expect(result).toContain('06');
      expect(result).toContain('05');
      expect(result).toContain('2024');
    });
  });

  describe('formatNumber()', () => {
    it('Slovenian uses comma', () => {
      expect(formatNumber(123.45, 'sl')).toBe('123,45');
    });

    it('English uses period', () => {
      expect(formatNumber(123.45, 'en')).toBe('123.45');
    });
  });

  describe('formatMonthYear()', () => {
    it('Slovenian: month/year', () => {
      expect(formatMonthYear(6, 2024, 'sl')).toBe('6/2024');
    });

    it('English: month name year', () => {
      expect(formatMonthYear(6, 2024, 'en')).toBe('June 2024');
    });
  });

  describe('formatPercentage()', () => {
    it('Slovenian format', () => {
      expect(formatPercentage(75.5, 'sl')).toBe('75,5 %');
    });

    it('English format', () => {
      expect(formatPercentage(75.5, 'en')).toBe('75.5%');
    });
  });

  describe('normalizeLanguage()', () => {
    it('sl stays sl', () => {
      expect(normalizeLanguage('sl')).toBe('sl');
    });

    it('en stays en', () => {
      expect(normalizeLanguage('en')).toBe('en');
    });

    it('unknown defaults to sl', () => {
      expect(normalizeLanguage('fr')).toBe('sl');
    });

    it('null defaults to sl', () => {
      expect(normalizeLanguage(null)).toBe('sl');
    });
  });
});
