-- Migration script to add multi-property support
-- Run this after updating schema.sql

-- Create default property for existing data
INSERT OR IGNORE INTO properties (id, name, address, property_type) 
VALUES (1, 'Default Property', 'Main Property Address', 'Building');

-- Add property_id column to existing tenants table (if not exists)
ALTER TABLE tenants ADD COLUMN property_id INTEGER DEFAULT 1;

-- Add property_id column to existing utility_entries table (if not exists)  
ALTER TABLE utility_entries ADD COLUMN property_id INTEGER DEFAULT 1;

-- Update existing data to use default property
UPDATE tenants SET property_id = 1 WHERE property_id IS NULL;
UPDATE utility_entries SET property_id = 1 WHERE property_id IS NULL;