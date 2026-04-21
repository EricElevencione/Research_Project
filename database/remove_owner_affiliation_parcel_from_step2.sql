-- Cleanup script: remove selected holder parcel(s) from Update Tenant/Lessee Landowner Step 2.
--
-- What this does:
-- 1) Clears role-link fields in rsbsa_farm_parcels for target parcel(s).
-- 2) Clears matching current role flags in land_history for target parcel(s).
--
-- Use this when a parcel is still shown in Step 2 but should no longer be
-- treated as an active tenant/lessee owner-linked parcel for the holder.
--
-- Usage:
-- 1) Edit params CTE values.
-- 2) Run the preview SELECT sections first.
-- 3) If correct, uncomment and run the UPDATE block.
-- 4) Verify with post-check SELECT.
-- 5) Keep ROLLBACK while testing; switch to COMMIT only when satisfied.

BEGIN;

-- -----------------------------------------------------------------------------
-- Preview 1: targeted parcel in rsbsa_farm_parcels
-- -----------------------------------------------------------------------------
WITH params AS (
  SELECT
    'Bailey Mayer Norton'::text AS holder_name,
    'Aaron Castro Benitez'::text AS old_owner_name,
    'tenant'::text AS role,
    ARRAY[68]::bigint[] AS target_parcel_ids
),
holder AS (
  SELECT rs.id AS holder_id,
         trim(concat_ws(' ', rs."FIRST NAME", rs."MIDDLE NAME", rs."LAST NAME", nullif(rs."EXT NAME", ''))) AS holder_full_name
  FROM rsbsa_submission rs
  JOIN params p
    ON lower(trim(concat_ws(' ', rs."FIRST NAME", rs."MIDDLE NAME", rs."LAST NAME", nullif(rs."EXT NAME", '')))) = lower(trim(p.holder_name))
  LIMIT 1
),
owner_row AS (
  SELECT rs.id AS owner_id,
         trim(concat_ws(' ', rs."FIRST NAME", rs."MIDDLE NAME", rs."LAST NAME", nullif(rs."EXT NAME", ''))) AS owner_full_name
  FROM rsbsa_submission rs
  JOIN params p
    ON lower(trim(concat_ws(' ', rs."FIRST NAME", rs."MIDDLE NAME", rs."LAST NAME", nullif(rs."EXT NAME", '')))) = lower(trim(p.old_owner_name))
  LIMIT 1
)
SELECT
  fp.id AS farm_parcel_id,
  fp.submission_id,
  fp.parcel_number,
  fp.total_farm_area_ha,
  fp.ownership_type_registered_owner,
  fp.ownership_type_tenant,
  fp.ownership_type_lessee,
  fp.tenant_land_owner_id,
  fp.tenant_land_owner_name,
  fp.lessee_land_owner_id,
  fp.lessee_land_owner_name,
  h.holder_id,
  h.holder_full_name,
  o.owner_id,
  o.owner_full_name
FROM rsbsa_farm_parcels fp
CROSS JOIN holder h
CROSS JOIN owner_row o
JOIN params p ON true
WHERE fp.submission_id = h.holder_id
  AND fp.id = ANY (p.target_parcel_ids)
ORDER BY fp.id;

-- -----------------------------------------------------------------------------
-- Preview 2: matching current land_history rows for the same holder/role/context
-- -----------------------------------------------------------------------------
WITH params AS (
  SELECT
    'Bailey Mayer Norton'::text AS holder_name,
    'Aaron Castro Benitez'::text AS old_owner_name,
    'tenant'::text AS role,
    ARRAY[68]::bigint[] AS target_parcel_ids
),
holder AS (
  SELECT rs.id AS holder_id
  FROM rsbsa_submission rs
  JOIN params p
    ON lower(trim(concat_ws(' ', rs."FIRST NAME", rs."MIDDLE NAME", rs."LAST NAME", nullif(rs."EXT NAME", '')))) = lower(trim(p.holder_name))
  LIMIT 1
),
owner_row AS (
  SELECT rs.id AS owner_id
  FROM rsbsa_submission rs
  JOIN params p
    ON lower(trim(concat_ws(' ', rs."FIRST NAME", rs."MIDDLE NAME", rs."LAST NAME", nullif(rs."EXT NAME", '')))) = lower(trim(p.old_owner_name))
  LIMIT 1
)
SELECT
  lh.id AS land_history_id,
  lh.farm_parcel_id,
  lh.farmer_id,
  lh.parcel_number,
  lh.is_current,
  lh.is_tenant,
  lh.is_lessee,
  lh.land_owner_id,
  lh.land_owner_name,
  lh.period_start_date,
  lh.period_end_date,
  lh.updated_at
FROM land_history lh
JOIN holder h
  ON lh.farmer_id = h.holder_id
JOIN params p
  ON lh.farm_parcel_id = ANY (p.target_parcel_ids)
LEFT JOIN owner_row o
  ON true
WHERE lh.is_current = true
  AND (
    (p.role = 'tenant' AND coalesce(lh.is_tenant, false) = true)
    OR
    (p.role = 'lessee' AND coalesce(lh.is_lessee, false) = true)
  )
  AND (
    o.owner_id IS NULL
    OR coalesce(lh.land_owner_id, 0) = o.owner_id
    OR lower(trim(coalesce(lh.land_owner_name, ''))) = lower(trim((SELECT old_owner_name FROM params)))
  )
ORDER BY lh.farm_parcel_id, lh.id DESC;

-- -----------------------------------------------------------------------------
-- Uncomment this UPDATE block after preview validation.
-- -----------------------------------------------------------------------------

WITH params AS (
  SELECT
    'Bailey Mayer Norton'::text AS holder_name,
    'Aaron Castro Benitez'::text AS old_owner_name,
    'tenant'::text AS role,
    ARRAY[68]::bigint[] AS target_parcel_ids
),
holder AS (
  SELECT rs.id AS holder_id
  FROM rsbsa_submission rs
  JOIN params p
    ON lower(trim(concat_ws(' ', rs."FIRST NAME", rs."MIDDLE NAME", rs."LAST NAME", nullif(rs."EXT NAME", '')))) = lower(trim(p.holder_name))
  LIMIT 1
),
owner_row AS (
  SELECT rs.id AS owner_id
  FROM rsbsa_submission rs
  JOIN params p
    ON lower(trim(concat_ws(' ', rs."FIRST NAME", rs."MIDDLE NAME", rs."LAST NAME", nullif(rs."EXT NAME", '')))) = lower(trim(p.old_owner_name))
  LIMIT 1
),
updated_fp AS (
  UPDATE rsbsa_farm_parcels fp
  SET
    ownership_type_tenant = CASE WHEN (SELECT role FROM params) = 'tenant' THEN false ELSE fp.ownership_type_tenant END,
    ownership_type_lessee = CASE WHEN (SELECT role FROM params) = 'lessee' THEN false ELSE fp.ownership_type_lessee END,
    tenant_land_owner_id = CASE WHEN (SELECT role FROM params) = 'tenant' THEN null ELSE fp.tenant_land_owner_id END,
    tenant_land_owner_name = CASE WHEN (SELECT role FROM params) = 'tenant' THEN null ELSE fp.tenant_land_owner_name END,
    lessee_land_owner_id = CASE WHEN (SELECT role FROM params) = 'lessee' THEN null ELSE fp.lessee_land_owner_id END,
    lessee_land_owner_name = CASE WHEN (SELECT role FROM params) = 'lessee' THEN null ELSE fp.lessee_land_owner_name END,
    updated_at = now()
  FROM holder h, params p
  WHERE fp.submission_id = h.holder_id
    AND fp.id = ANY (p.target_parcel_ids)
  RETURNING
    fp.id,
    fp.parcel_number,
    fp.ownership_type_tenant,
    fp.ownership_type_lessee,
    fp.tenant_land_owner_id,
    fp.tenant_land_owner_name,
    fp.lessee_land_owner_id,
    fp.lessee_land_owner_name
),
updated_lh AS (
  UPDATE land_history lh
  SET
    is_tenant = CASE WHEN (SELECT role FROM params) = 'tenant' THEN false ELSE lh.is_tenant END,
    is_lessee = CASE WHEN (SELECT role FROM params) = 'lessee' THEN false ELSE lh.is_lessee END,
    land_owner_id = CASE
      WHEN (SELECT role FROM params) = 'tenant' AND coalesce(lh.is_lessee, false) = false AND coalesce(lh.is_registered_owner, false) = false THEN null
      WHEN (SELECT role FROM params) = 'lessee' AND coalesce(lh.is_tenant, false) = false AND coalesce(lh.is_registered_owner, false) = false THEN null
      ELSE lh.land_owner_id
    END,
    land_owner_name = CASE
      WHEN (SELECT role FROM params) = 'tenant' AND coalesce(lh.is_lessee, false) = false AND coalesce(lh.is_registered_owner, false) = false THEN null
      WHEN (SELECT role FROM params) = 'lessee' AND coalesce(lh.is_tenant, false) = false AND coalesce(lh.is_registered_owner, false) = false THEN null
      ELSE lh.land_owner_name
    END,
    notes = concat_ws(' | ', nullif(lh.notes, ''), 'manual cleanup: removed role-linked owner context for Step 2 exclusion'),
    updated_at = now()
  FROM holder h, params p
  LEFT JOIN owner_row o ON true
  WHERE lh.is_current = true
    AND lh.farmer_id = h.holder_id
    AND lh.farm_parcel_id = ANY (p.target_parcel_ids)
    AND (
      (p.role = 'tenant' AND coalesce(lh.is_tenant, false) = true)
      OR
      (p.role = 'lessee' AND coalesce(lh.is_lessee, false) = true)
    )
    AND (
      o.owner_id IS NULL
      OR coalesce(lh.land_owner_id, 0) = o.owner_id
      OR lower(trim(coalesce(lh.land_owner_name, ''))) = lower(trim((SELECT old_owner_name FROM params)))
    )
  RETURNING
    lh.id,
    lh.farm_parcel_id,
    lh.is_current,
    lh.is_tenant,
    lh.is_lessee,
    lh.land_owner_id,
    lh.land_owner_name
)
SELECT
  'updated_rsbsa_farm_parcels' AS section,
  to_jsonb(updated_fp) AS row_data
FROM updated_fp
UNION ALL
SELECT
  'updated_land_history' AS section,
  to_jsonb(updated_lh) AS row_data
FROM updated_lh;


-- -----------------------------------------------------------------------------
-- Post-check: should not match Step 2 role-linked conditions after update.
-- -----------------------------------------------------------------------------
WITH params AS (
  SELECT
    'Bailey Mayer Norton'::text AS holder_name,
    'Aaron Castro Benitez'::text AS old_owner_name,
    'tenant'::text AS role,
    ARRAY[68]::bigint[] AS target_parcel_ids
),
holder AS (
  SELECT rs.id AS holder_id
  FROM rsbsa_submission rs
  JOIN params p
    ON lower(trim(concat_ws(' ', rs."FIRST NAME", rs."MIDDLE NAME", rs."LAST NAME", nullif(rs."EXT NAME", '')))) = lower(trim(p.holder_name))
  LIMIT 1
),
owner_row AS (
  SELECT rs.id AS owner_id
  FROM rsbsa_submission rs
  JOIN params p
    ON lower(trim(concat_ws(' ', rs."FIRST NAME", rs."MIDDLE NAME", rs."LAST NAME", nullif(rs."EXT NAME", '')))) = lower(trim(p.old_owner_name))
  LIMIT 1
)
SELECT
  fp.id AS farm_parcel_id,
  fp.submission_id,
  fp.parcel_number,
  fp.ownership_type_tenant,
  fp.tenant_land_owner_id,
  fp.tenant_land_owner_name,
  fp.ownership_type_lessee,
  fp.lessee_land_owner_id,
  fp.lessee_land_owner_name,
  lh.id AS current_land_history_id,
  lh.is_tenant,
  lh.is_lessee,
  lh.land_owner_id,
  lh.land_owner_name
FROM rsbsa_farm_parcels fp
JOIN holder h
  ON fp.submission_id = h.holder_id
JOIN params p
  ON fp.id = ANY (p.target_parcel_ids)
LEFT JOIN LATERAL (
  SELECT lh_sub.*
  FROM land_history lh_sub
  LEFT JOIN owner_row o ON true
  WHERE lh_sub.is_current = true
    AND lh_sub.farmer_id = h.holder_id
    AND lh_sub.farm_parcel_id = fp.id
    AND (
      (p.role = 'tenant' AND coalesce(lh_sub.is_tenant, false) = true)
      OR
      (p.role = 'lessee' AND coalesce(lh_sub.is_lessee, false) = true)
    )
    AND (
      o.owner_id IS NULL
      OR coalesce(lh_sub.land_owner_id, 0) = o.owner_id
      OR lower(trim(coalesce(lh_sub.land_owner_name, ''))) = lower(trim((SELECT old_owner_name FROM params)))
    )
  ORDER BY lh_sub.id DESC
  LIMIT 1
) lh ON true
ORDER BY fp.id;

-- Keep ROLLBACK while validating.
ROLLBACK;
