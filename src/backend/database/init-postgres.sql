-- PostgreSQL Database Initialization Script
-- This script sets up the complete database schema for the Tenant Management System

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create the main database user if it doesn't exist
-- Note: This requires superuser privileges and should be run by the database administrator
-- DO $$ 
-- BEGIN
--     IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'tenant_user') THEN
--         CREATE USER tenant_user WITH PASSWORD 'tenant_pass';
--     END IF;
-- END $$;

-- Grant necessary permissions
-- GRANT CONNECT ON DATABASE tenant_manager TO tenant_user;
-- GRANT USAGE ON SCHEMA public TO tenant_user;
-- GRANT CREATE ON SCHEMA public TO tenant_user;

-- Set up the database timezone
SET timezone = 'UTC';

-- Create tables (from schema-postgres.sql)
-- Properties table
CREATE TABLE IF NOT EXISTS properties (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    property_type TEXT NOT NULL,
    house_area NUMERIC(10,2),
    number_of_tenants INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    address TEXT NOT NULL,
    emso TEXT NOT NULL UNIQUE,
    tax_number TEXT,
    rent_amount NUMERIC(10,2) NOT NULL,
    lease_duration INTEGER NOT NULL,
    room_area NUMERIC(10,2) NOT NULL,
    number_of_people INTEGER NOT NULL DEFAULT 1,
    move_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
    move_out_date DATE,
    occupancy_status TEXT NOT NULL DEFAULT 'active' CHECK (occupancy_status IN ('active', 'moved_out', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tenants_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
);

-- Utility entries table
CREATE TABLE IF NOT EXISTS utility_entries (
    id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL DEFAULT 1,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    utility_type TEXT NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    allocation_method TEXT NOT NULL CHECK (allocation_method IN ('per_person', 'per_sqm', 'per_person_weighted', 'per_sqm_weighted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_utility_entries_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
    CONSTRAINT unique_utility_entry UNIQUE(property_id, month, year, utility_type)
);

-- Tenant utility allocations table
CREATE TABLE IF NOT EXISTS tenant_utility_allocations (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    utility_entry_id BIGINT NOT NULL,
    allocated_amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tenant_utility_allocations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
    CONSTRAINT fk_tenant_utility_allocations_utility FOREIGN KEY (utility_entry_id) REFERENCES utility_entries (id) ON DELETE CASCADE,
    CONSTRAINT unique_tenant_utility_allocation UNIQUE(tenant_id, utility_entry_id)
);

-- Billing periods table
CREATE TABLE IF NOT EXISTS billing_periods (
    id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_rent_calculated NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_utilities_calculated NUMERIC(10,2) NOT NULL DEFAULT 0,
    calculation_status TEXT NOT NULL DEFAULT 'pending' CHECK (calculation_status IN ('pending', 'calculated', 'finalized')),
    calculation_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_billing_periods_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
    CONSTRAINT unique_billing_period UNIQUE(property_id, month, year)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_tenants_move_in_date ON tenants (move_in_date);
CREATE INDEX IF NOT EXISTS idx_tenants_move_out_date ON tenants (move_out_date);
CREATE INDEX IF NOT EXISTS idx_tenants_occupancy_status ON tenants (occupancy_status);
CREATE INDEX IF NOT EXISTS idx_tenants_property_occupancy ON tenants (property_id, occupancy_status, move_in_date, move_out_date);
CREATE INDEX IF NOT EXISTS idx_billing_periods_property_date ON billing_periods (property_id, year, month);
CREATE INDEX IF NOT EXISTS idx_billing_periods_status ON billing_periods (calculation_status);

-- Additional PostgreSQL-specific indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tenants_property_id ON tenants (property_id);
CREATE INDEX IF NOT EXISTS idx_tenants_emso ON tenants (emso);
CREATE INDEX IF NOT EXISTS idx_utility_entries_property_id ON utility_entries (property_id);
CREATE INDEX IF NOT EXISTS idx_utility_entries_date ON utility_entries (year, month);
CREATE INDEX IF NOT EXISTS idx_tenant_utility_allocations_tenant_id ON tenant_utility_allocations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_utility_allocations_utility_entry_id ON tenant_utility_allocations (utility_entry_id);

-- Create utility functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at updates
DROP TRIGGER IF EXISTS update_billing_periods_updated_at ON billing_periods;
CREATE TRIGGER update_billing_periods_updated_at
    BEFORE UPDATE ON billing_periods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Default property insertion is handled by migration scripts to avoid duplicates

-- Grant table permissions to tenant_user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tenant_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tenant_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO tenant_user;

-- Set default privileges for future objects
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tenant_user;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO tenant_user;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO tenant_user;

-- Create a function to check database health
CREATE OR REPLACE FUNCTION check_database_health()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'properties'::TEXT as table_name,
        COUNT(*) as row_count,
        'OK'::TEXT as status
    FROM properties
    UNION ALL
    SELECT 
        'tenants'::TEXT as table_name,
        COUNT(*) as row_count,
        'OK'::TEXT as status
    FROM tenants
    UNION ALL
    SELECT 
        'utility_entries'::TEXT as table_name,
        COUNT(*) as row_count,
        'OK'::TEXT as status
    FROM utility_entries
    UNION ALL
    SELECT 
        'tenant_utility_allocations'::TEXT as table_name,
        COUNT(*) as row_count,
        'OK'::TEXT as status
    FROM tenant_utility_allocations
    UNION ALL
    SELECT 
        'billing_periods'::TEXT as table_name,
        COUNT(*) as row_count,
        'OK'::TEXT as status
    FROM billing_periods;
END;
$$ LANGUAGE plpgsql;

-- Database initialization completed - no logging entry needed

-- Show completion message
SELECT 'PostgreSQL database initialization completed successfully!' as message;