import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database and dependencies before importing the module under test
vi.mock('../../database/db.js', () => ({
  default: { query: vi.fn() }
}));
vi.mock('../../database/queryAdapter.js', () => ({
  getOccupancyDateRangeQuery: vi.fn(() => '')
}));
vi.mock('../../config/environment.js', () => ({
  default: { get: vi.fn() }
}));

import db from '../../database/db.js';
import { calculateAllocations } from '../../services/calculationService.js';

// Helper: create a tenant object
function makeTenant(id, moveIn, moveOut, { people = 1, roomArea = 20, houseArea = 100, propertyId = 1 } = {}) {
  return {
    id,
    property_id: propertyId,
    move_in_date: moveIn,
    move_out_date: moveOut,
    number_of_people: people,
    room_area: roomArea,
    house_area: houseArea,
  };
}

// Helper: set up db.query mock for a standard allocation flow
function setupMocks(utility, tenants) {
  db.query
    // 1. SELECT utility entry
    .mockResolvedValueOnce({ rows: [utility] })
    // 2. DELETE existing allocations
    .mockResolvedValueOnce({ rows: [] })
    // 3. SELECT shared properties (none)
    .mockResolvedValueOnce({ rows: [] })
    // 4. SELECT tenants
    .mockResolvedValueOnce({ rows: tenants });

  // INSERT for each allocation (one per tenant with >0 days)
  for (let i = 0; i < tenants.length; i++) {
    db.query.mockResolvedValueOnce({ rows: [] });
  }
}

describe('calculationService.calculateAllocations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('per_person allocation', () => {
    it('2 tenants with equal people — splits evenly', async () => {
      const utility = {
        id: 1, property_id: 1, month: 1, year: 2024,
        total_amount: 100, allocation_method: 'per_person', utility_type: 'water',
      };
      const tenants = [
        makeTenant(1, '2024-01-01', null, { people: 1 }),
        makeTenant(2, '2024-01-01', null, { people: 1 }),
      ];
      setupMocks(utility, tenants);

      const result = await calculateAllocations(1);
      expect(result).toHaveLength(2);
      expect(result[0].allocated_amount).toBe(50);
      expect(result[1].allocated_amount).toBe(50);
    });

    it('3 tenants with different people counts', async () => {
      const utility = {
        id: 1, property_id: 1, month: 1, year: 2024,
        total_amount: 300, allocation_method: 'per_person', utility_type: 'water',
      };
      // Tenant 1: 1 person, Tenant 2: 2 people, Tenant 3: 3 people
      // Total person-days: 31 + 62 + 93 = 186
      const tenants = [
        makeTenant(1, '2024-01-01', null, { people: 1 }),
        makeTenant(2, '2024-01-01', null, { people: 2 }),
        makeTenant(3, '2024-01-01', null, { people: 3 }),
      ];
      setupMocks(utility, tenants);

      const result = await calculateAllocations(1);
      expect(result).toHaveLength(3);
      const total = result.reduce((s, a) => s + a.allocated_amount, 0);
      expect(Math.abs(total - 300)).toBeLessThanOrEqual(0.01);
    });

    it('mid-month move-in gets proportional share', async () => {
      const utility = {
        id: 1, property_id: 1, month: 1, year: 2024,
        total_amount: 100, allocation_method: 'per_person', utility_type: 'electricity',
      };
      const tenants = [
        makeTenant(1, '2024-01-01', null, { people: 1 }),  // 31 person-days
        makeTenant(2, '2024-01-16', null, { people: 1 }), // 16 person-days
      ];
      setupMocks(utility, tenants);

      const result = await calculateAllocations(1);
      expect(result).toHaveLength(2);
      // Tenant 1 should get more than tenant 2
      expect(result[0].allocated_amount).toBeGreaterThan(result[1].allocated_amount);
    });
  });

  describe('per_sqm allocation', () => {
    it('2 tenants with different room areas', async () => {
      const utility = {
        id: 1, property_id: 1, month: 1, year: 2024,
        total_amount: 200, allocation_method: 'per_sqm', utility_type: 'heating',
      };
      // house_area = 100, tenant1 room = 30, tenant2 room = 20
      const tenants = [
        makeTenant(1, '2024-01-01', null, { roomArea: 30, houseArea: 100 }),
        makeTenant(2, '2024-01-01', null, { roomArea: 20, houseArea: 100 }),
      ];
      setupMocks(utility, tenants);

      const result = await calculateAllocations(1);
      expect(result).toHaveLength(2);
      // (200/100)*30 = 60, (200/100)*20 = 40
      expect(result[0].allocated_amount).toBe(60);
      expect(result[1].allocated_amount).toBe(40);
    });

    it('mid-month proration reduces amount', async () => {
      const utility = {
        id: 1, property_id: 1, month: 1, year: 2024,
        total_amount: 310, allocation_method: 'per_sqm', utility_type: 'heating',
      };
      // Full-month tenant and half-month tenant
      const tenants = [
        makeTenant(1, '2024-01-01', null, { roomArea: 50, houseArea: 100 }),
        makeTenant(2, '2024-01-16', null, { roomArea: 50, houseArea: 100 }),
      ];
      setupMocks(utility, tenants);

      const result = await calculateAllocations(1);
      expect(result).toHaveLength(2);
      // Full-month tenant gets more
      expect(result[0].allocated_amount).toBeGreaterThan(result[1].allocated_amount);
    });
  });

  describe('per_apartment allocation', () => {
    it('equal split by occupied days', async () => {
      const utility = {
        id: 1, property_id: 1, month: 1, year: 2024,
        total_amount: 200, allocation_method: 'per_apartment', utility_type: 'maintenance',
      };
      const tenants = [
        makeTenant(1, '2024-01-01', null),
        makeTenant(2, '2024-01-01', null),
      ];
      setupMocks(utility, tenants);

      const result = await calculateAllocations(1);
      expect(result).toHaveLength(2);
      expect(result[0].allocated_amount).toBe(100);
      expect(result[1].allocated_amount).toBe(100);
    });
  });

  describe('direct allocation', () => {
    it('assigns full amount to assigned tenant', async () => {
      const utility = {
        id: 1, property_id: 1, month: 1, year: 2024,
        total_amount: 150, allocation_method: 'direct', utility_type: 'internet',
        assigned_tenant_id: 5,
      };
      db.query
        .mockResolvedValueOnce({ rows: [utility] })   // SELECT utility
        .mockResolvedValueOnce({ rows: [] })           // DELETE existing
        .mockResolvedValueOnce({ rows: [] });          // INSERT

      const result = await calculateAllocations(1);
      expect(result).toHaveLength(1);
      expect(result[0].tenant_id).toBe(5);
      expect(result[0].allocated_amount).toBe(150);
    });
  });

  describe('Edge cases', () => {
    it('no tenants returns empty array', async () => {
      const utility = {
        id: 1, property_id: 1, month: 1, year: 2024,
        total_amount: 100, allocation_method: 'per_person', utility_type: 'water',
      };
      db.query
        .mockResolvedValueOnce({ rows: [utility] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await calculateAllocations(1);
      expect(result).toEqual([]);
    });

    it('utility not found throws', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      await expect(calculateAllocations(999)).rejects.toThrow('Utility entry not found');
    });

    it('unknown allocation method throws', async () => {
      const utility = {
        id: 1, property_id: 1, month: 1, year: 2024,
        total_amount: 100, allocation_method: 'unknown_method', utility_type: 'water',
      };
      const tenants = [makeTenant(1, '2024-01-01', null)];
      setupMocks(utility, tenants);

      await expect(calculateAllocations(1)).rejects.toThrow('Unknown allocation method');
    });

    it('sum integrity: total allocated === total_amount (within 0.01)', async () => {
      vi.resetAllMocks();
      const utility = {
        id: 1, property_id: 1, month: 1, year: 2024,
        total_amount: 100, allocation_method: 'per_person', utility_type: 'electricity',
      };
      const tenants = [
        makeTenant(1, '2024-01-01', null, { people: 1 }),
        makeTenant(2, '2024-01-01', null, { people: 2 }),
        makeTenant(3, '2024-01-01', null, { people: 3 }),
      ];
      setupMocks(utility, tenants);

      const result = await calculateAllocations(1);
      const total = result.reduce((s, a) => s + a.allocated_amount, 0);
      expect(Math.abs(total - 100)).toBeLessThanOrEqual(0.01);
    });
  });
});
