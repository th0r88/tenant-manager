# Bug Fixes Plan

## Phase 1: Form Alignment Fix

**File:** `src/frontend/components/TenantForm.jsx`
- Add justify-items-end to the main grid container
- Add text-right to labels for proper right alignment
- Keep form simple - just align existing structure to the right

## Phase 2: Address Field Protection

**File:** `src/frontend/components/TenantList.jsx`
- Wrap address in a container with max-width and truncate
- Add tooltip to show full address on hover
- Ensure address cell has constrained width to prevent table expansion

## Phase 3: CSS Support

**File:** `src/frontend/styles.css`
- Add minimal CSS utilities for:
  - Address truncation with ellipsis
  - Tooltip positioning for long addresses
  - Table column width constraints

## Success Criteria

- ✅ Form fields align to the right
- ✅ Long address "Martina Krpana ulica 18, 1000 Ljubljana, Slovenija" displays without breaking layout
- ✅ Full address visible on hover
- ✅ No horizontal/vertical scrollbars
- ✅ Clean, minimal code changes