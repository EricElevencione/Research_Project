-- ============================================================================
-- LAND HISTORY QUERY EXAMPLES
-- ============================================================================
-- Purpose: Useful queries for working with the land_history table
-- ============================================================================

-- ============================================================================
-- 1. GET CURRENT LAND OWNERSHIP STATUS FOR ALL PARCELS
-- ============================================================================
-- Shows the current ownership/tenancy status for all active land parcels

SELECT 
    lh.id,
    lh.parcel_number,
    lh.farm_location_barangay,
    lh.farm_location_municipality,
    lh.total_farm_area_ha,
    lh.land_owner_name,
    lh.farmer_name,
    CASE 
        WHEN lh.is_registered_owner THEN 'Owner'
        WHEN lh.is_tenant THEN 'Tenant'
        WHEN lh.is_lessee THEN 'Lessee'
        ELSE 'Other'
    END as ownership_status,
    lh.period_start_date,
    lh.created_at
FROM land_history lh
WHERE lh.is_current = TRUE
ORDER BY lh.farm_location_barangay, lh.land_owner_name;

-- ============================================================================
-- 2. GET COMPLETE HISTORY FOR A SPECIFIC LAND PARCEL
-- ============================================================================
-- Shows all historical records for a specific parcel (change over time)

SELECT 
    lh.id,
    lh.change_type,
    lh.land_owner_name,
    lh.farmer_name,
    CASE 
        WHEN lh.is_registered_owner THEN 'Owner'
        WHEN lh.is_tenant THEN 'Tenant'
        WHEN lh.is_lessee THEN 'Lessee'
        ELSE 'Other'
    END as ownership_status,
    lh.period_start_date,
    lh.period_end_date,
    lh.is_current,
    lh.change_reason,
    lh.created_at
FROM land_history lh
WHERE lh.farm_parcel_id = 1  -- Replace with specific parcel ID
ORDER BY lh.created_at DESC;

-- ============================================================================
-- 3. GET ALL LANDS OWNED BY A SPECIFIC PERSON (AS LAND OWNER)
-- ============================================================================
-- Find all lands where a specific person is the registered owner

SELECT 
    lh.parcel_number,
    lh.farm_location_barangay,
    lh.farm_location_municipality,
    lh.total_farm_area_ha,
    lh.farmer_name,
    CASE 
        WHEN lh.farmer_name = lh.land_owner_name THEN 'Self-Farmed'
        WHEN lh.is_tenant THEN 'Rented to Tenant'
        WHEN lh.is_lessee THEN 'Leased to Lessee'
        ELSE 'Other Arrangement'
    END as farming_arrangement,
    lh.period_start_date,
    lh.ownership_document_no
FROM land_history lh
WHERE lh.land_owner_name = 'John Doe'  -- Replace with actual name
  AND lh.is_current = TRUE
ORDER BY lh.farm_location_barangay, lh.parcel_number;

-- ============================================================================
-- 4. GET ALL LANDS RENTED BY A SPECIFIC PERSON (AS TENANT)
-- ============================================================================
-- Find all lands where a person is farming as a tenant

SELECT 
    lh.parcel_number,
    lh.farm_location_barangay,
    lh.farm_location_municipality,
    lh.total_farm_area_ha,
    lh.land_owner_name,
    lh.tenant_name,
    lh.period_start_date,
    EXTRACT(YEAR FROM AGE(COALESCE(lh.period_end_date, CURRENT_DATE), lh.period_start_date)) as years_as_tenant
FROM land_history lh
WHERE lh.is_tenant = TRUE
  AND lh.tenant_name = 'Jane Smith'  -- Replace with actual name
  AND lh.is_current = TRUE
ORDER BY lh.farm_location_barangay, lh.parcel_number;

-- ============================================================================
-- 5. LAND OWNERSHIP SUMMARY BY BARANGAY
-- ============================================================================
-- Statistical summary of land ownership types per barangay

SELECT 
    lh.farm_location_barangay,
    COUNT(*) as total_parcels,
    SUM(lh.total_farm_area_ha) as total_area_ha,
    SUM(CASE WHEN lh.is_registered_owner THEN 1 ELSE 0 END) as owner_operated,
    SUM(CASE WHEN lh.is_tenant THEN 1 ELSE 0 END) as tenant_operated,
    SUM(CASE WHEN lh.is_lessee THEN 1 ELSE 0 END) as lessee_operated,
    SUM(CASE WHEN lh.agrarian_reform_beneficiary THEN 1 ELSE 0 END) as agrarian_reform_count
FROM land_history lh
WHERE lh.is_current = TRUE
GROUP BY lh.farm_location_barangay
ORDER BY total_area_ha DESC;

-- ============================================================================
-- 6. FIND LAND OWNERS WITH MULTIPLE TENANTS
-- ============================================================================
-- Identify land owners who rent out to multiple tenants

SELECT 
    lh.land_owner_name,
    COUNT(DISTINCT lh.tenant_name) as number_of_tenants,
    COUNT(*) as number_of_parcels,
    SUM(lh.total_farm_area_ha) as total_area_rented_ha,
    STRING_AGG(DISTINCT lh.tenant_name, ', ') as tenant_names
FROM land_history lh
WHERE lh.is_tenant = TRUE
  AND lh.is_current = TRUE
GROUP BY lh.land_owner_name
HAVING COUNT(DISTINCT lh.tenant_name) > 1
ORDER BY number_of_tenants DESC, total_area_rented_ha DESC;

-- ============================================================================
-- 7. TENANT/LESSEE HISTORY DROPDOWN DATA
-- ============================================================================
-- Get history of all tenants/lessees who have farmed a specific land parcel
-- Perfect for populating dropdown menus in the UI

SELECT 
    lh.id,
    lh.farmer_name,
    lh.farmer_ffrs_code,
    CASE 
        WHEN lh.is_tenant THEN 'Tenant'
        WHEN lh.is_lessee THEN 'Lessee'
        WHEN lh.is_registered_owner THEN 'Owner'
        ELSE 'Other'
    END as relationship_type,
    lh.period_start_date,
    lh.period_end_date,
    CASE 
        WHEN lh.is_current THEN 'Current'
        ELSE 'Past'
    END as status,
    CASE 
        WHEN lh.period_end_date IS NOT NULL THEN 
            EXTRACT(YEAR FROM AGE(lh.period_end_date, lh.period_start_date)) || ' years'
        ELSE 
            EXTRACT(YEAR FROM AGE(CURRENT_DATE, lh.period_start_date)) || ' years (ongoing)'
    END as duration
FROM land_history lh
WHERE lh.farm_parcel_id = 1  -- Replace with specific parcel ID
  AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE)
ORDER BY lh.is_current DESC, lh.period_start_date DESC;

-- ============================================================================
-- 8. GET ALL PARCELS WITH THEIR CURRENT AND PREVIOUS OWNERS
-- ============================================================================
-- Shows current owner and most recent previous owner for each parcel

WITH current_ownership AS (
    SELECT 
        farm_parcel_id,
        land_owner_name as current_owner,
        farmer_name as current_farmer,
        period_start_date as current_since,
        total_farm_area_ha,
        farm_location_barangay
    FROM land_history
    WHERE is_current = TRUE
),
previous_ownership AS (
    SELECT DISTINCT ON (farm_parcel_id)
        farm_parcel_id,
        land_owner_name as previous_owner,
        farmer_name as previous_farmer,
        period_end_date as previous_until
    FROM land_history
    WHERE is_current = FALSE
    ORDER BY farm_parcel_id, period_end_date DESC
)
SELECT 
    co.farm_parcel_id,
    co.farm_location_barangay,
    co.total_farm_area_ha,
    co.current_owner,
    co.current_farmer,
    co.current_since,
    po.previous_owner,
    po.previous_farmer,
    po.previous_until
FROM current_ownership co
LEFT JOIN previous_ownership po ON co.farm_parcel_id = po.farm_parcel_id
ORDER BY co.farm_location_barangay, co.current_owner;

-- ============================================================================
-- 9. IDENTIFY RECENT OWNERSHIP CHANGES (LAST 30 DAYS)
-- ============================================================================
-- Find land parcels where ownership/tenancy changed recently

SELECT 
    lh.farm_parcel_id,
    lh.parcel_number,
    lh.farm_location_barangay,
    lh.change_type,
    lh.land_owner_name,
    lh.farmer_name,
    lh.period_start_date,
    lh.change_reason,
    lh.created_at
FROM land_history lh
WHERE lh.created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND lh.change_type IN ('OWNERSHIP_CHANGE', 'TENANT_CHANGE')
ORDER BY lh.created_at DESC;

-- ============================================================================
-- 10. GET COMPREHENSIVE LAND OWNER PROFILE
-- ============================================================================
-- Complete profile of a land owner including owned and rented lands

WITH owned_lands AS (
    SELECT 
        land_owner_name,
        COUNT(*) as parcels_owned,
        SUM(total_farm_area_ha) as total_owned_area,
        SUM(CASE WHEN farmer_name = land_owner_name THEN total_farm_area_ha ELSE 0 END) as self_farmed_area,
        SUM(CASE WHEN is_tenant THEN total_farm_area_ha ELSE 0 END) as rented_out_area
    FROM land_history
    WHERE is_current = TRUE 
      AND is_registered_owner = TRUE
    GROUP BY land_owner_name
),
rented_lands AS (
    SELECT 
        farmer_name,
        COUNT(*) as parcels_rented,
        SUM(total_farm_area_ha) as total_rented_area
    FROM land_history
    WHERE is_current = TRUE 
      AND (is_tenant = TRUE OR is_lessee = TRUE)
    GROUP BY farmer_name
)
SELECT 
    COALESCE(ol.land_owner_name, rl.farmer_name) as person_name,
    COALESCE(ol.parcels_owned, 0) as parcels_owned,
    COALESCE(ol.total_owned_area, 0) as total_owned_ha,
    COALESCE(ol.self_farmed_area, 0) as self_farmed_ha,
    COALESCE(ol.rented_out_area, 0) as rented_out_ha,
    COALESCE(rl.parcels_rented, 0) as parcels_rented,
    COALESCE(rl.total_rented_area, 0) as total_rented_ha,
    COALESCE(ol.self_farmed_area, 0) + COALESCE(rl.total_rented_area, 0) as total_farming_ha
FROM owned_lands ol
FULL OUTER JOIN rented_lands rl ON ol.land_owner_name = rl.farmer_name
ORDER BY total_farming_ha DESC;

-- ============================================================================
-- 11. FIND PARCELS WITH NO CURRENT HISTORY RECORD (DATA QUALITY CHECK)
-- ============================================================================
-- Quality assurance: Find farm parcels that don't have a current history record

SELECT 
    fp.id,
    fp.parcel_number,
    fp.farm_location_barangay,
    fp.submission_id,
    fp.created_at
FROM rsbsa_farm_parcels fp
LEFT JOIN land_history lh ON fp.id = lh.farm_parcel_id AND lh.is_current = TRUE
WHERE lh.id IS NULL
ORDER BY fp.created_at DESC;

-- ============================================================================
-- 12. TIMELINE VIEW: LAND OWNERSHIP CHANGES FOR UI
-- ============================================================================
-- Format suitable for timeline visualization in the frontend

SELECT 
    lh.id,
    lh.farm_parcel_id,
    lh.parcel_number,
    lh.land_owner_name,
    lh.farmer_name,
    lh.change_type,
    lh.period_start_date,
    lh.period_end_date,
    lh.is_current,
    TO_CHAR(lh.period_start_date, 'Month DD, YYYY') as formatted_start_date,
    CASE 
        WHEN lh.period_end_date IS NULL THEN 'Present'
        ELSE TO_CHAR(lh.period_end_date, 'Month DD, YYYY')
    END as formatted_end_date,
    CONCAT(
        CASE 
            WHEN lh.is_registered_owner THEN 'Owner: '
            WHEN lh.is_tenant THEN 'Tenant: '
            WHEN lh.is_lessee THEN 'Lessee: '
            ELSE 'Farmer: '
        END,
        lh.farmer_name
    ) as timeline_label,
    lh.notes
FROM land_history lh
WHERE lh.farm_parcel_id = 1  -- Replace with specific parcel ID
ORDER BY lh.period_start_date DESC;

-- ============================================================================
-- EXAMPLE: Insert manual land history record (for past data)
-- ============================================================================

-- Example: Add historical record for land that changed ownership
/*
INSERT INTO land_history (
    rsbsa_submission_id,
    farm_parcel_id,
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    land_owner_name,
    farmer_id,
    farmer_name,
    is_tenant,
    tenant_name,
    is_current,
    period_start_date,
    period_end_date,
    change_type,
    change_reason,
    created_by
) VALUES (
    123,  -- RSBSA submission ID
    456,  -- Farm parcel ID
    '1',
    'San Jose',
    'Dumangas',
    2.5,
    'Juan dela Cruz',
    789,
    'Pedro Santos',
    TRUE,
    'Pedro Santos',
    FALSE,  -- Not current anymore
    '2020-01-01',
    '2024-12-31',
    'TENANT_CHANGE',
    'Tenant moved to another municipality',
    'admin_user'
);
*/
