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

-- Add assigned_tenant_id for direct electricity assignment
ALTER TABLE utility_entries ADD COLUMN assigned_tenant_id INTEGER;

-- Drop old unique constraint that prevents multiple electricity entries per property/month
-- SQLite requires recreating the index; the old UNIQUE is part of table def but we override with a new partial index
DROP INDEX IF EXISTS idx_unique_utility_entry;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_utility_entry
    ON utility_entries (property_id, month, year, utility_type)
    WHERE assigned_tenant_id IS NULL;

-- Add utility_shared_properties junction table for cross-property utility sharing
CREATE TABLE IF NOT EXISTS utility_shared_properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utility_entry_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utility_entry_id) REFERENCES utility_entries (id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
    UNIQUE(utility_entry_id, property_id)
);
CREATE INDEX IF NOT EXISTS idx_usp_entry ON utility_shared_properties (utility_entry_id);
CREATE INDEX IF NOT EXISTS idx_usp_property ON utility_shared_properties (property_id);

-- Add payment_adjustments table for tracking overpayments/underpayments
CREATE TABLE IF NOT EXISTS payment_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    amount_paid REAL NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
    UNIQUE(tenant_id, month, year)
);