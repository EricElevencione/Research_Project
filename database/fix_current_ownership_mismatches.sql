-- ============================================================================
-- Remediation: fix_current_ownership_mismatches
-- Purpose:
--   Apply conservative fixes for ownership flag inconsistencies found by
--   verify_current_ownership_consistency.sql.
--
-- What this script fixes:
--   1) Tenant/lessee parcels marked as current legal owner
--   2) Owner parcel rows where is_current_owner is stale/inconsistent vs land_history
--   3) Submission-level owner flag mismatches
--
-- What this script does NOT do:
--   - It does not create missing rsbsa_farm_parcels rows from land_history.
--   - It does not rewrite transfer timelines.
--
-- Run after:
--   - create_register_farmer_function.sql
--   - backfill_current_owner_flags_from_land_history.sql
--   - verify_current_ownership_consistency.sql (if rows remain)
-- ============================================================================

BEGIN;

-- 1) Tenant/lessee rows must never be legal current owners.
UPDATE public.rsbsa_farm_parcels fp
SET
  is_current_owner = FALSE,
  updated_at = NOW()
WHERE (fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE)
  AND COALESCE(fp.is_current_owner, TRUE) = TRUE;

-- 2) Build normalized owner-history snapshots for deterministic matching.
CREATE TEMP TABLE tmp_owner_history_keys ON COMMIT DROP AS
SELECT DISTINCT
  lh.farmer_id::BIGINT AS submission_id,
  UPPER(TRIM(COALESCE(lh.parcel_number, ''))) AS parcel_number_key,
  UPPER(TRIM(COALESCE(lh.farm_location_barangay, ''))) AS barangay_key,
  UPPER(TRIM(COALESCE(lh.farm_location_municipality, ''))) AS municipality_key
FROM public.land_history lh
WHERE lh.is_registered_owner = TRUE
  AND lh.farmer_id IS NOT NULL;

CREATE TEMP TABLE tmp_current_owner_history_keys ON COMMIT DROP AS
SELECT DISTINCT
  lh.farmer_id::BIGINT AS submission_id,
  UPPER(TRIM(COALESCE(lh.parcel_number, ''))) AS parcel_number_key,
  UPPER(TRIM(COALESCE(lh.farm_location_barangay, ''))) AS barangay_key,
  UPPER(TRIM(COALESCE(lh.farm_location_municipality, ''))) AS municipality_key
FROM public.land_history lh
WHERE lh.is_registered_owner = TRUE
  AND lh.is_current = TRUE
  AND lh.farmer_id IS NOT NULL;

-- Fallback matcher only when a submission has a unique current owner row for the parcel number.
CREATE TEMP TABLE tmp_unique_current_submission_parcel ON COMMIT DROP AS
SELECT
  submission_id,
  parcel_number_key
FROM tmp_current_owner_history_keys
GROUP BY submission_id, parcel_number_key
HAVING COUNT(*) = 1;

-- 3) Mark owner parcels as current when current owner history evidence exists.
UPDATE public.rsbsa_farm_parcels fp
SET
  is_current_owner = TRUE,
  updated_at = NOW()
WHERE fp.ownership_type_registered_owner = TRUE
  AND COALESCE(fp.is_current_owner, FALSE) IS DISTINCT FROM TRUE
  AND (
    EXISTS (
      SELECT 1
      FROM tmp_current_owner_history_keys coh
      WHERE coh.submission_id = fp.submission_id
        AND coh.parcel_number_key = UPPER(TRIM(COALESCE(fp.parcel_number, '')))
        AND (
          coh.barangay_key = ''
          OR UPPER(TRIM(COALESCE(fp.farm_location_barangay, ''))) = ''
          OR coh.barangay_key = UPPER(TRIM(COALESCE(fp.farm_location_barangay, '')))
        )
        AND (
          coh.municipality_key = ''
          OR UPPER(TRIM(COALESCE(fp.farm_location_municipality, ''))) = ''
          OR coh.municipality_key = UPPER(TRIM(COALESCE(fp.farm_location_municipality, '')))
        )
    )
    OR EXISTS (
      SELECT 1
      FROM tmp_unique_current_submission_parcel ucp
      WHERE ucp.submission_id = fp.submission_id
        AND ucp.parcel_number_key = UPPER(TRIM(COALESCE(fp.parcel_number, '')))
    )
  );

-- 4) Mark owner parcels as non-current when owner history exists but this submission is not current.
UPDATE public.rsbsa_farm_parcels fp
SET
  is_current_owner = FALSE,
  updated_at = NOW()
WHERE fp.ownership_type_registered_owner = TRUE
  AND COALESCE(fp.is_current_owner, TRUE) IS DISTINCT FROM FALSE
  AND EXISTS (
    SELECT 1
    FROM tmp_owner_history_keys oh
    WHERE oh.parcel_number_key = UPPER(TRIM(COALESCE(fp.parcel_number, '')))
      AND (
        oh.barangay_key = ''
        OR UPPER(TRIM(COALESCE(fp.farm_location_barangay, ''))) = ''
        OR oh.barangay_key = UPPER(TRIM(COALESCE(fp.farm_location_barangay, '')))
      )
      AND (
        oh.municipality_key = ''
        OR UPPER(TRIM(COALESCE(fp.farm_location_municipality, ''))) = ''
        OR oh.municipality_key = UPPER(TRIM(COALESCE(fp.farm_location_municipality, '')))
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM tmp_current_owner_history_keys coh
    WHERE coh.submission_id = fp.submission_id
      AND coh.parcel_number_key = UPPER(TRIM(COALESCE(fp.parcel_number, '')))
      AND (
        coh.barangay_key = ''
        OR UPPER(TRIM(COALESCE(fp.farm_location_barangay, ''))) = ''
        OR coh.barangay_key = UPPER(TRIM(COALESCE(fp.farm_location_barangay, '')))
      )
      AND (
        coh.municipality_key = ''
        OR UPPER(TRIM(COALESCE(fp.farm_location_municipality, ''))) = ''
        OR coh.municipality_key = UPPER(TRIM(COALESCE(fp.farm_location_municipality, '')))
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM tmp_unique_current_submission_parcel ucp
    WHERE ucp.submission_id = fp.submission_id
      AND ucp.parcel_number_key = UPPER(TRIM(COALESCE(fp.parcel_number, '')))
  );

-- 5) Keep submission-level owner flag aligned with current owner parcel evidence.
UPDATE public.rsbsa_submission rs
SET
  "OWNERSHIP_TYPE_REGISTERED_OWNER" = EXISTS (
    SELECT 1
    FROM public.rsbsa_farm_parcels fp
    WHERE fp.submission_id = rs.id
      AND fp.ownership_type_registered_owner = TRUE
      AND COALESCE(fp.is_current_owner, TRUE) = TRUE
  ),
  updated_at = NOW()
WHERE rs."OWNERSHIP_TYPE_REGISTERED_OWNER" IS DISTINCT FROM EXISTS (
  SELECT 1
  FROM public.rsbsa_farm_parcels fp
  WHERE fp.submission_id = rs.id
    AND fp.ownership_type_registered_owner = TRUE
    AND COALESCE(fp.is_current_owner, TRUE) = TRUE
);

-- 6) Optional status/archive sync via helper RPC when available.
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'sync_farmer_no_parcels_status'
      AND n.nspname = 'public'
      AND p.pronargs = 1
  ) THEN
    FOR r IN SELECT id FROM public.rsbsa_submission LOOP
      PERFORM public.sync_farmer_no_parcels_status(r.id);
    END LOOP;
  ELSE
    RAISE NOTICE 'sync_farmer_no_parcels_status not found; skipped status/archive sync.';
  END IF;
END
$$;

COMMIT;

-- ============================================================================
-- Post-fix quick counts (read-only). Prefer re-running verify_current_ownership_consistency.sql.
-- ============================================================================
SELECT
  'tenant_or_lessee_marked_current_owner' AS check_name,
  COUNT(*)::BIGINT AS row_count
FROM public.rsbsa_farm_parcels fp
WHERE (fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE)
  AND COALESCE(fp.is_current_owner, TRUE) = TRUE

UNION ALL

SELECT
  'owner_current_without_current_history' AS check_name,
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
  'submission_owner_flag_mismatch' AS check_name,
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
  'current_owner_history_without_owner_parcel_row' AS check_name,
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
  AND fp.id IS NULL;
