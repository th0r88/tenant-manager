import { describe, it, expect } from 'vitest';
import { t, getMonthName, translateUtilityType, translations } from '../../services/translationService.js';

describe('TranslationService', () => {
  describe('t()', () => {
    it('Slovenian key returns correct string', () => {
      expect(t('sl', 'pdf.statementDate')).toBe('Datum obračuna');
    });

    it('English key returns correct string', () => {
      expect(t('en', 'pdf.statementDate')).toBe('Statement Date');
    });

    it('missing key returns the key itself', () => {
      expect(t('sl', 'nonexistent.key')).toBe('nonexistent.key');
    });

    it('missing key with fallback returns fallback', () => {
      expect(t('sl', 'nonexistent.key', 'Fallback')).toBe('Fallback');
    });

    it('unknown language falls back to Slovenian', () => {
      expect(t('fr', 'pdf.tenant')).toBe('Najemnik');
    });
  });

  describe('getMonthName()', () => {
    it('all Slovenian months', () => {
      const slMonths = translations.sl.months.full;
      for (let i = 0; i < 12; i++) {
        expect(getMonthName(i, 'sl')).toBe(slMonths[i]);
      }
    });

    it('all English months', () => {
      const enMonths = translations.en.months.full;
      for (let i = 0; i < 12; i++) {
        expect(getMonthName(i, 'en')).toBe(enMonths[i]);
      }
    });

    it('short month names', () => {
      expect(getMonthName(0, 'sl', true)).toBe('Jan');
      expect(getMonthName(0, 'en', true)).toBe('Jan');
    });

    it('out of range index returns first month', () => {
      expect(getMonthName(99, 'sl')).toBe('Januar');
    });
  });

  describe('translateUtilityType()', () => {
    const utilityTypes = ['electricity', 'water', 'heating', 'tv_rtv', 'internet', 'maintenance', 'gas', 'waste'];

    it('all types translate to Slovenian', () => {
      for (const type of utilityTypes) {
        const translated = translateUtilityType(type, 'sl');
        expect(translated).toBe(translations.sl.utilities[type]);
      }
    });

    it('all types translate to English', () => {
      for (const type of utilityTypes) {
        const translated = translateUtilityType(type, 'en');
        expect(translated).toBe(translations.en.utilities[type]);
      }
    });

    it('Slovenian input maps correctly', () => {
      expect(translateUtilityType('elektrika', 'en')).toBe('Electricity');
      expect(translateUtilityType('voda', 'en')).toBe('Water');
    });

    it('unknown type returns original', () => {
      expect(translateUtilityType('unknown_utility', 'sl')).toBe('unknown_utility');
    });
  });
});
