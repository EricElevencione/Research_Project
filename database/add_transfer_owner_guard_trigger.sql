-- ============================================================================
-- Migration: add_transfer_owner_guard_trigger
-- Purpose:
--   Prevent TRANSFER rows from storing a land_owner_name that conflicts with
--   the "from <name>" party in standardized transfer reason text.
--
-- Scope:
--   Applies only when both are true:
--     1) upper(change_type) = 'TRANSFER'
--     2) change_reason matches:
--        Ownership transfer from <name> to <name>
--
-- Behavior:
--   - On INSERT/UPDATE, auto-sets land_owner_name to parsed "from" name.
--   - Auto-sets land_owner_id only if parsed name maps to exactly one
--     rsbsa_submission full-name match.
--   - Includes conservative one-time backfill for existing standardized rows.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_person_name(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(coalesce(p_text, ''), '\\s+', ' ', 'g')));
$$;

CREATE OR REPLACE FUNCTION public.tg_enforce_transfer_owner_from_reason()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match TEXT[];
  v_from_name TEXT;
  v_owner_match_count INTEGER;
  v_owner_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF upper(coalesce(NEW.change_type, '')) <> 'TRANSFER' THEN
    RETURN NEW;
  END IF;

  v_match := regexp_match(
    trim(coalesce(NEW.change_reason, '')),
    '^ownership transfer from\\s+(.+?)\\s+to\\s+(.+?)(?:[.;]|$)',
    'i'
  );

  IF v_match IS NULL THEN
    RETURN NEW;
  END IF;

  v_from_name := trim(coalesce(v_match[1], ''));
  IF v_from_name = '' THEN
    RETURN NEW;
  END IF;

  NEW.land_owner_name := v_from_name;

  SELECT
    COUNT(*)::INTEGER,
    MAX(rs.id)::BIGINT
  INTO
    v_owner_match_count,
    v_owner_id
  FROM public.rsbsa_submission rs
  WHERE public.normalize_person_name(
    concat_ws(
      ' ',
      coalesce(rs."FIRST NAME", ''),
      coalesce(rs."MIDDLE NAME", ''),
      coalesce(rs."LAST NAME", ''),
      nullif(rs."EXT NAME", '')
    )
  ) = public.normalize_person_name(v_from_name);

  IF v_owner_match_count = 1 THEN
    NEW.land_owner_id := v_owner_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_transfer_owner_from_reason
  ON public.land_history;

CREATE TRIGGER trg_enforce_transfer_owner_from_reason
BEFORE INSERT OR UPDATE OF change_type, change_reason, land_owner_name, land_owner_id
ON public.land_history
FOR EACH ROW
EXECUTE FUNCTION public.tg_enforce_transfer_owner_from_reason();

WITH parsed AS (
  SELECT
    lh.id,
    trim((regexp_match(
      trim(coalesce(lh.change_reason, '')),
      '^ownership transfer from\\s+(.+?)\\s+to\\s+(.+?)(?:[.;]|$)',
      'i'
    ))[1]) AS from_name
  FROM public.land_history lh
  WHERE upper(coalesce(lh.change_type, '')) = 'TRANSFER'
    AND trim(coalesce(lh.change_reason, '')) ~* '^ownership transfer from\\s+.+\\s+to\\s+.+(?:[.;]|$)'
),
resolved_owner AS (
  SELECT
    p.id,
    p.from_name,
    CASE WHEN COUNT(rs.id) = 1 THEN MAX(rs.id) ELSE NULL END AS resolved_owner_id
  FROM parsed p
  LEFT JOIN public.rsbsa_submission rs
    ON public.normalize_person_name(
      concat_ws(
        ' ',
        coalesce(rs."FIRST NAME", ''),
        coalesce(rs."MIDDLE NAME", ''),
        coalesce(rs."LAST NAME", ''),
        nullif(rs."EXT NAME", '')
      )
    ) = public.normalize_person_name(p.from_name)
  GROUP BY p.id, p.from_name
)
UPDATE public.land_history lh
SET
  land_owner_name = ro.from_name,
  land_owner_id = coalesce(ro.resolved_owner_id, lh.land_owner_id),
  updated_at = now()
FROM resolved_owner ro
WHERE lh.id = ro.id
  AND (
    public.normalize_person_name(lh.land_owner_name) IS DISTINCT FROM public.normalize_person_name(ro.from_name)
    OR (ro.resolved_owner_id IS NOT NULL AND lh.land_owner_id IS DISTINCT FROM ro.resolved_owner_id)
  );

COMMIT;

-- ============================================================================
-- Post-run verification (read-only)
-- ============================================================================
-- 1) Check remaining standardized TRANSFER mismatches
-- WITH parsed AS (
--   SELECT
--     id,
--     land_owner_name,
--     trim((regexp_match(change_reason, '^Ownership transfer from\\s+(.+?)\\s+to\\s+(.+?)(?:[.;]|$)', 'i'))[1]) AS from_name
--   FROM public.land_history
--   WHERE upper(coalesce(change_type, '')) = 'TRANSFER'
--     AND trim(coalesce(change_reason, '')) ~* '^ownership transfer from\\s+.+\\s+to\\s+.+(?:[.;]|$)'
-- )
-- SELECT id, land_owner_name, from_name
-- FROM parsed
-- WHERE public.normalize_person_name(land_owner_name) IS DISTINCT FROM public.normalize_person_name(from_name)
-- ORDER BY id;
--
-- 2) Check trigger exists
-- SELECT c.relname AS table_name, t.tgname AS trigger_name, p.proname AS function_name
-- FROM pg_trigger t
-- JOIN pg_class c ON c.oid = t.tgrelid
-- JOIN pg_proc  p ON p.oid = t.tgfoid
-- WHERE NOT t.tgisinternal
--   AND c.relname = 'land_history'
--   AND t.tgname = 'trg_enforce_transfer_owner_from_reason';
