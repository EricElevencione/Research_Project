-- ============================================================================
-- Migration: add_ownership_category_columns_and_backfill
-- Purpose:
--   Introduce canonical two-category ownership fields while keeping legacy
--   boolean fields fully intact during transition.
--
-- Canonical values:
--   - registeredOwner
--   - tenantLessee
--   - unknown
--
-- Safe behavior:
--   - Non-destructive: does not drop legacy columns.
--   - Backfills ownership_category from existing booleans.
--   - Adds compatibility constraints only when missing.
-- ============================================================================

BEGIN;

-- 1) Add canonical ownership category columns.
ALTER TABLE public.rsbsa_submission
  ADD COLUMN IF NOT EXISTS ownership_category TEXT;

ALTER TABLE public.rsbsa_farm_parcels
  ADD COLUMN IF NOT EXISTS ownership_category TEXT;

ALTER TABLE public.land_history
  ADD COLUMN IF NOT EXISTS ownership_category TEXT;

-- 2) Backfill canonical ownership category values from legacy booleans.
-- Precedence is legal ownership first, then tenant/lessee association.
UPDATE public.rsbsa_submission rs
SET ownership_category = CASE
  WHEN rs."OWNERSHIP_TYPE_REGISTERED_OWNER" = TRUE THEN 'registeredOwner'
  WHEN rs."OWNERSHIP_TYPE_TENANT" = TRUE OR rs."OWNERSHIP_TYPE_LESSEE" = TRUE THEN 'tenantLessee'
  ELSE 'unknown'
END
WHERE rs.ownership_category IS NULL OR TRIM(rs.ownership_category) = '';

UPDATE public.rsbsa_farm_parcels fp
SET ownership_category = CASE
  WHEN fp.ownership_type_registered_owner = TRUE THEN 'registeredOwner'
  WHEN fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE THEN 'tenantLessee'
  ELSE 'unknown'
END
WHERE fp.ownership_category IS NULL OR TRIM(fp.ownership_category) = '';

UPDATE public.land_history lh
SET ownership_category = CASE
  WHEN lh.is_registered_owner = TRUE THEN 'registeredOwner'
  WHEN lh.is_tenant = TRUE OR lh.is_lessee = TRUE THEN 'tenantLessee'
  ELSE 'unknown'
END
WHERE lh.ownership_category IS NULL OR TRIM(lh.ownership_category) = '';

-- 3) Add check constraints if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rsbsa_submission_ownership_category_check'
  ) THEN
    ALTER TABLE public.rsbsa_submission
      ADD CONSTRAINT rsbsa_submission_ownership_category_check
      CHECK (ownership_category IN ('registeredOwner', 'tenantLessee', 'unknown'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rsbsa_farm_parcels_ownership_category_check'
  ) THEN
    ALTER TABLE public.rsbsa_farm_parcels
      ADD CONSTRAINT rsbsa_farm_parcels_ownership_category_check
      CHECK (ownership_category IN ('registeredOwner', 'tenantLessee', 'unknown'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'land_history_ownership_category_check'
  ) THEN
    ALTER TABLE public.land_history
      ADD CONSTRAINT land_history_ownership_category_check
      CHECK (ownership_category IN ('registeredOwner', 'tenantLessee', 'unknown'));
  END IF;
END
$$;

COMMIT;

-- ============================================================================
-- Post-run verification (read-only)
-- ============================================================================
-- 1) Count unresolved categories.
-- SELECT ownership_category, COUNT(*)
-- FROM public.rsbsa_submission
-- GROUP BY ownership_category
-- ORDER BY ownership_category;

-- SELECT ownership_category, COUNT(*)
-- FROM public.rsbsa_farm_parcels
-- GROUP BY ownership_category
-- ORDER BY ownership_category;

-- SELECT ownership_category, COUNT(*)
-- FROM public.land_history
-- GROUP BY ownership_category
-- ORDER BY ownership_category;
