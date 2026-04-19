-- ============================================================================
-- Verification Pack: verify_current_ownership_consistency
-- Purpose:
--   Read-only diagnostics after ownership/association migration and backfill.
--
-- Usage:
--   Run each query section in Supabase SQL Editor and confirm result counts.
-- ============================================================================

-- 0) Quick summary counts (recommended first run before details)
SELECT
  'q1_tenant_lessee_marked_current_owner' AS check_name,
  COUNT(*)::BIGINT AS row_count
FROM public.rsbsa_farm_parcels fp
WHERE (fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE)
  AND COALESCE(fp.is_current_owner, TRUE) = TRUE

UNION ALL

SELECT
  'q2_owner_current_without_current_history' AS check_name,
  COUNT(*)::BIGINT AS row_count
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

UNION ALL

SELECT
  'q3_current_history_without_current_owner_parcel' AS check_name,
  COUNT(*)::BIGINT AS row_count
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

UNION ALL

SELECT
  'q4_parcels_with_multiple_current_owners' AS check_name,
  COUNT(*)::BIGINT AS row_count
FROM (
  SELECT
    UPPER(TRIM(COALESCE(lh.parcel_number, ''))) AS parcel_number_key,
    UPPER(TRIM(COALESCE(lh.farm_location_barangay, ''))) AS barangay_key,
    UPPER(TRIM(COALESCE(lh.farm_location_municipality, ''))) AS municipality_key
  FROM public.land_history lh
  WHERE lh.is_registered_owner = TRUE
    AND lh.is_current = TRUE
  GROUP BY 1, 2, 3
  HAVING COUNT(*) > 1
) duplicates

UNION ALL

SELECT
  'q5_submission_owner_flag_mismatch' AS check_name,
  COUNT(*)::BIGINT AS row_count
FROM public.rsbsa_submission rs
WHERE rs."OWNERSHIP_TYPE_REGISTERED_OWNER" IS DISTINCT FROM EXISTS (
  SELECT 1
  FROM public.rsbsa_farm_parcels fp
  WHERE fp.submission_id = rs.id
    AND fp.ownership_type_registered_owner = TRUE
    AND COALESCE(fp.is_current_owner, TRUE) = TRUE
)

UNION ALL

SELECT
  'q6_submission_status_mismatch' AS check_name,
  COUNT(*)::BIGINT AS row_count
FROM (
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
) status_mismatches;

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

-- 7) Person-focused role snapshot (edit name filters as needed)
-- Example target below: Aaron Benitez.
WITH target_person AS (
  SELECT
    rs.id,
    CONCAT_WS(
      ' ',
      rs."FIRST NAME",
      rs."MIDDLE NAME",
      rs."LAST NAME",
      NULLIF(rs."EXT NAME", '')
    ) AS full_name,
    rs.status,
    rs."OWNERSHIP_TYPE_REGISTERED_OWNER" AS submission_owner_flag
  FROM public.rsbsa_submission rs
  WHERE UPPER(TRIM(COALESCE(rs."FIRST NAME", ''))) LIKE '%AARON%'
    AND UPPER(TRIM(COALESCE(rs."LAST NAME", ''))) LIKE '%BENITEZ%'
)
SELECT
  tp.id AS submission_id,
  tp.full_name,
  tp.status,
  tp.submission_owner_flag,
  (
    SELECT COUNT(*)::BIGINT
    FROM public.rsbsa_farm_parcels fp
    WHERE fp.submission_id = tp.id
      AND fp.ownership_type_registered_owner = TRUE
      AND COALESCE(fp.is_current_owner, TRUE) = TRUE
  ) AS current_owner_parcel_rows,
  (
    SELECT COUNT(*)::BIGINT
    FROM public.rsbsa_farm_parcels fp
    WHERE fp.submission_id = tp.id
      AND fp.ownership_type_tenant = TRUE
  ) AS tenant_parcel_rows,
  (
    SELECT COUNT(*)::BIGINT
    FROM public.rsbsa_farm_parcels fp
    WHERE fp.submission_id = tp.id
      AND fp.ownership_type_lessee = TRUE
  ) AS lessee_parcel_rows,
  (
    SELECT COUNT(*)::BIGINT
    FROM public.land_history lh
    WHERE lh.farmer_id = tp.id
      AND lh.is_current = TRUE
      AND lh.is_registered_owner = TRUE
  ) AS current_owner_history_rows,
  (
    SELECT COUNT(*)::BIGINT
    FROM public.land_history lh
    WHERE lh.farmer_id = tp.id
      AND lh.is_current = TRUE
      AND lh.is_tenant = TRUE
  ) AS current_tenant_history_rows,
  (
    SELECT COUNT(*)::BIGINT
    FROM public.land_history lh
    WHERE lh.farmer_id = tp.id
      AND lh.is_current = TRUE
      AND lh.is_lessee = TRUE
  ) AS current_lessee_history_rows
FROM target_person tp
ORDER BY tp.id;

-- 8) Person-focused parcel-level role details (same name filter as query 7)
WITH target_person AS (
  SELECT rs.id
  FROM public.rsbsa_submission rs
  WHERE UPPER(TRIM(COALESCE(rs."FIRST NAME", ''))) LIKE '%AARON%'
    AND UPPER(TRIM(COALESCE(rs."LAST NAME", ''))) LIKE '%BENITEZ%'
)
SELECT
  fp.id,
  fp.submission_id,
  fp.parcel_number,
  fp.farm_location_barangay,
  fp.farm_location_municipality,
  fp.ownership_type_registered_owner,
  fp.ownership_type_tenant,
  fp.ownership_type_lessee,
  fp.is_current_owner,
  fp.updated_at
FROM public.rsbsa_farm_parcels fp
INNER JOIN target_person tp
  ON tp.id = fp.submission_id
ORDER BY fp.updated_at DESC, fp.id DESC
LIMIT 200;
