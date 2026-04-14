-- ============================================================
-- register_farmer_with_parcels: Atomic RSBSA registration
-- Handles new registration AND ownership transfers in one transaction
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION register_farmer_with_parcels(
    p_data JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_submission_id BIGINT;
    v_submitted_at TIMESTAMPTZ;
    v_farmer_name TEXT;
    v_parcel JSONB;
    v_farm_parcel_id BIGINT;
    v_land_parcel_id BIGINT;
    v_parcel_number TEXT;
    v_previous_history_id BIGINT;
    v_prev_farmer_id BIGINT;
    v_prev_farmer_name TEXT;
    v_history_record RECORD;
    v_ownership_category TEXT;
    v_is_registered_owner BOOLEAN;
    v_is_tenant BOOLEAN;
    v_is_lessee BOOLEAN;
    v_is_ownership_transfer BOOLEAN;
    v_barangay TEXT;
    v_municipality TEXT;
    v_area DECIMAL;
    v_selected_land_owner JSONB;
    v_remaining_count INT;
    v_has_existing_parcel_ref BOOLEAN;
BEGIN
    -- CRITICAL: Disable the auto-insert trigger on rsbsa_farm_parcels
    -- This trigger (create_land_history_from_farm_parcel) auto-creates a land_history record
    -- on every farm parcel insert, but WE handle land_history ourselves with proper transfer logic.
    -- Without disabling, we get DUPLICATE land_history entries.
    ALTER TABLE rsbsa_farm_parcels DISABLE TRIGGER trigger_create_land_history_on_parcel_insert;

    -- Extract ownership category (supports legacy and new values).
    v_ownership_category := LOWER(COALESCE(p_data->>'ownershipCategory', 'registeredOwner'));

    IF v_ownership_category IN ('registeredowner', 'registered_owner', 'registered owner', 'owner') THEN
        v_is_registered_owner := TRUE;
        v_is_tenant := FALSE;
        v_is_lessee := FALSE;
    ELSIF v_ownership_category IN ('tenantlessee', 'tenant_lessee', 'tenant/lessee', 'tenant-lessee') THEN
        -- Canonical non-owner category during transition.
        v_is_registered_owner := FALSE;
        v_is_tenant := TRUE;
        v_is_lessee := FALSE;
    ELSIF v_ownership_category = 'tenant' THEN
        v_is_registered_owner := FALSE;
        v_is_tenant := TRUE;
        v_is_lessee := FALSE;
    ELSIF v_ownership_category = 'lessee' THEN
        v_is_registered_owner := FALSE;
        v_is_tenant := FALSE;
        v_is_lessee := TRUE;
    ELSE
        -- Default to owner for unknown category values.
        v_is_registered_owner := TRUE;
        v_is_tenant := FALSE;
        v_is_lessee := FALSE;
    END IF;

    v_is_ownership_transfer := v_is_registered_owner AND NOT v_is_tenant AND NOT v_is_lessee;
    v_selected_land_owner := p_data->'selectedLandOwner';

    -- Step 1: Insert rsbsa_submission
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME",
        "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY",
        "FARM LOCATION", "PARCEL AREA", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD",
        "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE",
        "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT",
        "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT",
        status
    ) VALUES (
        COALESCE(p_data->>'surname', p_data->>'lastName', ''),
        COALESCE(p_data->>'firstName', ''),
        COALESCE(p_data->>'middleName', ''),
        COALESCE(p_data->>'extensionName', p_data->>'extName', ''),
        COALESCE(p_data->>'gender', ''),
        CASE WHEN p_data->>'dateOfBirth' IS NOT NULL AND p_data->>'dateOfBirth' != '' 
             THEN (p_data->>'dateOfBirth')::DATE ELSE NULL END,
        COALESCE(p_data->>'barangay', ''),
        COALESCE(p_data->>'municipality', 'Dumangas'),
        COALESCE(p_data->'farmlandParcels'->0->>'farmLocationBarangay', p_data->>'barangay', ''),
        COALESCE((p_data->'farmlandParcels'->0->>'totalFarmAreaHa')::DECIMAL, 0),
        COALESCE((p_data->>'totalFarmArea')::DECIMAL, 0),
        COALESCE(p_data->>'mainLivelihood', ''),
        v_is_registered_owner,
        v_is_tenant,
        v_is_lessee,
        COALESCE((p_data->>'farmerRice')::BOOLEAN, FALSE),
        COALESCE((p_data->>'farmerCorn')::BOOLEAN, FALSE),
        COALESCE((p_data->>'farmerOtherCrops')::BOOLEAN, FALSE),
        COALESCE(p_data->>'farmerOtherCropsText', ''),
        COALESCE((p_data->>'farmerLivestock')::BOOLEAN, FALSE),
        COALESCE(p_data->>'farmerLivestockText', ''),
        COALESCE((p_data->>'farmerPoultry')::BOOLEAN, FALSE),
        COALESCE(p_data->>'farmerPoultryText', ''),
        'Submitted'
    )
    RETURNING id, submitted_at INTO v_submission_id, v_submitted_at;

    -- Build farmer full name
    v_farmer_name := TRIM(CONCAT_WS(' ',
        COALESCE(p_data->>'firstName', ''),
        COALESCE(p_data->>'middleName', ''),
        COALESCE(p_data->>'surname', p_data->>'lastName', '')
    ));

    RAISE NOTICE 'Created submission % for %', v_submission_id, v_farmer_name;

    -- Step 2: Process each parcel
    FOR v_parcel IN SELECT * FROM jsonb_array_elements(COALESCE(p_data->'farmlandParcels', '[]'::JSONB))
    LOOP
        v_barangay := COALESCE(v_parcel->>'farmLocationBarangay', '');
        v_municipality := COALESCE(v_parcel->>'farmLocationMunicipality', 'Dumangas');
        v_area := COALESCE((v_parcel->>'totalFarmAreaHa')::DECIMAL, 0);
        v_parcel_number := COALESCE(v_parcel->>'existingParcelNumber', '');
        v_previous_history_id := NULL;
        v_land_parcel_id := NULL;
        v_has_existing_parcel_ref := (v_parcel->>'existingParcelId') IS NOT NULL AND (v_parcel->>'existingParcelId') != '';

        -- Skip parcels with no location or area
        IF v_barangay = '' OR v_area = 0 THEN
            RAISE NOTICE 'Skipping parcel with empty barangay or zero area';
            CONTINUE;
        END IF;

        -- ========================================
        -- OWNERSHIP TRANSFER: existingParcelId set
        -- existingParcelId = rsbsa_farm_parcels.id
        -- ========================================
        IF v_has_existing_parcel_ref THEN
            RAISE NOTICE 'Processing ownership transfer for farm_parcel_id: %', v_parcel->>'existingParcelId';

            -- Find the current land_history record by farm_parcel_id
            SELECT lh.id, lh.land_parcel_id, lh.farmer_id, lh.farmer_name, lh.parcel_number
            INTO v_history_record
            FROM land_history lh
            WHERE lh.farm_parcel_id = (v_parcel->>'existingParcelId')::BIGINT
              AND lh.is_current = TRUE
            LIMIT 1;

            IF v_history_record.id IS NOT NULL THEN
                -- Found the current holder record
                v_land_parcel_id := v_history_record.land_parcel_id;
                v_parcel_number := COALESCE(v_history_record.parcel_number, v_parcel_number);
                v_previous_history_id := v_history_record.id;
                v_prev_farmer_id := v_history_record.farmer_id;
                v_prev_farmer_name := v_history_record.farmer_name;

                RAISE NOTICE 'Found current holder: % (history_id=%, land_parcel_id=%)', 
                    v_prev_farmer_name, v_previous_history_id, v_land_parcel_id;

                IF v_is_ownership_transfer THEN
                    -- Ownership transfers close prior current holder rows.
                    UPDATE land_history
                    SET is_current = FALSE,
                        period_end_date = CURRENT_DATE,
                        updated_at = NOW()
                    WHERE land_parcel_id = v_land_parcel_id
                      AND is_current = TRUE;

                    RAISE NOTICE 'Closed previous holder records for land_parcel_id: %', v_land_parcel_id;
                END IF;
            ELSE
                -- No land_history by farm_parcel_id, try by parcel_number
                RAISE NOTICE 'No land_history found by farm_parcel_id, trying parcel_number: %', v_parcel_number;
                
                IF v_parcel_number != '' THEN
                                        SELECT lh.id, lh.land_parcel_id, lh.farmer_id, lh.farmer_name
                                        INTO v_history_record
                                        FROM land_history lh
                                        WHERE lh.parcel_number = v_parcel_number
                                            AND lh.is_current = TRUE
                                        ORDER BY lh.is_registered_owner DESC, lh.created_at DESC
                                        LIMIT 1;

                    IF v_history_record.id IS NOT NULL THEN
                        v_land_parcel_id := v_history_record.land_parcel_id;
                        v_previous_history_id := v_history_record.id;
                        v_prev_farmer_id := v_history_record.farmer_id;
                        v_prev_farmer_name := v_history_record.farmer_name;

                        IF v_is_ownership_transfer THEN
                            UPDATE land_history
                            SET is_current = FALSE,
                                period_end_date = CURRENT_DATE,
                                updated_at = NOW()
                            WHERE land_parcel_id = v_land_parcel_id
                              AND is_current = TRUE;
                        END IF;
                    END IF;
                END IF;
            END IF;
        END IF;

        -- If no land_parcel found yet, create or find one
        IF v_land_parcel_id IS NULL THEN
            -- Generate unique parcel number if empty (using submission_id + parcel index)
            IF v_parcel_number = '' OR v_parcel_number IS NULL THEN
                v_parcel_number := 'Parcel-' || v_submission_id || '-' || 
                    COALESCE(v_parcel->>'parcelNo', '1');
            END IF;

            -- Upsert into land_parcels
            INSERT INTO land_parcels (
                parcel_number, farm_location_barangay, farm_location_municipality,
                total_farm_area_ha, is_active, created_at
            ) VALUES (
                v_parcel_number, v_barangay, v_municipality, v_area, TRUE, NOW()
            )
            ON CONFLICT (parcel_number) DO UPDATE SET updated_at = NOW()
            RETURNING id INTO v_land_parcel_id;

            RAISE NOTICE 'Created/found land_parcel: % (id=%)', v_parcel_number, v_land_parcel_id;
        END IF;

        -- Insert rsbsa_farm_parcels record
        INSERT INTO rsbsa_farm_parcels (
            submission_id, parcel_number, farm_location_barangay, farm_location_municipality,
            total_farm_area_ha, within_ancestral_domain, agrarian_reform_beneficiary,
            ownership_document_no, ownership_type_registered_owner, ownership_type_tenant,
            ownership_type_lessee, tenant_land_owner_name, lessee_land_owner_name,
            tenant_land_owner_id, lessee_land_owner_id, is_current_owner
        ) VALUES (
            v_submission_id, v_parcel_number, v_barangay, v_municipality,
            v_area,
            CASE WHEN COALESCE(v_parcel->>'withinAncestralDomain', 'No') IN ('Yes', 'true') THEN 'Yes' ELSE 'No' END,
            CASE WHEN COALESCE(v_parcel->>'agrarianReformBeneficiary', 'No') IN ('Yes', 'true') THEN 'Yes' ELSE 'No' END,
            COALESCE(v_parcel->>'ownershipDocumentNo', ''),
            v_is_registered_owner,
            v_is_tenant,
            v_is_lessee,
            CASE WHEN v_is_tenant AND v_selected_land_owner IS NOT NULL THEN v_selected_land_owner->>'name' ELSE '' END,
            CASE WHEN v_is_lessee AND v_selected_land_owner IS NOT NULL THEN v_selected_land_owner->>'name' ELSE '' END,
            CASE WHEN v_is_tenant AND v_selected_land_owner IS NOT NULL THEN (v_selected_land_owner->>'id')::BIGINT ELSE NULL END,
            CASE WHEN v_is_lessee AND v_selected_land_owner IS NOT NULL THEN (v_selected_land_owner->>'id')::BIGINT ELSE NULL END,
            v_is_registered_owner
        )
        RETURNING id INTO v_farm_parcel_id;

        RAISE NOTICE 'Created farm_parcel: % (id=%)', v_parcel_number, v_farm_parcel_id;

        -- Insert land_history record
        INSERT INTO land_history (
            land_parcel_id, farm_parcel_id, farmer_id, farmer_name,
            parcel_number, farm_location_barangay, farm_location_municipality,
            total_farm_area_ha, is_registered_owner, is_tenant, is_lessee,
            land_owner_id, land_owner_name,
            is_current, period_start_date, change_type, change_reason,
            previous_history_id, rsbsa_submission_id, created_at
        ) VALUES (
            v_land_parcel_id,
            v_farm_parcel_id,
            v_submission_id,
            v_farmer_name,
            v_parcel_number,
            v_barangay,
            v_municipality,
            v_area,
            v_is_registered_owner,
            v_is_tenant,
            v_is_lessee,
            -- land_owner_id: for registered owner = self, for tenant/lessee = selected land owner
            CASE 
                WHEN v_is_registered_owner THEN v_submission_id
                WHEN v_selected_land_owner IS NOT NULL THEN (v_selected_land_owner->>'id')::BIGINT
                ELSE NULL
            END,
            -- land_owner_name: for registered owner = self, for tenant/lessee = selected land owner
            CASE 
                WHEN v_is_registered_owner THEN v_farmer_name
                WHEN v_selected_land_owner IS NOT NULL THEN v_selected_land_owner->>'name'
                ELSE NULL
            END,
            TRUE,
            CURRENT_DATE,
            CASE
                WHEN v_is_registered_owner AND (v_previous_history_id IS NOT NULL OR v_has_existing_parcel_ref) THEN 'TRANSFER'
                WHEN v_is_registered_owner THEN 'NEW'
                WHEN v_is_tenant AND v_is_lessee THEN 'ASSOCIATION_CHANGE'
                WHEN v_is_tenant THEN 'TENANT_CHANGE'
                WHEN v_is_lessee THEN 'LESSEE_CHANGE'
                ELSE 'NEW'
            END,
            CASE 
                WHEN v_is_registered_owner AND (v_previous_history_id IS NOT NULL OR v_has_existing_parcel_ref) THEN
                    'Ownership transfer from ' || COALESCE(v_prev_farmer_name, 'unknown') || ' to ' || v_farmer_name
                WHEN v_is_registered_owner THEN 'Initial RSBSA registration'
                WHEN v_is_tenant AND v_is_lessee THEN
                    'Tenant/Lessee association under ' || COALESCE(v_selected_land_owner->>'name', COALESCE(v_prev_farmer_name, 'land owner'))
                WHEN v_is_tenant THEN
                    'Tenant association under ' || COALESCE(v_selected_land_owner->>'name', COALESCE(v_prev_farmer_name, 'land owner'))
                WHEN v_is_lessee THEN
                    'Lessee association under ' || COALESCE(v_selected_land_owner->>'name', COALESCE(v_prev_farmer_name, 'land owner'))
                ELSE
                    'Initial RSBSA registration'
            END,
            v_previous_history_id,
            v_submission_id,
            NOW()
        );

        RAISE NOTICE 'Created land_history for parcel % (transfer: %)', 
            v_parcel_number, v_previous_history_id IS NOT NULL;

        -- If this was a legal ownership transfer, update old owner's rsbsa_farm_parcels
        IF v_is_ownership_transfer AND v_prev_farmer_id IS NOT NULL THEN
            -- Mark old owner's matching parcel as not current
            UPDATE rsbsa_farm_parcels
            SET is_current_owner = FALSE
            WHERE submission_id = v_prev_farmer_id
              AND parcel_number = v_parcel_number;

            -- Check if old owner still has any current parcels
            SELECT COUNT(*) INTO v_remaining_count
            FROM rsbsa_farm_parcels
            WHERE submission_id = v_prev_farmer_id
              AND is_current_owner = TRUE;

            IF v_remaining_count = 0 THEN
                UPDATE rsbsa_submission
                SET status = 'Not Active'
                WHERE id = v_prev_farmer_id;
                RAISE NOTICE 'Marked previous owner % as Not Active', v_prev_farmer_id;
            END IF;
        END IF;
    END LOOP;

    -- Re-enable the trigger
    ALTER TABLE rsbsa_farm_parcels ENABLE TRIGGER trigger_create_land_history_on_parcel_insert;

    -- Return result
    RETURN jsonb_build_object(
        'submissionId', v_submission_id,
        'submittedAt', v_submitted_at,
        'farmerName', v_farmer_name,
        'message', 'Registration successful'
    );

EXCEPTION WHEN OTHERS THEN
    -- Always re-enable the trigger, even on error
    ALTER TABLE rsbsa_farm_parcels ENABLE TRIGGER trigger_create_land_history_on_parcel_insert;
    RAISE;
END;
$$;
