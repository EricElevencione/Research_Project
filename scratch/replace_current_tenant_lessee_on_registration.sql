CREATE OR REPLACE FUNCTION public.replace_current_tenant_lessee_on_registration(p_role text, p_owner_farm_parcel_id bigint, p_old_holder_id bigint, p_new_holder_id bigint, p_reason text DEFAULT NULL::text, p_effective_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_owner_parcel          record;
    v_owner_id              bigint;
    v_owner_name            text;
    v_old_holder_name       text;
    v_new_holder_name       text;
    v_old_holder_parcel_id  bigint;
    v_notes_payload         text;
    v_history_tagged_count  int := 0;
BEGIN
    -- -------------------------------------------------------------------------
    -- 1. Input validation
    -- -------------------------------------------------------------------------
    IF p_role NOT IN ('tenant', 'lessee') THEN
        RAISE EXCEPTION
            'Invalid role "%". Accepted values: ''tenant'', ''lessee''.', p_role;
    END IF;
 
    IF p_owner_farm_parcel_id IS NULL OR p_owner_farm_parcel_id <= 0 THEN
        RAISE EXCEPTION 'Invalid owner_farm_parcel_id: %.', p_owner_farm_parcel_id;
    END IF;
 
    IF p_old_holder_id IS NULL OR p_old_holder_id <= 0 THEN
        RAISE EXCEPTION 'Invalid old_holder_id: %.', p_old_holder_id;
    END IF;
 
    IF p_new_holder_id IS NULL OR p_new_holder_id <= 0 THEN
        RAISE EXCEPTION 'Invalid new_holder_id: %.', p_new_holder_id;
    END IF;
 
    IF p_old_holder_id = p_new_holder_id THEN
        RAISE EXCEPTION
            'old_holder_id and new_holder_id are the same (%). Cannot replace someone with themselves.',
            p_old_holder_id;
    END IF;
 
    -- -------------------------------------------------------------------------
    -- 2. Lock + fetch the owner's parcel row
    -- -------------------------------------------------------------------------
    SELECT *
    INTO v_owner_parcel
    FROM rsbsa_farm_parcels
    WHERE id = p_owner_farm_parcel_id
      AND ownership_type_registered_owner = true
      AND (is_current_owner IS NULL OR is_current_owner = true)
    FOR UPDATE;
 
    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Owner parcel (farm_parcel_id=%) not found or is not an active registered-owner parcel.',
            p_owner_farm_parcel_id;
    END IF;
 
    v_owner_id := v_owner_parcel.submission_id;
 
    -- Confirmation guard: the parcel must actually be currently held by
    -- p_old_holder_id -- protects against a stale UI (someone already
    -- replaced this parcel between when the user loaded the page and
    -- when they submitted).
    IF v_owner_parcel.cultivator_submission_id IS DISTINCT FROM p_old_holder_id THEN
        RAISE EXCEPTION
            'Parcel (farm_parcel_id=%) current cultivator (%) does not match expected old_holder_id (%). Refresh and try again.',
            p_owner_farm_parcel_id, v_owner_parcel.cultivator_submission_id, p_old_holder_id;
    END IF;
 
    -- -------------------------------------------------------------------------
    -- 3. Resolve names (owner, old holder, new holder)
    -- -------------------------------------------------------------------------
    SELECT trim(concat_ws(' ',
        NULLIF(trim("FIRST NAME"),  ''),
        NULLIF(trim("MIDDLE NAME"), ''),
        NULLIF(trim("LAST NAME"),   '')
    ))
    INTO v_owner_name
    FROM rsbsa_submission
    WHERE id = v_owner_id;
 
    SELECT trim(concat_ws(' ',
        NULLIF(trim("FIRST NAME"),  ''),
        NULLIF(trim("MIDDLE NAME"), ''),
        NULLIF(trim("LAST NAME"),   '')
    ))
    INTO v_old_holder_name
    FROM rsbsa_submission
    WHERE id = p_old_holder_id;
 
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Old holder (id=%) not found in rsbsa_submission.', p_old_holder_id;
    END IF;
 
    SELECT trim(concat_ws(' ',
        NULLIF(trim("FIRST NAME"),  ''),
        NULLIF(trim("MIDDLE NAME"), ''),
        NULLIF(trim("LAST NAME"),   '')
    ))
    INTO v_new_holder_name
    FROM rsbsa_submission
    WHERE id = p_new_holder_id;
 
    IF NOT FOUND THEN
        RAISE EXCEPTION 'New holder (id=%) not found in rsbsa_submission.', p_new_holder_id;
    END IF;
 
    -- -------------------------------------------------------------------------
    -- 4. Find + lock the OLD holder's own parcel row for this exact parcel
    -- -------------------------------------------------------------------------
    SELECT id
    INTO v_old_holder_parcel_id
    FROM rsbsa_farm_parcels
    WHERE submission_id   = p_old_holder_id
      AND parcel_number   = v_owner_parcel.parcel_number
      AND (
            (p_role = 'tenant' AND ownership_type_tenant = true AND tenant_land_owner_id = v_owner_id)
            OR
            (p_role = 'lessee' AND ownership_type_lessee = true AND lessee_land_owner_id = v_owner_id)
          )
      AND (is_current_owner IS NULL OR is_current_owner = true)
    FOR UPDATE;
 
    IF v_old_holder_parcel_id IS NULL THEN
        RAISE EXCEPTION
            'No active % parcel record found for old holder (id=%) on parcel_number %. They may have already been replaced.',
            p_role, p_old_holder_id, v_owner_parcel.parcel_number;
    END IF;
 
    -- -------------------------------------------------------------------------
    -- 5. Deactivate the old holder's parcel row
    -- -------------------------------------------------------------------------
    UPDATE rsbsa_farm_parcels
    SET is_current_owner = false,
        updated_at       = CURRENT_TIMESTAMP
    WHERE id = v_old_holder_parcel_id;
 
    -- Close their current land_history period
    UPDATE land_history
    SET is_current      = false,
        period_end_date = p_effective_date,
        updated_at      = CURRENT_TIMESTAMP
    WHERE farm_parcel_id = v_old_holder_parcel_id
      AND is_current      = true;
 
    -- -------------------------------------------------------------------------
    -- 6. Point the owner's parcel at the new holder
    -- -------------------------------------------------------------------------
    UPDATE rsbsa_farm_parcels
    SET cultivator_submission_id      = p_new_holder_id,
        cultivation_status_updated_at = CURRENT_TIMESTAMP,
        cultivation_status_reason     = COALESCE(
            p_reason,
            format('Cultivated by %s: %s (replaced %s)', p_role, v_new_holder_name, v_old_holder_name)
        ),
        updated_at                    = CURRENT_TIMESTAMP
    WHERE id = p_owner_farm_parcel_id;
 
    -- -------------------------------------------------------------------------
    -- 7. Tag the new holder's own land_history row (already created by
    --    register_farmer_with_parcels in step 1 of the calling sequence)
    --    so this is distinguishable from a manual registry transfer.
    --    Non-fatal: enrichment failing must not roll back the replacement
    --    itself.
    -- -------------------------------------------------------------------------
    BEGIN
        v_notes_payload := jsonb_build_object(
            'source',               'tenant_replaced_via_registration',
            'replaced_holder_id',   p_old_holder_id,
            'replaced_holder_name', v_old_holder_name
        )::text;
 
        UPDATE land_history
        SET change_reason = COALESCE(p_reason, change_reason),
            notes          = v_notes_payload,
            updated_at     = CURRENT_TIMESTAMP
        WHERE farmer_id     = p_new_holder_id
          AND parcel_number = v_owner_parcel.parcel_number
          AND is_current     = true
          AND (
                (p_role = 'tenant' AND is_tenant = true AND land_owner_id = v_owner_id)
                OR
                (p_role = 'lessee' AND is_lessee = true AND land_owner_id = v_owner_id)
              );
 
        GET DIAGNOSTICS v_history_tagged_count = ROW_COUNT;
 
        IF v_history_tagged_count = 0 THEN
            RAISE WARNING
                'No current land_history row found to tag for new holder % on parcel %. Was register_farmer_with_parcels run first?',
                p_new_holder_id, v_owner_parcel.parcel_number;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING
            'land_history tagging skipped for new % holder % under owner %: %',
            p_role, p_new_holder_id, v_owner_id, SQLERRM;
    END;
 
    -- -------------------------------------------------------------------------
    -- 8. Return result
    -- -------------------------------------------------------------------------
    RETURN jsonb_build_object(
        'success',           true,
        'role',              p_role,
        'ownerFarmParcelId', p_owner_farm_parcel_id,
        'ownerId',           v_owner_id,
        'ownerName',         v_owner_name,
        'oldHolderId',       p_old_holder_id,
        'oldHolderName',     v_old_holder_name,
        'oldHolderParcelId', v_old_holder_parcel_id,
        'newHolderId',       p_new_holder_id,
        'newHolderName',     v_new_holder_name,
        'historyTagged',     v_history_tagged_count > 0,
        'message', format(
            '%s parcel %s reassigned: %s replaced by %s.',
            initcap(p_role), v_owner_parcel.parcel_number, v_old_holder_name, v_new_holder_name
        )
    );
 
EXCEPTION
    WHEN OTHERS THEN RAISE;
END;
$function$
