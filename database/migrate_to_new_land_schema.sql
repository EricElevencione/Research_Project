-- ============================================================
-- MIGRATION SCRIPT - Migrate Existing Data to New Schema
-- ============================================================
-- This script migrates existing land_history data to the new schema.
-- Run this AFTER creating both land_parcels and land_history_new tables.
-- ============================================================

-- Step 1: Create land_parcels records from existing land_history data
-- Extract unique parcels based on parcel_number + barangay combination

INSERT INTO land_parcels (
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    within_ancestral_domain,
    agrarian_reform_beneficiary,
    ownership_document_no,
    created_at
)
SELECT DISTINCT ON (
    COALESCE(parcel_number, 'UNKNOWN-' || id::TEXT),
    farm_location_barangay
)
    -- Generate a parcel number if missing
    CASE 
        WHEN parcel_number IS NULL OR parcel_number = '' 
        THEN 'MIG-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(id::TEXT, 4, '0')
        ELSE parcel_number
    END AS parcel_number,
    COALESCE(farm_location_barangay, 'Unknown') AS farm_location_barangay,
    COALESCE(farm_location_municipality, 'Dumangas') AS farm_location_municipality,
    total_farm_area_ha,
    COALESCE(within_ancestral_domain, FALSE) AS within_ancestral_domain,
    COALESCE(agrarian_reform_beneficiary, FALSE) AS agrarian_reform_beneficiary,
    ownership_document_no,
    COALESCE(created_at, CURRENT_TIMESTAMP) AS created_at
FROM land_history
WHERE parcel_number IS NOT NULL AND parcel_number != ''
ON CONFLICT (parcel_number) DO NOTHING;

-- Step 2: Migrate land_history records to land_history_new
-- Link them to land_parcels via parcel_number

INSERT INTO land_history_new (
    land_parcel_id,
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
    period_start_date,
    period_end_date,
    is_current,
    change_type,
    change_reason,
    rsbsa_submission_id,
    within_ancestral_domain,
    agrarian_reform_beneficiary,
    ownership_document_no,
    created_at
)
SELECT 
    lp.id AS land_parcel_id,
    lh.parcel_number,
    lh.farm_location_barangay,
    lh.farm_location_municipality,
    lh.total_farm_area_ha,
    lh.farmer_id,
    lh.farmer_name,
    lh.farmer_ffrs_code,
    COALESCE(lh.is_registered_owner, FALSE),
    COALESCE(lh.is_tenant, FALSE),
    COALESCE(lh.is_lessee, FALSE),
    lh.land_owner_id,
    lh.land_owner_name,
    COALESCE(lh.period_start_date, CURRENT_DATE),
    lh.period_end_date,
    COALESCE(lh.is_current, TRUE),
    COALESCE(lh.change_type, 'MIGRATED'),
    COALESCE(lh.change_reason, 'Migrated from old land_history table'),
    lh.rsbsa_submission_id,
    COALESCE(lh.within_ancestral_domain, FALSE),
    COALESCE(lh.agrarian_reform_beneficiary, FALSE),
    lh.ownership_document_no,
    COALESCE(lh.created_at, CURRENT_TIMESTAMP)
FROM land_history lh
LEFT JOIN land_parcels lp ON lp.parcel_number = lh.parcel_number
WHERE lh.parcel_number IS NOT NULL AND lh.parcel_number != '';

-- Step 3: Handle orphan records (no parcel_number)
-- These get assigned a generated parcel number

INSERT INTO land_parcels (
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    created_at
)
SELECT 
    'ORPHAN-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(id::TEXT, 4, '0'),
    COALESCE(farm_location_barangay, 'Unknown'),
    COALESCE(farm_location_municipality, 'Dumangas'),
    total_farm_area_ha,
    COALESCE(created_at, CURRENT_TIMESTAMP)
FROM land_history
WHERE parcel_number IS NULL OR parcel_number = ''
ON CONFLICT (parcel_number) DO NOTHING;

-- Then migrate orphan history records
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
    created_at
)
SELECT 
    lp.id AS land_parcel_id,
    lp.parcel_number,
    COALESCE(lh.farm_location_barangay, 'Unknown'),
    COALESCE(lh.farm_location_municipality, 'Dumangas'),
    lh.total_farm_area_ha,
    lh.farmer_id,
    lh.farmer_name,
    COALESCE(lh.is_registered_owner, FALSE),
    COALESCE(lh.is_tenant, FALSE),
    COALESCE(lh.is_lessee, FALSE),
    lh.land_owner_id,
    lh.land_owner_name,
    COALESCE(lh.period_start_date, CURRENT_DATE),
    TRUE,
    'MIGRATED',
    'Migrated orphan record (no original parcel number)',
    COALESCE(lh.created_at, CURRENT_TIMESTAMP)
FROM land_history lh
JOIN land_parcels lp ON lp.parcel_number = 'ORPHAN-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(lh.id::TEXT, 4, '0')
WHERE lh.parcel_number IS NULL OR lh.parcel_number = '';

-- Step 4: Fix multiple "is_current = true" for same parcel
-- Keep only the most recent record as current

WITH ranked_history AS (
    SELECT 
        id,
        land_parcel_id,
        ROW_NUMBER() OVER (
            PARTITION BY land_parcel_id 
            ORDER BY period_start_date DESC, created_at DESC
        ) AS rn
    FROM land_history_new
    WHERE is_current = TRUE
)
UPDATE land_history_new
SET is_current = FALSE
WHERE id IN (
    SELECT id FROM ranked_history WHERE rn > 1
);

-- Step 5: Verification queries

SELECT 'Migration Summary' AS report;

SELECT 
    'Land Parcels' AS table_name,
    COUNT(*) AS record_count
FROM land_parcels
UNION ALL
SELECT 
    'Land History (New)' AS table_name,
    COUNT(*) AS record_count
FROM land_history_new
UNION ALL
SELECT 
    'Land History (Old)' AS table_name,
    COUNT(*) AS record_count
FROM land_history;

-- Check for current holders
SELECT 
    'Current Holders' AS metric,
    COUNT(*) AS count
FROM land_history_new
WHERE is_current = TRUE;

-- Sample of migrated data
SELECT 
    lp.parcel_number,
    lp.farm_location_barangay,
    lp.total_farm_area_ha,
    lhn.farmer_name,
    CASE 
        WHEN lhn.is_registered_owner THEN 'Owner'
        WHEN lhn.is_tenant THEN 'Tenant'
        WHEN lhn.is_lessee THEN 'Lessee'
        ELSE 'Unknown'
    END AS ownership_type,
    lhn.is_current
FROM land_parcels lp
LEFT JOIN land_history_new lhn ON lhn.land_parcel_id = lp.id AND lhn.is_current = TRUE
LIMIT 10;

SELECT 'Migration completed successfully!' AS status;
