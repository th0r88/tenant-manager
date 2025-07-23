-- Enhanced database constraints for data integrity (PostgreSQL)
-- Converted from SQLite triggers to PostgreSQL trigger functions

-- Properties table validation functions
CREATE OR REPLACE FUNCTION validate_property_house_area()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.house_area IS NOT NULL AND NEW.house_area <= 0 THEN
        RAISE EXCEPTION 'House area must be positive';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_property_tenants_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.number_of_tenants IS NOT NULL AND NEW.number_of_tenants <= 0 THEN
        RAISE EXCEPTION 'Number of tenants must be positive';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tenants table validation functions
CREATE OR REPLACE FUNCTION validate_tenant_rent_amount()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.rent_amount < 0 THEN
        RAISE EXCEPTION 'Rent amount cannot be negative';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_tenant_room_area()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.room_area <= 0 THEN
        RAISE EXCEPTION 'Room area must be positive';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_tenant_lease_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lease_duration <= 0 THEN
        RAISE EXCEPTION 'Lease duration must be positive';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_tenant_dates()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.move_out_date IS NOT NULL AND NEW.move_out_date <= NEW.move_in_date THEN
        RAISE EXCEPTION 'Move out date must be after move in date';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- EMŠO validation (Slovenian ID number format: 13 digits)
CREATE OR REPLACE FUNCTION validate_emso_format()
RETURNS TRIGGER AS $$
BEGIN
    IF length(NEW.emso) != 13 OR NEW.emso !~ '^[0-9]{13}$' THEN
        RAISE EXCEPTION 'EMŠO must be exactly 13 digits';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Utility entries validation functions
CREATE OR REPLACE FUNCTION validate_utility_amount()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_amount <= 0 THEN
        RAISE EXCEPTION 'Utility amount must be positive';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_utility_month()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.month < 1 OR NEW.month > 12 THEN
        RAISE EXCEPTION 'Month must be between 1 and 12';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_utility_year()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.year < 2000 OR NEW.year > 2100 THEN
        RAISE EXCEPTION 'Year must be between 2000 and 2100';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tenant utility allocations validation functions
CREATE OR REPLACE FUNCTION validate_allocation_amount()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.allocated_amount < 0 THEN
        RAISE EXCEPTION 'Allocated amount cannot be negative';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Billing periods validation functions
CREATE OR REPLACE FUNCTION validate_billing_period_month()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.month < 1 OR NEW.month > 12 THEN
        RAISE EXCEPTION 'Month must be between 1 and 12';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_billing_period_year()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.year < 2000 OR NEW.year > 2100 THEN
        RAISE EXCEPTION 'Year must be between 2000 and 2100';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_billing_period_amounts()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_rent_calculated < 0 OR NEW.total_utilities_calculated < 0 THEN
        RAISE EXCEPTION 'Calculated amounts cannot be negative';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for properties table
DROP TRIGGER IF EXISTS validate_property_house_area_trigger ON properties;
CREATE TRIGGER validate_property_house_area_trigger
    BEFORE INSERT OR UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION validate_property_house_area();

DROP TRIGGER IF EXISTS validate_property_tenants_count_trigger ON properties;
CREATE TRIGGER validate_property_tenants_count_trigger
    BEFORE INSERT OR UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION validate_property_tenants_count();

-- Create triggers for tenants table
DROP TRIGGER IF EXISTS validate_tenant_rent_amount_trigger ON tenants;
CREATE TRIGGER validate_tenant_rent_amount_trigger
    BEFORE INSERT OR UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION validate_tenant_rent_amount();

DROP TRIGGER IF EXISTS validate_tenant_room_area_trigger ON tenants;
CREATE TRIGGER validate_tenant_room_area_trigger
    BEFORE INSERT OR UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION validate_tenant_room_area();

DROP TRIGGER IF EXISTS validate_tenant_lease_duration_trigger ON tenants;
CREATE TRIGGER validate_tenant_lease_duration_trigger
    BEFORE INSERT OR UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION validate_tenant_lease_duration();

DROP TRIGGER IF EXISTS validate_tenant_dates_trigger ON tenants;
CREATE TRIGGER validate_tenant_dates_trigger
    BEFORE INSERT OR UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION validate_tenant_dates();

DROP TRIGGER IF EXISTS validate_emso_format_trigger ON tenants;
CREATE TRIGGER validate_emso_format_trigger
    BEFORE INSERT OR UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION validate_emso_format();

-- Create triggers for utility_entries table
DROP TRIGGER IF EXISTS validate_utility_amount_trigger ON utility_entries;
CREATE TRIGGER validate_utility_amount_trigger
    BEFORE INSERT OR UPDATE ON utility_entries
    FOR EACH ROW
    EXECUTE FUNCTION validate_utility_amount();

DROP TRIGGER IF EXISTS validate_utility_month_trigger ON utility_entries;
CREATE TRIGGER validate_utility_month_trigger
    BEFORE INSERT OR UPDATE ON utility_entries
    FOR EACH ROW
    EXECUTE FUNCTION validate_utility_month();

DROP TRIGGER IF EXISTS validate_utility_year_trigger ON utility_entries;
CREATE TRIGGER validate_utility_year_trigger
    BEFORE INSERT OR UPDATE ON utility_entries
    FOR EACH ROW
    EXECUTE FUNCTION validate_utility_year();

-- Create triggers for tenant_utility_allocations table
DROP TRIGGER IF EXISTS validate_allocation_amount_trigger ON tenant_utility_allocations;
CREATE TRIGGER validate_allocation_amount_trigger
    BEFORE INSERT OR UPDATE ON tenant_utility_allocations
    FOR EACH ROW
    EXECUTE FUNCTION validate_allocation_amount();

-- Create triggers for billing_periods table
DROP TRIGGER IF EXISTS validate_billing_period_month_trigger ON billing_periods;
CREATE TRIGGER validate_billing_period_month_trigger
    BEFORE INSERT OR UPDATE ON billing_periods
    FOR EACH ROW
    EXECUTE FUNCTION validate_billing_period_month();

DROP TRIGGER IF EXISTS validate_billing_period_year_trigger ON billing_periods;
CREATE TRIGGER validate_billing_period_year_trigger
    BEFORE INSERT OR UPDATE ON billing_periods
    FOR EACH ROW
    EXECUTE FUNCTION validate_billing_period_year();

DROP TRIGGER IF EXISTS validate_billing_period_amounts_trigger ON billing_periods;
CREATE TRIGGER validate_billing_period_amounts_trigger
    BEFORE INSERT OR UPDATE ON billing_periods
    FOR EACH ROW
    EXECUTE FUNCTION validate_billing_period_amounts();