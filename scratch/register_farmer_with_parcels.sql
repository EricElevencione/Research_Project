CREATE OR REPLACE FUNCTION public.register_farmer_with_parcels(p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$DECLARE
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
    v_is_cultivating BOOLEAN;
    v_cultivation_status_updated_at TIMESTAMPTZ;
    v_cultivation_status_reason TEXT;
    v_cultivator_submission_id BIGINT;
    v_contract_end_date DATE;
    v_parcel_is_registered_owner BOOLEAN;
    v_parcel_is_tenant BOOLEAN;
    v_parcel_is_lessee BOOLEAN;
    v_parcel_tenant_land_owner_name TEXT;
    v_parcel_lessee_land_owner_name TEXT;
    v_parcel_tenant_land_owner_id BIGINT;
    v_parcel_lessee_land_owner_id BIGINT;
    v_self_land_owner_id BIGINT;
BEGIN
    ALTER TABLE rsbsa_farm_parcels DISABLE TRIGGER trigger_create_land_history_on_parcel_insert;

    v_ownership_category := LOWER(COALESCE(p_data->>'ownershipCategory', 'registeredOwner'));

    IF v_ownership_category IN ('registeredowner', 'registered_owner', 'registered owner', 'owner') THEN
        v_is_registered_owner := TRUE; v_is_tenant := FALSE; v_is_lessee := FALSE;
    ELSIF v_ownership_category IN ('tenantlessee', 'tenant_lessee', 'tenant/lessee', 'tenant-lessee') THEN
        v_is_registered_owner := FALSE; v_is_tenant := TRUE; v_is_lessee := FALSE;
    ELSIF v_ownership_category = 'tenant' THEN
        v_is_registered_owner := FALSE; v_is_tenant := TRUE; v_is_lessee := FALSE;
    ELSIF v_ownership_category = 'lessee' THEN
        v_is_registered_owner := FALSE; v_is_tenant := FALSE; v_is_lessee := TRUE;
    ELSE
        v_is_registered_owner := TRUE; v_is_tenant := FALSE; v_is_lessee := FALSE;
    END IF;

    v_is_ownership_transfer := v_is_registered_owner AND NOT v_is_tenant AND NOT v_is_lessee;
    v_selected_land_owner := p_data->'selectedLandOwner';
    v_self_land_owner_id := NULLIF(p_data->>'selectedSelfLandOwnerId', '')::BIGINT;

    IF v_self_land_owner_id IS NOT NULL THEN
        UPDATE rsbsa_submission
        SET
            "LAST NAME"   = COALESCE(p_data->>'surname', p_data->>'lastName', "LAST NAME"),
            "FIRST NAME"  = COALESCE(p_data->>'firstName', "FIRST NAME"),
            "MIDDLE NAME" = COALESCE(p_data->>'middleName', "MIDDLE NAME"),
            "EXT NAME"    = COALESCE(p_data->>'extensionName', p_data->>'extName', "EXT NAME"),
            "GENDER"      = COALESCE(p_data->>'gender', "GENDER"),
            "BIRTHDATE"   = CASE WHEN p_data->>'dateOfBirth' IS NOT NULL AND p_data->>'dateOfBirth' != ''
                                 THEN (p_data->>'dateOfBirth')::DATE ELSE "BIRTHDATE" END,
            "BARANGAY"    = COALESCE(p_data->>'barangay', "BARANGAY"),
            "MUNICIPALITY" = COALESCE(p_data->>'municipality', "MUNICIPALITY"),
            "FARM LOCATION" = COALESCE(p_data->'farmlandParcels'->0->>'farmLocationBarangay', p_data->>'barangay', "FARM LOCATION"),
            -- ↓ FIXED: drop ::DECIMAL cast so text coalesces against text column
            "PARCEL AREA"    = COALESCE(p_data->'farmlandParcels'->0->>'totalFarmAreaHa', "PARCEL AREA"),
            -- ↓ UNCHANGED: TOTAL FARM AREA is numeric, DECIMAL cast is correct
            "TOTAL FARM AREA" = COALESCE((p_data->>'totalFarmArea')::DECIMAL, "TOTAL FARM AREA"),
            "MAIN LIVELIHOOD" = COALESCE(p_data->>'mainLivelihood', "MAIN LIVELIHOOD"),
            "OWNERSHIP_TYPE_REGISTERED_OWNER" = "OWNERSHIP_TYPE_REGISTERED_OWNER" OR v_is_registered_owner,
            "OWNERSHIP_TYPE_TENANT"           = "OWNERSHIP_TYPE_TENANT" OR v_is_tenant,
            "OWNERSHIP_TYPE_LESSEE"           = "OWNERSHIP_TYPE_LESSEE" OR v_is_lessee,
            "FARMER_RICE"              = COALESCE((p_data->>'farmerRice')::BOOLEAN, FALSE),
            "FARMER_CORN"              = COALESCE((p_data->>'farmerCorn')::BOOLEAN, FALSE),
            "FARMER_OTHER_CROPS"       = COALESCE((p_data->>'farmerOtherCrops')::BOOLEAN, FALSE),
            "FARMER_OTHER_CROPS_TEXT"  = COALESCE(p_data->>'farmerOtherCropsText', ''),
            "FARMER_LIVESTOCK"         = COALESCE((p_data->>'farmerLivestock')::BOOLEAN, FALSE),
            "FARMER_LIVESTOCK_TEXT"    = COALESCE(p_data->>'farmerLivestockText', ''),
            "FARMER_POULTRY"           = COALESCE((p_data->>'farmerPoultry')::BOOLEAN, FALSE),
            "FARMER_POULTRY_TEXT"      = COALESCE(p_data->>'farmerPoultryText', ''),
            is_actively_farming = COALESCE((p_data->>'isActivelyFarming')::BOOLEAN, FALSE),
            status      = 'Active Farmer',
            archived_at = NULL,
            archive_reason = NULL,
            profile_picture = COALESCE(p_data->>'profilePicture', profile_picture),
            updated_at  = NOW()
        WHERE id = v_self_land_owner_id
        RETURNING id, submitted_at INTO v_submission_id, v_submitted_at;

        RAISE NOTICE 'Updated existing landowner submission %', v_submission_id;
    ELSE
        INSERT INTO rsbsa_submission (
            "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME",
            "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY",
            "FARM LOCATION", "PARCEL AREA", "TOTAL FARM AREA",
            "MAIN LIVELIHOOD",
            "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE",
            "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT",
            "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT",
            is_actively_farming, status, profile_picture
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
            COALESCE(p_data->'farmlandParcels'->0->>'totalFarmAreaHa', '0'),
            COALESCE((p_data->>'totalFarmArea')::DECIMAL, 0),
            COALESCE(p_data->>'mainLivelihood', ''),
            v_is_registered_owner, v_is_tenant, v_is_lessee,
            COALESCE((p_data->>'farmerRice')::BOOLEAN, FALSE),
            COALESCE((p_data->>'farmerCorn')::BOOLEAN, FALSE),
            COALESCE((p_data->>'farmerOtherCrops')::BOOLEAN, FALSE),
            COALESCE(p_data->>'farmerOtherCropsText', ''),
            COALESCE((p_data->>'farmerLivestock')::BOOLEAN, FALSE),
            COALESCE(p_data->>'farmerLivestockText', ''),
            COALESCE((p_data->>'farmerPoultry')::BOOLEAN, FALSE),
            COALESCE(p_data->>'farmerPoultryText', ''),
            COALESCE((p_data->>'isActivelyFarming')::BOOLEAN, FALSE),
            'Submitted',
            p_data->>'profilePicture'
        )
        RETURNING id, submitted_at INTO v_submission_id, v_submitted_at;

        RAISE NOTICE 'Created new submission %', v_submission_id;
    END IF;

    v_farmer_name := TRIM(CONCAT_WS(' ',
        COALESCE(p_data->>'firstName', ''),
        COALESCE(p_data->>'middleName', ''),
        COALESCE(p_data->>'surname', p_data->>'lastName', '')
    ));

    FOR v_parcel IN SELECT * FROM jsonb_array_elements(COALESCE(p_data->'farmlandParcels', '[]'::JSONB))
    LOOP
        v_barangay     := COALESCE(v_parcel->>'farmLocationBarangay', '');
        v_municipality := COALESCE(v_parcel->>'farmLocationMunicipality', 'Dumangas');
        v_area         := COALESCE((v_parcel->>'totalFarmAreaHa')::DECIMAL, 0);
        v_parcel_number := COALESCE(v_parcel->>'existingParcelNumber', '');
        v_previous_history_id := NULL;
        v_land_parcel_id := NULL;
        v_has_existing_parcel_ref := (v_parcel->>'existingParcelId') IS NOT NULL AND (v_parcel->>'existingParcelId') != '';

        v_parcel_is_registered_owner := COALESCE((v_parcel->>'ownershipTypeRegisteredOwner')::BOOLEAN, v_is_registered_owner);
        v_parcel_is_tenant           := COALESCE((v_parcel->>'ownershipTypeTenant')::BOOLEAN, v_is_tenant);
        v_parcel_is_lessee           := COALESCE((v_parcel->>'ownershipTypeLessee')::BOOLEAN, v_is_lessee);

        v_parcel_tenant_land_owner_name := COALESCE(v_parcel->>'tenantLandOwnerName', '');
        v_parcel_lessee_land_owner_name := COALESCE(v_parcel->>'lesseeLandOwnerName', '');
        v_parcel_tenant_land_owner_id   := NULLIF(v_parcel->>'tenantLandOwnerId', '')::BIGINT;
        v_parcel_lessee_land_owner_id   := NULLIF(v_parcel->>'lesseeLandOwnerId', '')::BIGINT;

        IF v_parcel_is_tenant AND v_parcel_tenant_land_owner_name = '' AND v_selected_land_owner IS NOT NULL THEN
            v_parcel_tenant_land_owner_name := v_selected_land_owner->>'name';
            v_parcel_tenant_land_owner_id   := (v_selected_land_owner->>'id')::BIGINT;
        END IF;
        IF v_parcel_is_lessee AND v_parcel_lessee_land_owner_name = '' AND v_selected_land_owner IS NOT NULL THEN
            v_parcel_lessee_land_owner_name := v_selected_land_owner->>'name';
            v_parcel_lessee_land_owner_id   := (v_selected_land_owner->>'id')::BIGINT;
        END IF;

        v_is_cultivating := CASE
            WHEN COALESCE(v_parcel->>'isCultivating', '') = '' THEN TRUE
            WHEN LOWER(COALESCE(v_parcel->>'isCultivating', '')) IN ('false', 'f', 'no', '0') THEN FALSE
            ELSE TRUE
        END;
        v_cultivation_status_reason := NULLIF(v_parcel->>'cultivationStatusReason', '');
        v_cultivation_status_updated_at := CASE
            WHEN (v_parcel ? 'cultivationStatusUpdatedAt') AND COALESCE(v_parcel->>'cultivationStatusUpdatedAt', '') <> ''
                THEN (v_parcel->>'cultivationStatusUpdatedAt')::TIMESTAMPTZ
            WHEN (v_parcel ? 'isCultivating') THEN NOW()
            ELSE NULL
        END;
        v_cultivator_submission_id := CASE
            WHEN COALESCE(v_parcel->>'cultivatorSubmissionId', '') <> ''
                THEN (v_parcel->>'cultivatorSubmissionId')::BIGINT
            WHEN v_is_cultivating THEN v_submission_id
            ELSE NULL
        END;
        v_contract_end_date := CASE
            WHEN COALESCE(v_parcel->>'contractEndDate', '') <> ''
                THEN (v_parcel->>'contractEndDate')::DATE
            ELSE NULL
        END;

        IF v_barangay = '' OR v_area = 0 THEN
            RAISE NOTICE 'Skipping parcel with empty barangay or zero area';
            CONTINUE;
        END IF;

        IF v_has_existing_parcel_ref THEN
            SELECT lh.id, lh.land_parcel_id, lh.farmer_id, lh.farmer_name, lh.parcel_number
            INTO v_history_record
            FROM land_history lh
            WHERE lh.farm_parcel_id = (v_parcel->>'existingParcelId')::BIGINT AND lh.is_current = TRUE
            LIMIT 1;

            IF v_history_record.id IS NOT NULL THEN
                v_land_parcel_id      := v_history_record.land_parcel_id;
                v_parcel_number       := COALESCE(v_history_record.parcel_number, v_parcel_number);
                v_previous_history_id := v_history_record.id;
                v_prev_farmer_id      := v_history_record.farmer_id;
                v_prev_farmer_name    := v_history_record.farmer_name;

                IF v_parcel_is_registered_owner AND v_prev_farmer_id != v_submission_id THEN
                    UPDATE land_history SET is_current = FALSE, period_end_date = CURRENT_DATE, updated_at = NOW()
                    WHERE land_parcel_id = v_land_parcel_id AND is_current = TRUE;
                END IF;
            ELSE
                IF v_parcel_number != '' THEN
                    SELECT lh.id, lh.land_parcel_id, lh.farmer_id, lh.farmer_name
                    INTO v_history_record
                    FROM land_history lh
                    WHERE lh.parcel_number = v_parcel_number AND lh.is_current = TRUE
                    ORDER BY lh.is_registered_owner DESC, lh.created_at DESC LIMIT 1;

                    IF v_history_record.id IS NOT NULL THEN
                        v_land_parcel_id      := v_history_record.land_parcel_id;
                        v_previous_history_id := v_history_record.id;
                        v_prev_farmer_id      := v_history_record.farmer_id;
                        v_prev_farmer_name    := v_history_record.farmer_name;

                        IF v_parcel_is_registered_owner AND v_prev_farmer_id != v_submission_id THEN
                            UPDATE land_history SET is_current = FALSE, period_end_date = CURRENT_DATE, updated_at = NOW()
                            WHERE land_parcel_id = v_land_parcel_id AND is_current = TRUE;
                        END IF;
                    END IF;
                END IF;
            END IF;
        END IF;

        IF v_has_existing_parcel_ref AND v_prev_farmer_id = v_submission_id THEN
            v_farm_parcel_id := (v_parcel->>'existingParcelId')::BIGINT;
            UPDATE rsbsa_farm_parcels SET
                is_cultivating = v_is_cultivating,
                is_farming = COALESCE((v_parcel->>'isFarming')::BOOLEAN, v_is_cultivating),
                cultivation_status_updated_at = COALESCE(v_cultivation_status_updated_at, NOW()),
                cultivation_status_reason = v_cultivation_status_reason,
                cultivator_submission_id = v_cultivator_submission_id,
                contract_end_date = v_contract_end_date,
                updated_at = NOW()
            WHERE id = v_farm_parcel_id;
        ELSE
            IF v_land_parcel_id IS NULL THEN
                IF v_parcel_number = '' OR v_parcel_number IS NULL THEN
                    v_parcel_number := 'Parcel-' || v_submission_id || '-' || COALESCE(v_parcel->>'parcelNo', '1');
                END IF;
                INSERT INTO land_parcels (parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, is_active, created_at)
                VALUES (v_parcel_number, v_barangay, v_municipality, v_area, TRUE, NOW())
                ON CONFLICT (parcel_number) DO UPDATE SET updated_at = NOW()
                RETURNING id INTO v_land_parcel_id;
            END IF;

            INSERT INTO rsbsa_farm_parcels (
                submission_id, parcel_number, farm_location_barangay, farm_location_municipality,
                total_farm_area_ha, within_ancestral_domain, agrarian_reform_beneficiary,
                ownership_document_no, ownership_type_registered_owner, ownership_type_tenant,
                ownership_type_lessee, tenant_land_owner_name, lessee_land_owner_name,
                tenant_land_owner_id, lessee_land_owner_id, is_current_owner,
                is_cultivating, cultivation_status_updated_at, cultivation_status_reason,
                cultivator_submission_id, contract_end_date, is_farming
            ) VALUES (
                v_submission_id, v_parcel_number, v_barangay, v_municipality, v_area,
                CASE WHEN COALESCE(v_parcel->>'withinAncestralDomain', 'No') IN ('Yes', 'true') THEN 'Yes' ELSE 'No' END,
                CASE WHEN COALESCE(v_parcel->>'agrarianReformBeneficiary', 'No') IN ('Yes', 'true') THEN 'Yes' ELSE 'No' END,
                COALESCE(v_parcel->>'ownershipDocumentNo', ''),
                v_parcel_is_registered_owner, v_parcel_is_tenant, v_parcel_is_lessee,
                v_parcel_tenant_land_owner_name, v_parcel_lessee_land_owner_name,
                v_parcel_tenant_land_owner_id, v_parcel_lessee_land_owner_id,
                TRUE, v_is_cultivating, v_cultivation_status_updated_at,
                v_cultivation_status_reason, v_cultivator_submission_id, v_contract_end_date,
                COALESCE((v_parcel->>'isFarming')::BOOLEAN, v_is_cultivating)
            )
            RETURNING id INTO v_farm_parcel_id;

            IF (v_parcel_is_tenant OR v_parcel_is_lessee) AND (v_parcel_tenant_land_owner_id IS NOT NULL OR v_parcel_lessee_land_owner_id IS NOT NULL) THEN
                UPDATE rsbsa_farm_parcels SET
                    is_cultivating = FALSE,
                    cultivation_status_updated_at = COALESCE(v_cultivation_status_updated_at, NOW()),
                    cultivation_status_reason = COALESCE(v_cultivation_status_reason,
                        CASE
                            WHEN v_parcel_is_tenant AND v_parcel_is_lessee THEN 'Cultivated by tenant/lessee: ' || v_farmer_name
                            WHEN v_parcel_is_tenant THEN 'Cultivated by tenant: ' || v_farmer_name
                            WHEN v_parcel_is_lessee THEN 'Cultivated by lessee: ' || v_farmer_name
                            ELSE 'Cultivation status updated'
                        END),
                    cultivator_submission_id = v_submission_id,
                    updated_at = NOW()
                WHERE submission_id = COALESCE(v_parcel_tenant_land_owner_id, v_parcel_lessee_land_owner_id)
                  AND parcel_number = v_parcel_number
                  AND ownership_type_registered_owner = TRUE
                  AND (is_current_owner IS NULL OR is_current_owner = TRUE);
            END IF;

            INSERT INTO land_history (
                land_parcel_id, farm_parcel_id, farmer_id, farmer_name,
                parcel_number, farm_location_barangay, farm_location_municipality,
                total_farm_area_ha, is_registered_owner, is_tenant, is_lessee,
                land_owner_id, land_owner_name, is_current, period_start_date,
                change_type, change_reason, previous_history_id, rsbsa_submission_id, created_at
            ) VALUES (
                v_land_parcel_id, v_farm_parcel_id, v_submission_id, v_farmer_name,
                v_parcel_number, v_barangay, v_municipality, v_area,
                v_parcel_is_registered_owner, v_parcel_is_tenant, v_parcel_is_lessee,
                CASE WHEN v_parcel_is_registered_owner THEN v_submission_id
                     WHEN v_parcel_is_tenant THEN v_parcel_tenant_land_owner_id
                     WHEN v_parcel_is_lessee THEN v_parcel_lessee_land_owner_id
                     ELSE NULL END,
                CASE WHEN v_parcel_is_registered_owner THEN v_farmer_name
                     WHEN v_parcel_is_tenant THEN NULLIF(v_parcel_tenant_land_owner_name, '')
                     WHEN v_parcel_is_lessee THEN NULLIF(v_parcel_lessee_land_owner_name, '')
                     ELSE NULL END,
                TRUE, CURRENT_DATE,
                CASE WHEN v_parcel_is_registered_owner AND (v_previous_history_id IS NOT NULL OR v_has_existing_parcel_ref) THEN 'TRANSFER'
                     WHEN v_parcel_is_registered_owner THEN 'NEW'
                     WHEN v_parcel_is_tenant AND v_parcel_is_lessee THEN 'ASSOCIATION_CHANGE'
                     WHEN v_parcel_is_tenant THEN 'TENANT_CHANGE'
                     WHEN v_parcel_is_lessee THEN 'LESSEE_CHANGE'
                     ELSE 'NEW' END,
                CASE WHEN v_parcel_is_registered_owner AND (v_previous_history_id IS NOT NULL OR v_has_existing_parcel_ref) THEN
                         'Ownership transfer from ' || COALESCE(v_prev_farmer_name, 'unknown') || ' to ' || v_farmer_name
                     WHEN v_parcel_is_registered_owner THEN 'Initial RSBSA registration'
                     WHEN v_parcel_is_tenant AND v_parcel_is_lessee THEN
                         'Tenant/Lessee association under ' || COALESCE(NULLIF(v_parcel_tenant_land_owner_name, ''), COALESCE(v_prev_farmer_name, 'land owner'))
                     WHEN v_parcel_is_tenant THEN
                         'Tenant association under ' || COALESCE(NULLIF(v_parcel_tenant_land_owner_name, ''), COALESCE(v_prev_farmer_name, 'land owner'))
                     WHEN v_parcel_is_lessee THEN
                         'Lessee association under ' || COALESCE(NULLIF(v_parcel_lessee_land_owner_name, ''), COALESCE(v_prev_farmer_name, 'land owner'))
                     ELSE 'Initial RSBSA registration' END,
                v_previous_history_id, v_submission_id, NOW()
            );

            IF v_parcel_is_registered_owner AND v_prev_farmer_id IS NOT NULL AND v_prev_farmer_id != v_submission_id THEN
                UPDATE rsbsa_farm_parcels SET is_current_owner = FALSE
                WHERE submission_id = v_prev_farmer_id AND parcel_number = v_parcel_number;

                SELECT COUNT(*) INTO v_remaining_count
                FROM rsbsa_farm_parcels
                WHERE submission_id = v_prev_farmer_id AND is_current_owner = TRUE;

                IF v_remaining_count = 0 THEN
                    UPDATE rsbsa_submission SET status = 'inactive' WHERE id = v_prev_farmer_id;
                END IF;
            END IF;
        END IF;
    END LOOP;

    ALTER TABLE rsbsa_farm_parcels ENABLE TRIGGER trigger_create_land_history_on_parcel_insert;

    RETURN jsonb_build_object(
        'submissionId', v_submission_id,
        'submittedAt', v_submitted_at,
        'farmerName', v_farmer_name,
        'message', 'Registration successful'
    );

EXCEPTION WHEN OTHERS THEN
    ALTER TABLE rsbsa_farm_parcels ENABLE TRIGGER trigger_create_land_history_on_parcel_insert;
    RAISE;
END;$function$