const { createPool } = require("../backend/config/db.cjs");

const sqlSyncFarmerNoParcelsStatus = `
CREATE OR REPLACE FUNCTION public.sync_farmer_no_parcels_status(p_farmer_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_has_land_history BOOLEAN := FALSE;
  v_has_owner_history BOOLEAN := FALSE;
  v_current_owner_farm_parcel_count INT := 0;
  v_current_owner_history_count INT := 0;
  v_current_owner_count INT := 0;
  v_current_association_count INT := 0;
  v_has_ever_owned BOOLEAN := FALSE;
BEGIN
  -- Detect whether land_history is available.
  SELECT to_regclass('public.land_history') IS NOT NULL
    INTO v_has_land_history;

  -- Current legal ownership links from parcel table (fallback source).
  SELECT COUNT(*)
    INTO v_current_owner_farm_parcel_count
    FROM public.rsbsa_farm_parcels fp
   WHERE fp.submission_id = p_farmer_id
     AND fp.ownership_type_registered_owner = TRUE
     AND (fp.is_current_owner IS NULL OR fp.is_current_owner = TRUE);

  -- Current legal ownership and association links from land_history.
  IF v_has_land_history THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.land_history lh
      WHERE lh.farmer_id = p_farmer_id
        AND lh.is_registered_owner = TRUE
    )
      INTO v_has_owner_history;

    SELECT COUNT(*)
      INTO v_current_owner_history_count
      FROM public.land_history lh
     WHERE lh.farmer_id = p_farmer_id
       AND lh.is_registered_owner = TRUE
       AND lh.is_current = TRUE;

    SELECT COUNT(*)
      INTO v_current_association_count
      FROM public.land_history lh
     WHERE lh.farmer_id = p_farmer_id
       AND lh.is_current = TRUE
       AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE);
  ELSE
    SELECT COUNT(*)
      INTO v_current_association_count
      FROM public.rsbsa_farm_parcels fp
     WHERE fp.submission_id = p_farmer_id
       AND (fp.ownership_type_tenant = TRUE OR fp.ownership_type_lessee = TRUE);
  END IF;

  IF v_has_land_history AND v_has_owner_history THEN
    v_current_owner_count := COALESCE(v_current_owner_history_count, 0);
  ELSE
    v_current_owner_count := COALESCE(v_current_owner_farm_parcel_count, 0);
  END IF;

  -- Evidence that the farmer has ever been a legal owner.
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.rsbsa_farm_parcels fp
      WHERE fp.submission_id = p_farmer_id
        AND fp.ownership_type_registered_owner = TRUE
    )
    OR (
      v_has_land_history
      AND v_has_owner_history
    )
  )
  INTO v_has_ever_owned;

  -- Updated Priority Logic:
  -- 1) Has current legal owner OR active association link => Active Farmer.
  -- 2) No current links but has ever owned => No Parcels (transferred out).
  -- 3) Otherwise => No Parcels (no active owner or association links).
  IF v_current_owner_count > 0 OR v_current_association_count > 0 THEN
    UPDATE public.rsbsa_submission
       SET status         = 'Active Farmer',
           archived_at    = NULL,
           archive_reason = NULL
     WHERE id = p_farmer_id
       AND (status IS DISTINCT FROM 'Active Farmer'
            OR archived_at IS NOT NULL
            OR archive_reason IS NOT NULL);

  ELSIF v_has_ever_owned THEN
    UPDATE public.rsbsa_submission
       SET status         = 'No Parcels',
           archived_at    = NOW(),
           archive_reason = 'All owned parcels transferred'
     WHERE id = p_farmer_id
       AND (status IS DISTINCT FROM 'No Parcels'
            OR archived_at IS NULL
            OR archive_reason IS DISTINCT FROM 'All owned parcels transferred');

  ELSE
    UPDATE public.rsbsa_submission
       SET status         = 'No Parcels',
           archived_at    = NOW(),
           archive_reason = 'No active owner or association links'
     WHERE id = p_farmer_id
       AND (status IS DISTINCT FROM 'No Parcels'
            OR archived_at IS NULL
            OR archive_reason IS DISTINCT FROM 'No active owner or association links');
  END IF;
END;
$function$;
`;

const sqlReplaceTenantLesseeHolder = `
CREATE OR REPLACE FUNCTION public.replace_tenant_lessee_holder_with_portions_no_review(
    p_role text,
    p_current_holder_id bigint,
    p_replacement_holder_id bigint,
    p_owner_context_id bigint,
    p_reason text DEFAULT NULL::text,
    p_effective_date date DEFAULT CURRENT_DATE,
    p_items jsonb DEFAULT '[]'::jsonb,
    p_proofs jsonb DEFAULT '[]'::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_owner_name         text;
    v_owner_ffrs         text;
    v_replacement_name   text;
    v_replacement_ffrs   text;
    v_item               jsonb;
    v_farm_parcel_id     bigint;
    v_new_parcel_id      bigint;
    v_parcel             record;
    v_assigned_count     int  := 0;
    v_skipped_count      int  := 0;
    v_notes_payload      text := NULL;
BEGIN
    -- 1. Validate inputs
    IF p_role NOT IN ('tenant', 'lessee') THEN
        RAISE EXCEPTION 'Invalid role "%". Accepted values: ''tenant'', ''lessee''.', p_role;
    END IF;

    IF p_current_holder_id = p_replacement_holder_id THEN
        RAISE EXCEPTION 'Current holder and replacement holder cannot be the same (ID: %).', p_current_holder_id;
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'p_items must contain at least one parcel entry.';
    END IF;

    -- 2. Resolve owner name + FFRS
    SELECT trim(concat_ws(' ', NULLIF(trim("FIRST NAME"), ''), NULLIF(trim("MIDDLE NAME"), ''), NULLIF(trim("LAST NAME"), ''))), "FFRS_CODE"
      INTO v_owner_name, v_owner_ffrs
      FROM rsbsa_submission
     WHERE id = p_current_holder_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Owner (id=%) not found in rsbsa_submission.', p_current_holder_id;
    END IF;

    -- 3. Resolve replacement holder name + FFRS
    SELECT trim(concat_ws(' ', NULLIF(trim("FIRST NAME"), ''), NULLIF(trim("MIDDLE NAME"), ''), NULLIF(trim("LAST NAME"), ''))), "FFRS_CODE"
      INTO v_replacement_name, v_replacement_ffrs
      FROM rsbsa_submission
     WHERE id = p_replacement_holder_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Replacement holder / % (id=%) not found in rsbsa_submission.', p_role, p_replacement_holder_id;
    END IF;

    -- Build proofs note payload if provided
    IF p_proofs IS NOT NULL AND jsonb_array_length(p_proofs) > 0 THEN
        v_notes_payload := jsonb_build_object('proofs', p_proofs)::text;
    END IF;

    -- 4. Process each parcel item
    FOR v_item IN SELECT jsonb_array_elements(p_items)
    LOOP
        BEGIN
            v_farm_parcel_id := (v_item->>'farm_parcel_id')::bigint;
        EXCEPTION WHEN OTHERS THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END;

        IF v_farm_parcel_id IS NULL OR v_farm_parcel_id <= 0 THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Verify eligibility: must be landowner's active registered owner parcel, not yet tenanted/leased
        SELECT *
          INTO v_parcel
          FROM rsbsa_farm_parcels
         WHERE id = v_farm_parcel_id
           AND submission_id = p_current_holder_id
           AND ownership_type_registered_owner = true
           AND ownership_type_tenant = false
           AND ownership_type_lessee = false
         FOR UPDATE;

        IF NOT FOUND THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Step A: Update landowner's parcel row to show it is cultivated by the tenant
        UPDATE rsbsa_farm_parcels
           SET is_cultivating = false,
               cultivator_submission_id = p_replacement_holder_id,
               cultivation_status_updated_at = CURRENT_TIMESTAMP,
               cultivation_status_reason = 'Cultivated by ' || p_role || ': ' || v_replacement_name,
               updated_at = CURRENT_TIMESTAMP
         WHERE id = v_farm_parcel_id;

        -- Step B: Insert a separate parcel copy for the tenant
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
            tenant_land_owner_id,
            tenant_land_owner_name,
            lessee_land_owner_id,
            lessee_land_owner_name,
            ownership_category,
            is_current_owner,
            is_cultivating,
            is_farming,
            parent_parcel_id,
            created_at,
            updated_at
        ) VALUES (
            p_replacement_holder_id,
            v_parcel.parcel_number,
            v_parcel.farm_location_barangay,
            v_parcel.farm_location_municipality,
            v_parcel.total_farm_area_ha,
            v_parcel.within_ancestral_domain,
            v_parcel.ownership_document_no,
            v_parcel.agrarian_reform_beneficiary,
            false,
            (p_role = 'tenant'),
            (p_role = 'lessee'),
            (CASE WHEN p_role = 'tenant' THEN p_current_holder_id ELSE NULL END),
            (CASE WHEN p_role = 'tenant' THEN v_owner_name ELSE NULL END),
            (CASE WHEN p_role = 'lessee' THEN p_current_holder_id ELSE NULL END),
            (CASE WHEN p_role = 'lessee' THEN v_owner_name ELSE NULL END),
            p_role,
            true,
            true, -- Jada is cultivating it
            true, -- Jada is farming it
            v_farm_parcel_id,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        RETURNING id INTO v_new_parcel_id;

        -- Step C: Manually create tenant's land_history record (since parent_parcel_id is set)
        INSERT INTO land_history (
            rsbsa_submission_id,
            farm_parcel_id,
            parcel_number,
            farm_location_barangay,
            farm_location_municipality,
            total_farm_area_ha,
            land_owner_id,
            land_owner_name,
            land_owner_ffrs_code,
            farmer_id,
            farmer_name,
            farmer_ffrs_code,
            tenant_name,
            tenant_ffrs_code,
            is_tenant,
            lessee_name,
            lessee_ffrs_code,
            is_lessee,
            is_registered_owner,
            is_other_ownership,
            ownership_document_no,
            agrarian_reform_beneficiary,
            within_ancestral_domain,
            change_type,
            change_reason,
            notes,
            is_current,
            period_start_date
        ) VALUES (
            p_replacement_holder_id,
            v_new_parcel_id,
            v_parcel.parcel_number,
            v_parcel.farm_location_barangay,
            v_parcel.farm_location_municipality,
            v_parcel.total_farm_area_ha,
            p_current_holder_id,
            v_owner_name,
            v_owner_ffrs,
            p_replacement_holder_id,
            v_replacement_name,
            v_replacement_ffrs,
            (CASE WHEN p_role = 'tenant' THEN v_replacement_name ELSE NULL END),
            (CASE WHEN p_role = 'tenant' THEN v_replacement_ffrs ELSE NULL END),
            (p_role = 'tenant'),
            (CASE WHEN p_role = 'lessee' THEN v_replacement_name ELSE NULL END),
            (CASE WHEN p_role = 'lessee' THEN v_replacement_ffrs ELSE NULL END),
            (p_role = 'lessee'),
            false,
            false,
            v_parcel.ownership_document_no,
            (CASE WHEN v_parcel.agrarian_reform_beneficiary = 'Yes' THEN true ELSE false END),
            (CASE WHEN v_parcel.within_ancestral_domain = 'Yes' THEN true ELSE false END),
            (CASE WHEN p_role = 'tenant' THEN 'TENANT_CHANGE' ELSE 'LESSEE_CHANGE' END),
            COALESCE(p_reason, 'Tenant association under ' || v_owner_name),
            v_notes_payload,
            true,
            CURRENT_DATE
        );

        v_assigned_count := v_assigned_count + 1;
    END LOOP;

    -- Guard: at least one parcel must have been assigned
    IF v_assigned_count = 0 THEN
        RAISE EXCEPTION 'No valid % parcel assignments could be made under owner context %.', p_role, p_current_holder_id;
    END IF;

    -- Call status sync for both users to apply changes immediately
    PERFORM public.sync_farmer_no_parcels_status(p_current_holder_id);
    PERFORM public.sync_farmer_no_parcels_status(p_replacement_holder_id);

    RETURN jsonb_build_object(
        'success',              true,
        'selectedParcels',      v_assigned_count,
        'selected_parcels',     v_assigned_count,
        'skippedParcels',       v_skipped_count,
        'role',                 p_role,
        'ownerContextId',       p_current_holder_id,
        'ownerName',            v_owner_name,
        'replacementHolderId',  p_replacement_holder_id,
        'replacementHolderName', v_replacement_name,
        'message', format('%s parcel(s) assigned to %s as %s under owner %s.', v_assigned_count, v_replacement_name, p_role, v_owner_name)
    );
EXCEPTION
    WHEN OTHERS THEN RAISE;
END;
$function$;
`;

async function main() {
  const pool = createPool();
  try {
    console.log("Updating sync_farmer_no_parcels_status...");
    await pool.query(sqlSyncFarmerNoParcelsStatus);
    console.log("✅ sync_farmer_no_parcels_status updated!");

    console.log("Updating replace_tenant_lessee_holder_with_portions_no_review...");
    await pool.query(sqlReplaceTenantLesseeHolder);
    console.log("✅ replace_tenant_lessee_holder_with_portions_no_review updated!");

  } catch (err) {
    console.error("❌ SQL updates failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
