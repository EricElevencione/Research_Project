import fs from 'fs';

const sqlPath = 'scratch/register_farmer_with_parcels.sql';
let sql = fs.readFileSync(sqlPath, 'utf8').replace(/\r\n/g, '\n');

// 1. DECLARE replacement
const declareTarget = `    v_cultivator_submission_id BIGINT;
    v_contract_end_date DATE;
BEGIN`;

const declareReplacement = `    v_cultivator_submission_id BIGINT;
    v_contract_end_date DATE;
    -- Parcel-level ownership details
    v_parcel_is_registered_owner BOOLEAN;
    v_parcel_is_tenant BOOLEAN;
    v_parcel_is_lessee BOOLEAN;
    v_parcel_tenant_land_owner_name TEXT;
    v_parcel_lessee_land_owner_name TEXT;
    v_parcel_tenant_land_owner_id BIGINT;
    v_parcel_lessee_land_owner_id BIGINT;
BEGIN`;

if (!sql.includes(declareTarget)) {
  console.error("declareTarget not found!");
  process.exit(1);
}
sql = sql.replace(declareTarget, declareReplacement);

// 2. Loop start replacement
const loopStartTarget = `    -- Step 2: Process each parcel
    FOR v_parcel IN SELECT * FROM jsonb_array_elements(COALESCE(p_data->'farmlandParcels', '[]'::JSONB))
    LOOP
        v_barangay := COALESCE(v_parcel->>'farmLocationBarangay', '');
        v_municipality := COALESCE(v_parcel->>'farmLocationMunicipality', 'Dumangas');
        v_area := COALESCE((v_parcel->>'totalFarmAreaHa')::DECIMAL, 0);
        v_parcel_number := COALESCE(v_parcel->>'existingParcelNumber', '');
        v_previous_history_id := NULL;
        v_land_parcel_id := NULL;
        v_has_existing_parcel_ref := (v_parcel->>'existingParcelId') IS NOT NULL AND (v_parcel->>'existingParcelId') != '';`;

const loopStartReplacement = `    -- Step 2: Process each parcel
    FOR v_parcel IN SELECT * FROM jsonb_array_elements(COALESCE(p_data->'farmlandParcels', '[]'::JSONB))
    LOOP
        v_barangay := COALESCE(v_parcel->>'farmLocationBarangay', '');
        v_municipality := COALESCE(v_parcel->>'farmLocationMunicipality', 'Dumangas');
        v_area := COALESCE((v_parcel->>'totalFarmAreaHa')::DECIMAL, 0);
        v_parcel_number := COALESCE(v_parcel->>'existingParcelNumber', '');
        v_previous_history_id := NULL;
        v_land_parcel_id := NULL;
        v_has_existing_parcel_ref := (v_parcel->>'existingParcelId') IS NOT NULL AND (v_parcel->>'existingParcelId') != '';

        -- Extract parcel-level ownership details
        v_parcel_is_registered_owner := COALESCE((v_parcel->>'ownershipTypeRegisteredOwner')::BOOLEAN, v_is_registered_owner);
        v_parcel_is_tenant := COALESCE((v_parcel->>'ownershipTypeTenant')::BOOLEAN, v_is_tenant);
        v_parcel_is_lessee := COALESCE((v_parcel->>'ownershipTypeLessee')::BOOLEAN, v_is_lessee);

        v_parcel_tenant_land_owner_name := COALESCE(v_parcel->>'tenantLandOwnerName', '');
        v_parcel_lessee_land_owner_name := COALESCE(v_parcel->>'lesseeLandOwnerName', '');

        v_parcel_tenant_land_owner_id := NULLIF(v_parcel->>'tenantLandOwnerId', '')::BIGINT;
        v_parcel_lessee_land_owner_id := NULLIF(v_parcel->>'lesseeLandOwnerId', '')::BIGINT;

        -- Fallback to submission-level land owner if not set on the parcel
        IF v_parcel_is_tenant AND v_parcel_tenant_land_owner_name = '' AND v_selected_land_owner IS NOT NULL THEN
            v_parcel_tenant_land_owner_name := v_selected_land_owner->>'name';
            v_parcel_tenant_land_owner_id := (v_selected_land_owner->>'id')::BIGINT;
        END IF;

        IF v_parcel_is_lessee AND v_parcel_lessee_land_owner_name = '' AND v_selected_land_owner IS NOT NULL THEN
            v_parcel_lessee_land_owner_name := v_selected_land_owner->>'name';
            v_parcel_lessee_land_owner_id := (v_selected_land_owner->>'id')::BIGINT;
        END IF;`;

if (!sql.includes(loopStartTarget)) {
  console.error("loopStartTarget not found!");
  process.exit(1);
}
sql = sql.replace(loopStartTarget, loopStartReplacement);

// 3. Ownership transfer replaces (two occurrences)
const transferTarget1 = `                IF v_is_ownership_transfer THEN
                    UPDATE land_history
                    SET is_current = FALSE,
                        period_end_date = CURRENT_DATE,
                        updated_at = NOW()
                    WHERE land_parcel_id = v_land_parcel_id
                      AND is_current = TRUE;

                    RAISE NOTICE 'Closed previous holder records for land_parcel_id: %', v_land_parcel_id;
                END IF;`;

const transferReplacement1 = `                IF v_parcel_is_registered_owner THEN
                    UPDATE land_history
                    SET is_current = FALSE,
                        period_end_date = CURRENT_DATE,
                        updated_at = NOW()
                    WHERE land_parcel_id = v_land_parcel_id
                      AND is_current = TRUE;

                    RAISE NOTICE 'Closed previous holder records for land_parcel_id: %', v_land_parcel_id;
                END IF;`;

const transferTarget2 = `                        IF v_is_ownership_transfer THEN
                            UPDATE land_history
                            SET is_current = FALSE,
                                period_end_date = CURRENT_DATE,
                                updated_at = NOW()
                            WHERE land_parcel_id = v_land_parcel_id
                              AND is_current = TRUE;
                        END IF;`;

const transferReplacement2 = `                        IF v_parcel_is_registered_owner THEN
                            UPDATE land_history
                            SET is_current = FALSE,
                                period_end_date = CURRENT_DATE,
                                updated_at = NOW()
                            WHERE land_parcel_id = v_land_parcel_id
                              AND is_current = TRUE;
                        END IF;`;

if (!sql.includes(transferTarget1)) {
  console.error("transferTarget1 not found!");
  process.exit(1);
}
sql = sql.replace(transferTarget1, transferReplacement1);

if (!sql.includes(transferTarget2)) {
  console.error("transferTarget2 not found!");
  process.exit(1);
}
sql = sql.replace(transferTarget2, transferReplacement2);

// 4. INSERT INTO rsbsa_farm_parcels record
const insertParcelsTarget = `        -- Insert rsbsa_farm_parcels record
        INSERT INTO rsbsa_farm_parcels (
            submission_id, parcel_number, farm_location_barangay, farm_location_municipality,
            total_farm_area_ha, within_ancestral_domain, agrarian_reform_beneficiary,
            ownership_document_no, ownership_type_registered_owner, ownership_type_tenant,
            ownership_type_lessee, tenant_land_owner_name, lessee_land_owner_name,
            tenant_land_owner_id, lessee_land_owner_id, is_current_owner,
            is_cultivating, cultivation_status_updated_at, cultivation_status_reason,
            cultivator_submission_id,
            contract_end_date
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
            v_is_registered_owner,
            v_is_cultivating,
            v_cultivation_status_updated_at,
            v_cultivation_status_reason,
            v_cultivator_submission_id,
            v_contract_end_date
        )`;

const insertParcelsReplacement = `        -- Insert rsbsa_farm_parcels record
        INSERT INTO rsbsa_farm_parcels (
            submission_id, parcel_number, farm_location_barangay, farm_location_municipality,
            total_farm_area_ha, within_ancestral_domain, agrarian_reform_beneficiary,
            ownership_document_no, ownership_type_registered_owner, ownership_type_tenant,
            ownership_type_lessee, tenant_land_owner_name, lessee_land_owner_name,
            tenant_land_owner_id, lessee_land_owner_id, is_current_owner,
            is_cultivating, cultivation_status_updated_at, cultivation_status_reason,
            cultivator_submission_id,
            contract_end_date
        ) VALUES (
            v_submission_id, v_parcel_number, v_barangay, v_municipality,
            v_area,
            CASE WHEN COALESCE(v_parcel->>'withinAncestralDomain', 'No') IN ('Yes', 'true') THEN 'Yes' ELSE 'No' END,
            CASE WHEN COALESCE(v_parcel->>'agrarianReformBeneficiary', 'No') IN ('Yes', 'true') THEN 'Yes' ELSE 'No' END,
            COALESCE(v_parcel->>'ownershipDocumentNo', ''),
            v_parcel_is_registered_owner,
            v_parcel_is_tenant,
            v_parcel_is_lessee,
            v_parcel_tenant_land_owner_name,
            v_parcel_lessee_land_owner_name,
            v_parcel_tenant_land_owner_id,
            v_parcel_lessee_land_owner_id,
            v_parcel_is_registered_owner,
            v_is_cultivating,
            v_cultivation_status_updated_at,
            v_cultivation_status_reason,
            v_cultivator_submission_id,
            v_contract_end_date
        )`;

if (!sql.includes(insertParcelsTarget)) {
  console.error("insertParcelsTarget not found!");
  process.exit(1);
}
sql = sql.replace(insertParcelsTarget, insertParcelsReplacement);

// 5. Landowner linking update block
const linkingUpdateTarget = `        IF (v_is_tenant OR v_is_lessee) AND v_selected_land_owner IS NOT NULL THEN
            UPDATE rsbsa_farm_parcels
            SET is_cultivating = FALSE,
                cultivation_status_updated_at = COALESCE(v_cultivation_status_updated_at, NOW()),
                cultivation_status_reason = COALESCE(
                    v_cultivation_status_reason,
                    CASE
                        WHEN v_is_tenant AND v_is_lessee THEN 'Cultivated by tenant/lessee: ' || v_farmer_name
                        WHEN v_is_tenant THEN 'Cultivated by tenant: ' || v_farmer_name
                        WHEN v_is_lessee THEN 'Cultivated by lessee: ' || v_farmer_name
                        ELSE 'Cultivation status updated'
                    END
                ),
                cultivator_submission_id = v_submission_id,
                updated_at = NOW()
                        WHERE submission_id = NULLIF(v_selected_land_owner->>'id', '')::BIGINT
              AND parcel_number = v_parcel_number
              AND ownership_type_registered_owner = TRUE
              AND (is_current_owner IS NULL OR is_current_owner = TRUE);
        END IF;`;

const linkingUpdateReplacement = `        IF (v_parcel_is_tenant OR v_parcel_is_lessee) AND (v_parcel_tenant_land_owner_id IS NOT NULL OR v_parcel_lessee_land_owner_id IS NOT NULL) THEN
            UPDATE rsbsa_farm_parcels
            SET is_cultivating = FALSE,
                cultivation_status_updated_at = COALESCE(v_cultivation_status_updated_at, NOW()),
                cultivation_status_reason = COALESCE(
                    v_cultivation_status_reason,
                    CASE
                        WHEN v_parcel_is_tenant AND v_parcel_is_lessee THEN 'Cultivated by tenant/lessee: ' || v_farmer_name
                        WHEN v_parcel_is_tenant THEN 'Cultivated by tenant: ' || v_farmer_name
                        WHEN v_parcel_is_lessee THEN 'Cultivated by lessee: ' || v_farmer_name
                        ELSE 'Cultivation status updated'
                    END
                ),
                cultivator_submission_id = v_submission_id,
                updated_at = NOW()
            WHERE submission_id = COALESCE(v_parcel_tenant_land_owner_id, v_parcel_lessee_land_owner_id)
              AND parcel_number = v_parcel_number
              AND ownership_type_registered_owner = TRUE
              AND (is_current_owner IS NULL OR is_current_owner = TRUE);
        END IF;`;

if (!sql.includes(linkingUpdateTarget)) {
  console.error("linkingUpdateTarget not found!");
  process.exit(1);
}
sql = sql.replace(linkingUpdateTarget, linkingUpdateReplacement);

// 6. land_history insertion
const landHistoryTarget = `            v_is_registered_owner,
            v_is_tenant,
            v_is_lessee,
            CASE 
                WHEN v_is_registered_owner THEN v_submission_id
                WHEN v_selected_land_owner IS NOT NULL THEN (v_selected_land_owner->>'id')::BIGINT
                ELSE NULL
            END,
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
            END,`;

const landHistoryReplacement = `            v_parcel_is_registered_owner,
            v_parcel_is_tenant,
            v_parcel_is_lessee,
            CASE 
                WHEN v_parcel_is_registered_owner THEN v_submission_id
                WHEN v_parcel_is_tenant THEN v_parcel_tenant_land_owner_id
                WHEN v_parcel_is_lessee THEN v_parcel_lessee_land_owner_id
                ELSE NULL
            END,
            CASE 
                WHEN v_parcel_is_registered_owner THEN v_farmer_name
                WHEN v_parcel_is_tenant THEN NULLIF(v_parcel_tenant_land_owner_name, '')
                WHEN v_parcel_is_lessee THEN NULLIF(v_parcel_lessee_land_owner_name, '')
                ELSE NULL
            END,
            TRUE,
            CURRENT_DATE,
            CASE
                WHEN v_parcel_is_registered_owner AND (v_previous_history_id IS NOT NULL OR v_has_existing_parcel_ref) THEN 'TRANSFER'
                WHEN v_parcel_is_registered_owner THEN 'NEW'
                WHEN v_parcel_is_tenant AND v_parcel_is_lessee THEN 'ASSOCIATION_CHANGE'
                WHEN v_parcel_is_tenant THEN 'TENANT_CHANGE'
                WHEN v_parcel_is_lessee THEN 'LESSEE_CHANGE'
                ELSE 'NEW'
            END,
            CASE 
                WHEN v_parcel_is_registered_owner AND (v_previous_history_id IS NOT NULL OR v_has_existing_parcel_ref) THEN
                    'Ownership transfer from ' || COALESCE(v_prev_farmer_name, 'unknown') || ' to ' || v_farmer_name
                WHEN v_parcel_is_registered_owner THEN 'Initial RSBSA registration'
                WHEN v_parcel_is_tenant AND v_parcel_is_lessee THEN
                    'Tenant/Lessee association under ' || COALESCE(NULLIF(v_parcel_tenant_land_owner_name, ''), COALESCE(v_prev_farmer_name, 'land owner'))
                WHEN v_parcel_is_tenant THEN
                    'Tenant association under ' || COALESCE(NULLIF(v_parcel_tenant_land_owner_name, ''), COALESCE(v_prev_farmer_name, 'land owner'))
                WHEN v_parcel_is_lessee THEN
                    'Lessee association under ' || COALESCE(NULLIF(v_parcel_lessee_land_owner_name, ''), COALESCE(v_prev_farmer_name, 'land owner'))
                ELSE
                    'Initial RSBSA registration'
            END,`;

if (!sql.includes(landHistoryTarget)) {
  console.error("landHistoryTarget not found!");
  process.exit(1);
}
sql = sql.replace(landHistoryTarget, landHistoryReplacement);

// 7. Ownership transfer check replacement
const cleanUpTransferTarget = `        IF v_is_ownership_transfer AND v_prev_farmer_id IS NOT NULL THEN
            UPDATE rsbsa_farm_parcels
            SET is_current_owner = FALSE
            WHERE submission_id = v_prev_farmer_id
              AND parcel_number = v_parcel_number;`;

const cleanUpTransferReplacement = `        IF v_parcel_is_registered_owner AND v_prev_farmer_id IS NOT NULL THEN
            UPDATE rsbsa_farm_parcels
            SET is_current_owner = FALSE
            WHERE submission_id = v_prev_farmer_id
              AND parcel_number = v_parcel_number;`;

if (!sql.includes(cleanUpTransferTarget)) {
  console.error("cleanUpTransferTarget not found!");
  process.exit(1);
}
sql = sql.replace(cleanUpTransferTarget, cleanUpTransferReplacement);

fs.writeFileSync(sqlPath, sql, 'utf8');
console.log("SQL successfully updated!");
