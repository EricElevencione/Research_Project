-- ============================================================================
-- Verification Pack: verify_current_ownership_consistency
-- Purpose:
--   Read-only diagnostics after ownership/association migration and backfill.
--
-- Usage:
--   Run each query section in Supabase SQL Editor and confirm result counts.
-- ============================================================================

-- 1) Tenant/lessee parcel rows incorrectly marked as current owner
SELECT
  fp.id,
  fp.submission_id,
  fp.parcel_number,
  fp.farm_location_barangay,
  fp.farm_location_municipality,
  fp.ownership_type_registered_owner,
  fp.ownership_type_tenant,
  fp.ownership_type_lessee,
  fp.is_current_owner
FROM public.rsbsa_farm_parcels fp
WHERE (fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE)
  AND COALESCE(fp.is_current_owner, TRUE) = TRUE
ORDER BY fp.updated_at DESC
LIMIT 100;

-- 2) Owner parcel rows marked current without matching current owner in land_history
SELECT
  fp.id,
  fp.submission_id,
  fp.parcel_number,
  fp.farm_location_barangay,
  fp.farm_location_municipality,
  fp.is_current_owner
FROM public.rsbsa_farm_parcels fp
LEFT JOIN public.land_history lh
  ON lh.farmer_id = fp.submission_id
 AND UPPER(TRIM(COALESCE(lh.parcel_number, ''))) = UPPER(TRIM(COALESCE(fp.parcel_number, '')))
 AND UPPER(TRIM(COALESCE(lh.farm_location_barangay, ''))) = UPPER(TRIM(COALESCE(fp.farm_location_barangay, '')))
 AND UPPER(TRIM(COALESCE(lh.farm_location_municipality, ''))) = UPPER(TRIM(COALESCE(fp.farm_location_municipality, '')))
 AND lh.is_registered_owner = TRUE
 AND lh.is_current = TRUE
WHERE fp.ownership_type_registered_owner = TRUE
  AND COALESCE(fp.is_current_owner, TRUE) = TRUE
  AND lh.id IS NULL
ORDER BY fp.updated_at DESC
LIMIT 100;

-- 3) Current owner rows in land_history with no matching current owner parcel flag
SELECT
  lh.id AS land_history_id,
  lh.farmer_id AS submission_id,
  lh.parcel_number,
  lh.farm_location_barangay,
  lh.farm_location_municipality
FROM public.land_history lh
LEFT JOIN public.rsbsa_farm_parcels fp
  ON fp.submission_id = lh.farmer_id
 AND UPPER(TRIM(COALESCE(fp.parcel_number, ''))) = UPPER(TRIM(COALESCE(lh.parcel_number, '')))
 AND UPPER(TRIM(COALESCE(fp.farm_location_barangay, ''))) = UPPER(TRIM(COALESCE(lh.farm_location_barangay, '')))
 AND UPPER(TRIM(COALESCE(fp.farm_location_municipality, ''))) = UPPER(TRIM(COALESCE(lh.farm_location_municipality, '')))
 AND fp.ownership_type_registered_owner = TRUE
 AND COALESCE(fp.is_current_owner, TRUE) = TRUE
WHERE lh.is_registered_owner = TRUE
  AND lh.is_current = TRUE
  AND lh.farmer_id IS NOT NULL
  AND fp.id IS NULL
ORDER BY lh.updated_at DESC NULLS LAST, lh.created_at DESC
LIMIT 100;

-- 4) Parcels with multiple current registered owners in land_history (should be 0)
SELECT
  UPPER(TRIM(COALESCE(lh.parcel_number, ''))) AS parcel_number_key,
  UPPER(TRIM(COALESCE(lh.farm_location_barangay, ''))) AS barangay_key,
  UPPER(TRIM(COALESCE(lh.farm_location_municipality, ''))) AS municipality_key,
  COUNT(*) AS current_owner_rows
FROM public.land_history lh
WHERE lh.is_registered_owner = TRUE
  AND lh.is_current = TRUE
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1
ORDER BY current_owner_rows DESC, parcel_number_key
LIMIT 100;

-- 5) Submission owner flag mismatch with current owner parcel evidence
SELECT
  rs.id,
  rs."OWNERSHIP_TYPE_REGISTERED_OWNER" AS submission_owner_flag,
  EXISTS (
    SELECT 1
    FROM public.rsbsa_farm_parcels fp
    WHERE fp.submission_id = rs.id
      AND fp.ownership_type_registered_owner = TRUE
      AND COALESCE(fp.is_current_owner, TRUE) = TRUE
  ) AS has_current_owner_parcel
FROM public.rsbsa_submission rs
WHERE rs."OWNERSHIP_TYPE_REGISTERED_OWNER" IS DISTINCT FROM EXISTS (
  SELECT 1
  FROM public.rsbsa_farm_parcels fp
  WHERE fp.submission_id = rs.id
    AND fp.ownership_type_registered_owner = TRUE
    AND COALESCE(fp.is_current_owner, TRUE) = TRUE
)
ORDER BY rs.id
LIMIT 100;

-- 6) Submission status inconsistencies relative to current owner parcels
-- Note: This flags obvious mismatches only. Status workflows may include extra states.
SELECT
  rs.id,
  rs.status,
  COUNT(*) FILTER (
    WHERE fp.ownership_type_registered_owner = TRUE
      AND COALESCE(fp.is_current_owner, TRUE) = TRUE
  ) AS current_owner_parcel_count
FROM public.rsbsa_submission rs
LEFT JOIN public.rsbsa_farm_parcels fp
  ON fp.submission_id = rs.id
GROUP BY rs.id, rs.status
HAVING (
  COUNT(*) FILTER (
    WHERE fp.ownership_type_registered_owner = TRUE
      AND COALESCE(fp.is_current_owner, TRUE) = TRUE
  ) = 0
  AND rs.status NOT IN ('No Parcels', 'Not Active')
)
OR (
  COUNT(*) FILTER (
    WHERE fp.ownership_type_registered_owner = TRUE
      AND COALESCE(fp.is_current_owner, TRUE) = TRUE
  ) > 0
  AND rs.status = 'No Parcels'
)
ORDER BY rs.id
LIMIT 100;
