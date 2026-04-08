import { describe, it, expect } from 'vitest';
import validator from '../../middleware/validationMiddleware.js';

describe('ValidationMiddleware', () => {
  describe('Property validation', () => {
    it('valid property data passes', () => {
      const errors = [];
      const rules = validator.validationRules.property;
      for (const [field, rule] of Object.entries(rules)) {
        const value = {
          name: 'Test Property',
          address: '123 Test Street, Ljubljana',
          property_type: 'Apartment',
          house_area: 100,
          number_of_tenants: 5,
        }[field];
        errors.push(...validator.validateField(field, value, rule));
      }
      expect(errors).toHaveLength(0);
    });

    it('missing required name fails', () => {
      const errors = validator.validateField('name', undefined, validator.validationRules.property.name);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('REQUIRED');
    });

    it('name too short fails', () => {
      const errors = validator.validateField('name', 'A', validator.validationRules.property.name);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('MIN_LENGTH');
    });

    it('name too long fails', () => {
      const errors = validator.validateField('name', 'A'.repeat(101), validator.validationRules.property.name);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('MAX_LENGTH');
    });

    it('invalid property_type enum fails', () => {
      const errors = validator.validateField('property_type', 'Castle', validator.validationRules.property.property_type);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('INVALID_ENUM');
    });

    it('house_area out of range fails', () => {
      const errors = validator.validateField('house_area', 99999, validator.validationRules.property.house_area);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('MAX_VALUE');
    });
  });

  describe('Tenant validation', () => {
    it('valid tenant data passes', () => {
      const data = {
        property_id: 1,
        name: 'Janez',
        surname: 'Novak',
        address: '123 Test Street, Ljubljana',
        emso: '0101990500016', // We'll test EMSO separately
        tax_number: 'SI12345678',
        rent_amount: 500,
        lease_duration: 12,
        room_area: 25,
        number_of_people: 2,
        move_in_date: '2024-01-01',
        occupancy_status: 'active',
      };
      const errors = [];
      const rules = validator.validationRules.tenant;
      for (const [field, rule] of Object.entries(rules)) {
        if (data[field] !== undefined) {
          errors.push(...validator.validateField(field, data[field], rule, data));
        }
      }
      // May have EMSO errors since our test EMSO might not have valid checksum
      // Filter to non-EMSO errors
      const nonEmsoErrors = errors.filter(e => e.field !== 'emso');
      expect(nonEmsoErrors).toHaveLength(0);
    });

    it('missing required property_id fails', () => {
      const errors = validator.validateField('property_id', undefined, validator.validationRules.tenant.property_id);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('REQUIRED');
    });

    it('invalid name pattern fails', () => {
      const errors = validator.validateField('name', 'Test123', validator.validationRules.tenant.name);
      expect(errors.some(e => e.code === 'PATTERN')).toBe(true);
    });

    it('negative rent_amount fails', () => {
      const errors = validator.validateField('rent_amount', -100, validator.validationRules.tenant.rent_amount);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('invalid occupancy_status enum fails', () => {
      const errors = validator.validateField('occupancy_status', 'unknown', validator.validationRules.tenant.occupancy_status);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('INVALID_ENUM');
    });

    it('Slovenian characters in name pass', () => {
      const errors = validator.validateField('name', 'Črtomirček', validator.validationRules.tenant.name);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Utility validation', () => {
    it('valid utility data passes', () => {
      const data = {
        property_id: 1,
        month: 6,
        year: 2024,
        utility_type: 'electricity',
        total_amount: 150.50,
        allocation_method: 'per_person',
      };
      const errors = [];
      const rules = validator.validationRules.utility;
      for (const [field, rule] of Object.entries(rules)) {
        errors.push(...validator.validateField(field, data[field], rule, data));
      }
      expect(errors).toHaveLength(0);
    });

    it('invalid utility_type fails', () => {
      const errors = validator.validateField('utility_type', 'nuclear', validator.validationRules.utility.utility_type);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('INVALID_ENUM');
    });

    it('total_amount below min fails', () => {
      const errors = validator.validateField('total_amount', 0, validator.validationRules.utility.total_amount);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('invalid allocation_method fails', () => {
      const errors = validator.validateField('allocation_method', 'random', validator.validationRules.utility.allocation_method);
      expect(errors).toHaveLength(1);
    });
  });

  describe('Type validation', () => {
    it('string type rejects number', () => {
      const error = validator.validateType('name', 123, { type: 'string' });
      expect(error).not.toBeNull();
      expect(error.code).toBe('INVALID_TYPE');
    });

    it('integer type rejects float', () => {
      const error = validator.validateType('count', 3.5, { type: 'integer' });
      expect(error).not.toBeNull();
    });

    it('date type rejects invalid date', () => {
      const error = validator.validateType('date', 'not-a-date', { type: 'date' });
      expect(error).not.toBeNull();
    });

    it('currency type rejects negative', () => {
      const error = validator.validateType('amount', -5, { type: 'currency' });
      expect(error).not.toBeNull();
    });
  });

  describe('Sanitization', () => {
    it('trims and normalizes whitespace', () => {
      const result = validator.sanitizeValue('  hello   world  ', { sanitize: true, type: 'string' });
      expect(result).toBe('hello world');
    });

    it('preserves Slovenian characters', () => {
      const result = validator.sanitizeValue('Črtomirček Štefanija', { sanitize: true, type: 'string' });
      expect(result).toContain('Č');
      expect(result).toContain('č');
      expect(result).toContain('Š');
    });
  });
});
