-- Backfill rsbsa_farm_parcels for existing farmers who don't have parcel records
-- This is needed because the original farmers were inserted without creating individual parcel records

-- First, check how many farmers are missing parcel records
SELECT 
    'Farmers without parcel records' as check_type,
    COUNT(*) as count
FROM rsbsa_submission rs
LEFT JOIN rsbsa_farm_parcels fp ON fp.submission_id = rs.id
WHERE fp.id IS NULL;

-- Step 1: Alter parcel_number column to support longer values
ALTER TABLE rsbsa_farm_parcels 
ALTER COLUMN parcel_number TYPE VARCHAR(50);

ALTER TABLE land_parcels 
ALTER COLUMN parcel_number TYPE VARCHAR(50);

-- Step 2: Add missing columns to land_history if they don't exist
ALTER TABLE land_history 
ADD COLUMN IF NOT EXISTS farm_parcel_id BIGINT,
ADD COLUMN IF NOT EXISTS rsbsa_submission_id BIGINT,
ADD COLUMN IF NOT EXISTS land_owner_ffrs_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS farmer_id BIGINT,
ADD COLUMN IF NOT EXISTS farmer_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS farmer_ffrs_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS tenant_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS tenant_ffrs_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_tenant BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lessee_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS lessee_ffrs_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_lessee BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_registered_owner BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_other_ownership BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ownership_document_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS agrarian_reform_beneficiary BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS within_ancestral_domain BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS change_type VARCHAR(20) DEFAULT 'NEW',
ADD COLUMN IF NOT EXISTS period_start_date DATE DEFAULT CURRENT_DATE;

-- Insert parcel records for farmers who don't have them
-- Use data from the rsbsa_submission table (FARM LOCATION and TOTAL FARM AREA)
INSERT INTO rsbsa_farm_parcels (
    submission_id,
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    within_ancestral_domain,
    agrarian_reform_beneficiary,
    ownership_type_registered_owner,
    ownership_type_tenant,
    ownership_type_lessee,
    is_current_owner,
    created_at
)
SELECT 
    rs.id as submission_id,
    rs."FFRS_CODE" as parcel_number,
    SPLIT_PART(rs."FARM LOCATION", ',', 1) as farm_location_barangay,
    COALESCE(TRIM(SPLIT_PART(rs."FARM LOCATION", ',', 2)), 'Dumangas') as farm_location_municipality,
    rs."TOTAL FARM AREA" as total_farm_area_ha,
    'No' as within_ancestral_domain,
    'No' as agrarian_reform_beneficiary,
    COALESCE(rs."OWNERSHIP_TYPE_REGISTERED_OWNER", true) as ownership_type_registered_owner,
    COALESCE(rs."OWNERSHIP_TYPE_TENANT", false) as ownership_type_tenant,
    COALESCE(rs."OWNERSHIP_TYPE_LESSEE", false) as ownership_type_lessee,
    true as is_current_owner,
    COALESCE(rs.created_at, NOW()) as created_at
FROM rsbsa_submission rs
LEFT JOIN rsbsa_farm_parcels fp ON fp.submission_id = rs.id
WHERE fp.id IS NULL
  AND rs."FARM LOCATION" IS NOT NULL
  AND rs."TOTAL FARM AREA" IS NOT NULL
  AND rs."TOTAL FARM AREA" > 0;

-- Also create corresponding land_parcels entries if they don't exist
INSERT INTO land_parcels (
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    created_at
)
SELECT DISTINCT
    rs."FFRS_CODE" as parcel_number,
    SPLIT_PART(rs."FARM LOCATION", ',', 1) as farm_location_barangay,
    COALESCE(TRIM(SPLIT_PART(rs."FARM LOCATION", ',', 2)), 'Dumangas') as farm_location_municipality,
    rs."TOTAL FARM AREA" as total_farm_area_ha,
    COALESCE(rs.created_at, NOW()) as created_at
FROM rsbsa_submission rs
LEFT JOIN land_parcels lp ON lp.parcel_number = rs."FFRS_CODE"
WHERE lp.id IS NULL
  AND rs."FARM LOCATION" IS NOT NULL
  AND rs."TOTAL FARM AREA" IS NOT NULL
  AND rs."TOTAL FARM AREA" > 0
ON CONFLICT (parcel_number) DO NOTHING;

-- Update existing parcel records that have "1", "2", etc. to use FFRS_CODE
UPDATE rsbsa_farm_parcels fp
SET parcel_number = rs."FFRS_CODE"
FROM rsbsa_submission rs
WHERE fp.submission_id = rs.id
  AND fp.parcel_number ~ '^[0-9]+$'
  AND rs."FFRS_CODE" IS NOT NULL;

-- Verify the results
SELECT 
    'Farmers with parcel records' as check_type,
    COUNT(DISTINCT rs.id) as farmer_count,
    COUNT(fp.id) as parcel_count
FROM rsbsa_submission rs
LEFT JOIN rsbsa_farm_parcels fp ON fp.submission_id = rs.id;

-- Show sample data
SELECT 
    rs.id,
    rs."FIRST NAME" || ' ' || rs."LAST NAME" as farmer_name,
    rs."FFRS_CODE",
    fp.parcel_number,
    fp.farm_location_barangay,
    fp.total_farm_area_ha,
    fp.is_current_owner
FROM rsbsa_submission rs
LEFT JOIN rsbsa_farm_parcels fp ON fp.submission_id = rs.id
ORDER BY rs.id DESC
LIMIT 10;
