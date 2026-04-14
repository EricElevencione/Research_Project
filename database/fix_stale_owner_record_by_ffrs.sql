-- ============================================================================
-- Corrective Script: fix_stale_owner_record_by_ffrs
-- Purpose:
--   Resolve a farmer that remains Active due stale owner/association rows after
--   ownership transfer, then re-sync status via sync_farmer_no_parcels_status.
--
-- Default target:
--   Woods, Upton Osian (FFRS 06-30-18-000-119807)
--
-- Notes:
--   - This script is intentionally targeted and conservative.
--   - It can close current tenant/lessee association rows for the target when
--     they should no longer keep the farmer visible in owner-focused lists.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_ffrs_code TEXT := '06-30-18-000-119807';
  v_close_current_associations BOOLEAN := TRUE;
  v_farmer_id BIGINT;
  v_owner_rows_demoted INT := 0;
  v_assoc_rows_closed INT := 0;
BEGIN
  SELECT rs.id
    INTO v_farmer_id
    FROM public.rsbsa_submission rs
   WHERE rs."FFRS_CODE" = v_ffrs_code
   LIMIT 1;

  IF v_farmer_id IS NULL THEN
    RAISE EXCEPTION 'Target FFRS code not found: %', v_ffrs_code;
  END IF;

  -- Demote any current owner rows for this submission in rsbsa_farm_parcels.
  UPDATE public.rsbsa_farm_parcels fp
     SET is_current_owner = FALSE,
         updated_at = NOW()
   WHERE fp.submission_id = v_farmer_id
     AND fp.ownership_type_registered_owner = TRUE
     AND (fp.is_current_owner IS NULL OR fp.is_current_owner = TRUE);

  GET DIAGNOSTICS v_owner_rows_demoted = ROW_COUNT;

  -- Optionally close current tenant/lessee associations for this farmer.
  -- This is needed when the farmer should be archived as having no active land role.
  IF v_close_current_associations THEN
    UPDATE public.land_history lh
       SET is_current = FALSE,
           period_end_date = COALESCE(lh.period_end_date, CURRENT_DATE),
           change_type = CASE
             WHEN COALESCE(NULLIF(BTRIM(lh.change_type), ''), '') = '' THEN 'ASSOCIATION_CLOSED'
             ELSE lh.change_type
           END,
           change_reason = CASE
             WHEN COALESCE(NULLIF(BTRIM(lh.change_reason), ''), '') = ''
               THEN 'Closed by corrective cleanup: no current legal ownership remains'
             ELSE lh.change_reason
           END,
           updated_at = NOW()
     WHERE lh.farmer_id = v_farmer_id
       AND lh.is_current = TRUE
       AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE);

    GET DIAGNOSTICS v_assoc_rows_closed = ROW_COUNT;
  END IF;

  -- Recompute status/archival using current deployed sync function.
  PERFORM public.sync_farmer_no_parcels_status(v_farmer_id);

  RAISE NOTICE 'FFRS=% | farmer_id=% | owner_rows_demoted=% | association_rows_closed=%',
    v_ffrs_code, v_farmer_id, v_owner_rows_demoted, v_assoc_rows_closed;
END
$$;

COMMIT;

-- ============================================================================
-- Post-run verification (read-only)
-- ============================================================================
-- SELECT
--   rs.id,
--   rs."LAST NAME" AS last_name,
--   rs."FIRST NAME" AS first_name,
--   rs."MIDDLE NAME" AS middle_name,
--   rs."FFRS_CODE" AS ffrs_code,
--   rs.status,
--   rs.archived_at,
--   rs.archive_reason
-- FROM public.rsbsa_submission rs
-- WHERE rs."FFRS_CODE" = '06-30-18-000-119807';
--
-- WITH t AS (
--   SELECT id
--   FROM public.rsbsa_submission
--   WHERE "FFRS_CODE" = '06-30-18-000-119807'
--   LIMIT 1
-- )
-- SELECT
--   COUNT(*) FILTER (
--     WHERE fp.ownership_type_registered_owner = TRUE
--       AND (fp.is_current_owner IS NULL OR fp.is_current_owner = TRUE)
--   ) AS current_owner_rows,
--   COUNT(*) FILTER (
--     WHERE lh.is_current = TRUE
--       AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE)
--   ) AS current_assoc_rows
-- FROM t
-- LEFT JOIN public.rsbsa_farm_parcels fp ON fp.submission_id = t.id
-- LEFT JOIN public.land_history lh ON lh.farmer_id = t.id;
