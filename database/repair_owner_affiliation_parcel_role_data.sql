-- Repair script: make selected holder parcels eligible for Update Tenant/Lessee Landowner Step 2.
--
-- Why this is needed:
-- Step 2 eligibility depends on holder parcel role fields in rsbsa_farm_parcels.
-- If ownership_type_tenant/ownership_type_lessee and linked owner fields are blank,
-- the parcel will not appear in the Step 2 picker.
--
-- Usage:
-- 1) Edit params CTE values.
-- 2) Run the preview SELECT first.
-- 3) If preview is correct, run the UPDATE section.
-- 4) Re-open the modal and test Step 2 again.

BEGIN;

WITH params AS (
  SELECT
    'Miguel Abay Ramos'::text AS holder_name,
    'Alexandra Stokes Ashley Alexi'::text AS old_owner_name,
    'tenant'::text AS role,
    ARRAY[19,20]::bigint[] AS target_parcel_ids
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

-- Uncomment and run this UPDATE after checking the preview above.
/*
WITH params AS (
  SELECT
    'Miguel Abay Ramos'::text AS holder_name,
    'Alexandra Stokes Ashley Alexi'::text AS old_owner_name,
    'tenant'::text AS role,
    ARRAY[19,20]::bigint[] AS target_parcel_ids
),
holder AS (
  SELECT rs.id AS holder_id
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
UPDATE rsbsa_farm_parcels fp
SET
  ownership_type_tenant = CASE WHEN (SELECT role FROM params) = 'tenant' THEN true ELSE fp.ownership_type_tenant END,
  ownership_type_lessee = CASE WHEN (SELECT role FROM params) = 'lessee' THEN true ELSE fp.ownership_type_lessee END,
  tenant_land_owner_id = CASE WHEN (SELECT role FROM params) = 'tenant' THEN (SELECT owner_id FROM owner_row) ELSE fp.tenant_land_owner_id END,
  tenant_land_owner_name = CASE WHEN (SELECT role FROM params) = 'tenant' THEN (SELECT owner_full_name FROM owner_row) ELSE fp.tenant_land_owner_name END,
  lessee_land_owner_id = CASE WHEN (SELECT role FROM params) = 'lessee' THEN (SELECT owner_id FROM owner_row) ELSE fp.lessee_land_owner_id END,
  lessee_land_owner_name = CASE WHEN (SELECT role FROM params) = 'lessee' THEN (SELECT owner_full_name FROM owner_row) ELSE fp.lessee_land_owner_name END,
  updated_at = now()
FROM holder h, params p
WHERE fp.submission_id = h.holder_id
  AND fp.id = ANY (p.target_parcel_ids)
RETURNING fp.id, fp.parcel_number, fp.ownership_type_tenant, fp.ownership_type_lessee, fp.tenant_land_owner_id, fp.lessee_land_owner_id;
*/

-- Use ROLLBACK while testing. Switch to COMMIT after successful verification.
ROLLBACK;
