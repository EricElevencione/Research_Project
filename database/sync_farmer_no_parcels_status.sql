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
  v_current_parcel_count INT;
BEGIN
  -- Count parcels the farmer currently owns
  -- (is_current_owner IS NULL means legacy row → treat as current)
  SELECT COUNT(*)
    INTO v_current_parcel_count
    FROM public.rsbsa_farm_parcels
   WHERE submission_id = p_farmer_id
     AND (is_current_owner IS NULL OR is_current_owner = true);

  IF v_current_parcel_count = 0 THEN
    -- Farmer has zero parcels → mark as 'No Parcels' and archive
    UPDATE public.rsbsa_submission
       SET status         = 'No Parcels',
           archived_at    = NOW(),
           archive_reason = 'All parcels transferred'
     WHERE id = p_farmer_id
       AND (status IS DISTINCT FROM 'No Parcels'
            OR archived_at IS NULL);
  ELSE
    -- Farmer still has parcels → ensure they are active and visible
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
  IS 'Called after every transfer to sync farmer visibility across Land Registry, Masterlist, and RSBSA. Sets status to No Parcels + archives if 0 parcels remain, otherwise restores to Active Farmer.';

-- ── 3. Grant execute to authenticated users (Supabase RLS) ─────────────────

GRANT EXECUTE ON FUNCTION public.sync_farmer_no_parcels_status(BIGINT)
  TO authenticated;

-- ── 4. Optional: backfill existing farmers who already have 0 parcels ──────
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
--                 AND (fp.is_current_owner IS NULL OR fp.is_current_owner = true)
--            )
--        AND rs.status IS DISTINCT FROM 'No Parcels'
--   LOOP
--     PERFORM public.sync_farmer_no_parcels_status(r.id);
--   END LOOP;
-- END;
-- $$;
