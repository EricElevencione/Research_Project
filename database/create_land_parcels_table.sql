-- ============================================================
-- LAND PARCELS TABLE - Master Registry of Physical Land Parcels
-- ============================================================
-- This table holds the unique identity of each physical land parcel.
-- Each parcel has ONE record here, regardless of ownership changes.
-- Run this in Supabase SQL Editor
-- ============================================================

-- Create the land_parcels table
CREATE TABLE IF NOT EXISTS land_parcels (
    id SERIAL PRIMARY KEY,
    
    -- Unique parcel identifier (format: {BRGY_CODE}-{YEAR}-{SEQ})
    parcel_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Location information
    farm_location_barangay VARCHAR(100),
    farm_location_municipality VARCHAR(100) DEFAULT 'Dumangas',
    farm_location_province VARCHAR(100) DEFAULT 'Iloilo',
    
    -- Land details
    total_farm_area_ha DECIMAL(10,4),
    within_ancestral_domain BOOLEAN DEFAULT FALSE,
    agrarian_reform_beneficiary BOOLEAN DEFAULT FALSE,
    ownership_document_no VARCHAR(100),
    ownership_document_type VARCHAR(50), -- 'TCT', 'OCT', 'CLOA', 'TAX_DEC', etc.
    
    -- Geolocation (optional for future mapping features)
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    polygon_coordinates JSONB, -- For storing parcel boundaries
    
    -- Land classification
    land_type VARCHAR(50), -- 'Agricultural', 'Residential', 'Commercial', etc.
    primary_crop VARCHAR(100),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_land_parcels_parcel_number ON land_parcels(parcel_number);
CREATE INDEX IF NOT EXISTS idx_land_parcels_barangay ON land_parcels(farm_location_barangay);
CREATE INDEX IF NOT EXISTS idx_land_parcels_active ON land_parcels(is_active) WHERE is_active = TRUE;

-- Create a function to auto-generate parcel numbers
CREATE OR REPLACE FUNCTION generate_parcel_number(barangay_name VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    brgy_code VARCHAR(10);
    current_year VARCHAR(4);
    next_seq INTEGER;
    new_parcel_number VARCHAR(50);
BEGIN
    -- Generate barangay code (first 3 letters uppercase)
    brgy_code := UPPER(LEFT(REGEXP_REPLACE(barangay_name, '[^a-zA-Z]', '', 'g'), 3));
    
    -- Get current year
    current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    -- Get next sequence number for this barangay and year
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(parcel_number FROM LENGTH(brgy_code || '-' || current_year || '-') + 1)
            AS INTEGER
        )
    ), 0) + 1
    INTO next_seq
    FROM land_parcels
    WHERE parcel_number LIKE brgy_code || '-' || current_year || '-%';
    
    -- Format: BRG-2026-0001
    new_parcel_number := brgy_code || '-' || current_year || '-' || LPAD(next_seq::TEXT, 4, '0');
    
    RETURN new_parcel_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_land_parcels_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_land_parcels_timestamp
    BEFORE UPDATE ON land_parcels
    FOR EACH ROW
    EXECUTE FUNCTION update_land_parcels_timestamp();

-- Enable Row Level Security (RLS)
ALTER TABLE land_parcels ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read
CREATE POLICY "Allow authenticated read access" ON land_parcels
    FOR SELECT
    TO authenticated
    USING (true);

-- Create policy for authenticated users to insert
CREATE POLICY "Allow authenticated insert" ON land_parcels
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create policy for authenticated users to update
CREATE POLICY "Allow authenticated update" ON land_parcels
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON land_parcels TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE land_parcels_id_seq TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE land_parcels IS 'Master registry of physical land parcels. Each parcel has one record regardless of ownership changes.';
COMMENT ON COLUMN land_parcels.parcel_number IS 'Unique identifier in format: {BRGY_CODE}-{YEAR}-{SEQUENCE}';
COMMENT ON COLUMN land_parcels.ownership_document_type IS 'Type of ownership document: TCT, OCT, CLOA, TAX_DEC, etc.';

-- Verification query
SELECT 'land_parcels table created successfully!' AS status;
