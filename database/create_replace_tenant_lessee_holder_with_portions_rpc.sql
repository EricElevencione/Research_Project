-- Supabase RPC: replace_tenant_lessee_holder_with_portions_no_review
-- Run this in Supabase SQL Editor.
--
-- Purpose:
-- - Replace an active tenant OR lessee holder with a new holder.
-- - Supports full takeover or specific area takeover per parcel.
-- - For partial takeovers, splits the parcel so current holder keeps the remainder.
--
-- Input p_items JSONB format (required):
-- [
--   {
--     "farm_parcel_id": 123,
--     "takeover_mode": "full" | "specific",
--     "transfer_area_ha": 0.75
--   }
-- ]
--
-- Input p_proofs JSONB format (required):
-- [
--   {
--     "storage_bucket": "ownership-transfer-proofs",
--     "storage_path": "...",
--     "file_name": "signed-agreement.pdf",
--     "mime_type": "application/pdf",
--     "file_size_bytes": 12345
--   }
-- ]
--
-- Notes:
-- - This updates assignment only (tenant/lessee), not legal ownership.
-- - Uses owner context id to scope the assignment replacement.

DROP FUNCTION IF EXISTS public.replace_tenant_lessee_holder_with_portions_no_review(
  text,
  bigint,
  bigint,
  bigint,
  text,
  date,
  jsonb,
  jsonb
);

DROP FUNCTION IF EXISTS public.replace_tenant_lessee_holder_with_portions_no_review(
  text,
  bigint,
  bigint,
  bigint,
  text,
  date,
  jsonb
);

CREATE OR REPLACE FUNCTION public.replace_tenant_lessee_holder_with_portions_no_review(
  p_role text,
  p_current_holder_id bigint,
  p_replacement_holder_id bigint,
  p_owner_context_id bigint,
  p_reason text DEFAULT null,
  p_effective_date date DEFAULT current_date,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_proofs jsonb DEFAULT '[]'::jsonb
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
    case
      when lower(trim(coalesce(p_role, ''))) = 'tenant' then 'Tenant replacement'
      else 'Lessee replacement'
    end
  );

  v_current_name text;
  v_replacement_name text;
  v_current_ffrs text;
  v_replacement_ffrs text;

  v_role_change_type text;
  v_tenant_flag boolean;
  v_lessee_flag boolean;

  v_closed_count integer := 0;
  v_inserted_count integer := 0;
  v_parcel_update_count integer := 0;
  v_selected_count integer := 0;
  v_requested_count integer := 0;
  v_full_count integer := 0;
  v_partial_count integer := 0;
  v_proof_count integer := 0;
  v_owner_context_extra_count integer := 0;
  v_transfer_id bigint;

  v_rows_affected integer := 0;
  v_new_parcel_id bigint;
  v_next_parcel_no integer;

  v_row record;
BEGIN
  IF v_role NOT IN ('tenant', 'lessee') THEN
    RAISE EXCEPTION 'p_role must be tenant or lessee';
  END IF;

  IF p_current_holder_id IS NULL OR p_replacement_holder_id IS NULL THEN
    RAISE EXCEPTION 'Current and replacement holder IDs are required.';
  END IF;

  IF p_owner_context_id IS NULL THEN
    RAISE EXCEPTION 'Owner context ID is required.';
  END IF;

  IF p_current_holder_id = p_replacement_holder_id THEN
    RAISE EXCEPTION 'Current and replacement holder must be different.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rsbsa_submission WHERE id = p_current_holder_id) THEN
    RAISE EXCEPTION 'Current holder % not found.', p_current_holder_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rsbsa_submission WHERE id = p_replacement_holder_id) THEN
    RAISE EXCEPTION 'Replacement holder % not found.', p_replacement_holder_id;
  END IF;

  SELECT
    concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME", nullif("EXT NAME", '')),
    "FFRS_CODE"
  INTO v_current_name, v_current_ffrs
  FROM rsbsa_submission
  WHERE id = p_current_holder_id;

  SELECT
    concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME", nullif("EXT NAME", '')),
    "FFRS_CODE"
  INTO v_replacement_name, v_replacement_ffrs
  FROM rsbsa_submission
  WHERE id = p_replacement_holder_id;

  v_role_change_type := CASE WHEN v_role = 'tenant' THEN 'TENANT_CHANGE' ELSE 'LESSEE_CHANGE' END;
  v_tenant_flag := (v_role = 'tenant');
  v_lessee_flag := (v_role = 'lessee');

  CREATE TEMP TABLE IF NOT EXISTS tmp_replacement_items (
    farm_parcel_id bigint PRIMARY KEY,
    takeover_mode text,
    transfer_area_ha numeric(12,4)
  ) ON COMMIT DROP;

  TRUNCATE TABLE tmp_replacement_items;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Parcel selection is required. Provide at least one p_items entry.';
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

  INSERT INTO tmp_replacement_items (farm_parcel_id, takeover_mode, transfer_area_ha)
  SELECT
    (item->>'farm_parcel_id')::bigint,
    CASE lower(trim(coalesce(item->>'takeover_mode', '')))
      WHEN 'full' THEN 'full'
      WHEN 'specific' THEN 'specific'
      ELSE NULL
    END,
    CASE
      WHEN coalesce(item->>'transfer_area_ha', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN round((item->>'transfer_area_ha')::numeric, 4)
      ELSE NULL
    END
  FROM jsonb_array_elements(p_items) item
  WHERE coalesce(item->>'farm_parcel_id', '') ~ '^[0-9]+$'
  ON CONFLICT (farm_parcel_id)
  DO UPDATE SET
    takeover_mode = excluded.takeover_mode,
    transfer_area_ha = excluded.transfer_area_ha;

  IF NOT EXISTS (SELECT 1 FROM tmp_replacement_items) THEN
    RAISE EXCEPTION 'No parcel portions were provided for replacement.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_replacement_items
    WHERE takeover_mode IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid takeover_mode in p_items. Allowed values: full, specific.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_replacement_items
    WHERE takeover_mode = 'specific'
      AND (transfer_area_ha IS NULL OR transfer_area_ha <= 0)
  ) THEN
    RAISE EXCEPTION 'Specific slot requires transfer_area_ha > 0 for every selected parcel.';
  END IF;

  SELECT count(*) INTO v_requested_count FROM tmp_replacement_items;

  CREATE TEMP TABLE IF NOT EXISTS tmp_role_rows_to_process (
    id bigint,
    source_farmer_id bigint,
    land_parcel_id bigint,
    farm_parcel_id bigint,
    parcel_number text,
    farm_location_barangay text,
    farm_location_municipality text,
    total_farm_area_ha numeric(12,4),
    land_owner_id bigint,
    land_owner_name text,
    land_owner_ffrs_code text,
    ownership_document_no text,
    agrarian_reform_beneficiary boolean,
    within_ancestral_domain boolean,
    takeover_mode text,
    transfer_area_ha numeric(12,4),
    remaining_area_ha numeric(12,4),
    from_current_holder boolean
  ) ON COMMIT DROP;

  TRUNCATE TABLE tmp_role_rows_to_process;

  INSERT INTO tmp_role_rows_to_process (
    id,
    source_farmer_id,
    land_parcel_id,
    farm_parcel_id,
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    land_owner_id,
    land_owner_name,
    land_owner_ffrs_code,
    ownership_document_no,
    agrarian_reform_beneficiary,
    within_ancestral_domain,
    takeover_mode,
    transfer_area_ha,
    remaining_area_ha,
    from_current_holder
  )
  SELECT
    lh.id,
    lh.farmer_id,
    lh.land_parcel_id,
    lh.farm_parcel_id,
    lh.parcel_number,
    lh.farm_location_barangay,
    lh.farm_location_municipality,
    round(coalesce(lh.total_farm_area_ha, 0)::numeric, 4),
    lh.land_owner_id,
    lh.land_owner_name,
    lh.land_owner_ffrs_code,
    lh.ownership_document_no,
    coalesce(lh.agrarian_reform_beneficiary, false),
    coalesce(lh.within_ancestral_domain, false),
    i.takeover_mode,
    CASE
      WHEN i.takeover_mode = 'full' THEN round(coalesce(lh.total_farm_area_ha, 0)::numeric, 4)
      ELSE round(coalesce(i.transfer_area_ha, 0)::numeric, 4)
    END,
    NULL,
    true
  FROM land_history lh
  INNER JOIN tmp_replacement_items i
    ON i.farm_parcel_id = lh.farm_parcel_id
  WHERE lh.is_current = true
    AND lh.farmer_id = p_current_holder_id
    AND lh.land_owner_id = p_owner_context_id
    AND (
      (v_role = 'tenant' AND lh.is_tenant = true)
      OR
      (v_role = 'lessee' AND lh.is_lessee = true)
    );

  INSERT INTO tmp_role_rows_to_process (
    id,
    source_farmer_id,
    land_parcel_id,
    farm_parcel_id,
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    land_owner_id,
    land_owner_name,
    land_owner_ffrs_code,
    ownership_document_no,
    agrarian_reform_beneficiary,
    within_ancestral_domain,
    takeover_mode,
    transfer_area_ha,
    remaining_area_ha,
    from_current_holder
  )
  SELECT
    lh.id,
    lh.farmer_id,
    lh.land_parcel_id,
    lh.farm_parcel_id,
    lh.parcel_number,
    lh.farm_location_barangay,
    lh.farm_location_municipality,
    round(coalesce(lh.total_farm_area_ha, 0)::numeric, 4),
    lh.land_owner_id,
    lh.land_owner_name,
    lh.land_owner_ffrs_code,
    lh.ownership_document_no,
    coalesce(lh.agrarian_reform_beneficiary, false),
    coalesce(lh.within_ancestral_domain, false),
    i.takeover_mode,
    CASE
      WHEN i.takeover_mode = 'full' THEN round(coalesce(lh.total_farm_area_ha, 0)::numeric, 4)
      ELSE round(coalesce(i.transfer_area_ha, 0)::numeric, 4)
    END,
    NULL,
    false
  FROM tmp_replacement_items i
  INNER JOIN LATERAL (
    SELECT lh.*
    FROM land_history lh
    WHERE lh.is_current = true
      AND lh.farm_parcel_id = i.farm_parcel_id
      AND lh.land_owner_id = p_owner_context_id
      AND NOT (
        (v_role = 'tenant' AND lh.is_tenant = true)
        OR
        (v_role = 'lessee' AND lh.is_lessee = true)
      )
    ORDER BY lh.period_start_date DESC NULLS LAST, lh.id DESC
    LIMIT 1
  ) lh ON true
  WHERE NOT EXISTS (
    SELECT 1
    FROM tmp_role_rows_to_process existing_row
    WHERE existing_row.farm_parcel_id = i.farm_parcel_id
  );

  IF NOT EXISTS (SELECT 1 FROM tmp_role_rows_to_process) THEN
    RAISE EXCEPTION 'No selected parcel portions could be processed under owner context %.',
      p_owner_context_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_role_rows_to_process
    WHERE from_current_holder = false
      AND takeover_mode = 'specific'
  ) THEN
    RAISE EXCEPTION 'Specific slot is only allowed for parcels currently assigned to the selected % holder. Use full parcel takeover for owner-context-only parcels.',
      v_role;
  END IF;

  IF (SELECT count(*) FROM tmp_role_rows_to_process) <> v_requested_count THEN
    RAISE EXCEPTION 'One or more selected parcels are outside owner context % or already have an active % assignment under that owner.',
      p_owner_context_id, v_role;
  END IF;

  FOR v_row IN SELECT * FROM tmp_role_rows_to_process LOOP
    IF coalesce(v_row.from_current_holder, false) = false THEN
      v_owner_context_extra_count := v_owner_context_extra_count + 1;
    END IF;

    IF coalesce(v_row.transfer_area_ha, 0) <= 0 THEN
      RAISE EXCEPTION 'Invalid transfer area for parcel %: transfer area must be > 0.',
        v_row.farm_parcel_id;
    END IF;

    IF v_row.transfer_area_ha > v_row.total_farm_area_ha + 0.0001 THEN
      RAISE EXCEPTION 'Transfer area % exceeds parcel area % for parcel %.',
        v_row.transfer_area_ha,
        v_row.total_farm_area_ha,
        v_row.farm_parcel_id;
    END IF;

    UPDATE tmp_role_rows_to_process
    SET
      transfer_area_ha = round(v_row.transfer_area_ha::numeric, 4),
      remaining_area_ha = round((v_row.total_farm_area_ha - v_row.transfer_area_ha)::numeric, 4)
    WHERE id = v_row.id;
  END LOOP;

  FOR v_row IN
    SELECT *
    FROM tmp_role_rows_to_process
    ORDER BY farm_parcel_id
  LOOP
    v_selected_count := v_selected_count + 1;

    IF coalesce(v_row.remaining_area_ha, 0) <= 0.0001 THEN
      UPDATE land_history lh
      SET
        is_current = false,
        period_end_date = v_now,
        updated_at = now(),
        transferred_area_ha = v_row.transfer_area_ha,
        remaining_area_ha = 0,
        change_type = v_role_change_type,
        change_reason = coalesce(nullif(lh.change_reason, ''), v_reason),
        notes = format(
          '%s replacement (full parcel) from farmer %s to %s under owner %s',
          initcap(v_role),
          coalesce(v_row.source_farmer_id, p_current_holder_id),
          p_replacement_holder_id,
          p_owner_context_id
        )
      WHERE lh.id = v_row.id
        AND lh.is_current = true;

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
        p_replacement_holder_id,
        v_replacement_name,
        v_replacement_ffrs,
        v_row.parcel_number,
        v_row.farm_location_barangay,
        v_row.farm_location_municipality,
        v_row.transfer_area_ha,
        v_row.transfer_area_ha,
        0,
        false,
        v_tenant_flag,
        v_lessee_flag,
        v_row.land_owner_id,
        v_row.land_owner_name,
        v_row.land_owner_ffrs_code,
        true,
        v_now,
        null,
        v_role_change_type,
        v_reason,
        v_row.id,
        p_replacement_holder_id,
        v_row.ownership_document_no,
        v_row.agrarian_reform_beneficiary,
        v_row.within_ancestral_domain,
        now(),
        now(),
        format(
          '%s replacement (full parcel) from farmer %s to %s under owner %s',
          initcap(v_role),
          coalesce(v_row.source_farmer_id, p_current_holder_id),
          p_replacement_holder_id,
          p_owner_context_id
        )
      );

      v_inserted_count := v_inserted_count + 1;
      v_full_count := v_full_count + 1;

      IF v_role = 'tenant' THEN
        UPDATE rsbsa_farm_parcels
        SET
          submission_id = p_replacement_holder_id,
          ownership_type_registered_owner = false,
          ownership_type_tenant = true,
          ownership_type_lessee = false,
          ownership_type_others = false,
          tenant_land_owner_id = coalesce(v_row.land_owner_id, p_owner_context_id),
          tenant_land_owner_name = coalesce(v_row.land_owner_name, ''),
          lessee_land_owner_id = null,
          lessee_land_owner_name = null,
          is_current_owner = false,
          total_farm_area_ha = v_row.transfer_area_ha,
          updated_at = now()
        WHERE id = v_row.farm_parcel_id;
      ELSE
        UPDATE rsbsa_farm_parcels
        SET
          submission_id = p_replacement_holder_id,
          ownership_type_registered_owner = false,
          ownership_type_tenant = false,
          ownership_type_lessee = true,
          ownership_type_others = false,
          lessee_land_owner_id = coalesce(v_row.land_owner_id, p_owner_context_id),
          lessee_land_owner_name = coalesce(v_row.land_owner_name, ''),
          tenant_land_owner_id = null,
          tenant_land_owner_name = null,
          is_current_owner = false,
          total_farm_area_ha = v_row.transfer_area_ha,
          updated_at = now()
        WHERE id = v_row.farm_parcel_id;
      END IF;

      v_parcel_update_count := v_parcel_update_count + 1;

    ELSE
      IF v_role = 'tenant' THEN
        UPDATE rsbsa_farm_parcels
        SET
          submission_id = coalesce(v_row.source_farmer_id, p_current_holder_id),
          ownership_type_registered_owner = false,
          ownership_type_tenant = true,
          ownership_type_lessee = false,
          ownership_type_others = false,
          tenant_land_owner_id = coalesce(v_row.land_owner_id, p_owner_context_id),
          tenant_land_owner_name = coalesce(v_row.land_owner_name, ''),
          lessee_land_owner_id = null,
          lessee_land_owner_name = null,
          is_current_owner = false,
          total_farm_area_ha = v_row.remaining_area_ha,
          updated_at = now()
        WHERE id = v_row.farm_parcel_id;
      ELSE
        UPDATE rsbsa_farm_parcels
        SET
          submission_id = coalesce(v_row.source_farmer_id, p_current_holder_id),
          ownership_type_registered_owner = false,
          ownership_type_tenant = false,
          ownership_type_lessee = true,
          ownership_type_others = false,
          lessee_land_owner_id = coalesce(v_row.land_owner_id, p_owner_context_id),
          lessee_land_owner_name = coalesce(v_row.land_owner_name, ''),
          tenant_land_owner_id = null,
          tenant_land_owner_name = null,
          is_current_owner = false,
          total_farm_area_ha = v_row.remaining_area_ha,
          updated_at = now()
        WHERE id = v_row.farm_parcel_id;
      END IF;

      v_parcel_update_count := v_parcel_update_count + 1;

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
      WHERE submission_id = p_replacement_holder_id;

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
        parent_parcel_id,
        split_origin_area_ha,
        created_at,
        updated_at
      )
      SELECT
        p_replacement_holder_id,
        v_next_parcel_no::text,
        fp.farm_location_barangay,
        fp.farm_location_municipality,
        v_row.transfer_area_ha,
        fp.within_ancestral_domain,
        fp.ownership_document_no,
        fp.agrarian_reform_beneficiary,
        false,
        v_tenant_flag,
        v_lessee_flag,
        false,
        CASE WHEN v_role = 'tenant' THEN coalesce(v_row.land_owner_name, '') ELSE null END,
        CASE WHEN v_role = 'lessee' THEN coalesce(v_row.land_owner_name, '') ELSE null END,
        CASE WHEN v_role = 'tenant' THEN coalesce(v_row.land_owner_id, p_owner_context_id) ELSE null END,
        CASE WHEN v_role = 'lessee' THEN coalesce(v_row.land_owner_id, p_owner_context_id) ELSE null END,
        false,
        v_row.farm_parcel_id,
        v_row.total_farm_area_ha,
        now(),
        now()
      FROM rsbsa_farm_parcels fp
      WHERE fp.id = v_row.farm_parcel_id
      RETURNING id INTO v_new_parcel_id;

      UPDATE land_history lh
      SET
        total_farm_area_ha = v_row.remaining_area_ha,
        transferred_area_ha = v_row.transfer_area_ha,
        remaining_area_ha = v_row.remaining_area_ha,
        change_type = v_role_change_type,
        change_reason = v_reason,
        notes = format(
          '%s replacement (partial %s ha) from farmer %s to %s under owner %s',
          initcap(v_role),
          v_row.transfer_area_ha,
          coalesce(v_row.source_farmer_id, p_current_holder_id),
          p_replacement_holder_id,
          p_owner_context_id
        ),
        updated_at = now()
      WHERE lh.id = v_row.id
        AND lh.is_current = true;

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
        p_replacement_holder_id,
        v_replacement_name,
        v_replacement_ffrs,
        v_next_parcel_no::text,
        v_row.farm_location_barangay,
        v_row.farm_location_municipality,
        v_row.transfer_area_ha,
        v_row.transfer_area_ha,
        v_row.remaining_area_ha,
        false,
        v_tenant_flag,
        v_lessee_flag,
        v_row.land_owner_id,
        v_row.land_owner_name,
        v_row.land_owner_ffrs_code,
        true,
        v_now,
        null,
        v_role_change_type,
        v_reason,
        v_row.id,
        p_replacement_holder_id,
        v_row.ownership_document_no,
        v_row.agrarian_reform_beneficiary,
        v_row.within_ancestral_domain,
        now(),
        now(),
        format(
          '%s replacement (partial %s ha) from farmer %s to %s under owner %s',
          initcap(v_role),
          v_row.transfer_area_ha,
          coalesce(v_row.source_farmer_id, p_current_holder_id),
          p_replacement_holder_id,
          p_owner_context_id
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
    p_current_holder_id,
    p_replacement_holder_id,
    v_now,
    CASE WHEN v_role = 'tenant' THEN 'tenant_replacement' ELSE 'lessee_replacement' END,
    v_reason,
    coalesce(p_proofs, '[]'::jsonb),
    format(
      '%s replacement with proof docs (%s selected parcel%s, owner context %s, %s owner-context extra parcel%s)',
      initcap(v_role),
      v_selected_count,
      CASE WHEN v_selected_count = 1 THEN '' ELSE 's' END,
      p_owner_context_id,
      v_owner_context_extra_count,
      CASE WHEN v_owner_context_extra_count = 1 THEN '' ELSE 's' END
    ),
    now()
  )
  RETURNING id INTO v_transfer_id;

  RETURN jsonb_build_object(
    'message', format(
      '%s replacement successful: %s -> %s (%s assignment%s, %s full, %s partial).',
      initcap(v_role),
      coalesce(v_current_name, concat('Farmer #', p_current_holder_id::text)),
      coalesce(v_replacement_name, concat('Farmer #', p_replacement_holder_id::text)),
      v_inserted_count,
      CASE WHEN v_inserted_count = 1 THEN '' ELSE 's' END,
      v_full_count,
      v_partial_count
    ),
    'role', v_role,
    'selectedParcels', v_selected_count,
    'closedRows', v_closed_count,
    'affectedRows', v_inserted_count,
    'updatedParcels', v_parcel_update_count,
    'fullCount', v_full_count,
    'partialCount', v_partial_count,
    'ownerContextExtraParcels', v_owner_context_extra_count,
    'proofCount', v_proof_count,
    'transferId', v_transfer_id,
    'ownerContextId', p_owner_context_id,
    'currentHolderId', p_current_holder_id,
    'replacementHolderId', p_replacement_holder_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_tenant_lessee_holder_with_portions_no_review(
  text,
  bigint,
  bigint,
  bigint,
  text,
  date,
  jsonb,
  jsonb
) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
