-- Supabase RPC: update_tenant_lessee_landowner_affiliation_no_review
-- Run this in Supabase SQL Editor.
--
-- Purpose:
-- - Keep the same tenant/lessee holder.
-- - Update only the linked landowner for selected parcel(s).
-- - Record history and audit trail with required proof documents.

DROP FUNCTION IF EXISTS public.update_tenant_lessee_landowner_affiliation_no_review(
  text,
  bigint,
  bigint,
  bigint,
  bigint[],
  text,
  date,
  jsonb
);

DROP FUNCTION IF EXISTS public.update_tenant_lessee_landowner_affiliation_no_review(
  text,
  bigint,
  bigint,
  bigint,
  bigint[],
  text,
  date,
  jsonb,
  jsonb
);

CREATE OR REPLACE FUNCTION public.update_tenant_lessee_landowner_affiliation_no_review(
  p_role text,
  p_holder_farmer_id bigint,
  p_old_owner_id bigint,
  p_new_owner_id bigint,
  p_farm_parcel_ids bigint[] DEFAULT null,
  p_reason text DEFAULT null,
  p_effective_date date DEFAULT current_date,
  p_proofs jsonb DEFAULT '[]'::jsonb,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := lower(trim(coalesce(p_role, '')));
  v_now date := coalesce(p_effective_date, current_date);
  v_reason text := coalesce(
    nullif(trim(p_reason), ''),
    CASE
      WHEN lower(trim(coalesce(p_role, ''))) = 'tenant' THEN 'Tenant landowner update'
      ELSE 'Lessee landowner update'
    END
  );
  v_change_type text := 'OWNER_AFFILIATION_CHANGE';

  v_holder_name text;
  v_holder_ffrs text;
  v_old_owner_name text;
  v_old_owner_ffrs text;
  v_new_owner_name text;
  v_new_owner_ffrs text;

  v_selected_count integer := 0;
  v_closed_count integer := 0;
  v_inserted_count integer := 0;
  v_parcel_update_count integer := 0;
  v_requested_count integer := 0;
  v_full_count integer := 0;
  v_partial_count integer := 0;
  v_proof_count integer := 0;
  v_transfer_id bigint;
  v_rows_affected integer := 0;
  v_next_parcel_no integer := 0;
  v_new_parcel_id bigint;

  v_row record;
BEGIN
  IF v_role NOT IN ('tenant', 'lessee') THEN
    RAISE EXCEPTION 'p_role must be tenant or lessee.';
  END IF;

  IF p_holder_farmer_id IS NULL OR p_holder_farmer_id <= 0 THEN
    RAISE EXCEPTION 'Valid holder farmer ID is required.';
  END IF;

  IF p_old_owner_id IS NULL OR p_old_owner_id <= 0 THEN
    RAISE EXCEPTION 'Valid current linked owner ID is required.';
  END IF;

  IF p_new_owner_id IS NULL OR p_new_owner_id <= 0 THEN
    RAISE EXCEPTION 'Valid new linked owner ID is required.';
  END IF;

  IF p_old_owner_id = p_new_owner_id THEN
    RAISE EXCEPTION 'Current and new linked owner must be different.';
  END IF;

  IF (p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0)
     AND (p_farm_parcel_ids IS NULL OR coalesce(array_length(p_farm_parcel_ids, 1), 0) = 0)
  THEN
    RAISE EXCEPTION 'Select at least one parcel item or farm parcel ID.';
  END IF;

  IF p_proofs IS NULL OR jsonb_typeof(p_proofs) <> 'array' OR jsonb_array_length(p_proofs) = 0 THEN
    RAISE EXCEPTION 'Supporting proof document is required. Provide at least one p_proofs entry.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_proofs) proof
    WHERE coalesce(nullif(trim(proof->>'storage_bucket'), ''), '') = ''
       OR coalesce(nullif(trim(proof->>'storage_path'), ''), '') = ''
       OR coalesce(nullif(trim(proof->>'file_name'), ''), '') = ''
  ) THEN
    RAISE EXCEPTION 'Each proof must include storage_bucket, storage_path, and file_name.';
  END IF;

  SELECT count(*) INTO v_proof_count FROM jsonb_array_elements(p_proofs);

  IF NOT EXISTS (SELECT 1 FROM rsbsa_submission WHERE id = p_holder_farmer_id) THEN
    RAISE EXCEPTION 'Holder farmer % not found.', p_holder_farmer_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rsbsa_submission WHERE id = p_old_owner_id) THEN
    RAISE EXCEPTION 'Current linked owner % not found.', p_old_owner_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rsbsa_submission WHERE id = p_new_owner_id) THEN
    RAISE EXCEPTION 'New linked owner % not found.', p_new_owner_id;
  END IF;

  SELECT
    concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME", nullif("EXT NAME", '')),
    "FFRS_CODE"
  INTO v_holder_name, v_holder_ffrs
  FROM rsbsa_submission
  WHERE id = p_holder_farmer_id;

  SELECT
    concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME", nullif("EXT NAME", '')),
    "FFRS_CODE"
  INTO v_old_owner_name, v_old_owner_ffrs
  FROM rsbsa_submission
  WHERE id = p_old_owner_id;

  SELECT
    concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME", nullif("EXT NAME", '')),
    "FFRS_CODE"
  INTO v_new_owner_name, v_new_owner_ffrs
  FROM rsbsa_submission
  WHERE id = p_new_owner_id;

  -- Keep temp tables for the session to avoid cached-plan failures from
  -- ON COMMIT DROP in repeated RPC calls.
  CREATE TEMP TABLE IF NOT EXISTS tmp_owner_affiliation_items (
    farm_parcel_id bigint PRIMARY KEY
    ,takeover_mode text NOT NULL
    ,transfer_area_ha numeric(12,4)
  );

  TRUNCATE TABLE tmp_owner_affiliation_items;

  IF p_items IS NOT NULL
     AND jsonb_typeof(p_items) = 'array'
     AND jsonb_array_length(p_items) > 0
  THEN
    INSERT INTO tmp_owner_affiliation_items (
      farm_parcel_id,
      takeover_mode,
      transfer_area_ha
    )
    SELECT DISTINCT
      CASE
        WHEN coalesce(item->>'farm_parcel_id', '') ~ '^[0-9]+$' THEN (item->>'farm_parcel_id')::bigint
        ELSE NULL
      END AS farm_parcel_id,
      CASE
        WHEN lower(coalesce(item->>'takeover_mode', '')) IN ('specific', 'partial', 'specific_slot') THEN 'specific'
        ELSE 'full'
      END AS takeover_mode,
      CASE
        WHEN lower(coalesce(item->>'takeover_mode', '')) IN ('specific', 'partial', 'specific_slot')
             AND coalesce(trim(item->>'transfer_area_ha'), '') ~ '^[0-9]+(\.[0-9]+)?$'
        THEN round((item->>'transfer_area_ha')::numeric, 4)
        ELSE NULL
      END AS transfer_area_ha
    FROM jsonb_array_elements(p_items) item
    WHERE
      CASE
        WHEN coalesce(item->>'farm_parcel_id', '') ~ '^[0-9]+$' THEN (item->>'farm_parcel_id')::bigint
        ELSE NULL
      END IS NOT NULL
      AND
      CASE
        WHEN coalesce(item->>'farm_parcel_id', '') ~ '^[0-9]+$' THEN (item->>'farm_parcel_id')::bigint
        ELSE NULL
      END > 0;
  ELSE
    INSERT INTO tmp_owner_affiliation_items (
      farm_parcel_id,
      takeover_mode,
      transfer_area_ha
    )
    SELECT DISTINCT parcel_id, 'full', NULL
    FROM unnest(p_farm_parcel_ids) AS parcel_id
    WHERE parcel_id IS NOT NULL AND parcel_id > 0;
  END IF;

  SELECT count(*) INTO v_requested_count FROM tmp_owner_affiliation_items;

  IF v_requested_count = 0 THEN
    RAISE EXCEPTION 'No valid parcel items were provided.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_owner_affiliation_items
    WHERE takeover_mode = 'specific'
      AND (transfer_area_ha IS NULL OR transfer_area_ha <= 0)
  ) THEN
    RAISE EXCEPTION 'Specific/partial mode requires transfer_area_ha > 0 for each selected parcel.';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS tmp_owner_affiliation_rows (
    history_id bigint,
    land_parcel_id bigint,
    farm_parcel_id bigint,
    farmer_id bigint,
    farmer_name text,
    farmer_ffrs_code text,
    parcel_number text,
    farm_location_barangay text,
    farm_location_municipality text,
    total_farm_area_ha numeric(12,4),
    transferred_area_ha numeric(12,4),
    is_registered_owner boolean,
    is_tenant boolean,
    is_lessee boolean,
    ownership_document_no text,
    agrarian_reform_beneficiary boolean,
    within_ancestral_domain boolean,
    land_owner_id bigint,
    land_owner_name text,
    land_owner_ffrs_code text,
    rsbsa_submission_id bigint,
    takeover_mode text,
    transfer_area_ha numeric(12,4),
    remaining_area_ha numeric(12,4)
  );

  TRUNCATE TABLE tmp_owner_affiliation_rows;

  INSERT INTO tmp_owner_affiliation_rows (
    history_id,
    land_parcel_id,
    farm_parcel_id,
    farmer_id,
    farmer_name,
    farmer_ffrs_code,
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    transferred_area_ha,
    is_registered_owner,
    is_tenant,
    is_lessee,
    ownership_document_no,
    agrarian_reform_beneficiary,
    within_ancestral_domain,
    land_owner_id,
    land_owner_name,
    land_owner_ffrs_code,
    rsbsa_submission_id,
    takeover_mode,
    transfer_area_ha,
    remaining_area_ha
  )
  SELECT
    lh.id,
    lh.land_parcel_id,
    fp.id,
    p_holder_farmer_id,
    coalesce(lh.farmer_name, v_holder_name),
    coalesce(lh.farmer_ffrs_code, v_holder_ffrs),
    coalesce(
      nullif(trim(lh.parcel_number), ''),
      nullif(trim(fp.parcel_number), ''),
      concat('Parcel-', fp.id::text)
    ),
    coalesce(
      nullif(trim(lh.farm_location_barangay), ''),
      nullif(trim(fp.farm_location_barangay), '')
    ),
    coalesce(
      nullif(trim(lh.farm_location_municipality), ''),
      nullif(trim(fp.farm_location_municipality), '')
    ),
    round(coalesce(fp.total_farm_area_ha, lh.total_farm_area_ha, 0)::numeric, 4),
    round(coalesce(lh.transferred_area_ha, 0)::numeric, 4),
    false,
    (v_role = 'tenant'),
    (v_role = 'lessee'),
    coalesce(lh.ownership_document_no, fp.ownership_document_no),
    coalesce(
      lh.agrarian_reform_beneficiary,
      CASE
        WHEN nullif(trim(coalesce(fp.agrarian_reform_beneficiary::text, '')), '') IS NULL THEN false
        WHEN lower(trim(fp.agrarian_reform_beneficiary::text)) IN ('yes', 'true', '1', 't') THEN true
        ELSE false
      END
    ),
    coalesce(
      lh.within_ancestral_domain,
      CASE
        WHEN nullif(trim(coalesce(fp.within_ancestral_domain::text, '')), '') IS NULL THEN false
        WHEN lower(trim(fp.within_ancestral_domain::text)) IN ('yes', 'true', '1', 't') THEN true
        ELSE false
      END
    ),
    p_old_owner_id,
    CASE
      WHEN v_role = 'tenant'
      THEN coalesce(nullif(trim(fp.tenant_land_owner_name), ''), lh.land_owner_name, v_old_owner_name)
      ELSE coalesce(nullif(trim(fp.lessee_land_owner_name), ''), lh.land_owner_name, v_old_owner_name)
    END,
    coalesce(lh.land_owner_ffrs_code, v_old_owner_ffrs),
    coalesce(lh.rsbsa_submission_id, fp.submission_id),
    i.takeover_mode,
    CASE
      WHEN i.takeover_mode = 'full' THEN round(coalesce(fp.total_farm_area_ha, lh.total_farm_area_ha, 0)::numeric, 4)
      ELSE round(coalesce(i.transfer_area_ha, 0)::numeric, 4)
    END,
    round(
      (
        coalesce(fp.total_farm_area_ha, lh.total_farm_area_ha, 0)::numeric -
        CASE
          WHEN i.takeover_mode = 'full' THEN coalesce(fp.total_farm_area_ha, lh.total_farm_area_ha, 0)::numeric
          ELSE coalesce(i.transfer_area_ha, 0)::numeric
        END
      ),
      4
    )
  FROM tmp_owner_affiliation_items i
  INNER JOIN rsbsa_farm_parcels fp
    ON fp.id = i.farm_parcel_id
  LEFT JOIN LATERAL (
    SELECT lh_sub.*
    FROM land_history lh_sub
    WHERE lh_sub.farm_parcel_id = fp.id
      AND lh_sub.is_current = true
      AND lh_sub.farmer_id = p_holder_farmer_id
      AND lh_sub.land_owner_id = p_old_owner_id
      AND (
        (v_role = 'tenant' AND lh_sub.is_tenant = true)
        OR
        (v_role = 'lessee' AND lh_sub.is_lessee = true)
      )
    ORDER BY lh_sub.period_start_date DESC NULLS LAST, lh_sub.id DESC
    LIMIT 1
  ) lh ON true
  WHERE fp.submission_id = p_holder_farmer_id
    AND (
      (v_role = 'tenant'
       AND coalesce(fp.ownership_type_tenant, false) = true
       AND (
         coalesce(fp.tenant_land_owner_id, 0) = p_old_owner_id
         OR (
           fp.tenant_land_owner_id IS NULL
           AND nullif(trim(coalesce(v_old_owner_name, '')), '') IS NOT NULL
           AND lower(trim(coalesce(fp.tenant_land_owner_name, ''))) = lower(trim(v_old_owner_name))
         )
         OR lh.id IS NOT NULL
       ))
      OR
      (v_role = 'lessee'
       AND coalesce(fp.ownership_type_lessee, false) = true
       AND (
         coalesce(fp.lessee_land_owner_id, 0) = p_old_owner_id
         OR (
           fp.lessee_land_owner_id IS NULL
           AND nullif(trim(coalesce(v_old_owner_name, '')), '') IS NOT NULL
           AND lower(trim(coalesce(fp.lessee_land_owner_name, ''))) = lower(trim(v_old_owner_name))
         )
         OR lh.id IS NOT NULL
       ))
    );

  SELECT count(*) INTO v_selected_count FROM tmp_owner_affiliation_rows;

  IF v_selected_count = 0 THEN
    RAISE EXCEPTION 'No active % assignments found for holder % under linked owner %.',
      v_role,
      p_holder_farmer_id,
      p_old_owner_id;
  END IF;

  IF v_selected_count <> v_requested_count THEN
    RAISE EXCEPTION 'One or more selected parcels are invalid for this holder/owner context.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_owner_affiliation_rows
    WHERE transfer_area_ha <= 0
  ) THEN
    RAISE EXCEPTION 'Transfer area must be greater than 0 for all selected parcel items.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_owner_affiliation_rows
    WHERE transfer_area_ha > total_farm_area_ha + 0.0001
  ) THEN
    RAISE EXCEPTION 'One or more specific/partial areas exceed parcel area.';
  END IF;

  FOR v_row IN
    SELECT *
    FROM tmp_owner_affiliation_rows
    ORDER BY farm_parcel_id
  LOOP
    IF coalesce(v_row.remaining_area_ha, 0) <= 0.0001 THEN
      UPDATE land_history
      SET
        is_current = false,
        period_end_date = v_now,
        change_type = v_change_type,
        change_reason = v_reason,
        notes = format(
          '%s landowner link updated (full) from farmer %s to farmer %s for holder farmer %s (parcel %s)',
          initcap(v_role),
          p_old_owner_id,
          p_new_owner_id,
          p_holder_farmer_id,
          v_row.farm_parcel_id
        ),
        updated_at = now()
      WHERE id = v_row.history_id
        AND is_current = true;

      GET DIAGNOSTICS v_rows_affected = row_count;
      v_closed_count := v_closed_count + coalesce(v_rows_affected, 0);

      INSERT INTO land_history (
        land_parcel_id,
        farm_parcel_id,
        farmer_id,
        farmer_name,
        farmer_ffrs_code,
        parcel_number,
        farm_location_barangay,
        farm_location_municipality,
        total_farm_area_ha,
        transferred_area_ha,
        remaining_area_ha,
        is_registered_owner,
        is_tenant,
        is_lessee,
        land_owner_id,
        land_owner_name,
        land_owner_ffrs_code,
        is_current,
        period_start_date,
        period_end_date,
        change_type,
        change_reason,
        previous_history_id,
        rsbsa_submission_id,
        ownership_document_no,
        agrarian_reform_beneficiary,
        within_ancestral_domain,
        created_at,
        updated_at,
        notes
      )
      VALUES (
        v_row.land_parcel_id,
        v_row.farm_parcel_id,
        p_holder_farmer_id,
        coalesce(v_holder_name, v_row.farmer_name),
        coalesce(v_holder_ffrs, v_row.farmer_ffrs_code),
        v_row.parcel_number,
        v_row.farm_location_barangay,
        v_row.farm_location_municipality,
        v_row.total_farm_area_ha,
        v_row.total_farm_area_ha,
        0,
        v_row.is_registered_owner,
        v_row.is_tenant,
        v_row.is_lessee,
        p_new_owner_id,
        coalesce(v_new_owner_name, concat('Owner #', p_new_owner_id::text)),
        coalesce(v_new_owner_ffrs, v_row.land_owner_ffrs_code),
        true,
        v_now,
        null,
        v_change_type,
        v_reason,
        v_row.history_id,
        coalesce(v_row.rsbsa_submission_id, p_holder_farmer_id),
        v_row.ownership_document_no,
        v_row.agrarian_reform_beneficiary,
        v_row.within_ancestral_domain,
        now(),
        now(),
        format(
          '%s landowner link updated (full) from farmer %s to farmer %s for holder farmer %s (parcel %s)',
          initcap(v_role),
          p_old_owner_id,
          p_new_owner_id,
          p_holder_farmer_id,
          v_row.farm_parcel_id
        )
      );

      v_inserted_count := v_inserted_count + 1;
      v_full_count := v_full_count + 1;

      IF v_role = 'tenant' THEN
        UPDATE rsbsa_farm_parcels
        SET
          tenant_land_owner_id = p_new_owner_id,
          tenant_land_owner_name = coalesce(v_new_owner_name, concat('Owner #', p_new_owner_id::text)),
          updated_at = now()
        WHERE id = v_row.farm_parcel_id
          AND submission_id = p_holder_farmer_id
          AND coalesce(ownership_type_tenant, false) = true
          AND (
            coalesce(tenant_land_owner_id, 0) = p_old_owner_id
            OR (
              tenant_land_owner_id IS NULL
              AND nullif(trim(coalesce(v_old_owner_name, '')), '') IS NOT NULL
              AND lower(trim(coalesce(tenant_land_owner_name, ''))) = lower(trim(v_old_owner_name))
            )
          );
      ELSE
        UPDATE rsbsa_farm_parcels
        SET
          lessee_land_owner_id = p_new_owner_id,
          lessee_land_owner_name = coalesce(v_new_owner_name, concat('Owner #', p_new_owner_id::text)),
          updated_at = now()
        WHERE id = v_row.farm_parcel_id
          AND submission_id = p_holder_farmer_id
          AND coalesce(ownership_type_lessee, false) = true
          AND (
            coalesce(lessee_land_owner_id, 0) = p_old_owner_id
            OR (
              lessee_land_owner_id IS NULL
              AND nullif(trim(coalesce(v_old_owner_name, '')), '') IS NOT NULL
              AND lower(trim(coalesce(lessee_land_owner_name, ''))) = lower(trim(v_old_owner_name))
            )
          );
      END IF;

      GET DIAGNOSTICS v_rows_affected = row_count;
      IF coalesce(v_rows_affected, 0) = 0 THEN
        RAISE EXCEPTION 'Parcel % failed owner-link update due to stale owner context. Please refresh and retry.',
          v_row.farm_parcel_id;
      END IF;

      v_parcel_update_count := v_parcel_update_count + v_rows_affected;
    ELSE
      IF v_role = 'tenant' THEN
        UPDATE rsbsa_farm_parcels
        SET
          total_farm_area_ha = v_row.remaining_area_ha,
          tenant_land_owner_id = p_old_owner_id,
          tenant_land_owner_name = coalesce(v_old_owner_name, v_row.land_owner_name),
          updated_at = now()
        WHERE id = v_row.farm_parcel_id
          AND submission_id = p_holder_farmer_id
          AND coalesce(ownership_type_tenant, false) = true
          AND (
            coalesce(tenant_land_owner_id, 0) = p_old_owner_id
            OR (
              tenant_land_owner_id IS NULL
              AND nullif(trim(coalesce(v_old_owner_name, '')), '') IS NOT NULL
              AND lower(trim(coalesce(tenant_land_owner_name, ''))) = lower(trim(v_old_owner_name))
            )
          );
      ELSE
        UPDATE rsbsa_farm_parcels
        SET
          total_farm_area_ha = v_row.remaining_area_ha,
          lessee_land_owner_id = p_old_owner_id,
          lessee_land_owner_name = coalesce(v_old_owner_name, v_row.land_owner_name),
          updated_at = now()
        WHERE id = v_row.farm_parcel_id
          AND submission_id = p_holder_farmer_id
          AND coalesce(ownership_type_lessee, false) = true
          AND (
            coalesce(lessee_land_owner_id, 0) = p_old_owner_id
            OR (
              lessee_land_owner_id IS NULL
              AND nullif(trim(coalesce(v_old_owner_name, '')), '') IS NOT NULL
              AND lower(trim(coalesce(lessee_land_owner_name, ''))) = lower(trim(v_old_owner_name))
            )
          );
      END IF;

      GET DIAGNOSTICS v_rows_affected = row_count;
      IF coalesce(v_rows_affected, 0) = 0 THEN
        RAISE EXCEPTION 'Parcel % failed partial owner-link update due to stale owner context. Please refresh and retry.',
          v_row.farm_parcel_id;
      END IF;

      v_parcel_update_count := v_parcel_update_count + v_rows_affected;

      SELECT
        coalesce(
          max(
            CASE
              WHEN parcel_number ~ '^[0-9]+$' THEN parcel_number::int
              ELSE null
            END
          ),
          0
        ) + 1
      INTO v_next_parcel_no
      FROM rsbsa_farm_parcels
      WHERE submission_id = p_holder_farmer_id;

      INSERT INTO rsbsa_farm_parcels (
        submission_id,
        parcel_number,
        farm_location_barangay,
        farm_location_municipality,
        total_farm_area_ha,
        within_ancestral_domain,
        ownership_document_no,
        agrarian_reform_beneficiary,
        ownership_type_registered_owner,
        ownership_type_tenant,
        ownership_type_lessee,
        ownership_type_others,
        tenant_land_owner_name,
        lessee_land_owner_name,
        tenant_land_owner_id,
        lessee_land_owner_id,
        is_current_owner,
        created_at,
        updated_at
      )
      SELECT
        p_holder_farmer_id,
        v_next_parcel_no::text,
        fp.farm_location_barangay,
        fp.farm_location_municipality,
        v_row.transfer_area_ha,
        fp.within_ancestral_domain,
        fp.ownership_document_no,
        fp.agrarian_reform_beneficiary,
        false,
        CASE WHEN v_role = 'tenant' THEN true ELSE false END,
        CASE WHEN v_role = 'lessee' THEN true ELSE false END,
        false,
        CASE WHEN v_role = 'tenant' THEN coalesce(v_new_owner_name, concat('Owner #', p_new_owner_id::text)) ELSE null END,
        CASE WHEN v_role = 'lessee' THEN coalesce(v_new_owner_name, concat('Owner #', p_new_owner_id::text)) ELSE null END,
        CASE WHEN v_role = 'tenant' THEN p_new_owner_id ELSE null END,
        CASE WHEN v_role = 'lessee' THEN p_new_owner_id ELSE null END,
        false,
        now(),
        now()
      FROM rsbsa_farm_parcels fp
      WHERE fp.id = v_row.farm_parcel_id
      RETURNING id INTO v_new_parcel_id;

      v_parcel_update_count := v_parcel_update_count + 1;

      UPDATE land_history
      SET
        total_farm_area_ha = v_row.remaining_area_ha,
        transferred_area_ha = v_row.transfer_area_ha,
        remaining_area_ha = v_row.remaining_area_ha,
        change_type = v_change_type,
        change_reason = v_reason,
        notes = format(
          '%s landowner partial update from farmer %s to farmer %s for holder farmer %s (parcel %s, split area %s ha)',
          initcap(v_role),
          p_old_owner_id,
          p_new_owner_id,
          p_holder_farmer_id,
          v_row.farm_parcel_id,
          v_row.transfer_area_ha
        ),
        updated_at = now()
      WHERE id = v_row.history_id
        AND is_current = true;

      IF NOT FOUND THEN
        INSERT INTO land_history (
          land_parcel_id,
          farm_parcel_id,
          farmer_id,
          farmer_name,
          farmer_ffrs_code,
          parcel_number,
          farm_location_barangay,
          farm_location_municipality,
          total_farm_area_ha,
          transferred_area_ha,
          remaining_area_ha,
          is_registered_owner,
          is_tenant,
          is_lessee,
          land_owner_id,
          land_owner_name,
          land_owner_ffrs_code,
          is_current,
          period_start_date,
          period_end_date,
          change_type,
          change_reason,
          previous_history_id,
          rsbsa_submission_id,
          ownership_document_no,
          agrarian_reform_beneficiary,
          within_ancestral_domain,
          created_at,
          updated_at,
          notes
        )
        VALUES (
          v_row.land_parcel_id,
          v_row.farm_parcel_id,
          p_holder_farmer_id,
          coalesce(v_holder_name, v_row.farmer_name),
          coalesce(v_holder_ffrs, v_row.farmer_ffrs_code),
          v_row.parcel_number,
          v_row.farm_location_barangay,
          v_row.farm_location_municipality,
          v_row.remaining_area_ha,
          v_row.transfer_area_ha,
          v_row.remaining_area_ha,
          false,
          (v_role = 'tenant'),
          (v_role = 'lessee'),
          p_old_owner_id,
          coalesce(v_old_owner_name, v_row.land_owner_name),
          coalesce(v_old_owner_ffrs, v_row.land_owner_ffrs_code),
          true,
          v_now,
          null,
          v_change_type,
          v_reason,
          null,
          coalesce(v_row.rsbsa_submission_id, p_holder_farmer_id),
          v_row.ownership_document_no,
          v_row.agrarian_reform_beneficiary,
          v_row.within_ancestral_domain,
          now(),
          now(),
          format(
            '%s landowner partial update retained old owner farmer %s for holder farmer %s (parcel %s, remaining area %s ha)',
            initcap(v_role),
            p_old_owner_id,
            p_holder_farmer_id,
            v_row.farm_parcel_id,
            v_row.remaining_area_ha
          )
        );
      END IF;

      INSERT INTO land_history (
        land_parcel_id,
        farm_parcel_id,
        farmer_id,
        farmer_name,
        farmer_ffrs_code,
        parcel_number,
        farm_location_barangay,
        farm_location_municipality,
        total_farm_area_ha,
        transferred_area_ha,
        remaining_area_ha,
        is_registered_owner,
        is_tenant,
        is_lessee,
        land_owner_id,
        land_owner_name,
        land_owner_ffrs_code,
        is_current,
        period_start_date,
        period_end_date,
        change_type,
        change_reason,
        previous_history_id,
        rsbsa_submission_id,
        ownership_document_no,
        agrarian_reform_beneficiary,
        within_ancestral_domain,
        created_at,
        updated_at,
        notes
      )
      VALUES (
        v_row.land_parcel_id,
        v_new_parcel_id,
        p_holder_farmer_id,
        coalesce(v_holder_name, v_row.farmer_name),
        coalesce(v_holder_ffrs, v_row.farmer_ffrs_code),
        v_next_parcel_no::text,
        v_row.farm_location_barangay,
        v_row.farm_location_municipality,
        v_row.transfer_area_ha,
        v_row.transfer_area_ha,
        0,
        false,
        v_row.is_tenant,
        v_row.is_lessee,
        p_new_owner_id,
        coalesce(v_new_owner_name, concat('Owner #', p_new_owner_id::text)),
        coalesce(v_new_owner_ffrs, v_row.land_owner_ffrs_code),
        true,
        v_now,
        null,
        v_change_type,
        v_reason,
        v_row.history_id,
        coalesce(v_row.rsbsa_submission_id, p_holder_farmer_id),
        v_row.ownership_document_no,
        v_row.agrarian_reform_beneficiary,
        v_row.within_ancestral_domain,
        now(),
        now(),
        format(
          '%s landowner partial update from farmer %s to farmer %s for holder farmer %s (new parcel %s, area %s ha)',
          initcap(v_role),
          p_old_owner_id,
          p_new_owner_id,
          p_holder_farmer_id,
          v_new_parcel_id,
          v_row.transfer_area_ha
        )
      );

      v_inserted_count := v_inserted_count + 1;
      v_partial_count := v_partial_count + 1;
    END IF;
  END LOOP;

  INSERT INTO ownership_transfers (
    from_farmer_id,
    to_farmer_id,
    transfer_date,
    transfer_type,
    transfer_reason,
    documents,
    notes,
    created_at
  )
  VALUES (
    p_old_owner_id,
    p_new_owner_id,
    v_now,
    CASE
      WHEN v_role = 'tenant' THEN 'owner_affiliation_tenant'
      ELSE 'owner_affiliation_lessee'
    END,
    v_reason,
    coalesce(p_proofs, '[]'::jsonb),
    format(
      '%s landowner update for holder farmer %s: from farmer %s to farmer %s (%s parcel%s, %s full, %s partial)',
      initcap(v_role),
      p_holder_farmer_id,
      p_old_owner_id,
      p_new_owner_id,
      v_selected_count,
      CASE WHEN v_selected_count = 1 THEN '' ELSE 's' END,
      v_full_count,
      v_partial_count
    ),
    now()
  )
  RETURNING id INTO v_transfer_id;

  RETURN jsonb_build_object(
    'message', format(
      '%s landowner update complete for %s parcel%s.',
      initcap(v_role),
      v_selected_count,
      CASE WHEN v_selected_count = 1 THEN '' ELSE 's' END
    ),
    'role', v_role,
    'holderFarmerId', p_holder_farmer_id,
    'oldOwnerId', p_old_owner_id,
    'newOwnerId', p_new_owner_id,
    'selectedParcels', v_selected_count,
    'closedRows', v_closed_count,
    'affectedRows', v_inserted_count,
    'updatedParcels', v_parcel_update_count,
    'fullParcels', v_full_count,
    'partialParcels', v_partial_count,
    'proofCount', v_proof_count,
    'transferId', v_transfer_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_tenant_lessee_landowner_affiliation_no_review(
  text,
  bigint,
  bigint,
  bigint,
  bigint[],
  text,
  date,
  jsonb,
  jsonb
) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
