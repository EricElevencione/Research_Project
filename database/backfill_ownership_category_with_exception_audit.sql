-- ============================================================================
-- Script: backfill_ownership_category_with_exception_audit
-- Purpose:
--   Phase 2 hardening for canonical ownership migration.
--
--   1) Deterministically backfill ownership_category from legacy booleans.
--   2) Route unresolved contradictions to a manual exception audit table.
--
-- Canonical precedence:
--   registeredOwner > tenantLessee > unknown
--
-- Contradictions routed to audit table:
--   - Registered owner flag TRUE while tenant/lessee flag(s) are also TRUE.
--   - ownership_category contains invalid canonical value.
-- ============================================================================

BEGIN;

-- Ensure canonical column exists before audit/backfill queries reference it.
ALTER TABLE IF EXISTS public.rsbsa_submission
  ADD COLUMN IF NOT EXISTS ownership_category TEXT;

ALTER TABLE IF EXISTS public.rsbsa_farm_parcels
  ADD COLUMN IF NOT EXISTS ownership_category TEXT;

ALTER TABLE IF EXISTS public.land_history
  ADD COLUMN IF NOT EXISTS ownership_category TEXT;

CREATE TABLE IF NOT EXISTS public.ownership_category_exception_audit (
  id BIGSERIAL PRIMARY KEY,
  source_table TEXT NOT NULL,
  source_id BIGINT NOT NULL,
  reason_code TEXT NOT NULL,
  reason_detail TEXT NOT NULL,
  legacy_registered_owner BOOLEAN,
  legacy_tenant BOOLEAN,
  legacy_lessee BOOLEAN,
  existing_ownership_category TEXT,
  suggested_ownership_category TEXT,
  capture_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ownership_category_exception_source_table_check CHECK (
    source_table IN ('rsbsa_submission', 'rsbsa_farm_parcels', 'land_history')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ownership_category_exception_audit_unique_idx
  ON public.ownership_category_exception_audit (source_table, source_id, reason_code);

-- --------------------------------------------------------------------------
-- Audit contradictions before backfill updates.
-- --------------------------------------------------------------------------

INSERT INTO public.ownership_category_exception_audit (
  source_table,
  source_id,
  reason_code,
  reason_detail,
  legacy_registered_owner,
  legacy_tenant,
  legacy_lessee,
  existing_ownership_category,
  suggested_ownership_category,
  capture_payload,
  last_seen_at
)
SELECT
  'rsbsa_submission' AS source_table,
  rs.id AS source_id,
  'MIXED_OWNER_AND_TENANT_LESSEE_FLAGS' AS reason_code,
  'Legacy flags are contradictory: registered owner is TRUE while tenant/lessee is also TRUE. Canonical precedence defaults to registeredOwner.' AS reason_detail,
  rs."OWNERSHIP_TYPE_REGISTERED_OWNER" AS legacy_registered_owner,
  rs."OWNERSHIP_TYPE_TENANT" AS legacy_tenant,
  rs."OWNERSHIP_TYPE_LESSEE" AS legacy_lessee,
  rs.ownership_category AS existing_ownership_category,
  'registeredOwner' AS suggested_ownership_category,
  jsonb_build_object(
    'status', rs.status,
    'farmer_name', TRIM(CONCAT_WS(' ', rs."FIRST NAME", rs."MIDDLE NAME", rs."LAST NAME"))
  ) AS capture_payload,
  NOW() AS last_seen_at
FROM public.rsbsa_submission rs
WHERE rs."OWNERSHIP_TYPE_REGISTERED_OWNER" = TRUE
  AND (rs."OWNERSHIP_TYPE_TENANT" = TRUE OR rs."OWNERSHIP_TYPE_LESSEE" = TRUE)
ON CONFLICT (source_table, source_id, reason_code)
DO UPDATE SET
  reason_detail = EXCLUDED.reason_detail,
  legacy_registered_owner = EXCLUDED.legacy_registered_owner,
  legacy_tenant = EXCLUDED.legacy_tenant,
  legacy_lessee = EXCLUDED.legacy_lessee,
  existing_ownership_category = EXCLUDED.existing_ownership_category,
  suggested_ownership_category = EXCLUDED.suggested_ownership_category,
  capture_payload = EXCLUDED.capture_payload,
  last_seen_at = EXCLUDED.last_seen_at,
  resolved = FALSE,
  resolved_at = NULL,
  resolution_notes = NULL;

INSERT INTO public.ownership_category_exception_audit (
  source_table,
  source_id,
  reason_code,
  reason_detail,
  legacy_registered_owner,
  legacy_tenant,
  legacy_lessee,
  existing_ownership_category,
  suggested_ownership_category,
  capture_payload,
  last_seen_at
)
SELECT
  'rsbsa_farm_parcels' AS source_table,
  fp.id AS source_id,
  'MIXED_OWNER_AND_TENANT_LESSEE_FLAGS' AS reason_code,
  'Legacy flags are contradictory: registered owner is TRUE while tenant/lessee is also TRUE. Canonical precedence defaults to registeredOwner.' AS reason_detail,
  fp.ownership_type_registered_owner AS legacy_registered_owner,
  fp.ownership_type_tenant AS legacy_tenant,
  fp.ownership_type_lessee AS legacy_lessee,
  fp.ownership_category AS existing_ownership_category,
  'registeredOwner' AS suggested_ownership_category,
  jsonb_build_object(
    'submission_id', fp.submission_id,
    'parcel_number', fp.parcel_number,
    'farm_location_barangay', fp.farm_location_barangay,
    'farm_location_municipality', fp.farm_location_municipality
  ) AS capture_payload,
  NOW() AS last_seen_at
FROM public.rsbsa_farm_parcels fp
WHERE fp.ownership_type_registered_owner = TRUE
  AND (fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE)
ON CONFLICT (source_table, source_id, reason_code)
DO UPDATE SET
  reason_detail = EXCLUDED.reason_detail,
  legacy_registered_owner = EXCLUDED.legacy_registered_owner,
  legacy_tenant = EXCLUDED.legacy_tenant,
  legacy_lessee = EXCLUDED.legacy_lessee,
  existing_ownership_category = EXCLUDED.existing_ownership_category,
  suggested_ownership_category = EXCLUDED.suggested_ownership_category,
  capture_payload = EXCLUDED.capture_payload,
  last_seen_at = EXCLUDED.last_seen_at,
  resolved = FALSE,
  resolved_at = NULL,
  resolution_notes = NULL;

INSERT INTO public.ownership_category_exception_audit (
  source_table,
  source_id,
  reason_code,
  reason_detail,
  legacy_registered_owner,
  legacy_tenant,
  legacy_lessee,
  existing_ownership_category,
  suggested_ownership_category,
  capture_payload,
  last_seen_at
)
SELECT
  'land_history' AS source_table,
  lh.id AS source_id,
  'MIXED_OWNER_AND_TENANT_LESSEE_FLAGS' AS reason_code,
  'Legacy flags are contradictory: registered owner is TRUE while tenant/lessee is also TRUE. Canonical precedence defaults to registeredOwner.' AS reason_detail,
  lh.is_registered_owner AS legacy_registered_owner,
  lh.is_tenant AS legacy_tenant,
  lh.is_lessee AS legacy_lessee,
  lh.ownership_category AS existing_ownership_category,
  'registeredOwner' AS suggested_ownership_category,
  jsonb_build_object(
    'farmer_id', lh.farmer_id,
    'farm_parcel_id', lh.farm_parcel_id,
    'parcel_number', lh.parcel_number,
    'is_current', lh.is_current,
    'change_type', lh.change_type
  ) AS capture_payload,
  NOW() AS last_seen_at
FROM public.land_history lh
WHERE lh.is_registered_owner = TRUE
  AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE)
ON CONFLICT (source_table, source_id, reason_code)
DO UPDATE SET
  reason_detail = EXCLUDED.reason_detail,
  legacy_registered_owner = EXCLUDED.legacy_registered_owner,
  legacy_tenant = EXCLUDED.legacy_tenant,
  legacy_lessee = EXCLUDED.legacy_lessee,
  existing_ownership_category = EXCLUDED.existing_ownership_category,
  suggested_ownership_category = EXCLUDED.suggested_ownership_category,
  capture_payload = EXCLUDED.capture_payload,
  last_seen_at = EXCLUDED.last_seen_at,
  resolved = FALSE,
  resolved_at = NULL,
  resolution_notes = NULL;

INSERT INTO public.ownership_category_exception_audit (
  source_table,
  source_id,
  reason_code,
  reason_detail,
  legacy_registered_owner,
  legacy_tenant,
  legacy_lessee,
  existing_ownership_category,
  suggested_ownership_category,
  capture_payload,
  last_seen_at
)
SELECT
  src.source_table,
  src.source_id,
  'INVALID_OWNERSHIP_CATEGORY_VALUE' AS reason_code,
  'ownership_category has an invalid value outside canonical set [registeredOwner, tenantLessee, unknown].' AS reason_detail,
  src.legacy_registered_owner,
  src.legacy_tenant,
  src.legacy_lessee,
  src.existing_ownership_category,
  src.suggested_ownership_category,
  src.capture_payload,
  NOW() AS last_seen_at
FROM (
  SELECT
    'rsbsa_submission'::TEXT AS source_table,
    rs.id AS source_id,
    rs."OWNERSHIP_TYPE_REGISTERED_OWNER" AS legacy_registered_owner,
    rs."OWNERSHIP_TYPE_TENANT" AS legacy_tenant,
    rs."OWNERSHIP_TYPE_LESSEE" AS legacy_lessee,
    rs.ownership_category AS existing_ownership_category,
    CASE
      WHEN rs."OWNERSHIP_TYPE_REGISTERED_OWNER" = TRUE THEN 'registeredOwner'
      WHEN rs."OWNERSHIP_TYPE_TENANT" = TRUE OR rs."OWNERSHIP_TYPE_LESSEE" = TRUE THEN 'tenantLessee'
      ELSE 'unknown'
    END AS suggested_ownership_category,
    jsonb_build_object('status', rs.status) AS capture_payload
  FROM public.rsbsa_submission rs
  WHERE COALESCE(NULLIF(TRIM(rs.ownership_category), ''), 'unknown')
        NOT IN ('registeredOwner', 'tenantLessee', 'unknown')

  UNION ALL

  SELECT
    'rsbsa_farm_parcels'::TEXT AS source_table,
    fp.id AS source_id,
    fp.ownership_type_registered_owner AS legacy_registered_owner,
    fp.ownership_type_tenant AS legacy_tenant,
    fp.ownership_type_lessee AS legacy_lessee,
    fp.ownership_category AS existing_ownership_category,
    CASE
      WHEN fp.ownership_type_registered_owner = TRUE THEN 'registeredOwner'
      WHEN fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE THEN 'tenantLessee'
      ELSE 'unknown'
    END AS suggested_ownership_category,
    jsonb_build_object('submission_id', fp.submission_id, 'parcel_number', fp.parcel_number) AS capture_payload
  FROM public.rsbsa_farm_parcels fp
  WHERE COALESCE(NULLIF(TRIM(fp.ownership_category), ''), 'unknown')
        NOT IN ('registeredOwner', 'tenantLessee', 'unknown')

  UNION ALL

  SELECT
    'land_history'::TEXT AS source_table,
    lh.id AS source_id,
    lh.is_registered_owner AS legacy_registered_owner,
    lh.is_tenant AS legacy_tenant,
    lh.is_lessee AS legacy_lessee,
    lh.ownership_category AS existing_ownership_category,
    CASE
      WHEN lh.is_registered_owner = TRUE THEN 'registeredOwner'
      WHEN lh.is_tenant = TRUE OR lh.is_lessee = TRUE THEN 'tenantLessee'
      ELSE 'unknown'
    END AS suggested_ownership_category,
    jsonb_build_object('farm_parcel_id', lh.farm_parcel_id, 'change_type', lh.change_type, 'is_current', lh.is_current) AS capture_payload
  FROM public.land_history lh
  WHERE COALESCE(NULLIF(TRIM(lh.ownership_category), ''), 'unknown')
        NOT IN ('registeredOwner', 'tenantLessee', 'unknown')
) src
ON CONFLICT (source_table, source_id, reason_code)
DO UPDATE SET
  reason_detail = EXCLUDED.reason_detail,
  legacy_registered_owner = EXCLUDED.legacy_registered_owner,
  legacy_tenant = EXCLUDED.legacy_tenant,
  legacy_lessee = EXCLUDED.legacy_lessee,
  existing_ownership_category = EXCLUDED.existing_ownership_category,
  suggested_ownership_category = EXCLUDED.suggested_ownership_category,
  capture_payload = EXCLUDED.capture_payload,
  last_seen_at = EXCLUDED.last_seen_at,
  resolved = FALSE,
  resolved_at = NULL,
  resolution_notes = NULL;

-- --------------------------------------------------------------------------
-- Deterministic canonical backfill/update.
-- --------------------------------------------------------------------------

UPDATE public.rsbsa_submission rs
SET ownership_category = CASE
  WHEN rs."OWNERSHIP_TYPE_REGISTERED_OWNER" = TRUE THEN 'registeredOwner'
  WHEN rs."OWNERSHIP_TYPE_TENANT" = TRUE OR rs."OWNERSHIP_TYPE_LESSEE" = TRUE THEN 'tenantLessee'
  ELSE 'unknown'
END
WHERE rs.ownership_category IS DISTINCT FROM CASE
  WHEN rs."OWNERSHIP_TYPE_REGISTERED_OWNER" = TRUE THEN 'registeredOwner'
  WHEN rs."OWNERSHIP_TYPE_TENANT" = TRUE OR rs."OWNERSHIP_TYPE_LESSEE" = TRUE THEN 'tenantLessee'
  ELSE 'unknown'
END;

UPDATE public.rsbsa_farm_parcels fp
SET ownership_category = CASE
  WHEN fp.ownership_type_registered_owner = TRUE THEN 'registeredOwner'
  WHEN fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE THEN 'tenantLessee'
  ELSE 'unknown'
END
WHERE fp.ownership_category IS DISTINCT FROM CASE
  WHEN fp.ownership_type_registered_owner = TRUE THEN 'registeredOwner'
  WHEN fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE THEN 'tenantLessee'
  ELSE 'unknown'
END;

UPDATE public.land_history lh
SET ownership_category = CASE
  WHEN lh.is_registered_owner = TRUE THEN 'registeredOwner'
  WHEN lh.is_tenant = TRUE OR lh.is_lessee = TRUE THEN 'tenantLessee'
  ELSE 'unknown'
END
WHERE lh.ownership_category IS DISTINCT FROM CASE
  WHEN lh.is_registered_owner = TRUE THEN 'registeredOwner'
  WHEN lh.is_tenant = TRUE OR lh.is_lessee = TRUE THEN 'tenantLessee'
  ELSE 'unknown'
END;

COMMIT;

-- --------------------------------------------------------------------------
-- Post-run review queries (read-only)
-- --------------------------------------------------------------------------
-- SELECT source_table, reason_code, COUNT(*)
-- FROM public.ownership_category_exception_audit
-- WHERE resolved = FALSE
-- GROUP BY source_table, reason_code
-- ORDER BY source_table, reason_code;

-- SELECT *
-- FROM public.ownership_category_exception_audit
-- WHERE resolved = FALSE
-- ORDER BY last_seen_at DESC
-- LIMIT 200;
