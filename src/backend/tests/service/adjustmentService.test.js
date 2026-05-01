import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/db.js', () => ({
  default: { query: vi.fn() }
}));

import db from '../../database/db.js';
import { computeAdjustment, computeEffectivePrevTotalDue } from '../../services/adjustmentService.js';

const TENANT = {
  id: 1,
  rent_amount: 100,
  move_in_date: '2024-01-01',
  move_out_date: null,
};

// Wire db.query to dispatch by SQL fragment so tests don't depend on call order
// (the function recurses, producing variable query sequences).
function setupDb({ payments = {}, utilities = {} } = {}) {
  db.query.mockImplementation(async (sql, params) => {
    if (sql.includes('FROM payment_adjustments')) {
      const [, month, year] = params;
      const key = `${year}-${month}`;
      if (Object.prototype.hasOwnProperty.call(payments, key)) {
        return { rows: [{ amount_paid: payments[key] }] };
      }
      return { rows: [] };
    }
    if (sql.includes('tenant_utility_allocations')) {
      const [, month, year] = params;
      const key = `${year}-${month}`;
      return { rows: [{ total: utilities[key] ?? null }] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
}

describe('adjustmentService.computeAdjustment', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns null when no payment record exists', async () => {
    setupDb({ payments: {} });
    const result = await computeAdjustment(1, TENANT, 3, 2026);
    expect(result).toBeNull();
  });

  it('returns null when paid exactly the nominal due (single month)', async () => {
    // March invoice = rent(March 100) + utilities(Feb 103) = 203, paid 203
    setupDb({
      payments: { '2026-3': 203 },
      utilities: { '2026-2': 103 },
    });
    const result = await computeAdjustment(1, TENANT, 3, 2026);
    expect(result).toBeNull();
  });

  it('detects a single-month overpayment', async () => {
    // March: nominal 203, paid 205 → +2
    setupDb({
      payments: { '2026-3': 205 },
      utilities: { '2026-2': 103 },
    });
    const result = await computeAdjustment(1, TENANT, 3, 2026);
    expect(result).not.toBeNull();
    expect(result.amount).toBeCloseTo(2, 2);
    expect(result.month).toBe(3);
    expect(result.year).toBe(2026);
  });

  it('detects a single-month underpayment as a negative adjustment', async () => {
    // March: nominal 203, paid 200 → -3
    setupDb({
      payments: { '2026-3': 200 },
      utilities: { '2026-2': 103 },
    });
    const result = await computeAdjustment(1, TENANT, 3, 2026);
    expect(result.amount).toBeCloseTo(-3, 2);
  });

  // === Regression tests for the chained-overpayment bug ===
  // Bug scenario reported by the user:
  //   March owes 203, pays 205 → +2 overpayment
  //   April owes 195 → invoice shows 193, but tenant pays 195 → +2 again
  //   May owes 199 → invoice should show 197, but historically showed 199 (lost 2 EUR)
  describe('chained overpayment across consecutive months (regression)', () => {
    // Nominal totals: rent 100/month + utilities of the preceding month
    const utilities = {
      '2026-2': 103, // → March nominal = 203
      '2026-3': 95,  // → April nominal = 195
      '2026-4': 99,  // → May  nominal = 199
    };

    it('April adjustment includes March carryover', async () => {
      setupDb({
        payments: { '2026-3': 205, '2026-4': 195 },
        utilities,
      });
      const april = await computeAdjustment(1, TENANT, 4, 2026);
      // April effective due = 195 - 2 (March carryover) = 193, paid 195 → +2
      expect(april).not.toBeNull();
      expect(april.amount).toBeCloseTo(2, 2);
    });

    it('May adjustment chains both March and April overpayments', async () => {
      setupDb({
        payments: { '2026-3': 205, '2026-4': 195, '2026-5': 199 },
        utilities,
      });
      const may = await computeAdjustment(1, TENANT, 5, 2026);
      // May effective due = 199 - 2 (April carryover, which itself folded in March) = 197.
      // Tenant paid 199 → +2 carryover that must NOT be lost.
      expect(may).not.toBeNull();
      expect(may.amount).toBeCloseTo(2, 2);
    });

    it('chain terminates cleanly when overpayment is consumed (paid the discounted amount)', async () => {
      // March +2 carryover → April effective due = 193, paid 193 (consumes credit) → 0
      // May should see no carryover.
      setupDb({
        payments: { '2026-3': 205, '2026-4': 193, '2026-5': 199 },
        utilities,
      });
      const may = await computeAdjustment(1, TENANT, 5, 2026);
      // May effective due = 199 - 0 = 199, paid 199 → 0
      expect(may).toBeNull();
    });

    it('underpayment carries forward as a debt and chains correctly', async () => {
      // March: paid 200 (nominal 203) → -3
      // April: nominal 195, effective due = 195 - (-3) = 198, paid 195 → -3
      // May:   nominal 199, effective due = 199 - (-3) = 202, paid 199 → -3 (debt persists)
      setupDb({
        payments: { '2026-3': 200, '2026-4': 195, '2026-5': 199 },
        utilities,
      });
      const may = await computeAdjustment(1, TENANT, 5, 2026);
      expect(may).not.toBeNull();
      expect(may.amount).toBeCloseTo(-3, 2);
    });

    it('larger overpayment is still represented in full each month it persists', async () => {
      // March: paid 213 (nominal 203) → +10
      // April: nominal 195, effective 185, paid 195 → +10
      // May:   nominal 199, effective 189, paid 199 → +10
      setupDb({
        payments: { '2026-3': 213, '2026-4': 195, '2026-5': 199 },
        utilities,
      });
      const may = await computeAdjustment(1, TENANT, 5, 2026);
      expect(may.amount).toBeCloseTo(10, 2);
    });

    it('handles year boundary (December → January)', async () => {
      // December 2025: nominal = rent(100) + utilities(Nov 2025 = 80) = 180, paid 185 → +5
      // January 2026: nominal = rent(100) + utilities(Dec 2025 = 90) = 190, effective 185, paid 190 → +5
      setupDb({
        payments: { '2025-12': 185, '2026-1': 190 },
        utilities: { '2025-11': 80, '2025-12': 90 },
      });
      const jan = await computeAdjustment(1, TENANT, 1, 2026);
      expect(jan.amount).toBeCloseTo(5, 2);
    });
  });

  it('does not return spurious adjustments for floating-point noise', async () => {
    // Paid exactly: 100 + 0.1 + 0.2 = 100.3 (classic FP edge), nominal = 100.3
    setupDb({
      payments: { '2026-3': 100.3 },
      utilities: { '2026-2': 0.3 },
    });
    const result = await computeAdjustment(1, TENANT, 3, 2026);
    expect(result).toBeNull();
  });
});

describe('adjustmentService.computeEffectivePrevTotalDue', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns nominal due when there is no prior carryover', async () => {
    setupDb({
      payments: {},
      utilities: { '2026-2': 103 },
    });
    const due = await computeEffectivePrevTotalDue(1, TENANT, 3, 2026);
    // 100 (rent) + 103 (Feb utilities) = 203
    expect(due).toBeCloseTo(203, 2);
  });

  it('subtracts carryover from the previous month so the summary matches what the PDF showed', async () => {
    // March overpaid by 2 → April effective prev_total_due (when looking from May) = 195 - 2 = 193
    setupDb({
      payments: { '2026-3': 205 },
      utilities: { '2026-2': 103, '2026-3': 95 },
    });
    const due = await computeEffectivePrevTotalDue(1, TENANT, 4, 2026);
    expect(due).toBeCloseTo(193, 2);
  });

  it('chains across multiple months for the summary view', async () => {
    // March +2, April paid 195 → April +2, so May effective prev_total_due = 199 - 2 = 197
    setupDb({
      payments: { '2026-3': 205, '2026-4': 195 },
      utilities: { '2026-2': 103, '2026-3': 95, '2026-4': 99 },
    });
    const due = await computeEffectivePrevTotalDue(1, TENANT, 5, 2026);
    expect(due).toBeCloseTo(197, 2);
  });
});
