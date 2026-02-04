-- ============================================================
-- UPDATE EXISTING LAND HISTORY RECORDS
-- ============================================================
-- This script updates existing land_history records to populate
-- the new columns required by the search functionality.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Step 1: Check current state of land_history
SELECT 
    id,
    farmer_name,
    farmer_id,
    is_current,
    is_registered_owner,
    is_tenant,
    is_lessee,
    parcel_number,
    farm_location_barangay
FROM land_history
LIMIT 20;

-- Step 2: Update is_current to TRUE for all records that don't have period_end_date
-- (These are currently active records)
UPDATE land_history
SET is_current = TRUE
WHERE is_current IS NULL 
   OR (period_end_date IS NULL AND is_current = FALSE);

-- Step 3: Set default ownership type if all are NULL
-- Assume they are registered owners if no ownership type is set
UPDATE land_history
SET is_registered_owner = TRUE,
    is_tenant = FALSE,
    is_lessee = FALSE
WHERE is_registered_owner IS NULL 
  AND is_tenant IS NULL 
  AND is_lessee IS NULL;

-- Step 4: Populate farmer_name from rsbsa_submission if farmer_id exists but farmer_name is NULL
UPDATE land_history lh
SET farmer_name = CONCAT(
    rs."FIRST NAME", ' ',
    COALESCE(rs."MIDDLE NAME" || ' ', ''),
    rs."SURNAME",
    CASE WHEN rs."EXTENSION NAME" IS NOT NULL AND rs."EXTENSION NAME" != '' 
         THEN ' ' || rs."EXTENSION NAME" 
         ELSE '' 
    END
)
FROM rsbsa_submission rs
WHERE lh.farmer_id = rs.id
  AND (lh.farmer_name IS NULL OR lh.farmer_name = '');

-- Step 5: If farmer_name is still NULL but we have a rsbsa_submission_id, use that
UPDATE land_history lh
SET farmer_name = CONCAT(
    rs."FIRST NAME", ' ',
    COALESCE(rs."MIDDLE NAME" || ' ', ''),
    rs."SURNAME",
    CASE WHEN rs."EXTENSION NAME" IS NOT NULL AND rs."EXTENSION NAME" != '' 
         THEN ' ' || rs."EXTENSION NAME" 
         ELSE '' 
    END
)
FROM rsbsa_submission rs
WHERE lh.rsbsa_submission_id = rs.id
  AND (lh.farmer_name IS NULL OR lh.farmer_name = '');

-- Step 6: Set period_start_date if NULL (use created_at or current date)
UPDATE land_history
SET period_start_date = COALESCE(created_at::date, CURRENT_DATE)
WHERE period_start_date IS NULL;

-- Step 7: Set change_type if NULL
UPDATE land_history
SET change_type = 'EXISTING'
WHERE change_type IS NULL OR change_type = '';

-- Step 8: Verify the updates - check searchable records
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
WHERE is_current = TRUE AND is_registered_owner = TRUE
LIMIT 20;

-- Show count of now-searchable records
SELECT COUNT(*) as searchable_registered_owners 
FROM land_history 
WHERE is_current = TRUE AND is_registered_owner = TRUE AND farmer_name IS NOT NULL;
