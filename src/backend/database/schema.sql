CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    property_type TEXT NOT NULL,
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
    allocation_method TEXT NOT NULL CHECK (allocation_method IN ('per_person', 'per_sqm')),
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