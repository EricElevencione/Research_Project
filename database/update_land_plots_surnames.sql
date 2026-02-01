-- Migration: Update land_plots with missing surnames from rsbsa_submission
-- This script finds land_plots records with empty surname and tries to match them 
-- with rsbsa_submission records based on first_name, middle_name, and barangay

-- First, let's see what records have missing surnames
SELECT 
    lp.id,
    lp.first_name,
    lp.middle_name,
    lp.surname,
    lp.barangay,
    rs."FIRST NAME" as rs_first_name,
    rs."MIDDLE NAME" as rs_middle_name,
    rs."LAST NAME" as rs_last_name,
    rs."BARANGAY" as rs_barangay
FROM land_plots lp
LEFT JOIN rsbsa_submission rs ON (
    LOWER(TRIM(lp.first_name)) = LOWER(TRIM(rs."FIRST NAME"))
    AND LOWER(TRIM(COALESCE(lp.middle_name, ''))) = LOWER(TRIM(COALESCE(rs."MIDDLE NAME", '')))
    AND LOWER(TRIM(lp.barangay)) = LOWER(TRIM(rs."BARANGAY"))
)
WHERE (lp.surname IS NULL OR lp.surname = '')
AND rs.id IS NOT NULL;

-- Update land_plots with missing surnames
UPDATE land_plots lp
SET 
    surname = rs."LAST NAME",
    updated_at = CURRENT_TIMESTAMP
FROM rsbsa_submission rs
WHERE (lp.surname IS NULL OR lp.surname = '')
AND LOWER(TRIM(lp.first_name)) = LOWER(TRIM(rs."FIRST NAME"))
AND LOWER(TRIM(COALESCE(lp.middle_name, ''))) = LOWER(TRIM(COALESCE(rs."MIDDLE NAME", '')))
AND LOWER(TRIM(lp.barangay)) = LOWER(TRIM(rs."BARANGAY"))
AND rs."LAST NAME" IS NOT NULL 
AND rs."LAST NAME" != '';

-- Show the results after update
SELECT 
    id,
    first_name,
    middle_name,
    surname,
    barangay,
    updated_at
FROM land_plots
WHERE surname IS NOT NULL AND surname != ''
ORDER BY updated_at DESC
LIMIT 20;
