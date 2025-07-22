-- Migration script to add multi-property support and fix UTF-8 encoding
-- Run this after updating schema.sql

-- Set UTF-8 encoding for the database
PRAGMA encoding = "UTF-8";

-- Create default property for existing data only if there are tenants but no properties
INSERT OR IGNORE INTO properties (id, name, address, property_type) 
SELECT 1, 'Default Property', 'Main Property Address', 'Building'
WHERE EXISTS (SELECT 1 FROM tenants LIMIT 1) 
  AND NOT EXISTS (SELECT 1 FROM properties LIMIT 1);

-- Add property_id column to existing tenants table (if not exists)
ALTER TABLE tenants ADD COLUMN property_id INTEGER DEFAULT 1;

-- Add property_id column to existing utility_entries table (if not exists)  
ALTER TABLE utility_entries ADD COLUMN property_id INTEGER DEFAULT 1;

-- Update existing data to use default property
UPDATE tenants SET property_id = 1 WHERE property_id IS NULL;
UPDATE utility_entries SET property_id = 1 WHERE property_id IS NULL;