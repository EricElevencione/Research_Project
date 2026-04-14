-- ============================================================================
-- Migration: sync_farmer_no_parcels_status
-- Purpose: Adds archived_at / archive_reason columns to rsbsa_submission
--          and creates an RPC to atomically update farmer visibility status
--          after land transfers across all three modules (Land Registry,
--          Masterlist, RSBSA).
--
-- Run this in Supabase SQL Editor ONCE after deploying.
-- ============================================================================

-- ── 1. Add new columns to rsbsa_submission ─────────────────────────────────

ALTER TABLE public.rsbsa_submission
  ADD COLUMN IF NOT EXISTS archived_at    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT        DEFAULT NULL;

COMMENT ON COLUMN public.rsbsa_submission.archived_at
  IS 'Timestamp when farmer was hidden (all parcels transferred). NULL = visible.';

COMMENT ON COLUMN public.rsbsa_submission.archive_reason
  IS 'Human-readable reason for archiving, e.g. "All parcels transferred".';

-- ── 2. Create or replace the sync RPC ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_farmer_no_parcels_status(
  p_farmer_id BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_owner_parcel_count INT := 0;
  v_current_association_count INT := 0;
  v_current_link_count INT := 0;
  v_has_land_history BOOLEAN := FALSE;
BEGIN
  -- Legal owner links: current owner rows in rsbsa_farm_parcels.
  -- (is_current_owner IS NULL means legacy row → treat as current)
  SELECT COUNT(*)
    INTO v_current_owner_parcel_count
    FROM public.rsbsa_farm_parcels
   WHERE submission_id = p_farmer_id
     AND ownership_type_registered_owner = TRUE
     AND (is_current_owner IS NULL OR is_current_owner = true);

  -- Tenant/lessee links: use current land_history rows when available,
  -- so association visibility follows active relationship records.
  SELECT to_regclass('public.land_history') IS NOT NULL
    INTO v_has_land_history;

  IF v_has_land_history THEN
    SELECT COUNT(*)
      INTO v_current_association_count
      FROM public.land_history lh
     WHERE lh.farmer_id = p_farmer_id
       AND lh.is_current = TRUE
       AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE);
  ELSE
    -- Fallback for environments without land_history.
    SELECT COUNT(*)
      INTO v_current_association_count
      FROM public.rsbsa_farm_parcels fp
     WHERE fp.submission_id = p_farmer_id
       AND (fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE);
  END IF;

  v_current_link_count :=
    COALESCE(v_current_owner_parcel_count, 0) +
    COALESCE(v_current_association_count, 0);

  IF v_current_link_count = 0 THEN
    -- Farmer has zero active owner/association links → archive
    UPDATE public.rsbsa_submission
       SET status         = 'No Parcels',
           archived_at    = NOW(),
           archive_reason = 'All parcels transferred'
     WHERE id = p_farmer_id
       AND (status IS DISTINCT FROM 'No Parcels'
            OR archived_at IS NULL);
  ELSE
    -- Farmer has at least one active owner/association link → visible
    UPDATE public.rsbsa_submission
       SET status         = 'Active Farmer',
           archived_at    = NULL,
           archive_reason = NULL
     WHERE id = p_farmer_id
       AND (status IS DISTINCT FROM 'Active Farmer'
            OR archived_at IS NOT NULL);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.sync_farmer_no_parcels_status(BIGINT)
  IS 'Called after every transfer to sync farmer visibility across Land Registry, Masterlist, and RSBSA. Counts active owner links and active tenant/lessee associations. Sets status to No Parcels + archives if no active links remain, otherwise restores to Active Farmer.';

-- ── 3. Grant execute to authenticated users (Supabase RLS) ─────────────────

GRANT EXECUTE ON FUNCTION public.sync_farmer_no_parcels_status(BIGINT)
  TO authenticated;

-- ── 4. Optional: backfill existing farmers who already have 0 active links ──
-- Uncomment the block below to run a one-time backfill.
--
-- DO $$
-- DECLARE
--   r RECORD;
-- BEGIN
--   FOR r IN
--     SELECT rs.id
--       FROM public.rsbsa_submission rs
--      WHERE NOT EXISTS (
--              SELECT 1 FROM public.rsbsa_farm_parcels fp
--               WHERE fp.submission_id = rs.id
--                 AND fp.ownership_type_registered_owner = TRUE
--                 AND (fp.is_current_owner IS NULL OR fp.is_current_owner = true)
--            )
--        AND NOT EXISTS (
--              SELECT 1 FROM public.land_history lh
--               WHERE lh.farmer_id = rs.id
--                 AND lh.is_current = TRUE
--                 AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE)
--            )
--        AND rs.status IS DISTINCT FROM 'No Parcels'
--   LOOP
--     PERFORM public.sync_farmer_no_parcels_status(r.id);
--   END LOOP;
-- END;
-- $$;
