-- ============================================================
-- LAND HISTORY TABLE - Redesign for Proper Ownership Tracking
-- ============================================================
-- This table tracks ownership changes over time.
-- Each row represents a period when someone held rights to a parcel.
-- Run this in Supabase SQL Editor AFTER create_land_parcels_table.sql
-- ============================================================

-- First, backup existing data if any
CREATE TABLE IF NOT EXISTS land_history_backup AS 
SELECT * FROM land_history;

-- Drop existing table (we're redesigning it)
-- Comment this out if you want to keep existing data
-- DROP TABLE IF EXISTS land_history CASCADE;

-- Create the redesigned land_history table
CREATE TABLE IF NOT EXISTS land_history_new (
    id SERIAL PRIMARY KEY,
    
    -- Link to master parcel registry
    land_parcel_id INTEGER REFERENCES land_parcels(id) ON DELETE CASCADE,
    parcel_number VARCHAR(50), -- Denormalized for quick queries
    
    -- Location info (denormalized for reporting)
    farm_location_barangay VARCHAR(100),
    farm_location_municipality VARCHAR(100) DEFAULT 'Dumangas',
    total_farm_area_ha DECIMAL(10,4),
    
    -- Current holder information
    farmer_id INTEGER, -- References rsbsa_submission.id
    farmer_name VARCHAR(200),
    farmer_ffrs_code VARCHAR(50),
    
    -- Ownership type flags (only ONE should be true per record)
    is_registered_owner BOOLEAN DEFAULT FALSE,
    is_tenant BOOLEAN DEFAULT FALSE,
    is_lessee BOOLEAN DEFAULT FALSE,
    
    -- For tenants/lessees: who owns the land
    land_owner_id INTEGER, -- References the owner's rsbsa_submission.id or farmer record
    land_owner_name VARCHAR(200),
    
    -- Time period tracking
    period_start_date DATE NOT NULL,
    period_end_date DATE, -- NULL means this is the current holder
    is_current BOOLEAN DEFAULT TRUE,
    
    -- Change/Transfer tracking
    change_type VARCHAR(50) NOT NULL DEFAULT 'NEW',
    -- Possible values: 'NEW', 'TRANSFER', 'INHERITANCE', 'LEASE_START', 
    --                  'LEASE_END', 'TENANT_CHANGE', 'CORRECTION'
    change_reason TEXT,
    
    -- Link to previous holder (creates ownership chain)
    previous_history_id INTEGER REFERENCES land_history_new(id),
    
    -- Reference to RSBSA submission that created this record
    rsbsa_submission_id INTEGER,
    
    -- Document references
    within_ancestral_domain BOOLEAN DEFAULT FALSE,
    agrarian_reform_beneficiary BOOLEAN DEFAULT FALSE,
    ownership_document_no VARCHAR(100),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    notes TEXT
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_land_history_new_parcel_id ON land_history_new(land_parcel_id);
CREATE INDEX IF NOT EXISTS idx_land_history_new_parcel_number ON land_history_new(parcel_number);
CREATE INDEX IF NOT EXISTS idx_land_history_new_farmer ON land_history_new(farmer_id);
CREATE INDEX IF NOT EXISTS idx_land_history_new_current ON land_history_new(is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_land_history_new_owner ON land_history_new(land_owner_id);
CREATE INDEX IF NOT EXISTS idx_land_history_new_dates ON land_history_new(period_start_date, period_end_date);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_land_history_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_land_history_timestamp
    BEFORE UPDATE ON land_history_new
    FOR EACH ROW
    EXECUTE FUNCTION update_land_history_timestamp();

-- Function to transfer ownership (closes previous record, creates new one)
CREATE OR REPLACE FUNCTION transfer_land_ownership(
    p_land_parcel_id INTEGER,
    p_new_farmer_id INTEGER,
    p_new_farmer_name VARCHAR,
    p_is_owner BOOLEAN,
    p_is_tenant BOOLEAN,
    p_is_lessee BOOLEAN,
    p_land_owner_id INTEGER DEFAULT NULL,
    p_land_owner_name VARCHAR DEFAULT NULL,
    p_change_type VARCHAR DEFAULT 'TRANSFER',
    p_change_reason TEXT DEFAULT NULL,
    p_rsbsa_submission_id INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_previous_id INTEGER;
    v_parcel_number VARCHAR;
    v_barangay VARCHAR;
    v_municipality VARCHAR;
    v_area DECIMAL;
    v_new_id INTEGER;
BEGIN
    -- Get current holder's record and parcel info
    SELECT 
        lh.id,
        lh.parcel_number,
        lh.farm_location_barangay,
        lh.farm_location_municipality,
        lh.total_farm_area_ha
    INTO 
        v_previous_id,
        v_parcel_number,
        v_barangay,
        v_municipality,
        v_area
    FROM land_history_new lh
    WHERE lh.land_parcel_id = p_land_parcel_id 
      AND lh.is_current = TRUE
    LIMIT 1;
    
    -- If no parcel info from history, get from land_parcels
    IF v_parcel_number IS NULL THEN
        SELECT 
            parcel_number,
            farm_location_barangay,
            farm_location_municipality,
            total_farm_area_ha
        INTO 
            v_parcel_number,
            v_barangay,
            v_municipality,
            v_area
        FROM land_parcels
        WHERE id = p_land_parcel_id;
    END IF;
    
    -- Close the previous holder's record
    IF v_previous_id IS NOT NULL THEN
        UPDATE land_history_new
        SET 
            is_current = FALSE,
            period_end_date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_previous_id;
    END IF;
    
    -- Create new ownership record
    INSERT INTO land_history_new (
        land_parcel_id,
        parcel_number,
        farm_location_barangay,
        farm_location_municipality,
        total_farm_area_ha,
        farmer_id,
        farmer_name,
        is_registered_owner,
        is_tenant,
        is_lessee,
        land_owner_id,
        land_owner_name,
        period_start_date,
        is_current,
        change_type,
        change_reason,
        previous_history_id,
        rsbsa_submission_id
    ) VALUES (
        p_land_parcel_id,
        v_parcel_number,
        v_barangay,
        v_municipality,
        v_area,
        p_new_farmer_id,
        p_new_farmer_name,
        p_is_owner,
        p_is_tenant,
        p_is_lessee,
        p_land_owner_id,
        p_land_owner_name,
        CURRENT_DATE,
        TRUE,
        p_change_type,
        p_change_reason,
        v_previous_id,
        p_rsbsa_submission_id
    )
    RETURNING id INTO v_new_id;
    
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS)
ALTER TABLE land_history_new ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated read access" ON land_history_new
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON land_history_new
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON land_history_new
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON land_history_new TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE land_history_new_id_seq TO authenticated;

-- Add comments
COMMENT ON TABLE land_history_new IS 'Tracks ownership/tenancy changes over time. Each row = one holder for one period.';
COMMENT ON COLUMN land_history_new.previous_history_id IS 'Links to the previous holder, creating an ownership chain';
COMMENT ON COLUMN land_history_new.is_current IS 'TRUE if this is the current holder. Only ONE record per parcel should be current.';
COMMENT ON FUNCTION transfer_land_ownership IS 'Transfers ownership: closes previous record and creates new one with proper linking';

-- Verification
SELECT 'land_history_new table created successfully!' AS status;
