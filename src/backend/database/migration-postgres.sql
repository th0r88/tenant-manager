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