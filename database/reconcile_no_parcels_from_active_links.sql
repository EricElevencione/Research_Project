-- ============================================================================
-- One-time repair: reconcile archived No Parcels status using active links
--
-- Run this AFTER updating sync_farmer_no_parcels_status.sql.
-- This script re-evaluates every farmer record and restores visibility for
-- active tenant/lessee associations.
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'sync_farmer_no_parcels_status'
      AND n.nspname = 'public'
      AND p.pronargs = 1
  ) THEN
    RAISE EXCEPTION 'sync_farmer_no_parcels_status(BIGINT) not found. Apply database/sync_farmer_no_parcels_status.sql first.';
  END IF;

  FOR r IN SELECT id FROM public.rsbsa_submission LOOP
    PERFORM public.sync_farmer_no_parcels_status(r.id);
  END LOOP;
END
$$;

-- Optional verification: farmers still marked No Parcels even with current
-- tenant/lessee associations should return zero rows.
SELECT
  rs.id,
  rs."LAST NAME" AS last_name,
  rs."FIRST NAME" AS first_name,
  rs.status,
  rs.archived_at,
  rs.archive_reason,
  COUNT(lh.id) AS current_association_rows
FROM public.rsbsa_submission rs
JOIN public.land_history lh
  ON lh.farmer_id = rs.id
 AND lh.is_current = TRUE
 AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE)
WHERE rs.status = 'No Parcels'
GROUP BY rs.id, rs."LAST NAME", rs."FIRST NAME", rs.status, rs.archived_at, rs.archive_reason
ORDER BY rs.archived_at DESC NULLS LAST;
