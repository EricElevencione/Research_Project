-- ============================================================================
-- MIGRATION: Owner Link Indexes + Backfill (Tenant/Lessee -> Owner ID)
-- ============================================================================
-- Purpose:
-- 1) Ensure rsbsa_farm_parcels has owner-id link columns.
-- 2) Add indexes for fast owner->tenant lookup on map/API.
-- 3) Backfill missing owner IDs from owner name (strict exact normalized match).
-- 4) Store unresolved rows for manual review.
--
-- Safe characteristics:
-- - Additive only (no destructive updates/deletes)
-- - Backfill only when *_land_owner_id is NULL
-- - Writes unresolved rows to an audit table
-- ============================================================================

BEGIN;

-- 1) Ensure owner-id columns exist
ALTER TABLE rsbsa_farm_parcels
  ADD COLUMN IF NOT EXISTS tenant_land_owner_id BIGINT,
  ADD COLUMN IF NOT EXISTS lessee_land_owner_id BIGINT;

-- 2) Add FK constraints if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_rsbsa_farm_parcels_tenant_land_owner_id'
  ) THEN
    ALTER TABLE rsbsa_farm_parcels
      ADD CONSTRAINT fk_rsbsa_farm_parcels_tenant_land_owner_id
      FOREIGN KEY (tenant_land_owner_id)
      REFERENCES rsbsa_submission(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_rsbsa_farm_parcels_lessee_land_owner_id'
  ) THEN
    ALTER TABLE rsbsa_farm_parcels
      ADD CONSTRAINT fk_rsbsa_farm_parcels_lessee_land_owner_id
      FOREIGN KEY (lessee_land_owner_id)
      REFERENCES rsbsa_submission(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Add indexes used by map/API id-first lookup
CREATE INDEX IF NOT EXISTS idx_rsbsa_farm_parcels_tenant_land_owner_id
  ON rsbsa_farm_parcels(tenant_land_owner_id)
  WHERE tenant_land_owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rsbsa_farm_parcels_lessee_land_owner_id
  ON rsbsa_farm_parcels(lessee_land_owner_id)
  WHERE lessee_land_owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rsbsa_farm_parcels_barangay_owner_lookup
  ON rsbsa_farm_parcels(farm_location_barangay, tenant_land_owner_id, lessee_land_owner_id);

-- 4) Audit table for unresolved links
CREATE TABLE IF NOT EXISTS owner_link_backfill_audit (
  id BIGSERIAL PRIMARY KEY,
  farm_parcel_id BIGINT NOT NULL,
  link_type TEXT NOT NULL CHECK (link_type IN ('tenant', 'lessee')),
  owner_name TEXT,
  farm_location_barangay TEXT,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Normalization helpers via expression re-use:
-- normalize(x) = lower(trim(regexp_replace(coalesce(x,''), '\\s+', ' ', 'g')))

-- 5) Backfill tenant owner IDs (strict unique match)
WITH tenant_candidates AS (
  SELECT
    fp.id AS farm_parcel_id,
    rs.id AS owner_id,
    COUNT(*) OVER (PARTITION BY fp.id) AS candidate_count,
    ROW_NUMBER() OVER (PARTITION BY fp.id ORDER BY rs.id) AS rn
  FROM rsbsa_farm_parcels fp
  JOIN rsbsa_submission rs
    ON lower(trim(regexp_replace(coalesce(fp.tenant_land_owner_name, ''), '\\s+', ' ', 'g'))) =
       lower(trim(regexp_replace(concat_ws(' ',
         coalesce(rs."FIRST NAME", ''),
         coalesce(rs."MIDDLE NAME", ''),
         coalesce(rs."LAST NAME", '')
       ), '\\s+', ' ', 'g')))
  WHERE fp.ownership_type_tenant = TRUE
    AND fp.tenant_land_owner_id IS NULL
    AND coalesce(trim(fp.tenant_land_owner_name), '') <> ''
    AND (
      lower(trim(regexp_replace(coalesce(fp.farm_location_barangay, ''), '\\s+', ' ', 'g'))) =
      lower(trim(regexp_replace(coalesce(rs."BARANGAY", ''), '\\s+', ' ', 'g')))
      OR coalesce(trim(fp.farm_location_barangay), '') = ''
      OR coalesce(trim(rs."BARANGAY"), '') = ''
    )
), unique_tenant_matches AS (
  SELECT farm_parcel_id, owner_id
  FROM tenant_candidates
  WHERE candidate_count = 1 AND rn = 1
)
UPDATE rsbsa_farm_parcels fp
SET tenant_land_owner_id = um.owner_id,
    updated_at = NOW()
FROM unique_tenant_matches um
WHERE fp.id = um.farm_parcel_id;

-- 6) Backfill lessee owner IDs (strict unique match)
WITH lessee_candidates AS (
  SELECT
    fp.id AS farm_parcel_id,
    rs.id AS owner_id,
    COUNT(*) OVER (PARTITION BY fp.id) AS candidate_count,
    ROW_NUMBER() OVER (PARTITION BY fp.id ORDER BY rs.id) AS rn
  FROM rsbsa_farm_parcels fp
  JOIN rsbsa_submission rs
    ON lower(trim(regexp_replace(coalesce(fp.lessee_land_owner_name, ''), '\\s+', ' ', 'g'))) =
       lower(trim(regexp_replace(concat_ws(' ',
         coalesce(rs."FIRST NAME", ''),
         coalesce(rs."MIDDLE NAME", ''),
         coalesce(rs."LAST NAME", '')
       ), '\\s+', ' ', 'g')))
  WHERE fp.ownership_type_lessee = TRUE
    AND fp.lessee_land_owner_id IS NULL
    AND coalesce(trim(fp.lessee_land_owner_name), '') <> ''
    AND (
      lower(trim(regexp_replace(coalesce(fp.farm_location_barangay, ''), '\\s+', ' ', 'g'))) =
      lower(trim(regexp_replace(coalesce(rs."BARANGAY", ''), '\\s+', ' ', 'g')))
      OR coalesce(trim(fp.farm_location_barangay), '') = ''
      OR coalesce(trim(rs."BARANGAY"), '') = ''
    )
), unique_lessee_matches AS (
  SELECT farm_parcel_id, owner_id
  FROM lessee_candidates
  WHERE candidate_count = 1 AND rn = 1
)
UPDATE rsbsa_farm_parcels fp
SET lessee_land_owner_id = um.owner_id,
    updated_at = NOW()
FROM unique_lessee_matches um
WHERE fp.id = um.farm_parcel_id;

-- 7) Audit unresolved tenant rows
INSERT INTO owner_link_backfill_audit (
  farm_parcel_id,
  link_type,
  owner_name,
  farm_location_barangay,
  candidate_count,
  reason
)
SELECT
  fp.id,
  'tenant',
  fp.tenant_land_owner_name,
  fp.farm_location_barangay,
  (
    SELECT COUNT(*)
    FROM rsbsa_submission rs
    WHERE lower(trim(regexp_replace(coalesce(fp.tenant_land_owner_name, ''), '\\s+', ' ', 'g'))) =
          lower(trim(regexp_replace(concat_ws(' ',
            coalesce(rs."FIRST NAME", ''),
            coalesce(rs."MIDDLE NAME", ''),
            coalesce(rs."LAST NAME", '')
          ), '\\s+', ' ', 'g')))
  ) AS candidate_count,
  'Could not resolve unique tenant owner match'
FROM rsbsa_farm_parcels fp
WHERE fp.ownership_type_tenant = TRUE
  AND fp.tenant_land_owner_id IS NULL
  AND coalesce(trim(fp.tenant_land_owner_name), '') <> '';

-- 8) Audit unresolved lessee rows
INSERT INTO owner_link_backfill_audit (
  farm_parcel_id,
  link_type,
  owner_name,
  farm_location_barangay,
  candidate_count,
  reason
)
SELECT
  fp.id,
  'lessee',
  fp.lessee_land_owner_name,
  fp.farm_location_barangay,
  (
    SELECT COUNT(*)
    FROM rsbsa_submission rs
    WHERE lower(trim(regexp_replace(coalesce(fp.lessee_land_owner_name, ''), '\\s+', ' ', 'g'))) =
          lower(trim(regexp_replace(concat_ws(' ',
            coalesce(rs."FIRST NAME", ''),
            coalesce(rs."MIDDLE NAME", ''),
            coalesce(rs."LAST NAME", '')
          ), '\\s+', ' ', 'g')))
  ) AS candidate_count,
  'Could not resolve unique lessee owner match'
FROM rsbsa_farm_parcels fp
WHERE fp.ownership_type_lessee = TRUE
  AND fp.lessee_land_owner_id IS NULL
  AND coalesce(trim(fp.lessee_land_owner_name), '') <> '';

COMMIT;

-- Optional post-run checks:
-- SELECT COUNT(*) AS tenant_unlinked
-- FROM rsbsa_farm_parcels
-- WHERE ownership_type_tenant = TRUE
--   AND coalesce(trim(tenant_land_owner_name), '') <> ''
--   AND tenant_land_owner_id IS NULL;
--
-- SELECT COUNT(*) AS lessee_unlinked
-- FROM rsbsa_farm_parcels
-- WHERE ownership_type_lessee = TRUE
--   AND coalesce(trim(lessee_land_owner_name), '') <> ''
--   AND lessee_land_owner_id IS NULL;
--
-- SELECT * FROM owner_link_backfill_audit ORDER BY created_at DESC LIMIT 100;
