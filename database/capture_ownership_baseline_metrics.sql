-- ============================================================================
-- Script: capture_ownership_baseline_metrics
-- Purpose:
--   Capture a reproducible ownership baseline snapshot before/after migration
--   so rollout outcomes can be validated quantitatively.
--
-- Captures:
--   - mixed-role count
--   - owner-only count
--   - tenant/lessee count
--   - transfer-history distribution (land_history.change_type)
--
-- Notes:
--   - Non-destructive.
--   - Stores snapshot in ownership_metrics_snapshots.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ownership_metrics_snapshots (
  id BIGSERIAL PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  capture_label TEXT NOT NULL DEFAULT 'manual',
  metrics JSONB NOT NULL
);

WITH params AS (
  SELECT 'baseline'::TEXT AS capture_label
),
submission_counts AS (
  SELECT
    COUNT(*)::BIGINT AS total_count,
    SUM(
      CASE
        WHEN rs."OWNERSHIP_TYPE_REGISTERED_OWNER" = TRUE
         AND (rs."OWNERSHIP_TYPE_TENANT" = TRUE OR rs."OWNERSHIP_TYPE_LESSEE" = TRUE)
        THEN 1 ELSE 0
      END
    )::BIGINT AS mixed_role_count,
    SUM(
      CASE
        WHEN rs."OWNERSHIP_TYPE_REGISTERED_OWNER" = TRUE
         AND COALESCE(rs."OWNERSHIP_TYPE_TENANT", FALSE) = FALSE
         AND COALESCE(rs."OWNERSHIP_TYPE_LESSEE", FALSE) = FALSE
        THEN 1 ELSE 0
      END
    )::BIGINT AS owner_only_count,
    SUM(
      CASE
        WHEN COALESCE(rs."OWNERSHIP_TYPE_REGISTERED_OWNER", FALSE) = FALSE
         AND (rs."OWNERSHIP_TYPE_TENANT" = TRUE OR rs."OWNERSHIP_TYPE_LESSEE" = TRUE)
        THEN 1 ELSE 0
      END
    )::BIGINT AS tenant_lessee_count,
    SUM(
      CASE
        WHEN COALESCE(rs."OWNERSHIP_TYPE_REGISTERED_OWNER", FALSE) = FALSE
         AND COALESCE(rs."OWNERSHIP_TYPE_TENANT", FALSE) = FALSE
         AND COALESCE(rs."OWNERSHIP_TYPE_LESSEE", FALSE) = FALSE
        THEN 1 ELSE 0
      END
    )::BIGINT AS unknown_count
  FROM public.rsbsa_submission rs
),
parcel_counts AS (
  SELECT
    COUNT(*)::BIGINT AS total_count,
    SUM(
      CASE
        WHEN fp.ownership_type_registered_owner = TRUE
         AND (fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE)
        THEN 1 ELSE 0
      END
    )::BIGINT AS mixed_role_count,
    SUM(
      CASE
        WHEN fp.ownership_type_registered_owner = TRUE
         AND COALESCE(fp.ownership_type_tenant, FALSE) = FALSE
         AND COALESCE(fp.ownership_type_lessee, FALSE) = FALSE
        THEN 1 ELSE 0
      END
    )::BIGINT AS owner_only_count,
    SUM(
      CASE
        WHEN COALESCE(fp.ownership_type_registered_owner, FALSE) = FALSE
         AND (fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE)
        THEN 1 ELSE 0
      END
    )::BIGINT AS tenant_lessee_count,
    SUM(
      CASE
        WHEN COALESCE(fp.ownership_type_registered_owner, FALSE) = FALSE
         AND COALESCE(fp.ownership_type_tenant, FALSE) = FALSE
         AND COALESCE(fp.ownership_type_lessee, FALSE) = FALSE
        THEN 1 ELSE 0
      END
    )::BIGINT AS unknown_count,
    SUM(
      CASE
        WHEN fp.ownership_type_registered_owner = TRUE
         AND COALESCE(fp.is_current_owner, TRUE) = TRUE
        THEN 1 ELSE 0
      END
    )::BIGINT AS current_owner_rows,
    SUM(
      CASE
        WHEN (fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE)
         AND COALESCE(fp.is_current_owner, TRUE) = TRUE
        THEN 1 ELSE 0
      END
    )::BIGINT AS tenant_lessee_marked_current_owner_rows
  FROM public.rsbsa_farm_parcels fp
),
history_current_counts AS (
  SELECT
    COUNT(*)::BIGINT AS total_count,
    SUM(
      CASE
        WHEN lh.is_registered_owner = TRUE
         AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE)
        THEN 1 ELSE 0
      END
    )::BIGINT AS mixed_role_count,
    SUM(
      CASE
        WHEN lh.is_registered_owner = TRUE
         AND COALESCE(lh.is_tenant, FALSE) = FALSE
         AND COALESCE(lh.is_lessee, FALSE) = FALSE
        THEN 1 ELSE 0
      END
    )::BIGINT AS owner_only_count,
    SUM(
      CASE
        WHEN COALESCE(lh.is_registered_owner, FALSE) = FALSE
         AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE)
        THEN 1 ELSE 0
      END
    )::BIGINT AS tenant_lessee_count,
    SUM(
      CASE
        WHEN COALESCE(lh.is_registered_owner, FALSE) = FALSE
         AND COALESCE(lh.is_tenant, FALSE) = FALSE
         AND COALESCE(lh.is_lessee, FALSE) = FALSE
        THEN 1 ELSE 0
      END
    )::BIGINT AS unknown_count
  FROM public.land_history lh
  WHERE lh.is_current = TRUE
),
history_change_type_distribution AS (
  SELECT COALESCE(
    jsonb_object_agg(change_type, row_count ORDER BY change_type),
    '{}'::JSONB
  ) AS distribution
  FROM (
    SELECT
      COALESCE(NULLIF(TRIM(lh.change_type), ''), 'UNSPECIFIED') AS change_type,
      COUNT(*)::BIGINT AS row_count
    FROM public.land_history lh
    GROUP BY 1
  ) grouped
),
snapshot_insert AS (
  INSERT INTO public.ownership_metrics_snapshots (capture_label, metrics)
  SELECT
    params.capture_label,
    jsonb_build_object(
      'rsbsa_submission', jsonb_build_object(
        'total_count', submission_counts.total_count,
        'mixed_role_count', submission_counts.mixed_role_count,
        'owner_only_count', submission_counts.owner_only_count,
        'tenant_lessee_count', submission_counts.tenant_lessee_count,
        'unknown_count', submission_counts.unknown_count
      ),
      'rsbsa_farm_parcels', jsonb_build_object(
        'total_count', parcel_counts.total_count,
        'mixed_role_count', parcel_counts.mixed_role_count,
        'owner_only_count', parcel_counts.owner_only_count,
        'tenant_lessee_count', parcel_counts.tenant_lessee_count,
        'unknown_count', parcel_counts.unknown_count,
        'current_owner_rows', parcel_counts.current_owner_rows,
        'tenant_lessee_marked_current_owner_rows', parcel_counts.tenant_lessee_marked_current_owner_rows
      ),
      'land_history_current', jsonb_build_object(
        'total_count', history_current_counts.total_count,
        'mixed_role_count', history_current_counts.mixed_role_count,
        'owner_only_count', history_current_counts.owner_only_count,
        'tenant_lessee_count', history_current_counts.tenant_lessee_count,
        'unknown_count', history_current_counts.unknown_count
      ),
      'land_history_change_type_distribution',
        history_change_type_distribution.distribution
    )
  FROM params
  CROSS JOIN submission_counts
  CROSS JOIN parcel_counts
  CROSS JOIN history_current_counts
  CROSS JOIN history_change_type_distribution
  RETURNING id, captured_at, capture_label, metrics
)
SELECT * FROM snapshot_insert;

COMMIT;

-- Quick view of latest snapshots (read-only)
-- SELECT id, captured_at, capture_label
-- FROM public.ownership_metrics_snapshots
-- ORDER BY captured_at DESC
-- LIMIT 20;
