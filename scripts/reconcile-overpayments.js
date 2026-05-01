#!/usr/bin/env node

/**
 * Reconciliation Script: Overpayment Carryover Diff
 *
 * Prints, for every payment_adjustments row in the requested range, the
 * adjustment that the buggy (pre-fix) code would have computed vs. the
 * adjustment that the new chained logic produces. The diff column shows the
 * EUR that the previous logic silently dropped (or, if negative, debt it
 * over-attributed).
 *
 * Read-only: never writes to the database.
 *
 * Usage:
 *   node scripts/reconcile-overpayments.js
 *   node scripts/reconcile-overpayments.js --property-id 1
 *   node scripts/reconcile-overpayments.js --tenant-id 42
 *   node scripts/reconcile-overpayments.js --from 2026-01 --to 2026-05
 */

import db from '../src/backend/database/db.js';
import { calculateProportionalRent } from '../src/backend/services/proportionalCalculationService.js';
import { computeAdjustment } from '../src/backend/services/adjustmentService.js';
import precisionMath from '../src/backend/utils/precisionMath.js';

function parseArgs(argv) {
    const args = { propertyId: null, tenantId: null, from: null, to: null };
    for (let i = 2; i < argv.length; i++) {
        const flag = argv[i];
        const value = argv[i + 1];
        switch (flag) {
            case '--property-id':
                args.propertyId = parseInt(value, 10); i++; break;
            case '--tenant-id':
                args.tenantId = parseInt(value, 10); i++; break;
            case '--from':
                args.from = parsePeriod(value); i++; break;
            case '--to':
                args.to = parsePeriod(value); i++; break;
            case '--help':
            case '-h':
                printUsage(); process.exit(0); break;
            default:
                console.error(`Unknown flag: ${flag}`);
                printUsage();
                process.exit(1);
        }
    }
    return args;
}

function parsePeriod(s) {
    const m = /^(\d{4})-(\d{1,2})$/.exec(s || '');
    if (!m) throw new Error(`Invalid period: ${s} (expected YYYY-MM)`);
    return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) };
}

function periodKey({ year, month }) { return year * 12 + (month - 1); }

function printUsage() {
    console.log(`Usage: node scripts/reconcile-overpayments.js [options]
  --property-id N    Restrict to one property
  --tenant-id N      Restrict to one tenant
  --from YYYY-MM     Inclusive lower bound of payment month
  --to YYYY-MM       Inclusive upper bound of payment month
  -h, --help         Show this help`);
}

function fmt(n) {
    if (n === null || n === undefined) return '       —';
    const sign = n > 0 ? '+' : (n < 0 ? '' : ' ');
    return `${sign}${n.toFixed(2)} EUR`.padStart(13);
}

async function nominalDueFor(tenant, month, year) {
    // Mirrors getNominalDue in adjustmentService: invoice(M) = rent(M) + utilities(M-1)
    const rentCalc = calculateProportionalRent(
        tenant.rent_amount, tenant.move_in_date, tenant.move_out_date, year, month
    );
    const rent = rentCalc.isFullMonth ? rentCalc.monthlyRent : rentCalc.proRatedAmount;

    let utilMonth = month - 1, utilYear = year;
    if (utilMonth === 0) { utilMonth = 12; utilYear = year - 1; }

    const r = await db.query(
        `SELECT SUM(tua.allocated_amount) AS total
         FROM tenant_utility_allocations tua
         JOIN utility_entries ue ON tua.utility_entry_id = ue.id
         WHERE tua.tenant_id = $1 AND ue.month = $2 AND ue.year = $3`,
        [tenant.id, utilMonth, utilYear]
    );
    const utilities = parseFloat(r.rows[0]?.total) || 0;
    return precisionMath.toNumber(precisionMath.add(rent, utilities));
}

async function loadAdjustmentRows(args) {
    const where = [];
    const params = [];
    let i = 1;
    if (args.tenantId) { where.push(`pa.tenant_id = $${i++}`); params.push(args.tenantId); }
    if (args.propertyId) { where.push(`t.property_id = $${i++}`); params.push(args.propertyId); }
    if (args.from) {
        where.push(`(pa.year * 12 + pa.month) >= $${i++}`);
        params.push(args.from.year * 12 + args.from.month);
    }
    if (args.to) {
        where.push(`(pa.year * 12 + pa.month) <= $${i++}`);
        params.push(args.to.year * 12 + args.to.month);
    }
    const sql = `
        SELECT pa.tenant_id, pa.month, pa.year, pa.amount_paid,
               t.name, t.surname, t.rent_amount, t.move_in_date, t.move_out_date,
               t.property_id, p.name AS property_name
        FROM payment_adjustments pa
        JOIN tenants t ON t.id = pa.tenant_id
        JOIN properties p ON p.id = t.property_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY t.property_id, pa.tenant_id, pa.year, pa.month
    `;
    const r = await db.query(sql, params);
    return r.rows;
}

async function reconcile() {
    const args = parseArgs(process.argv);
    const rows = await loadAdjustmentRows(args);

    if (rows.length === 0) {
        console.log('No payment_adjustments rows match the filter.');
        return;
    }

    // Group by tenant
    const byTenant = new Map();
    for (const r of rows) {
        if (!byTenant.has(r.tenant_id)) byTenant.set(r.tenant_id, { meta: r, rows: [] });
        byTenant.get(r.tenant_id).rows.push(r);
    }

    console.log('Overpayment carryover reconciliation');
    console.log('=====================================');
    console.log('  old_adj = paid − nominal_due           (pre-fix behavior)');
    console.log('  new_adj = paid − effective_due_chained (post-fix behavior)');
    console.log('  diff    = new_adj − old_adj            (EUR the old system ignored)');
    console.log('');

    const propertyTotals = new Map();
    let grandDiff = 0;
    let touchedTenants = 0;

    for (const [tenantId, group] of byTenant) {
        const t = group.meta;
        const tenant = {
            id: tenantId,
            rent_amount: t.rent_amount,
            move_in_date: t.move_in_date,
            move_out_date: t.move_out_date,
        };

        const lines = [];
        let tenantDiff = 0;

        for (const row of group.rows.sort((a, b) => periodKey(a) - periodKey(b))) {
            const paid = parseFloat(row.amount_paid);
            const nominal = await nominalDueFor(tenant, row.month, row.year);
            const oldAdj = precisionMath.toNumber(precisionMath.subtract(paid, nominal));
            const newAdjResult = await computeAdjustment(tenantId, tenant, row.month, row.year);
            const newAdj = newAdjResult ? newAdjResult.amount : 0;
            const diff = precisionMath.toNumber(precisionMath.subtract(newAdj, oldAdj));
            tenantDiff = precisionMath.toNumber(precisionMath.add(tenantDiff, diff));

            lines.push({
                period: `${String(row.month).padStart(2, '0')}/${row.year}`,
                paid, nominal, oldAdj, newAdj, diff,
            });
        }

        if (Math.abs(tenantDiff) < 0.005) continue; // no change for this tenant

        touchedTenants++;
        grandDiff = precisionMath.toNumber(precisionMath.add(grandDiff, tenantDiff));
        propertyTotals.set(
            t.property_id,
            precisionMath.toNumber(precisionMath.add(propertyTotals.get(t.property_id) || 0, tenantDiff))
        );

        console.log(`▸ ${t.name} ${t.surname}  (tenant #${tenantId}, property: ${t.property_name})`);
        console.log('   period   |     paid     |   nominal    |   old_adj    |   new_adj    |    diff');
        console.log('   ---------|--------------|--------------|--------------|--------------|-------------');
        for (const l of lines) {
            console.log(`   ${l.period}  |${fmt(l.paid)} |${fmt(l.nominal)} |${fmt(l.oldAdj)} |${fmt(l.newAdj)} |${fmt(l.diff)}`);
        }
        console.log(`   tenant Δ:${fmt(tenantDiff)}`);
        console.log('');
    }

    console.log('Summary');
    console.log('-------');
    if (propertyTotals.size > 0) {
        for (const [pid, total] of propertyTotals) {
            console.log(`  property #${pid}: ${fmt(total)}`);
        }
    }
    console.log(`  affected tenants: ${touchedTenants}`);
    console.log(`  grand total Δ:   ${fmt(grandDiff)}`);
    if (grandDiff > 0) {
        console.log('\n  Positive diff → tenants have credit the old system lost track of.');
        console.log('  Regenerate affected months\' PDFs from the report screen to issue corrected invoices.');
    } else if (grandDiff < 0) {
        console.log('\n  Negative diff → tenants owe more than the old system showed.');
    } else {
        console.log('\n  No discrepancy detected.');
    }
}

reconcile()
    .then(() => process.exit(0))
    .catch(err => { console.error('Reconciliation failed:', err); process.exit(1); });
