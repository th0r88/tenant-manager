-- Enhanced database constraints for data integrity

-- Add additional constraints to existing tables

-- Properties table constraints
CREATE TRIGGER IF NOT EXISTS validate_property_house_area
    BEFORE INSERT ON properties
    WHEN NEW.house_area IS NOT NULL AND NEW.house_area <= 0
BEGIN
    SELECT RAISE(ABORT, 'House area must be positive');
END;

CREATE TRIGGER IF NOT EXISTS validate_property_house_area_update
    BEFORE UPDATE ON properties
    WHEN NEW.house_area IS NOT NULL AND NEW.house_area <= 0
BEGIN
    SELECT RAISE(ABORT, 'House area must be positive');
END;

CREATE TRIGGER IF NOT EXISTS validate_property_tenants_count
    BEFORE INSERT ON properties
    WHEN NEW.number_of_tenants IS NOT NULL AND NEW.number_of_tenants <= 0
BEGIN
    SELECT RAISE(ABORT, 'Number of tenants must be positive');
END;

CREATE TRIGGER IF NOT EXISTS validate_property_tenants_count_update
    BEFORE UPDATE ON properties
    WHEN NEW.number_of_tenants IS NOT NULL AND NEW.number_of_tenants <= 0
BEGIN
    SELECT RAISE(ABORT, 'Number of tenants must be positive');
END;

-- Tenants table constraints
CREATE TRIGGER IF NOT EXISTS validate_tenant_rent_amount
    BEFORE INSERT ON tenants
    WHEN NEW.rent_amount < 0
BEGIN
    SELECT RAISE(ABORT, 'Rent amount cannot be negative');
END;

CREATE TRIGGER IF NOT EXISTS validate_tenant_rent_amount_update
    BEFORE UPDATE ON tenants
    WHEN NEW.rent_amount < 0
BEGIN
    SELECT RAISE(ABORT, 'Rent amount cannot be negative');
END;

CREATE TRIGGER IF NOT EXISTS validate_tenant_room_area
    BEFORE INSERT ON tenants
    WHEN NEW.room_area <= 0
BEGIN
    SELECT RAISE(ABORT, 'Room area must be positive');
END;

CREATE TRIGGER IF NOT EXISTS validate_tenant_room_area_update
    BEFORE UPDATE ON tenants
    WHEN NEW.room_area <= 0
BEGIN
    SELECT RAISE(ABORT, 'Room area must be positive');
END;

CREATE TRIGGER IF NOT EXISTS validate_tenant_lease_duration
    BEFORE INSERT ON tenants
    WHEN NEW.lease_duration <= 0
BEGIN
    SELECT RAISE(ABORT, 'Lease duration must be positive');
END;

CREATE TRIGGER IF NOT EXISTS validate_tenant_lease_duration_update
    BEFORE UPDATE ON tenants
    WHEN NEW.lease_duration <= 0
BEGIN
    SELECT RAISE(ABORT, 'Lease duration must be positive');
END;

CREATE TRIGGER IF NOT EXISTS validate_tenant_dates
    BEFORE INSERT ON tenants
    WHEN NEW.move_out_date IS NOT NULL AND NEW.move_out_date <= NEW.move_in_date
BEGIN
    SELECT RAISE(ABORT, 'Move out date must be after move in date');
END;

CREATE TRIGGER IF NOT EXISTS validate_tenant_dates_update
    BEFORE UPDATE ON tenants
    WHEN NEW.move_out_date IS NOT NULL AND NEW.move_out_date <= NEW.move_in_date
BEGIN
    SELECT RAISE(ABORT, 'Move out date must be after move in date');
END;

-- EMŠO validation (Slovenian ID number format: 13 digits)
CREATE TRIGGER IF NOT EXISTS validate_emso_format
    BEFORE INSERT ON tenants
    WHEN length(NEW.emso) != 13 OR NEW.emso NOT GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
BEGIN
    SELECT RAISE(ABORT, 'EMŠO must be exactly 13 digits');
END;

CREATE TRIGGER IF NOT EXISTS validate_emso_format_update
    BEFORE UPDATE ON tenants
    WHEN length(NEW.emso) != 13 OR NEW.emso NOT GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
BEGIN
    SELECT RAISE(ABORT, 'EMŠO must be exactly 13 digits');
END;

-- Utility entries constraints
CREATE TRIGGER IF NOT EXISTS validate_utility_amount
    BEFORE INSERT ON utility_entries
    WHEN NEW.total_amount <= 0
BEGIN
    SELECT RAISE(ABORT, 'Utility amount must be positive');
END;

CREATE TRIGGER IF NOT EXISTS validate_utility_amount_update
    BEFORE UPDATE ON utility_entries
    WHEN NEW.total_amount <= 0
BEGIN
    SELECT RAISE(ABORT, 'Utility amount must be positive');
END;

CREATE TRIGGER IF NOT EXISTS validate_utility_month
    BEFORE INSERT ON utility_entries
    WHEN NEW.month < 1 OR NEW.month > 12
BEGIN
    SELECT RAISE(ABORT, 'Month must be between 1 and 12');
END;

CREATE TRIGGER IF NOT EXISTS validate_utility_month_update
    BEFORE UPDATE ON utility_entries
    WHEN NEW.month < 1 OR NEW.month > 12
BEGIN
    SELECT RAISE(ABORT, 'Month must be between 1 and 12');
END;

CREATE TRIGGER IF NOT EXISTS validate_utility_year
    BEFORE INSERT ON utility_entries
    WHEN NEW.year < 2000 OR NEW.year > 2100
BEGIN
    SELECT RAISE(ABORT, 'Year must be between 2000 and 2100');
END;

CREATE TRIGGER IF NOT EXISTS validate_utility_year_update
    BEFORE UPDATE ON utility_entries
    WHEN NEW.year < 2000 OR NEW.year > 2100
BEGIN
    SELECT RAISE(ABORT, 'Year must be between 2000 and 2100');
END;

-- Tenant utility allocations constraints
CREATE TRIGGER IF NOT EXISTS validate_allocation_amount
    BEFORE INSERT ON tenant_utility_allocations
    WHEN NEW.allocated_amount < 0
BEGIN
    SELECT RAISE(ABORT, 'Allocated amount cannot be negative');
END;

CREATE TRIGGER IF NOT EXISTS validate_allocation_amount_update
    BEFORE UPDATE ON tenant_utility_allocations
    WHEN NEW.allocated_amount < 0
BEGIN
    SELECT RAISE(ABORT, 'Allocated amount cannot be negative');
END;

-- Billing periods constraints
CREATE TRIGGER IF NOT EXISTS validate_billing_period_month
    BEFORE INSERT ON billing_periods
    WHEN NEW.month < 1 OR NEW.month > 12
BEGIN
    SELECT RAISE(ABORT, 'Month must be between 1 and 12');
END;

CREATE TRIGGER IF NOT EXISTS validate_billing_period_month_update
    BEFORE UPDATE ON billing_periods
    WHEN NEW.month < 1 OR NEW.month > 12
BEGIN
    SELECT RAISE(ABORT, 'Month must be between 1 and 12');
END;

CREATE TRIGGER IF NOT EXISTS validate_billing_period_year
    BEFORE INSERT ON billing_periods
    WHEN NEW.year < 2000 OR NEW.year > 2100
BEGIN
    SELECT RAISE(ABORT, 'Year must be between 2000 and 2100');
END;

CREATE TRIGGER IF NOT EXISTS validate_billing_period_year_update
    BEFORE UPDATE ON billing_periods
    WHEN NEW.year < 2000 OR NEW.year > 2100
BEGIN
    SELECT RAISE(ABORT, 'Year must be between 2000 and 2100');
END;

CREATE TRIGGER IF NOT EXISTS validate_billing_period_amounts
    BEFORE INSERT ON billing_periods
    WHEN NEW.total_rent_calculated < 0 OR NEW.total_utilities_calculated < 0
BEGIN
    SELECT RAISE(ABORT, 'Calculated amounts cannot be negative');
END;

CREATE TRIGGER IF NOT EXISTS validate_billing_period_amounts_update
    BEFORE UPDATE ON billing_periods
    WHEN NEW.total_rent_calculated < 0 OR NEW.total_utilities_calculated < 0
BEGIN
    SELECT RAISE(ABORT, 'Calculated amounts cannot be negative');
END;