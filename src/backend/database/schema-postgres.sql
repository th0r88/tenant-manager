-- PostgreSQL Schema for Tenant Management System
-- Converted from SQLite schema with PostgreSQL-specific optimizations

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

-- Efficient date-range indexes for occupancy queries
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

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at in billing_periods
CREATE TRIGGER update_billing_periods_updated_at
    BEFORE UPDATE ON billing_periods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();