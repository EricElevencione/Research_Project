-- Create a table to store individual farm parcels for RSBSA submissions
-- Each parcel will be a separate record linked to a farmer submission

CREATE TABLE IF NOT EXISTS rsbsa_farm_parcels (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT REFERENCES rsbsa_submission(id) ON DELETE CASCADE,
    parcel_number VARCHAR(20) NOT NULL,
    farm_location_barangay VARCHAR(100),
    farm_location_municipality VARCHAR(100),
    total_farm_area_ha DECIMAL(10,2),
    within_ancestral_domain VARCHAR(10) CHECK (within_ancestral_domain IN ('Yes', 'No')),
    ownership_document_no VARCHAR(100),
    agrarian_reform_beneficiary VARCHAR(10) CHECK (agrarian_reform_beneficiary IN ('Yes', 'No')),
    ownership_type_registered_owner BOOLEAN DEFAULT FALSE,
    ownership_type_tenant BOOLEAN DEFAULT FALSE,
    ownership_type_lessee BOOLEAN DEFAULT FALSE,
    ownership_type_others BOOLEAN DEFAULT FALSE,
    tenant_land_owner_name VARCHAR(200),
    lessee_land_owner_name VARCHAR(200),
    ownership_others_specify TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rsbsa_farm_parcels_submission_id ON rsbsa_farm_parcels(submission_id);
CREATE INDEX IF NOT EXISTS idx_rsbsa_farm_parcels_parcel_number ON rsbsa_farm_parcels(parcel_number);
CREATE INDEX IF NOT EXISTS idx_rsbsa_farm_parcels_barangay ON rsbsa_farm_parcels(farm_location_barangay);
CREATE INDEX IF NOT EXISTS idx_rsbsa_farm_parcels_municipality ON rsbsa_farm_parcels(farm_location_municipality);
CREATE INDEX IF NOT EXISTS idx_rsbsa_farm_parcels_area ON rsbsa_farm_parcels(total_farm_area_ha);

-- Add table comments
COMMENT ON TABLE rsbsa_farm_parcels IS 'Stores individual farm parcels for each RSBSA submission';
COMMENT ON COLUMN rsbsa_farm_parcels.submission_id IS 'Reference to the main RSBSA submission';
COMMENT ON COLUMN rsbsa_farm_parcels.parcel_number IS 'Parcel number (1, 2, 3, etc.)';
COMMENT ON COLUMN rsbsa_farm_parcels.farm_location_barangay IS 'Barangay where the farm parcel is located';
COMMENT ON COLUMN rsbsa_farm_parcels.farm_location_municipality IS 'Municipality where the farm parcel is located';
COMMENT ON COLUMN rsbsa_farm_parcels.total_farm_area_ha IS 'Area of this specific parcel in hectares';
COMMENT ON COLUMN rsbsa_farm_parcels.within_ancestral_domain IS 'Whether this parcel is within ancestral domain';
COMMENT ON COLUMN rsbsa_farm_parcels.ownership_document_no IS 'Document number proving ownership of this parcel';
COMMENT ON COLUMN rsbsa_farm_parcels.agrarian_reform_beneficiary IS 'Whether the farmer is an agrarian reform beneficiary for this parcel';
COMMENT ON COLUMN rsbsa_farm_parcels.ownership_type_registered_owner IS 'Whether the farmer is the registered owner of this parcel';
COMMENT ON COLUMN rsbsa_farm_parcels.ownership_type_tenant IS 'Whether the farmer is a tenant of this parcel';
COMMENT ON COLUMN rsbsa_farm_parcels.ownership_type_lessee IS 'Whether the farmer is a lessee of this parcel';
COMMENT ON COLUMN rsbsa_farm_parcels.ownership_type_others IS 'Whether the farmer has other ownership type for this parcel';
COMMENT ON COLUMN rsbsa_farm_parcels.tenant_land_owner_name IS 'Name of land owner if farmer is a tenant';
COMMENT ON COLUMN rsbsa_farm_parcels.lessee_land_owner_name IS 'Name of land owner if farmer is a lessee';
COMMENT ON COLUMN rsbsa_farm_parcels.ownership_others_specify IS 'Specification of other ownership type';
