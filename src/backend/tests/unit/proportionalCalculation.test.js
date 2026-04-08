import { describe, it, expect } from 'vitest';
import {
  getDaysInMonth,
  calculateOccupiedDays,
  calculateProportionalRent,
  calculatePersonDays,
  calculateSqmDays,
  validateCalculationInputs,
} from '../../services/proportionalCalculationService.js';

describe('ProportionalCalculationService', () => {
  describe('getDaysInMonth', () => {
    it('January has 31 days', () => {
      expect(getDaysInMonth(2024, 1)).toBe(31);
    });

    it('February non-leap has 28 days', () => {
      expect(getDaysInMonth(2023, 2)).toBe(28);
    });

    it('February leap year has 29 days', () => {
      expect(getDaysInMonth(2024, 2)).toBe(29);
    });

    it('April has 30 days', () => {
      expect(getDaysInMonth(2024, 4)).toBe(30);
    });
  });

  describe('calculateOccupiedDays', () => {
    it('full month occupancy', () => {
      expect(calculateOccupiedDays('2024-01-01', null, 2024, 1)).toBe(31);
    });

    it('mid-month move-in (Jan 15)', () => {
      // Jan 15 to Jan 31 = 17 days
      expect(calculateOccupiedDays('2024-01-15', null, 2024, 1)).toBe(17);
    });

    it('mid-month move-out (Jan 15)', () => {
      // Jan 1 to Jan 15 = 15 days
      expect(calculateOccupiedDays('2024-01-01', '2024-01-15', 2024, 1)).toBe(15);
    });

    it('both move-in and move-out in same month', () => {
      // Jan 10 to Jan 20 = 11 days (inclusive)
      expect(calculateOccupiedDays('2024-01-10', '2024-01-20', 2024, 1)).toBe(11);
    });

    it('tenant not yet moved in returns 0', () => {
      expect(calculateOccupiedDays('2024-03-01', null, 2024, 1)).toBe(0);
    });

    it('tenant already moved out returns 0', () => {
      expect(calculateOccupiedDays('2024-01-01', '2024-01-31', 2024, 3)).toBe(0);
    });

    it('leap year February full month', () => {
      expect(calculateOccupiedDays('2024-02-01', null, 2024, 2)).toBe(29);
    });

    it('same-day move counts as 1 day', () => {
      expect(calculateOccupiedDays('2024-01-15', '2024-01-15', 2024, 1)).toBe(1);
    });
  });

  describe('calculateProportionalRent', () => {
    it('full month equals full rent', () => {
      const result = calculateProportionalRent(1000, '2024-01-01', null, 2024, 1);
      expect(result.proRatedAmount).toBe(1000);
      expect(result.isFullMonth).toBe(true);
      expect(result.occupancyPercentage).toBe(100);
    });

    it('half month is approximately half rent', () => {
      // Jan has 31 days, move in on Jan 16 = 16 days
      const result = calculateProportionalRent(1000, '2024-01-16', null, 2024, 1);
      expect(result.occupiedDays).toBe(16);
      expect(result.isFullMonth).toBe(false);
      expect(result.proRatedAmount).toBeCloseTo(516.13, 1);
    });

    it('returns correct occupancyPercentage', () => {
      // 15 out of 30 days in April
      const result = calculateProportionalRent(900, '2024-04-01', '2024-04-15', 2024, 4);
      expect(result.occupancyPercentage).toBe(50);
    });
  });

  describe('calculatePersonDays', () => {
    it('single tenant full month', () => {
      const tenants = [{
        move_in_date: '2024-01-01',
        move_out_date: null,
        number_of_people: 2,
      }];
      const result = calculatePersonDays(tenants, 2024, 1);
      expect(result[0].occupiedDays).toBe(31);
      expect(result[0].personDays).toBe(62); // 2 people * 31 days
    });

    it('multiple tenants with different people counts', () => {
      const tenants = [
        { move_in_date: '2024-01-01', move_out_date: null, number_of_people: 1 },
        { move_in_date: '2024-01-01', move_out_date: null, number_of_people: 3 },
      ];
      const result = calculatePersonDays(tenants, 2024, 1);
      expect(result[0].personDays).toBe(31);
      expect(result[1].personDays).toBe(93);
    });

    it('undefined number_of_people defaults to 1', () => {
      const tenants = [{ move_in_date: '2024-01-01', move_out_date: null }];
      const result = calculatePersonDays(tenants, 2024, 1);
      expect(result[0].personDays).toBe(31);
    });
  });

  describe('calculateSqmDays', () => {
    it('single tenant full month', () => {
      const tenants = [{
        move_in_date: '2024-01-01',
        move_out_date: null,
        room_area: 25,
      }];
      const result = calculateSqmDays(tenants, 2024, 1);
      expect(result[0].sqmDays).toBe(775); // 25 * 31
    });

    it('multiple tenants', () => {
      const tenants = [
        { move_in_date: '2024-01-01', move_out_date: null, room_area: 20 },
        { move_in_date: '2024-01-01', move_out_date: null, room_area: 30 },
      ];
      const result = calculateSqmDays(tenants, 2024, 1);
      expect(result[0].sqmDays).toBe(620);
      expect(result[1].sqmDays).toBe(930);
    });

    it('undefined room_area defaults to 0', () => {
      const tenants = [{ move_in_date: '2024-01-01', move_out_date: null }];
      const result = calculateSqmDays(tenants, 2024, 1);
      expect(result[0].sqmDays).toBe(0);
    });
  });

  describe('validateCalculationInputs', () => {
    it('valid inputs return isValid true', () => {
      const result = validateCalculationInputs('2024-01-01', '2024-06-30', 2024, 3);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('invalid move-in date returns error', () => {
      const result = validateCalculationInputs('not-a-date', null, 2024, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid move-in date');
    });

    it('move-out before move-in returns error', () => {
      const result = validateCalculationInputs('2024-06-01', '2024-01-01', 2024, 3);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Move-out date must be after move-in date');
    });

    it('invalid month returns error', () => {
      const result = validateCalculationInputs('2024-01-01', null, 2024, 13);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Month must be between 1 and 12');
    });

    it('month 0 returns error', () => {
      const result = validateCalculationInputs('2024-01-01', null, 2024, 0);
      expect(result.isValid).toBe(false);
    });

    it('null move-out date is valid (active tenant)', () => {
      const result = validateCalculationInputs('2024-01-01', null, 2024, 1);
      expect(result.isValid).toBe(true);
    });
  });
});
