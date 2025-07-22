# Migration Scripts

This directory contains database migration and maintenance scripts for the tenant management system.

## recalculate-utility-allocations.js

**Purpose:** Fixes existing utility allocations that were calculated using the old buggy method by recalculating them with the new person-days weighted allocation logic.

**When to use:** 
- After upgrading to v1.2.12+ with the person-days weighted allocation fix
- When PDF reports show incorrect prorated amounts for mid-month tenants
- When you notice utility allocations don't add up to 100% of the total bill

**What it does:**
1. Creates a backup table `tenant_utility_allocations_backup` 
2. Identifies utility entries with partial-month tenants
3. Deletes old incorrect allocations
4. Recalculates using the new person-days weighted method
5. Shows before/after comparison for verification

**Usage:**
```bash
# Run from project root directory
node scripts/recalculate-utility-allocations.js
```

**Safety:**
- Creates automatic backup before making changes
- Only processes entries with detected partial-month tenants
- Provides detailed logging of all changes made
- Can be safely re-run multiple times

**Expected Results:**
- Mid-month tenants will see corrected prorated amounts in PDFs
- Example: Tenant moving in June 10th will see €10.66 instead of €9.74
- All utility allocations will sum to exactly 100% of the utility bill
- No more unallocated utility costs

**Rollback:**
If issues occur, you can restore from the backup:
```sql
-- Restore original allocations (if needed)
DELETE FROM tenant_utility_allocations;
INSERT INTO tenant_utility_allocations 
SELECT tenant_id, utility_entry_id, allocated_amount 
FROM tenant_utility_allocations_backup;
```