CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    property_type TEXT NOT NULL,
    house_area REAL,
    number_of_tenants INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    address TEXT NOT NULL,
    emso TEXT NOT NULL UNIQUE,
    tax_number TEXT,
    rent_amount REAL NOT NULL,
    lease_duration INTEGER NOT NULL,
    room_area REAL NOT NULL,
    move_in_date DATE NOT NULL DEFAULT (date('now')),
    move_out_date DATE,
    occupancy_status TEXT NOT NULL DEFAULT 'active' CHECK (occupancy_status IN ('active', 'moved_out', 'pending')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS utility_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL DEFAULT 1,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    utility_type TEXT NOT NULL,
    total_amount REAL NOT NULL,
    allocation_method TEXT NOT NULL CHECK (allocation_method IN ('per_person', 'per_sqm', 'per_person_weighted', 'per_sqm_weighted')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
    UNIQUE(property_id, month, year, utility_type)
);

CREATE TABLE IF NOT EXISTS tenant_utility_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    utility_entry_id INTEGER NOT NULL,
    allocated_amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
    FOREIGN KEY (utility_entry_id) REFERENCES utility_entries (id) ON DELETE CASCADE,
    UNIQUE(tenant_id, utility_entry_id)
);

CREATE TABLE IF NOT EXISTS billing_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_rent_calculated REAL NOT NULL DEFAULT 0,
    total_utilities_calculated REAL NOT NULL DEFAULT 0,
    calculation_status TEXT NOT NULL DEFAULT 'pending' CHECK (calculation_status IN ('pending', 'calculated', 'finalized')),
    calculation_date DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
    UNIQUE(property_id, month, year)
);

-- Efficient date-range indexes for occupancy queries
CREATE INDEX IF NOT EXISTS idx_tenants_move_in_date ON tenants (move_in_date);
CREATE INDEX IF NOT EXISTS idx_tenants_move_out_date ON tenants (move_out_date);
CREATE INDEX IF NOT EXISTS idx_tenants_occupancy_status ON tenants (occupancy_status);
CREATE INDEX IF NOT EXISTS idx_tenants_property_occupancy ON tenants (property_id, occupancy_status, move_in_date, move_out_date);
CREATE INDEX IF NOT EXISTS idx_billing_periods_property_date ON billing_periods (property_id, year, month);
CREATE INDEX IF NOT EXISTS idx_billing_periods_status ON billing_periods (calculation_status);