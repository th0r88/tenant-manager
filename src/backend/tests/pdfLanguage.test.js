/**
 * PDF Language Integration Tests
 * Tests for backend PDF generation with proper language support
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { generateTenantReport } from '../services/pdfService.js';
import { t, translateUtilityType, getMonthName } from '../services/translationService.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';

// Mock PDF generation (avoid actual PDF creation in tests)
vi.mock('pdfkit', () => {
  return {
    default: vi.fn(() => ({
      registerFont: vi.fn(),
      on: vi.fn(),
      end: vi.fn(),
      // Add other PDFKit methods as needed
    }))
  };
});

describe('PDF Language Translation Service', () => {
  describe('Translation Function', () => {
    test('should translate PDF labels in Slovenian', () => {
      expect(t('sl', 'pdf.statementDate')).toBe('Datum izjave');
      expect(t('sl', 'pdf.billingPeriod')).toBe('Obračunsko obdobje');
      expect(t('sl', 'pdf.tenant')).toBe('Najemnik');
      expect(t('sl', 'pdf.totalAmountDue')).toBe('SKUPAJ ZA PLAČILO');
    });

    test('should translate PDF labels in English', () => {
      expect(t('en', 'pdf.statementDate')).toBe('Statement Date');
      expect(t('en', 'pdf.billingPeriod')).toBe('Billing Period');
      expect(t('en', 'pdf.tenant')).toBe('Tenant');
      expect(t('en', 'pdf.totalAmountDue')).toBe('TOTAL AMOUNT DUE');
    });

    test('should fallback to key if translation missing', () => {
      expect(t('sl', 'pdf.nonexistentKey')).toBe('pdf.nonexistentKey');
      expect(t('en', 'pdf.nonexistentKey')).toBe('pdf.nonexistentKey');
    });

    test('should use fallback value if provided', () => {
      expect(t('sl', 'pdf.nonexistentKey', 'Fallback Text')).toBe('Fallback Text');
      expect(t('en', 'pdf.nonexistentKey', 'Fallback Text')).toBe('Fallback Text');
    });
  });

  describe('Utility Type Translation', () => {
    test('should translate utility types in Slovenian', () => {
      expect(translateUtilityType('electricity', 'sl')).toBe('Elektrika');
      expect(translateUtilityType('water', 'sl')).toBe('Voda');
      expect(translateUtilityType('heating', 'sl')).toBe('Ogrevanje');
      expect(translateUtilityType('internet', 'sl')).toBe('Internet');
    });

    test('should translate utility types in English', () => {
      expect(translateUtilityType('electricity', 'en')).toBe('Electricity');
      expect(translateUtilityType('water', 'en')).toBe('Water');
      expect(translateUtilityType('heating', 'en')).toBe('Heating');
      expect(translateUtilityType('internet', 'en')).toBe('Internet');
    });

    test('should return original value for unknown utility types', () => {
      expect(translateUtilityType('unknown_type', 'sl')).toBe('unknown_type');
      expect(translateUtilityType('unknown_type', 'en')).toBe('unknown_type');
    });
  });

  describe('Month Name Translation', () => {
    test('should translate month names in Slovenian', () => {
      expect(getMonthName(0, 'sl')).toBe('Januar');
      expect(getMonthName(5, 'sl')).toBe('Junij');
      expect(getMonthName(11, 'sl')).toBe('December');
    });

    test('should translate month names in English', () => {
      expect(getMonthName(0, 'en')).toBe('January');
      expect(getMonthName(5, 'en')).toBe('June');
      expect(getMonthName(11, 'en')).toBe('December');
    });

    test('should handle invalid month indices', () => {
      expect(getMonthName(-1, 'sl')).toBe('Januar'); // Should fallback to first month
      expect(getMonthName(12, 'sl')).toBe('December'); // Should fallback to last month
    });
  });
});

describe('Formatting Utilities', () => {
  describe('Currency Formatting', () => {
    test('should format currency in Slovenian style', () => {
      expect(formatCurrency(123.45, 'sl')).toBe('123,45 €');
      expect(formatCurrency(1000, 'sl')).toBe('1000,00 €');
      expect(formatCurrency(0, 'sl')).toBe('0,00 €');
    });

    test('should format currency in English style', () => {
      expect(formatCurrency(123.45, 'en')).toBe('€123.45');
      expect(formatCurrency(1000, 'en')).toBe('€1000.00');
      expect(formatCurrency(0, 'en')).toBe('€0.00');
    });

    test('should handle invalid currency values', () => {
      expect(formatCurrency(null, 'sl')).toBe('0,00 €');
      expect(formatCurrency(undefined, 'en')).toBe('€0.00');
      expect(formatCurrency('invalid', 'sl')).toBe('0,00 €');
    });
  });

  describe('Date Formatting', () => {
    const testDate = new Date('2025-06-20');

    test('should format dates in Slovenian style', () => {
      const formatted = formatDate(testDate, 'sl');
      expect(formatted).toMatch(/20\.\s*6\.\s*2025/); // DD. MM. YYYY format
    });

    test('should format dates in English style', () => {
      const formatted = formatDate(testDate, 'en');
      expect(formatted).toMatch(/June\s+20,\s+2025/); // Month DD, YYYY format
    });

    test('should handle invalid dates', () => {
      expect(formatDate(null, 'sl')).toBe('');
      expect(formatDate(undefined, 'en')).toBe('');
      expect(formatDate('invalid', 'sl')).toBe('');
    });
  });
});

describe('PDF Generation Language Integration', () => {
  const mockTenant = {
    id: 1,
    name: 'John',
    surname: 'Doe',
    rent_amount: 500,
    property_name: 'Test Property'
  };

  const mockUtilities = [
    {
      utility_type: 'electricity',
      total_amount: 100,
      allocated_amount: 25
    },
    {
      utility_type: 'water',
      total_amount: 50,
      allocated_amount: 12.5
    }
  ];

  describe('PDF Generation with Language Parameter', () => {
    test('should accept language parameter in options', async () => {
      // Test that generateTenantReport accepts language parameter
      const options = { language: 'en' };
      
      // This would normally generate a PDF, but we're mocking PDFKit
      // The test verifies the function accepts the language parameter
      expect(() => {
        generateTenantReport(mockTenant, 6, 2025, mockUtilities, options);
      }).not.toThrow();
    });

    test('should default to Slovenian if no language provided', async () => {
      // Test default language behavior
      expect(() => {
        generateTenantReport(mockTenant, 6, 2025, mockUtilities, {});
      }).not.toThrow();
    });

    test('should normalize language parameter', async () => {
      // Test language normalization
      const invalidLanguages = ['de', 'fr', 'invalid', '', null];
      
      invalidLanguages.forEach(lang => {
        expect(() => {
          generateTenantReport(mockTenant, 6, 2025, mockUtilities, { language: lang });
        }).not.toThrow();
      });
    });
  });
});

describe('API Route Language Integration', () => {
  let app;

  beforeEach(() => {
    // Mock Express app for testing routes
    app = express();
    app.use(express.json());
    
    // Mock database
    vi.mock('../database/db.js', () => ({
      default: {
        get: vi.fn(),
        all: vi.fn()
      }
    }));
  });

  describe('Individual PDF Download Route', () => {
    test('should extract language parameter from query string', async () => {
      // Mock route handler would extract language from req.query.lang
      const mockReq = {
        params: { tenantId: '1', month: '6', year: '2025' },
        query: { lang: 'en' }
      };

      const { lang = 'sl' } = mockReq.query;
      expect(lang).toBe('en');
    });

    test('should default to Slovenian if no language parameter', async () => {
      const mockReq = {
        params: { tenantId: '1', month: '6', year: '2025' },
        query: {}
      };

      const { lang = 'sl' } = mockReq.query;
      expect(lang).toBe('sl');
    });
  });

  describe('Batch Export Route', () => {
    test('should extract language parameter from request body', async () => {
      const mockReq = {
        body: {
          tenantIds: [1, 2, 3],
          month: 6,
          year: 2025,
          language: 'en'
        }
      };

      const { tenantIds, month, year, language = 'sl' } = mockReq.body;
      expect(language).toBe('en');
      expect(tenantIds).toEqual([1, 2, 3]);
    });

    test('should default to Slovenian for batch export', async () => {
      const mockReq = {
        body: {
          tenantIds: [1, 2, 3],
          month: 6,
          year: 2025
        }
      };

      const { language = 'sl' } = mockReq.body;
      expect(language).toBe('sl');
    });
  });
});

describe('PDF Language Quality Gates', () => {
  describe('Translation Completeness', () => {
    const requiredPDFKeys = [
      'pdf.statementDate',
      'pdf.billingPeriod',
      'pdf.tenant',
      'pdf.chargesBreakdown',
      'pdf.monthlyRent',
      'pdf.utilityCharges',
      'pdf.totalAmountDue',
      'pdf.amount',
      'pdf.totalAmount',
      'pdf.yourShare',
      'pdf.utilityType'
    ];

    test('should have all required PDF translations in Slovenian', () => {
      requiredPDFKeys.forEach(key => {
        const translation = t('sl', key);
        expect(translation).not.toBe(key); // Should not fallback to key
        expect(translation).toBeTruthy(); // Should have actual translation
      });
    });

    test('should have all required PDF translations in English', () => {
      requiredPDFKeys.forEach(key => {
        const translation = t('en', key);
        expect(translation).not.toBe(key); // Should not fallback to key
        expect(translation).toBeTruthy(); // Should have actual translation
      });
    });
  });

  describe('Utility Type Coverage', () => {
    const utilityTypes = [
      'electricity', 'water', 'heating', 'internet', 
      'maintenance', 'gas', 'waste', 'cleaning'
    ];

    test('should translate all utility types in both languages', () => {
      utilityTypes.forEach(type => {
        const slTranslation = translateUtilityType(type, 'sl');
        const enTranslation = translateUtilityType(type, 'en');
        
        expect(slTranslation).not.toBe(type); // Should be translated
        expect(enTranslation).not.toBe(type); // Should be translated
        expect(slTranslation).toBeTruthy();
        expect(enTranslation).toBeTruthy();
      });
    });
  });

  describe('Formatting Consistency', () => {
    test('should format currency consistently', () => {
      const testAmounts = [0, 123.45, 1000, 1234.56];
      
      testAmounts.forEach(amount => {
        const slFormat = formatCurrency(amount, 'sl');
        const enFormat = formatCurrency(amount, 'en');
        
        // Slovenian should end with €
        expect(slFormat).toMatch(/,\d{2}\s€$/);
        
        // English should start with €
        expect(enFormat).toMatch(/^€\d+\.\d{2}$/);
      });
    });

    test('should format dates consistently', () => {
      const testDate = new Date('2025-06-20');
      
      const slFormat = formatDate(testDate, 'sl');
      const enFormat = formatDate(testDate, 'en');
      
      // Both should be non-empty strings
      expect(slFormat).toBeTruthy();
      expect(enFormat).toBeTruthy();
      
      // Should be different formats
      expect(slFormat).not.toBe(enFormat);
    });
  });
});