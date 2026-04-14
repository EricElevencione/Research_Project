-- ============================================================================
-- Migration: backfill_current_owner_flags_from_land_history
-- Purpose:
--   1) Reconcile rsbsa_farm_parcels.is_current_owner with land_history owner records
--   2) Ensure tenant/lessee rows are never marked as current owners
--
-- Safe behavior:
--   - Only marks a row FALSE when there is owner-history evidence for the same
--     parcel identity and the row is not the current owner in land_history.
--   - Leaves legacy rows unchanged when no matching owner-history evidence exists.
--
-- Run this in Supabase SQL Editor.
-- ============================================================================

BEGIN;

WITH normalized_farm_parcels AS (
  SELECT
    fp.id,
    fp.submission_id,
    UPPER(TRIM(COALESCE(fp.parcel_number, ''))) AS parcel_number_key,
    UPPER(TRIM(COALESCE(fp.farm_location_barangay, ''))) AS barangay_key,
    UPPER(TRIM(COALESCE(fp.farm_location_municipality, ''))) AS municipality_key,
    fp.ownership_type_registered_owner,
    fp.ownership_type_tenant,
    fp.ownership_type_lessee,
    fp.is_current_owner
  FROM public.rsbsa_farm_parcels fp
),
owner_history AS (
  SELECT DISTINCT
    lh.farmer_id::BIGINT AS submission_id,
    UPPER(TRIM(COALESCE(lh.parcel_number, ''))) AS parcel_number_key,
    UPPER(TRIM(COALESCE(lh.farm_location_barangay, ''))) AS barangay_key,
    UPPER(TRIM(COALESCE(lh.farm_location_municipality, ''))) AS municipality_key
  FROM public.land_history lh
  WHERE lh.is_registered_owner = TRUE
    AND lh.farmer_id IS NOT NULL
),
current_owner_history AS (
  SELECT DISTINCT
    lh.farmer_id::BIGINT AS submission_id,
    UPPER(TRIM(COALESCE(lh.parcel_number, ''))) AS parcel_number_key,
    UPPER(TRIM(COALESCE(lh.farm_location_barangay, ''))) AS barangay_key,
    UPPER(TRIM(COALESCE(lh.farm_location_municipality, ''))) AS municipality_key
  FROM public.land_history lh
  WHERE lh.is_registered_owner = TRUE
    AND lh.is_current = TRUE
    AND lh.farmer_id IS NOT NULL
)
UPDATE public.rsbsa_farm_parcels fp
SET
  is_current_owner = CASE
    WHEN nfp.ownership_type_registered_owner IS DISTINCT FROM TRUE THEN FALSE
    WHEN EXISTS (
      SELECT 1
      FROM current_owner_history coh
      WHERE coh.submission_id = nfp.submission_id
        AND coh.parcel_number_key = nfp.parcel_number_key
        AND (coh.barangay_key = '' OR nfp.barangay_key = '' OR coh.barangay_key = nfp.barangay_key)
        AND (coh.municipality_key = '' OR nfp.municipality_key = '' OR coh.municipality_key = nfp.municipality_key)
    ) THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM owner_history oh
      WHERE oh.parcel_number_key = nfp.parcel_number_key
        AND (oh.barangay_key = '' OR nfp.barangay_key = '' OR oh.barangay_key = nfp.barangay_key)
        AND (oh.municipality_key = '' OR nfp.municipality_key = '' OR oh.municipality_key = nfp.municipality_key)
    ) THEN FALSE
    ELSE COALESCE(nfp.is_current_owner, TRUE)
  END,
  updated_at = NOW()
FROM normalized_farm_parcels nfp
WHERE fp.id = nfp.id
  AND (
    nfp.ownership_type_registered_owner = TRUE
    OR nfp.ownership_type_tenant = TRUE
    OR nfp.ownership_type_lessee = TRUE
    OR nfp.is_current_owner IS NULL
    OR nfp.is_current_owner = TRUE
  );

-- Tenant/lessee rows should never be counted as legal current owners.
UPDATE public.rsbsa_farm_parcels
SET
  is_current_owner = FALSE,
  updated_at = NOW()
WHERE (ownership_type_tenant = TRUE OR ownership_type_lessee = TRUE)
  AND is_current_owner IS DISTINCT FROM FALSE;

-- Keep submission-level ownership flag aligned with current owner parcels.
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

-- Optional status/archive sync via helper RPC when present.
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
-- Post-run verification queries (read-only)
-- ============================================================================
-- 1) Check any owner rows still NULL
-- SELECT COUNT(*) AS null_owner_flags
-- FROM public.rsbsa_farm_parcels
-- WHERE ownership_type_registered_owner = TRUE
--   AND is_current_owner IS NULL;

-- 2) Check owner rows that conflict with current land_history owner
-- SELECT fp.id, fp.submission_id, fp.parcel_number, fp.is_current_owner
-- FROM public.rsbsa_farm_parcels fp
-- LEFT JOIN public.land_history lh
--   ON lh.farmer_id = fp.submission_id
--  AND UPPER(TRIM(COALESCE(lh.parcel_number, ''))) = UPPER(TRIM(COALESCE(fp.parcel_number, '')))
--  AND UPPER(TRIM(COALESCE(lh.farm_location_barangay, ''))) = UPPER(TRIM(COALESCE(fp.farm_location_barangay, '')))
--  AND UPPER(TRIM(COALESCE(lh.farm_location_municipality, ''))) = UPPER(TRIM(COALESCE(fp.farm_location_municipality, '')))
--  AND lh.is_registered_owner = TRUE
--  AND lh.is_current = TRUE
-- WHERE fp.ownership_type_registered_owner = TRUE
--   AND fp.is_current_owner = TRUE
--   AND lh.id IS NULL
-- ORDER BY fp.updated_at DESC
-- LIMIT 100;

-- 3) Check submission owner-flag mismatch with current owner parcel evidence
-- SELECT rs.id,
--        rs."OWNERSHIP_TYPE_REGISTERED_OWNER" AS submission_owner_flag,
--        EXISTS (
--          SELECT 1
--          FROM public.rsbsa_farm_parcels fp
--          WHERE fp.submission_id = rs.id
--            AND fp.ownership_type_registered_owner = TRUE
--            AND COALESCE(fp.is_current_owner, TRUE) = TRUE
--        ) AS has_current_owner_parcel
-- FROM public.rsbsa_submission rs
-- WHERE rs."OWNERSHIP_TYPE_REGISTERED_OWNER" IS DISTINCT FROM EXISTS (
--   SELECT 1
--   FROM public.rsbsa_farm_parcels fp
--   WHERE fp.submission_id = rs.id
--     AND fp.ownership_type_registered_owner = TRUE
--     AND COALESCE(fp.is_current_owner, TRUE) = TRUE
-- )
-- ORDER BY rs.id
-- LIMIT 100;
