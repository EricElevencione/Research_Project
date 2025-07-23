-- Table: land_rights_history
-- Tracks the history of ownership, tenancy, and usage for each land parcel

CREATE TABLE IF NOT EXISTS land_rights_history (
    id SERIAL PRIMARY KEY,
    parcel_id INTEGER NOT NULL, -- Reference to the land parcel
    person_id INTEGER NOT NULL, -- Reference to the person (farmer, owner, tenant, etc.)
    role VARCHAR(32) NOT NULL,  -- e.g., 'Owner', 'Tenant', 'Lessee', etc.
    start_date DATE NOT NULL,
    end_date DATE,              -- NULL if current
    reason VARCHAR(128),        -- Reason for change (optional)
    changed_by INTEGER,         -- User ID who made the change (optional)
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys (uncomment and adjust as needed)
    -- FOREIGN KEY (parcel_id) REFERENCES parcels(id),
    -- FOREIGN KEY (person_id) REFERENCES persons(id),
    -- FOREIGN KEY (changed_by) REFERENCES users(id)
    
    -- Add indexes for faster queries
    INDEX idx_parcel_id (parcel_id),
    INDEX idx_person_id (person_id)
);

-- Optionally, add comments for documentation
COMMENT ON TABLE land_rights_history IS 'Tracks the full history of land rights and usage for each parcel.';
COMMENT ON COLUMN land_rights_history.role IS 'Role of the person for this period (Owner, Tenant, Lessee, etc.)';
COMMENT ON COLUMN land_rights_history.reason IS 'Reason for the change (e.g., Sold, Leased, Inherited)'; 