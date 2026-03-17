-- Migration script to add multi-property support (PostgreSQL version)
-- Run this after updating schema

-- Create default property for existing data only if there are tenants but no properties
INSERT INTO properties (id, name, address, property_type) 
SELECT 1, 'Default Property', 'Main Property Address', 'Building'
WHERE EXISTS (SELECT 1 FROM tenants LIMIT 1) 
  AND NOT EXISTS (SELECT 1 FROM properties LIMIT 1)
ON CONFLICT (id) DO NOTHING;

-- Add property_id column to existing tenants table (PostgreSQL syntax)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS property_id BIGINT DEFAULT 1;

-- Add property_id column to existing utility_entries table (PostgreSQL syntax)  
ALTER TABLE utility_entries ADD COLUMN IF NOT EXISTS property_id BIGINT DEFAULT 1;

-- Update existing data to use default property
UPDATE tenants SET property_id = 1 WHERE property_id IS NULL;
UPDATE utility_entries SET property_id = 1 WHERE property_id IS NULL;

-- Add foreign key constraints if they don't exist (PostgreSQL syntax)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenants_property') THEN
        ALTER TABLE tenants ADD CONSTRAINT fk_tenants_property
            FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_utility_entries_property') THEN
        ALTER TABLE utility_entries ADD CONSTRAINT fk_utility_entries_property
            FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE;
    END IF;
END $$;

-- Update allocation_method CHECK constraint to include 'direct'
DO $$
BEGIN
    ALTER TABLE utility_entries DROP CONSTRAINT IF EXISTS utility_entries_allocation_method_check;
    ALTER TABLE utility_entries ADD CONSTRAINT utility_entries_allocation_method_check
        CHECK (allocation_method IN ('per_person', 'per_sqm', 'per_person_weighted', 'per_sqm_weighted', 'direct', 'per_apartment'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Add assigned_tenant_id for direct electricity assignment
ALTER TABLE utility_entries ADD COLUMN IF NOT EXISTS assigned_tenant_id BIGINT;

-- Add FK constraint for assigned_tenant_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_utility_entries_assigned_tenant') THEN
        ALTER TABLE utility_entries ADD CONSTRAINT fk_utility_entries_assigned_tenant
            FOREIGN KEY (assigned_tenant_id) REFERENCES tenants (id) ON DELETE SET NULL;
    END IF;
END $$;

-- Replace unique constraint to allow multiple direct-assigned entries per property/month/type
ALTER TABLE utility_entries DROP CONSTRAINT IF EXISTS unique_utility_entry;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_utility_entry
    ON utility_entries (property_id, month, year, utility_type)
    WHERE assigned_tenant_id IS NULL;

-- Add utility_shared_properties junction table for cross-property utility sharing
CREATE TABLE IF NOT EXISTS utility_shared_properties (
    id BIGSERIAL PRIMARY KEY,
    utility_entry_id BIGINT NOT NULL,
    property_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usp_utility_entry FOREIGN KEY (utility_entry_id) REFERENCES utility_entries (id) ON DELETE CASCADE,
    CONSTRAINT fk_usp_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
    CONSTRAINT unique_usp UNIQUE(utility_entry_id, property_id)
);
CREATE INDEX IF NOT EXISTS idx_usp_entry ON utility_shared_properties (utility_entry_id);
CREATE INDEX IF NOT EXISTS idx_usp_property ON utility_shared_properties (property_id);

-- Add payment_adjustments table for tracking overpayments/underpayments
CREATE TABLE IF NOT EXISTS payment_adjustments (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    amount_paid NUMERIC(10,2) NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_adjustments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
    CONSTRAINT unique_payment_adjustment UNIQUE(tenant_id, month, year)
);