-- PostgreSQL Performance Indexes
-- Optimized indexes for property management queries

-- Properties table indexes
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_area ON properties(house_area);
CREATE INDEX IF NOT EXISTS idx_properties_tenants ON properties(number_of_tenants);
CREATE INDEX IF NOT EXISTS idx_properties_created ON properties(created_at);

-- Tenants table indexes
CREATE INDEX IF NOT EXISTS idx_tenants_property ON tenants(property_id);
CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name, surname);
CREATE INDEX IF NOT EXISTS idx_tenants_emso ON tenants(emso);
CREATE INDEX IF NOT EXISTS idx_tenants_tax_number ON tenants(tax_number);
CREATE INDEX IF NOT EXISTS idx_tenants_rent ON tenants(rent_amount);
CREATE INDEX IF NOT EXISTS idx_tenants_area ON tenants(room_area);
CREATE INDEX IF NOT EXISTS idx_tenants_people ON tenants(number_of_people);
CREATE INDEX IF NOT EXISTS idx_tenants_move_in ON tenants(move_in_date);
CREATE INDEX IF NOT EXISTS idx_tenants_move_out ON tenants(move_out_date);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(property_id, move_out_date) WHERE move_out_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_created ON tenants(created_at);

-- Utility entries table indexes
CREATE INDEX IF NOT EXISTS idx_utility_entries_property ON utility_entries(property_id);
CREATE INDEX IF NOT EXISTS idx_utility_entries_period ON utility_entries(month, year);
CREATE INDEX IF NOT EXISTS idx_utility_entries_type ON utility_entries(utility_type);
CREATE INDEX IF NOT EXISTS idx_utility_entries_amount ON utility_entries(total_amount);
CREATE INDEX IF NOT EXISTS idx_utility_entries_method ON utility_entries(allocation_method);
CREATE INDEX IF NOT EXISTS idx_utility_entries_property_period ON utility_entries(property_id, month, year);
CREATE INDEX IF NOT EXISTS idx_utility_entries_created ON utility_entries(created_at);

-- Tenant utility allocations table indexes
CREATE INDEX IF NOT EXISTS idx_tenant_allocations_tenant ON tenant_utility_allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_allocations_utility ON tenant_utility_allocations(utility_entry_id);
CREATE INDEX IF NOT EXISTS idx_tenant_allocations_amount ON tenant_utility_allocations(allocated_amount);
CREATE INDEX IF NOT EXISTS idx_tenant_allocations_composite ON tenant_utility_allocations(tenant_id, utility_entry_id);
CREATE INDEX IF NOT EXISTS idx_tenant_allocations_created ON tenant_utility_allocations(created_at);

-- Billing periods table indexes
CREATE INDEX IF NOT EXISTS idx_billing_periods_property ON billing_periods(property_id);
CREATE INDEX IF NOT EXISTS idx_billing_periods_period ON billing_periods(month, year);
CREATE INDEX IF NOT EXISTS idx_billing_periods_status ON billing_periods(calculation_status);
CREATE INDEX IF NOT EXISTS idx_billing_periods_property_period ON billing_periods(property_id, month, year);
CREATE INDEX IF NOT EXISTS idx_billing_periods_rent ON billing_periods(total_rent_calculated);
CREATE INDEX IF NOT EXISTS idx_billing_periods_utilities ON billing_periods(total_utilities_calculated);
CREATE INDEX IF NOT EXISTS idx_billing_periods_created ON billing_periods(created_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tenants_property_active ON tenants(property_id) WHERE move_out_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_rent_range ON tenants(property_id, rent_amount);
CREATE INDEX IF NOT EXISTS idx_utility_property_type ON utility_entries(property_id, utility_type);
CREATE INDEX IF NOT EXISTS idx_allocations_tenant_utility ON tenant_utility_allocations(tenant_id, utility_entry_id);

-- Text search indexes for names and addresses
CREATE INDEX IF NOT EXISTS idx_properties_name_search ON properties USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_properties_address_search ON properties USING gin(to_tsvector('english', address));
CREATE INDEX IF NOT EXISTS idx_tenants_name_search ON tenants USING gin(to_tsvector('english', name || ' ' || surname));
CREATE INDEX IF NOT EXISTS idx_tenants_address_search ON tenants USING gin(to_tsvector('english', address));

-- Partial indexes for common filters
CREATE INDEX IF NOT EXISTS idx_tenants_current_month ON tenants(property_id, move_in_date) 
WHERE move_in_date <= CURRENT_DATE AND (move_out_date IS NULL OR move_out_date > CURRENT_DATE);

CREATE INDEX IF NOT EXISTS idx_utility_current_year ON utility_entries(property_id, month, utility_type) 
WHERE year = EXTRACT(year FROM CURRENT_DATE);

CREATE INDEX IF NOT EXISTS idx_billing_pending ON billing_periods(property_id, month, year) 
WHERE calculation_status = 'pending';

-- Performance statistics collection
ANALYZE properties;
ANALYZE tenants;
ANALYZE utility_entries;
ANALYZE tenant_utility_allocations;
ANALYZE billing_periods;

-- Comments for index purposes
COMMENT ON INDEX idx_properties_type IS 'Filter properties by type';
COMMENT ON INDEX idx_tenants_property IS 'Join tenants with properties';
COMMENT ON INDEX idx_tenants_active IS 'Find active tenants only';
COMMENT ON INDEX idx_utility_entries_property_period IS 'Monthly utility queries';
COMMENT ON INDEX idx_tenant_allocations_composite IS 'Tenant-utility allocation joins';
COMMENT ON INDEX idx_billing_periods_property_period IS 'Monthly billing queries';
COMMENT ON INDEX idx_tenants_name_search IS 'Full-text search on tenant names';
COMMENT ON INDEX idx_tenants_current_month IS 'Current month active tenants';
COMMENT ON INDEX idx_utility_current_year IS 'Current year utility entries';
COMMENT ON INDEX idx_billing_pending IS 'Pending billing calculations';