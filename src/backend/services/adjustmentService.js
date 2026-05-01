import db from '../database/db.js';
import { calculateProportionalRent } from './proportionalCalculationService.js';
import precisionMath from '../utils/precisionMath.js';

// Hard cap on recursion depth to prevent runaway queries on malformed data.
const MAX_CHAIN_DEPTH = 36;

function previousPeriod(month, year) {
    let m = month - 1;
    let y = year;
    if (m === 0) { m = 12; y = year - 1; }
    return { month: m, year: y };
}

async function getNominalDue(tenantId, tenant, month, year) {
    // Invoice for `month` = rent(month) + utilities(month-1)
    const rentCalc = calculateProportionalRent(
        tenant.rent_amount, tenant.move_in_date, tenant.move_out_date, year, month
    );
    const rent = rentCalc.isFullMonth ? rentCalc.monthlyRent : rentCalc.proRatedAmount;

    const { month: utilMonth, year: utilYear } = previousPeriod(month, year);
    const utilResult = await db.query(
        `SELECT SUM(tua.allocated_amount) as total
         FROM tenant_utility_allocations tua
         JOIN utility_entries ue ON tua.utility_entry_id = ue.id
         WHERE tua.tenant_id = $1 AND ue.month = $2 AND ue.year = $3`,
        [tenantId, utilMonth, utilYear]
    );
    const utilities = parseFloat(utilResult.rows[0]?.total) || 0;

    return precisionMath.toNumber(precisionMath.add(rent, utilities));
}

/**
 * Compute the carryover (signed adjustment) from a single billing month, taking
 * any earlier carried-over credit/debt into account so consecutive over- or
 * underpayments propagate correctly.
 *
 * Returns null when no payment record exists for `month`/`year` or when the
 * resulting adjustment is effectively zero (< 0.005 EUR).
 *
 * Positive amount = overpayment (reduces next invoice).
 * Negative amount = underpayment (increases next invoice).
 */
export async function computeAdjustment(tenantId, tenant, month, year, depth = 0) {
    if (depth > MAX_CHAIN_DEPTH) return null;

    const adjResult = await db.query(
        'SELECT amount_paid FROM payment_adjustments WHERE tenant_id = $1 AND month = $2 AND year = $3',
        [tenantId, month, year]
    );
    if (adjResult.rows.length === 0) return null;

    const nominalDue = await getNominalDue(tenantId, tenant, month, year);

    // Pull forward the carryover from the previous month so consecutive
    // over/underpayments chain instead of being silently dropped.
    const prev = previousPeriod(month, year);
    const prevAdjustment = await computeAdjustment(tenantId, tenant, prev.month, prev.year, depth + 1);
    const carryover = prevAdjustment ? prevAdjustment.amount : 0;

    const effectiveDue = precisionMath.toNumber(precisionMath.subtract(nominalDue, carryover));
    const amountPaid = parseFloat(adjResult.rows[0].amount_paid);
    const adjustmentAmount = precisionMath.toNumber(precisionMath.subtract(amountPaid, effectiveDue));

    if (Math.abs(adjustmentAmount) < 0.005) return null;
    return { amount: adjustmentAmount, month, year };
}

/**
 * Effective amount that was due for an invoice month after applying any
 * carryover from earlier months. Used to display "previous total due" in the
 * monthly summary so the chained adjustment computed on the frontend matches
 * what the PDF actually showed.
 */
export async function computeEffectivePrevTotalDue(tenantId, tenant, month, year) {
    const nominalDue = await getNominalDue(tenantId, tenant, month, year);
    const prev = previousPeriod(month, year);
    const prevAdjustment = await computeAdjustment(tenantId, tenant, prev.month, prev.year);
    const carryover = prevAdjustment ? prevAdjustment.amount : 0;
    return precisionMath.toNumber(precisionMath.subtract(nominalDue, carryover));
}
