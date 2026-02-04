-- ============================================================
-- POPULATE LAND HISTORY FROM EXISTING RSBSA DATA
-- ============================================================
-- This script populates the land_history table from existing
-- rsbsa_submission and rsbsa_farm_parcels records.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Step 1: Preview the data we'll be inserting
SELECT 
    rs.id as farmer_id,
    TRIM(CONCAT(
        COALESCE(rs."FIRST NAME", ''), ' ',
        COALESCE(rs."MIDDLE NAME", ''), ' ',
        COALESCE(rs."LAST NAME", '')
    )) as farmer_name,
    rs."FFRS_CODE" as ffrs_code,
    fp.id as parcel_id,
    fp.parcel_number,
    fp.farm_location_barangay,
    fp.farm_location_municipality,
    fp.total_farm_area_ha,
    fp.ownership_type_registered_owner,
    fp.ownership_type_tenant,
    fp.ownership_type_lessee
FROM rsbsa_submission rs
JOIN rsbsa_farm_parcels fp ON fp.submission_id = rs.id
WHERE fp.ownership_type_registered_owner = true
LIMIT 20;

-- Step 2: Insert into land_history from existing data
-- Only insert if not already exists (avoid duplicates)
INSERT INTO land_history (
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    farmer_id,
    farmer_name,
    farmer_ffrs_code,
    is_registered_owner,
    is_tenant,
    is_lessee,
    land_owner_id,
    land_owner_name,
    is_current,
    period_start_date,
    change_type,
    change_reason,
    rsbsa_submission_id,
    within_ancestral_domain,
    agrarian_reform_beneficiary,
    ownership_document_no,
    created_at
)
SELECT 
    COALESCE(fp.parcel_number, 'PARCEL-' || fp.id::TEXT) as parcel_number,
    fp.farm_location_barangay,
    COALESCE(fp.farm_location_municipality, 'Dumangas') as farm_location_municipality,
    COALESCE(fp.total_farm_area_ha, 0) as total_farm_area_ha,
    rs.id as farmer_id,
    TRIM(CONCAT(
        COALESCE(rs."FIRST NAME", ''), ' ',
        COALESCE(rs."MIDDLE NAME", ''), ' ',
        COALESCE(rs."LAST NAME", '')
    )) as farmer_name,
    rs."FFRS_CODE" as farmer_ffrs_code,
    COALESCE(fp.ownership_type_registered_owner, false) as is_registered_owner,
    COALESCE(fp.ownership_type_tenant, false) as is_tenant,
    COALESCE(fp.ownership_type_lessee, false) as is_lessee,
    -- For registered owners, they are their own land owner
    CASE WHEN fp.ownership_type_registered_owner = true THEN rs.id ELSE NULL END as land_owner_id,
    CASE WHEN fp.ownership_type_registered_owner = true 
         THEN TRIM(CONCAT(COALESCE(rs."FIRST NAME", ''), ' ', COALESCE(rs."MIDDLE NAME", ''), ' ', COALESCE(rs."LAST NAME", '')))
         ELSE NULL 
    END as land_owner_name,
    true as is_current,  -- All existing records are current
    COALESCE(rs.created_at::date, CURRENT_DATE) as period_start_date,
    'EXISTING' as change_type,
    'Migrated from existing RSBSA registration' as change_reason,
    rs.id as rsbsa_submission_id,
    COALESCE(fp.within_ancestral_domain = 'Yes' OR fp.within_ancestral_domain::text = 'true', false) as within_ancestral_domain,
    COALESCE(fp.agrarian_reform_beneficiary = 'Yes' OR fp.agrarian_reform_beneficiary::text = 'true', false) as agrarian_reform_beneficiary,
    fp.ownership_document_no,
    COALESCE(rs.created_at, CURRENT_TIMESTAMP) as created_at
FROM rsbsa_submission rs
JOIN rsbsa_farm_parcels fp ON fp.submission_id = rs.id
WHERE NOT EXISTS (
    -- Avoid duplicates: check if this farmer+parcel combo already exists
    SELECT 1 FROM land_history lh 
    WHERE lh.farmer_id = rs.id 
      AND lh.parcel_number = fp.parcel_number
);

-- Step 3: Verify what was inserted
SELECT 
    id,
    farmer_name,
    parcel_number,
    farm_location_barangay,
    is_current,
    is_registered_owner,
    is_tenant,
    is_lessee
FROM land_history
WHERE is_current = true AND is_registered_owner = true
ORDER BY farmer_name
LIMIT 20;

-- Step 4: Count searchable records
SELECT COUNT(*) as searchable_registered_owners 
FROM land_history 
WHERE is_current = true 
  AND is_registered_owner = true 
  AND farmer_name IS NOT NULL 
  AND farmer_name != '';
