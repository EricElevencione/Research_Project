-- ============================================================================
-- MIGRATION SCRIPT: Populate land_history from existing data
-- ============================================================================
-- Purpose: Migrate existing farm parcel data to the new land_history table
-- Run this AFTER creating the improved land_history table
-- ============================================================================

-- ============================================================================
-- STEP 1: Disable triggers temporarily (to avoid duplicates)
-- ============================================================================

ALTER TABLE rsbsa_farm_parcels DISABLE TRIGGER trigger_create_land_history_on_parcel_insert;
ALTER TABLE rsbsa_farm_parcels DISABLE TRIGGER trigger_update_land_history_on_parcel_update;

-- ============================================================================
-- STEP 2: Populate land_history from existing rsbsa_farm_parcels
-- ============================================================================

INSERT INTO land_history (
    rsbsa_submission_id,
    farm_parcel_id,
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    land_owner_name,
    land_owner_ffrs_code,
    farmer_id,
    farmer_name,
    farmer_ffrs_code,
    tenant_name,
    tenant_ffrs_code,
    is_tenant,
    lessee_name,
    lessee_ffrs_code,
    is_lessee,
    is_registered_owner,
    is_other_ownership,
    ownership_type_details,
    ownership_document_no,
    agrarian_reform_beneficiary,
    within_ancestral_domain,
    change_type,
    is_current,
    period_start_date,
    created_at
)
SELECT 
    fp.submission_id,
    fp.id,
    fp.parcel_number,
    fp.farm_location_barangay,
    fp.farm_location_municipality,
    fp.total_farm_area_ha,
    
    -- Determine land owner name based on ownership type
    CASE 
        WHEN fp.ownership_type_registered_owner THEN 
            CONCAT_WS(' ',
                rs."FIRST NAME",
                rs."MIDDLE NAME",
                rs."LAST NAME",
                NULLIF(rs."EXT NAME", '')
            )
        WHEN fp.ownership_type_tenant THEN fp.tenant_land_owner_name
        WHEN fp.ownership_type_lessee THEN fp.lessee_land_owner_name
        ELSE 
            CONCAT_WS(' ',
                rs."FIRST NAME",
                rs."MIDDLE NAME",
                rs."LAST NAME",
                NULLIF(rs."EXT NAME", '')
            )
    END,
    
    -- Land owner FFRS code (only if farmer is the owner)
    CASE 
        WHEN fp.ownership_type_registered_owner THEN rs."FFRS_CODE"
        ELSE NULL
    END,
    
    -- Farmer information
    fp.submission_id,
    CONCAT_WS(' ',
        rs."FIRST NAME",
        rs."MIDDLE NAME",
        rs."LAST NAME",
        NULLIF(rs."EXT NAME", '')
    ),
    rs."FFRS_CODE",
    
    -- Tenant information
    CASE 
        WHEN fp.ownership_type_tenant THEN 
            CONCAT_WS(' ',
                rs."FIRST NAME",
                rs."MIDDLE NAME",
                rs."LAST NAME",
                NULLIF(rs."EXT NAME", '')
            )
        ELSE NULL 
    END,
    CASE WHEN fp.ownership_type_tenant THEN rs."FFRS_CODE" ELSE NULL END,
    fp.ownership_type_tenant,
    
    -- Lessee information
    CASE 
        WHEN fp.ownership_type_lessee THEN 
            CONCAT_WS(' ',
                rs."FIRST NAME",
                rs."MIDDLE NAME",
                rs."LAST NAME",
                NULLIF(rs."EXT NAME", '')
            )
        ELSE NULL 
    END,
    CASE WHEN fp.ownership_type_lessee THEN rs."FFRS_CODE" ELSE NULL END,
    fp.ownership_type_lessee,
    
    -- Ownership flags
    fp.ownership_type_registered_owner,
    fp.ownership_type_others,
    fp.ownership_others_specify,
    
    -- Documents
    fp.ownership_document_no,
    CASE WHEN fp.agrarian_reform_beneficiary = 'Yes' THEN TRUE ELSE FALSE END,
    CASE WHEN fp.within_ancestral_domain = 'Yes' THEN TRUE ELSE FALSE END,
    
    -- History tracking
    'NEW',  -- Initial migration records are marked as NEW
    TRUE,   -- All migrated records are current
    COALESCE(fp.created_at::DATE, CURRENT_DATE),  -- Use parcel creation date as start date
    fp.created_at
FROM rsbsa_farm_parcels fp
INNER JOIN rsbsa_submission rs ON fp.submission_id = rs.id
WHERE NOT EXISTS (
    -- Avoid duplicates if already populated
    SELECT 1 FROM land_history lh 
    WHERE lh.farm_parcel_id = fp.id
)
ORDER BY fp.submission_id, fp.parcel_number;

-- ============================================================================
-- STEP 3: Re-enable triggers
-- ============================================================================

ALTER TABLE rsbsa_farm_parcels ENABLE TRIGGER trigger_create_land_history_on_parcel_insert;
ALTER TABLE rsbsa_farm_parcels ENABLE TRIGGER trigger_update_land_history_on_parcel_update;

-- ============================================================================
-- STEP 4: Verification queries
-- ============================================================================

-- Count records migrated
SELECT 
    'Farm Parcels' as table_name,
    COUNT(*) as record_count
FROM rsbsa_farm_parcels
UNION ALL
SELECT 
    'Land History' as table_name,
    COUNT(*) as record_count
FROM land_history;

-- Check for any farm parcels without land history
SELECT 
    fp.id,
    fp.parcel_number,
    fp.submission_id,
    'Missing land history record' as issue
FROM rsbsa_farm_parcels fp
LEFT JOIN land_history lh ON fp.id = lh.farm_parcel_id
WHERE lh.id IS NULL;

-- Summary by ownership type
SELECT 
    CASE 
        WHEN is_registered_owner THEN 'Owner'
        WHEN is_tenant THEN 'Tenant'
        WHEN is_lessee THEN 'Lessee'
        WHEN is_other_ownership THEN 'Other'
        ELSE 'Unknown'
    END as ownership_type,
    COUNT(*) as count,
    SUM(total_farm_area_ha) as total_area_ha
FROM land_history
WHERE is_current = TRUE
GROUP BY 
    CASE 
        WHEN is_registered_owner THEN 'Owner'
        WHEN is_tenant THEN 'Tenant'
        WHEN is_lessee THEN 'Lessee'
        WHEN is_other_ownership THEN 'Other'
        ELSE 'Unknown'
    END
ORDER BY count DESC;

-- ============================================================================
-- Migration Complete!
-- ============================================================================

SELECT 'Migration completed successfully!' as status;
