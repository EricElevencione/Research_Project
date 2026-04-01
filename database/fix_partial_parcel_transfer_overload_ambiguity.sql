-- ============================================================================
-- Fix: Ambiguous execute_partial_parcel_transfer overloads
-- ============================================================================
-- Purpose:
--   Remove legacy overloads that cause PostgREST/PostgreSQL to fail with:
--   "Could not choose the best candidate function ..."
--
-- Safe behavior:
--   - Keeps the canonical BIGINT 8-argument function used by the app.
--   - Drops known legacy INTEGER overloads only if they exist.
--   - Re-applies EXECUTE grants only when a canonical signature exists.
--   - Reloads PostgREST schema cache.
--
-- Important:
--   Run database/create_partial_parcel_transfer_rpc.sql after this cleanup
--   to ensure the latest function body (including format-string fixes) is active.
-- ============================================================================

BEGIN;

-- Legacy overload observed in production error payload.
DROP FUNCTION IF EXISTS public.execute_partial_parcel_transfer(
  INTEGER,
  INTEGER,
  INTEGER,
  NUMERIC,
  TEXT,
  TEXT,
  DATE,
  BOOLEAN,
  BOOLEAN,
  TEXT
);

-- Defensive cleanup in case an older 7-parameter INTEGER overload exists.
DROP FUNCTION IF EXISTS public.execute_partial_parcel_transfer(
  INTEGER,
  INTEGER,
  INTEGER,
  NUMERIC,
  TEXT,
  TEXT,
  DATE
);

-- Remove legacy BIGINT 7-parameter signature so only the canonical version remains.
DROP FUNCTION IF EXISTS public.execute_partial_parcel_transfer(
  BIGINT,
  BIGINT,
  BIGINT,
  NUMERIC,
  TEXT,
  TEXT,
  DATE
);

-- Ensure app roles can still call canonical function when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'execute_partial_parcel_transfer'
      AND pg_get_function_identity_arguments(p.oid) =
        'bigint, bigint, bigint, numeric, text, text, date, jsonb'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.execute_partial_parcel_transfer(BIGINT, BIGINT, BIGINT, NUMERIC, TEXT, TEXT, DATE, JSONB) TO anon, authenticated, service_role';
  ELSIF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'execute_partial_parcel_transfer'
      AND pg_get_function_identity_arguments(p.oid) =
        'bigint, bigint, bigint, numeric, text, text, date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.execute_partial_parcel_transfer(BIGINT, BIGINT, BIGINT, NUMERIC, TEXT, TEXT, DATE) TO anon, authenticated, service_role';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Optional verification after running migration:
-- SELECT oid::regprocedure
-- FROM pg_proc
-- WHERE proname = 'execute_partial_parcel_transfer'
-- ORDER BY oid;
