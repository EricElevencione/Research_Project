-- ============================================================================
-- Optional Policy Change: strict_owner_archive_policy
--
-- What changes:
--   A farmer is archived as 'No Parcels' when they no longer have any CURRENT
--   registered-owner parcel and they have evidence of prior legal ownership.
--
-- Why this exists:
--   This is stricter than association-aware behavior. It treats legal ownership
--   as the primary criterion for visibility even if tenant/lessee associations
--   still exist for that same farmer.
--
-- IMPORTANT:
--   Run this only if this is your intended business rule.
--   It replaces public.sync_farmer_no_parcels_status(bigint).
-- ============================================================================

BEGIN;

-- Safety check: expected tables must exist.
DO $$
BEGIN
  IF to_regclass('public.rsbsa_submission') IS NULL
     OR to_regclass('public.rsbsa_farm_parcels') IS NULL THEN
    RAISE EXCEPTION 'Required tables not found (rsbsa_submission / rsbsa_farm_parcels).';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_farmer_no_parcels_status(p_farmer_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_has_land_history BOOLEAN := FALSE;
  v_has_owner_history BOOLEAN := FALSE;
  v_current_owner_farm_parcel_count INT := 0;
  v_current_owner_history_count INT := 0;
  v_current_owner_count INT := 0;
  v_current_association_count INT := 0;
  v_has_ever_owned BOOLEAN := FALSE;
BEGIN
  -- Detect whether land_history is available.
  SELECT to_regclass('public.land_history') IS NOT NULL
    INTO v_has_land_history;

  -- Current legal ownership links from parcel table (fallback source).
  SELECT COUNT(*)
    INTO v_current_owner_farm_parcel_count
    FROM public.rsbsa_farm_parcels fp
   WHERE fp.submission_id = p_farmer_id
     AND fp.ownership_type_registered_owner = TRUE
     AND (fp.is_current_owner IS NULL OR fp.is_current_owner = TRUE);

  -- Current legal ownership and association links from land_history.
  -- If owner history exists for this farmer, use history as source-of-truth
  -- for current legal ownership to avoid stale is_current_owner flags.
  IF v_has_land_history THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.land_history lh
      WHERE lh.farmer_id = p_farmer_id
        AND lh.is_registered_owner = TRUE
    )
      INTO v_has_owner_history;

    SELECT COUNT(*)
      INTO v_current_owner_history_count
      FROM public.land_history lh
     WHERE lh.farmer_id = p_farmer_id
       AND lh.is_registered_owner = TRUE
       AND lh.is_current = TRUE;

    SELECT COUNT(*)
      INTO v_current_association_count
      FROM public.land_history lh
     WHERE lh.farmer_id = p_farmer_id
       AND lh.is_current = TRUE
       AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE);
  ELSE
    SELECT COUNT(*)
      INTO v_current_association_count
      FROM public.rsbsa_farm_parcels fp
     WHERE fp.submission_id = p_farmer_id
       AND (fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE);
  END IF;

  IF v_has_land_history AND v_has_owner_history THEN
    v_current_owner_count := COALESCE(v_current_owner_history_count, 0);
  ELSE
    v_current_owner_count := COALESCE(v_current_owner_farm_parcel_count, 0);
  END IF;

  -- Evidence that the farmer has ever been a legal owner.
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.rsbsa_farm_parcels fp
      WHERE fp.submission_id = p_farmer_id
        AND fp.ownership_type_registered_owner = TRUE
    )
    OR (
      v_has_land_history
      AND v_has_owner_history
    )
  )
  INTO v_has_ever_owned;

  -- Strict policy:
  -- 1) Has current legal owner link => Active Farmer.
  -- 2) No current legal owner link but has ever owned => No Parcels (transferred out).
  -- 3) Never owner => keep association-aware behavior.
  IF v_current_owner_count > 0 THEN
    UPDATE public.rsbsa_submission
       SET status         = 'Active Farmer',
           archived_at    = NULL,
           archive_reason = NULL
     WHERE id = p_farmer_id
       AND (status IS DISTINCT FROM 'Active Farmer'
            OR archived_at IS NOT NULL
            OR archive_reason IS NOT NULL);

  ELSIF v_has_ever_owned THEN
    UPDATE public.rsbsa_submission
       SET status         = 'No Parcels',
           archived_at    = NOW(),
           archive_reason = 'All owned parcels transferred'
     WHERE id = p_farmer_id
       AND (status IS DISTINCT FROM 'No Parcels'
            OR archived_at IS NULL
            OR archive_reason IS DISTINCT FROM 'All owned parcels transferred');

  ELSIF v_current_association_count > 0 THEN
    UPDATE public.rsbsa_submission
       SET status         = 'Active Farmer',
           archived_at    = NULL,
           archive_reason = NULL
     WHERE id = p_farmer_id
       AND (status IS DISTINCT FROM 'Active Farmer'
            OR archived_at IS NOT NULL
            OR archive_reason IS NOT NULL);

  ELSE
    UPDATE public.rsbsa_submission
       SET status         = 'No Parcels',
           archived_at    = NOW(),
           archive_reason = 'No active owner or association links'
     WHERE id = p_farmer_id
       AND (status IS DISTINCT FROM 'No Parcels'
            OR archived_at IS NULL
            OR archive_reason IS DISTINCT FROM 'No active owner or association links');
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.sync_farmer_no_parcels_status(BIGINT)
  IS 'Strict owner policy: archive former legal owners once current legal ownership is zero (history-first source when available); keep never-owner records association-aware.';

GRANT EXECUTE ON FUNCTION public.sync_farmer_no_parcels_status(BIGINT)
  TO authenticated;

COMMIT;

-- ============================================================================
-- Optional one-time full reconciliation after policy change
-- ============================================================================
-- DO $$
-- DECLARE
--   r RECORD;
-- BEGIN
--   FOR r IN SELECT id FROM public.rsbsa_submission LOOP
--     PERFORM public.sync_farmer_no_parcels_status(r.id);
--   END LOOP;
-- END
-- $$;

-- ============================================================================
-- Preview before switching policy (read-only)
-- Farmers who would become 'No Parcels' under strict owner policy.
-- ============================================================================
-- WITH source_flags AS (
--   SELECT to_regclass('public.land_history') IS NOT NULL AS has_land_history
-- ),
-- owner_counts_fp AS (
--   SELECT
--     rs.id,
--     COALESCE(
--       COUNT(*) FILTER (
--         WHERE fp.ownership_type_registered_owner = TRUE
--           AND (fp.is_current_owner IS NULL OR fp.is_current_owner = TRUE)
--       ),
--       0
--     ) AS current_owner_count
--   FROM public.rsbsa_submission rs
--   LEFT JOIN public.rsbsa_farm_parcels fp
--     ON fp.submission_id = rs.id
--   GROUP BY rs.id
-- ),
-- owner_counts_history AS (
--   SELECT
--     rs.id,
--     COALESCE(
--       COUNT(*) FILTER (
--         WHERE lh.is_registered_owner = TRUE
--           AND lh.is_current = TRUE
--       ),
--       0
--     ) AS current_owner_count
--   FROM public.rsbsa_submission rs
--   LEFT JOIN public.land_history lh
--     ON lh.farmer_id = rs.id
--   GROUP BY rs.id
-- ),
-- owner_ever_fp AS (
--   SELECT
--     rs.id,
--     EXISTS (
--       SELECT 1
--       FROM public.rsbsa_farm_parcels fp
--       WHERE fp.submission_id = rs.id
--         AND fp.ownership_type_registered_owner = TRUE
--     ) AS has_owner_fp
--   FROM public.rsbsa_submission rs
-- ),
-- owner_history AS (
--   SELECT
--     rs.id,
--     EXISTS (
--       SELECT 1
--       FROM public.land_history lh
--       WHERE lh.farmer_id = rs.id
--         AND lh.is_registered_owner = TRUE
--     ) AS has_owner_history
--   FROM public.rsbsa_submission rs
-- ),
-- owner_counts AS (
--   SELECT
--     rs.id,
--     CASE
--       WHEN sf.has_land_history AND oh.has_owner_history
--         THEN COALESCE(och.current_owner_count, 0)
--       ELSE COALESCE(ocfp.current_owner_count, 0)
--     END AS current_owner_count,
--     (COALESCE(oefp.has_owner_fp, FALSE) OR COALESCE(oh.has_owner_history, FALSE)) AS has_ever_owned,
--     COALESCE(ocfp.current_owner_count, 0) AS fp_current_owner_count,
--     COALESCE(och.current_owner_count, 0) AS history_current_owner_count
--   FROM public.rsbsa_submission rs
--   CROSS JOIN source_flags sf
--   LEFT JOIN owner_counts_fp ocfp ON ocfp.id = rs.id
--   LEFT JOIN owner_counts_history och ON och.id = rs.id
--   LEFT JOIN owner_ever_fp oefp ON oefp.id = rs.id
--   LEFT JOIN owner_history oh ON oh.id = rs.id
-- )
-- SELECT
--   rs.id,
--   rs."LAST NAME" AS last_name,
--   rs."FIRST NAME" AS first_name,
--   rs."MIDDLE NAME" AS middle_name,
--   rs.status,
--   oc.current_owner_count,
--   oc.has_ever_owned,
--   oc.fp_current_owner_count,
--   oc.history_current_owner_count
-- FROM public.rsbsa_submission rs
-- JOIN owner_counts oc ON oc.id = rs.id
-- WHERE oc.current_owner_count = 0
--   AND oc.has_ever_owned = TRUE
--   AND rs.status <> 'No Parcels'
-- ORDER BY rs.id;
