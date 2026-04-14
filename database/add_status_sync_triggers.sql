-- ============================================================================
-- Migration: add_status_sync_triggers
-- Purpose:
--   Keep rsbsa_submission.status and archive fields synchronized at DB level
--   whenever owner links or tenant/lessee association links change.
--
-- Requirements:
--   - public.sync_farmer_no_parcels_status(bigint) must already exist.
--
-- Safe behavior:
--   - Idempotent: CREATE OR REPLACE for trigger functions.
--   - Trigger recreation is deterministic via DROP TRIGGER IF EXISTS.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'sync_farmer_no_parcels_status'
      AND n.nspname = 'public'
      AND p.pronargs = 1
  ) THEN
    RAISE EXCEPTION 'public.sync_farmer_no_parcels_status(bigint) not found. Run database/sync_farmer_no_parcels_status.sql first.';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.tg_sync_farmer_status_from_parcels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_owner_link_counts BOOLEAN := FALSE;
  new_owner_link_counts BOOLEAN := FALSE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_owner_link_counts :=
      OLD.submission_id IS NOT NULL
      AND OLD.ownership_type_registered_owner = TRUE
      AND (OLD.is_current_owner IS NULL OR OLD.is_current_owner = TRUE);
  END IF;

  IF TG_OP <> 'DELETE' THEN
    new_owner_link_counts :=
      NEW.submission_id IS NOT NULL
      AND NEW.ownership_type_registered_owner = TRUE
      AND (NEW.is_current_owner IS NULL OR NEW.is_current_owner = TRUE);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF new_owner_link_counts THEN
      PERFORM public.sync_farmer_no_parcels_status(NEW.submission_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF old_owner_link_counts THEN
      PERFORM public.sync_farmer_no_parcels_status(OLD.submission_id);
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.submission_id IS DISTINCT FROM NEW.submission_id THEN
    IF old_owner_link_counts THEN
      PERFORM public.sync_farmer_no_parcels_status(OLD.submission_id);
    END IF;

    IF new_owner_link_counts THEN
      PERFORM public.sync_farmer_no_parcels_status(NEW.submission_id);
    END IF;

    RETURN NEW;
  END IF;

  IF old_owner_link_counts IS DISTINCT FROM new_owner_link_counts THEN
    PERFORM public.sync_farmer_no_parcels_status(NEW.submission_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_farmer_status_from_parcels
  ON public.rsbsa_farm_parcels;

CREATE TRIGGER trg_sync_farmer_status_from_parcels
AFTER INSERT OR UPDATE OR DELETE ON public.rsbsa_farm_parcels
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_farmer_status_from_parcels();

CREATE OR REPLACE FUNCTION public.tg_sync_farmer_status_from_land_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_assoc_link_counts BOOLEAN := FALSE;
  new_assoc_link_counts BOOLEAN := FALSE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_assoc_link_counts :=
      OLD.farmer_id IS NOT NULL
      AND OLD.is_current = TRUE
      AND (OLD.is_tenant = TRUE OR OLD.is_lessee = TRUE);
  END IF;

  IF TG_OP <> 'DELETE' THEN
    new_assoc_link_counts :=
      NEW.farmer_id IS NOT NULL
      AND NEW.is_current = TRUE
      AND (NEW.is_tenant = TRUE OR NEW.is_lessee = TRUE);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF new_assoc_link_counts THEN
      PERFORM public.sync_farmer_no_parcels_status(NEW.farmer_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF old_assoc_link_counts THEN
      PERFORM public.sync_farmer_no_parcels_status(OLD.farmer_id);
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.farmer_id IS DISTINCT FROM NEW.farmer_id THEN
    IF old_assoc_link_counts THEN
      PERFORM public.sync_farmer_no_parcels_status(OLD.farmer_id);
    END IF;

    IF new_assoc_link_counts THEN
      PERFORM public.sync_farmer_no_parcels_status(NEW.farmer_id);
    END IF;

    RETURN NEW;
  END IF;

  IF old_assoc_link_counts IS DISTINCT FROM new_assoc_link_counts THEN
    PERFORM public.sync_farmer_no_parcels_status(NEW.farmer_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_farmer_status_from_land_history
  ON public.land_history;

CREATE TRIGGER trg_sync_farmer_status_from_land_history
AFTER INSERT OR UPDATE OR DELETE ON public.land_history
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_farmer_status_from_land_history();

COMMIT;

-- ============================================================================
-- Post-run verification (read-only)
-- ============================================================================
-- SELECT
--   c.relname AS table_name,
--   t.tgname  AS trigger_name,
--   p.proname AS function_name
-- FROM pg_trigger t
-- JOIN pg_class c ON c.oid = t.tgrelid
-- JOIN pg_proc  p ON p.oid = t.tgfoid
-- WHERE NOT t.tgisinternal
--   AND c.relname IN ('rsbsa_farm_parcels', 'land_history')
-- ORDER BY c.relname, t.tgname;
