-- ============================================================================
-- Fix: Ambiguous execute_partial_parcel_transfer overloads
-- ============================================================================
-- Purpose:
--   Remove legacy overloads that cause PostgREST/PostgreSQL to fail with:
--   "Could not choose the best candidate function ..."
--
-- Safe behavior:
--   - Keeps the canonical BIGINT 7-argument function used by the app.
--   - Drops known legacy INTEGER overloads only if they exist.
--   - Re-applies EXECUTE grants for canonical function.
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

-- Ensure app roles can still call canonical function.
GRANT EXECUTE ON FUNCTION public.execute_partial_parcel_transfer(
  BIGINT,
  BIGINT,
  BIGINT,
  NUMERIC,
  TEXT,
  TEXT,
  DATE
) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Optional verification after running migration:
-- SELECT oid::regprocedure
-- FROM pg_proc
-- WHERE proname = 'execute_partial_parcel_transfer'
-- ORDER BY oid;
