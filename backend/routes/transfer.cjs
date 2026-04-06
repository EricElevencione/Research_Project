const express = require("express");
const router = express.Router();

// Import database pool
const { createPool } = require("../config/db.cjs");
const pool = createPool();

const AREA_EPSILON = 0.0001;

const parsePositiveInt = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const intValue = Math.trunc(parsed);
  return intValue > 0 ? intValue : null;
};

const parsePositiveArea = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
};

const normalizeDateValue = (value) => {
  const source = value ? new Date(value) : new Date();
  if (Number.isNaN(source.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return source.toISOString().slice(0, 10);
};

const boolFromYesNo = (value) => {
  if (value === true) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "yes" || normalized === "true";
  }
  return false;
};

const toAreaNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
};

const buildDisplayName = (row) => {
  const first = String(row["FIRST NAME"] || "").trim();
  const middle = String(row["MIDDLE NAME"] || "").trim();
  const last = String(row["LAST NAME"] || "").trim();
  const ext = String(row["EXT NAME"] || "").trim();
  return [first, middle, last, ext].filter(Boolean).join(" ").trim();
};

const assertTransferMode = (mode) =>
  mode === "voluntary" || mode === "inheritance";

const normalizeOwnershipCategory = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "registeredowner" ||
    normalized === "registered_owner" ||
    normalized === "registered owner" ||
    normalized === "owner"
  ) {
    return "registeredOwner";
  }

  if (
    normalized === "tenantlessee" ||
    normalized === "tenant_lessee" ||
    normalized === "tenant/lessee" ||
    normalized === "tenant-lessee" ||
    normalized === "tenant" ||
    normalized === "lessee"
  ) {
    return "tenantLessee";
  }

  return "unknown";
};

const getTransferSchemaCapabilities = async (client) => {
  const result = await client.query(`
        SELECT
            EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'rsbsa_submission'
                  AND column_name = 'ownership_category'
            ) AS has_submission_ownership_category_column,
            EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'rsbsa_farm_parcels'
                  AND column_name = 'ownership_category'
            ) AS has_parcel_ownership_category_column,
            EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'rsbsa_farm_parcels'
                  AND column_name = 'is_current_owner'
            ) AS has_current_owner_column,
            EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'land_history'
                  AND column_name = 'ownership_category'
            ) AS has_land_history_ownership_category_column
    `);

  return {
    hasSubmissionOwnershipCategoryColumn:
      result.rows?.[0]?.has_submission_ownership_category_column === true,
    hasParcelOwnershipCategoryColumn:
      result.rows?.[0]?.has_parcel_ownership_category_column === true,
    hasCurrentOwnerColumn: result.rows?.[0]?.has_current_owner_column === true,
    hasLandHistoryOwnershipCategoryColumn:
      result.rows?.[0]?.has_land_history_ownership_category_column === true,
  };
};

const setSubmissionOwnershipCategory = async (
  client,
  submissionId,
  ownershipCategory,
  schemaCapabilities,
) => {
  if (!schemaCapabilities?.hasSubmissionOwnershipCategoryColumn) {
    return;
  }

  await client.query(
    `
            UPDATE rsbsa_submission
            SET ownership_category = $2,
                updated_at = NOW()
            WHERE id = $1
        `,
    [submissionId, normalizeOwnershipCategory(ownershipCategory)],
  );
};

const enforceRegisteredOwnerParcelState = async (
  client,
  parcelIds,
  schemaCapabilities,
) => {
  const normalizedIds = [];
  if (Array.isArray(parcelIds)) {
    for (const value of parcelIds) {
      const parsed = parsePositiveInt(value);
      if (parsed) normalizedIds.push(parsed);
    }
  } else {
    const parsed = parsePositiveInt(parcelIds);
    if (parsed) normalizedIds.push(parsed);
  }

  if (normalizedIds.length === 0) return;

  const setParts = [
    "ownership_type_registered_owner = TRUE",
    "ownership_type_tenant = FALSE",
    "ownership_type_lessee = FALSE",
    "ownership_type_others = FALSE",
    "tenant_land_owner_name = NULL",
    "lessee_land_owner_name = NULL",
    "tenant_land_owner_id = NULL",
    "lessee_land_owner_id = NULL",
  ];
  const values = [normalizedIds];
  let paramCounter = 2;

  if (schemaCapabilities?.hasParcelOwnershipCategoryColumn) {
    setParts.push(`ownership_category = $${paramCounter}`);
    values.push("registeredOwner");
    paramCounter += 1;
  }

  if (schemaCapabilities?.hasCurrentOwnerColumn) {
    setParts.push("is_current_owner = TRUE");
  }

  setParts.push("updated_at = NOW()");

  await client.query(
    `
            UPDATE rsbsa_farm_parcels
            SET ${setParts.join(", ")}
            WHERE id = ANY($1::bigint[])
        `,
    values,
  );
};

const setCurrentHistoryOwnershipCategory = async (
  client,
  farmParcelId,
  ownershipCategory,
  schemaCapabilities,
) => {
  if (!schemaCapabilities?.hasLandHistoryOwnershipCategoryColumn) {
    return;
  }

  await client.query(
    `
            UPDATE land_history
            SET ownership_category = $2,
                updated_at = NOW()
            WHERE farm_parcel_id = $1
              AND is_current = TRUE
        `,
    [farmParcelId, normalizeOwnershipCategory(ownershipCategory)],
  );
};

const lockFarmerRow = async (client, farmerId) => {
  const result = await client.query(
    `
            SELECT
                id,
                "FIRST NAME",
                "MIDDLE NAME",
                "LAST NAME",
                "EXT NAME",
                "FFRS_CODE",
                "TOTAL FARM AREA",
                status
            FROM rsbsa_submission
            WHERE id = $1
            FOR UPDATE
        `,
    [farmerId],
  );

  if (result.rowCount === 0) {
    throw new Error(`Farmer record not found (id: ${farmerId}).`);
  }

  const row = result.rows[0];
  return {
    id: Number(row.id),
    name: buildDisplayName(row),
    ffrsCode: String(row["FFRS_CODE"] || ""),
    totalFarmArea: toAreaNumber(row["TOTAL FARM AREA"]),
    status: row.status || null,
  };
};

const lockDonorParcel = async (client, farmParcelId) => {
  const result = await client.query(
    `
            SELECT
                id,
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
                ownership_type_others
            FROM rsbsa_farm_parcels
            WHERE id = $1
            FOR UPDATE
        `,
    [farmParcelId],
  );

  if (result.rowCount === 0) {
    throw new Error(`Parcel not found (id: ${farmParcelId}).`);
  }

  const row = result.rows[0];
  return {
    id: Number(row.id),
    submissionId: parsePositiveInt(row.submission_id),
    parcelNumber: String(row.parcel_number || ""),
    farmLocationBarangay: String(row.farm_location_barangay || ""),
    farmLocationMunicipality: String(row.farm_location_municipality || ""),
    totalFarmAreaHa: toAreaNumber(row.total_farm_area_ha),
    withinAncestralDomain: row.within_ancestral_domain,
    ownershipDocumentNo: row.ownership_document_no || null,
    agrarianReformBeneficiary: row.agrarian_reform_beneficiary,
  };
};

const closeCurrentHistoryRows = async (
  client,
  farmParcelId,
  transferDate,
  changeType,
  changeReason,
  noteText,
) => {
  const currentRows = await client.query(
    `
            SELECT id
            FROM land_history
            WHERE farm_parcel_id = $1
              AND is_current = TRUE
            ORDER BY id DESC
            FOR UPDATE
        `,
    [farmParcelId],
  );

  if (currentRows.rowCount === 0) {
    return null;
  }

  const ids = currentRows.rows.map((row) => Number(row.id));
  const previousHistoryId = ids[0];

  await client.query(
    `
            UPDATE land_history
            SET
                is_current = FALSE,
                period_end_date = $2,
                change_type = $3,
                change_reason = $4,
                notes = $5,
                updated_at = NOW()
            WHERE id = ANY($1::bigint[])
        `,
    [ids, transferDate, changeType, changeReason || null, noteText || null],
  );

  return previousHistoryId;
};

const ensureSingleCurrentHistory = async (
  client,
  {
    farmParcelId,
    submissionId,
    farmerName,
    farmerFfrsCode,
    parcelNumber,
    farmLocationBarangay,
    farmLocationMunicipality,
    areaHa,
    ownershipDocumentNo,
    withinAncestralDomain,
    agrarianReformBeneficiary,
    transferDate,
    changeType,
    changeReason,
    previousRecordId,
    notes,
  },
) => {
  const currentRows = await client.query(
    `
            SELECT id
            FROM land_history
            WHERE farm_parcel_id = $1
              AND is_current = TRUE
            ORDER BY id DESC
            FOR UPDATE
        `,
    [farmParcelId],
  );

  const withinAncestralDomainBool = boolFromYesNo(withinAncestralDomain);
  const agrarianReformBeneficiaryBool = boolFromYesNo(
    agrarianReformBeneficiary,
  );
  const safeArea = Math.max(0, toAreaNumber(areaHa));

  if (currentRows.rowCount === 0) {
    await client.query(
      `
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
                    period_start_date,
                    period_end_date,
                    is_current,
                    change_type,
                    change_reason,
                    previous_record_id,
                    notes,
                    created_at,
                    updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12,
                    NULL, NULL, FALSE,
                    NULL, NULL, FALSE,
                    TRUE, FALSE,
                    $13, $14, $15,
                    $16, NULL, TRUE,
                    $17, $18, $19, $20,
                    NOW(), NOW()
                )
            `,
      [
        submissionId,
        farmParcelId,
        parcelNumber || null,
        farmLocationBarangay || null,
        farmLocationMunicipality || null,
        safeArea,
        submissionId,
        farmerName || null,
        farmerFfrsCode || null,
        submissionId,
        farmerName || null,
        farmerFfrsCode || null,
        ownershipDocumentNo || null,
        agrarianReformBeneficiaryBool,
        withinAncestralDomainBool,
        transferDate,
        changeType,
        changeReason || null,
        previousRecordId || null,
        notes || null,
      ],
    );
    return;
  }

  const newestHistoryId = Number(currentRows.rows[0].id);
  const staleHistoryIds = currentRows.rows
    .slice(1)
    .map((row) => Number(row.id));

  await client.query(
    `
            UPDATE land_history
            SET
                rsbsa_submission_id = $2,
                parcel_number = $3,
                farm_location_barangay = $4,
                farm_location_municipality = $5,
                total_farm_area_ha = $6,
                land_owner_id = $7,
                land_owner_name = $8,
                land_owner_ffrs_code = $9,
                farmer_id = $10,
                farmer_name = $11,
                farmer_ffrs_code = $12,
                tenant_name = NULL,
                tenant_ffrs_code = NULL,
                is_tenant = FALSE,
                lessee_name = NULL,
                lessee_ffrs_code = NULL,
                is_lessee = FALSE,
                is_registered_owner = TRUE,
                is_other_ownership = FALSE,
                ownership_document_no = $13,
                agrarian_reform_beneficiary = $14,
                within_ancestral_domain = $15,
                period_start_date = $16,
                period_end_date = NULL,
                is_current = TRUE,
                change_type = $17,
                change_reason = $18,
                previous_record_id = $19,
                notes = $20,
                updated_at = NOW()
            WHERE id = $1
        `,
    [
      newestHistoryId,
      submissionId,
      parcelNumber || null,
      farmLocationBarangay || null,
      farmLocationMunicipality || null,
      safeArea,
      submissionId,
      farmerName || null,
      farmerFfrsCode || null,
      submissionId,
      farmerName || null,
      farmerFfrsCode || null,
      ownershipDocumentNo || null,
      agrarianReformBeneficiaryBool,
      withinAncestralDomainBool,
      transferDate,
      changeType,
      changeReason || null,
      previousRecordId || null,
      notes || null,
    ],
  );

  if (staleHistoryIds.length > 0) {
    await client.query(
      `
                UPDATE land_history
                SET
                    is_current = FALSE,
                    period_end_date = $2,
                    updated_at = NOW()
                WHERE id = ANY($1::bigint[])
            `,
      [staleHistoryIds, transferDate],
    );
  }
};

const getNextParcelNumberForFarmer = async (client, submissionId) => {
  const result = await client.query(
    `
            SELECT
                COALESCE(
                    MAX(
                        CASE
                            WHEN parcel_number ~ '^[0-9]+$' THEN parcel_number::integer
                            ELSE NULL
                        END
                    ),
                    0
                ) + 1 AS next_parcel_number
            FROM rsbsa_farm_parcels
            WHERE submission_id = $1
        `,
    [submissionId],
  );

  return String(result.rows[0].next_parcel_number || 1);
};

const refreshFarmerOwnershipSummary = async (
  client,
  farmerId,
  schemaCapabilities = {},
) => {
  const summaryResult = await client.query(
    `
            SELECT
                COALESCE(SUM(total_farm_area_ha), 0)::numeric(10,2) AS total_area_ha,
                COUNT(*)::integer AS parcel_count
            FROM rsbsa_farm_parcels
            WHERE submission_id = $1
        `,
    [farmerId],
  );

  const row = summaryResult.rows[0] || { total_area_ha: 0, parcel_count: 0 };
  const totalArea = toAreaNumber(row.total_area_ha);
  const parcelCount = Number(row.parcel_count) || 0;
  const hasParcels = parcelCount > 0 && totalArea > AREA_EPSILON;

  const updateFields = [];
  const updateValues = [farmerId];
  let paramCounter = 2;

  if (hasParcels) {
    updateFields.push(`"TOTAL FARM AREA" = $${paramCounter}`);
    updateValues.push(totalArea);
    paramCounter += 1;

    updateFields.push('"OWNERSHIP_TYPE_REGISTERED_OWNER" = TRUE');
    updateFields.push('"OWNERSHIP_TYPE_TENANT" = FALSE');
    updateFields.push('"OWNERSHIP_TYPE_LESSEE" = FALSE');
    updateFields.push("status = 'Active Farmer'");

    if (schemaCapabilities.hasSubmissionOwnershipCategoryColumn) {
      updateFields.push(`ownership_category = $${paramCounter}`);
      updateValues.push("registeredOwner");
      paramCounter += 1;
    }
  } else {
    updateFields.push('"TOTAL FARM AREA" = 0');
    updateFields.push('"OWNERSHIP_TYPE_REGISTERED_OWNER" = FALSE');
    updateFields.push("status = 'No Parcels'");

    if (schemaCapabilities.hasSubmissionOwnershipCategoryColumn) {
      updateFields.push(`ownership_category = $${paramCounter}`);
      updateValues.push("unknown");
      paramCounter += 1;
    }
  }

  updateFields.push("updated_at = NOW()");

  await client.query(
    `
            UPDATE rsbsa_submission
            SET ${updateFields.join(", ")}
            WHERE id = $1
        `,
    updateValues,
  );

  return {
    farmerId,
    totalAreaHa: hasParcels ? totalArea : 0,
    parcelCount,
    status: hasParcels ? "Active Farmer" : "No Parcels",
  };
};

/**
 * POST /api/transfer-ownership/confirm
 * Unified ownership transfer endpoint used by JoLandRegistry modal.
 * Handles full and partial transfer, then updates summaries for donor/recipient.
 */
router.post("/confirm", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      transferMode,
      fromFarmerId,
      toFarmerId,
      transferDate,
      transferReason,
      items,
      proofs,
    } = req.body || {};

    if (!assertTransferMode(transferMode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transfer mode. Expected voluntary or inheritance.",
      });
    }

    const fromFarmer = parsePositiveInt(fromFarmerId);
    const toFarmer = parsePositiveInt(toFarmerId);
    if (!fromFarmer || !toFarmer) {
      return res.status(400).json({
        success: false,
        message: "Invalid source/recipient farmer IDs.",
      });
    }

    if (fromFarmer === toFarmer) {
      return res.status(400).json({
        success: false,
        message: "Source and recipient must be different farmers.",
      });
    }

    const transferItems = Array.isArray(items) ? items : [];
    if (transferItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No transfer items provided.",
      });
    }

    const safeProofs = Array.isArray(proofs) ? proofs : [];
    if (safeProofs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one proof image is required.",
      });
    }

    const normalizedTransferDate = normalizeDateValue(transferDate);
    const normalizedReason =
      (typeof transferReason === "string" && transferReason.trim()) ||
      (transferMode === "inheritance" ? "Inheritance" : "Voluntary Transfer");

    await client.query("BEGIN");
    const schemaCapabilities = await getTransferSchemaCapabilities(client);

    const donorFarmer = await lockFarmerRow(client, fromFarmer);
    const recipientFarmer = await lockFarmerRow(client, toFarmer);

    let totalTransferredAreaHa = 0;
    let fullParcelsTransferred = 0;
    let partialParcelsTransferred = 0;
    const processedItems = [];

    for (let index = 0; index < transferItems.length; index += 1) {
      const item = transferItems[index] || {};
      const farmParcelId = parsePositiveInt(item.land_parcel_id);
      const requestedAreaHa = parsePositiveArea(item.transferred_area_ha);

      if (!farmParcelId || !requestedAreaHa) {
        throw new Error(`Invalid transfer item at index ${index + 1}.`);
      }

      const donorParcel = await lockDonorParcel(client, farmParcelId);
      if (
        !donorParcel.submissionId ||
        donorParcel.submissionId !== donorFarmer.id
      ) {
        throw new Error(
          `Parcel ${farmParcelId} is not owned by the selected donor.`,
        );
      }

      if (donorParcel.totalFarmAreaHa <= AREA_EPSILON) {
        throw new Error(`Parcel ${farmParcelId} has no transferable area.`);
      }

      if (requestedAreaHa > donorParcel.totalFarmAreaHa + AREA_EPSILON) {
        throw new Error(
          `Requested area (${requestedAreaHa} ha) exceeds parcel ${farmParcelId} area (${donorParcel.totalFarmAreaHa} ha).`,
        );
      }

      const isFullTransfer =
        donorParcel.totalFarmAreaHa - requestedAreaHa <= AREA_EPSILON;
      const remainingAreaHa = Math.max(
        0,
        Math.round((donorParcel.totalFarmAreaHa - requestedAreaHa) * 100) / 100,
      );

      const historyBaseNote = `Transfer ${transferMode} | donor ${donorFarmer.id} -> recipient ${recipientFarmer.id} | parcel ${farmParcelId}`;
      const previousHistoryId = await closeCurrentHistoryRows(
        client,
        farmParcelId,
        normalizedTransferDate,
        isFullTransfer ? "TRANSFER_OUT" : "TRANSFER_PARTIAL_OUT",
        normalizedReason,
        historyBaseNote,
      );

      if (isFullTransfer) {
        await client.query(
          `
                        UPDATE rsbsa_farm_parcels
                        SET
                            submission_id = $1,
                            updated_at = NOW()
                        WHERE id = $2
                    `,
          [recipientFarmer.id, farmParcelId],
        );

        await enforceRegisteredOwnerParcelState(
          client,
          farmParcelId,
          schemaCapabilities,
        );

        await ensureSingleCurrentHistory(client, {
          farmParcelId,
          submissionId: recipientFarmer.id,
          farmerName: recipientFarmer.name,
          farmerFfrsCode: recipientFarmer.ffrsCode,
          parcelNumber: donorParcel.parcelNumber,
          farmLocationBarangay: donorParcel.farmLocationBarangay,
          farmLocationMunicipality: donorParcel.farmLocationMunicipality,
          areaHa: donorParcel.totalFarmAreaHa,
          ownershipDocumentNo: donorParcel.ownershipDocumentNo,
          withinAncestralDomain: donorParcel.withinAncestralDomain,
          agrarianReformBeneficiary: donorParcel.agrarianReformBeneficiary,
          transferDate: normalizedTransferDate,
          changeType: "TRANSFER_IN",
          changeReason: normalizedReason,
          previousRecordId: previousHistoryId,
          notes: historyBaseNote,
        });

        await setCurrentHistoryOwnershipCategory(
          client,
          farmParcelId,
          "registeredOwner",
          schemaCapabilities,
        );

        fullParcelsTransferred += 1;
        processedItems.push({
          farmParcelId,
          transferredAreaHa: requestedAreaHa,
          remainingDonorAreaHa: 0,
          mode: "full",
        });
      } else {
        await client.query(
          `
                        UPDATE rsbsa_farm_parcels
                        SET
                            total_farm_area_ha = $1,
                            updated_at = NOW()
                        WHERE id = $2
                    `,
          [remainingAreaHa, farmParcelId],
        );

        await enforceRegisteredOwnerParcelState(
          client,
          farmParcelId,
          schemaCapabilities,
        );

        await ensureSingleCurrentHistory(client, {
          farmParcelId,
          submissionId: donorFarmer.id,
          farmerName: donorFarmer.name,
          farmerFfrsCode: donorFarmer.ffrsCode,
          parcelNumber: donorParcel.parcelNumber,
          farmLocationBarangay: donorParcel.farmLocationBarangay,
          farmLocationMunicipality: donorParcel.farmLocationMunicipality,
          areaHa: remainingAreaHa,
          ownershipDocumentNo: donorParcel.ownershipDocumentNo,
          withinAncestralDomain: donorParcel.withinAncestralDomain,
          agrarianReformBeneficiary: donorParcel.agrarianReformBeneficiary,
          transferDate: normalizedTransferDate,
          changeType: "TRANSFER_PARTIAL_RETAIN",
          changeReason: normalizedReason,
          previousRecordId: previousHistoryId,
          notes: `${historyBaseNote} | donor retains ${remainingAreaHa} ha`,
        });

        await setCurrentHistoryOwnershipCategory(
          client,
          farmParcelId,
          "registeredOwner",
          schemaCapabilities,
        );

        const recipientParcelNumber = await getNextParcelNumberForFarmer(
          client,
          recipientFarmer.id,
        );
        const recipientParcelResult = await client.query(
          `
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
                            ownership_others_specify,
                            created_at,
                            updated_at
                        ) VALUES (
                            $1, $2, $3, $4, $5,
                            $6, $7, $8,
                            TRUE, FALSE, FALSE, FALSE,
                            NULL, NULL, NULL, NULL, NULL,
                            NOW(), NOW()
                        )
                        RETURNING id
                    `,
          [
            recipientFarmer.id,
            recipientParcelNumber,
            donorParcel.farmLocationBarangay || null,
            donorParcel.farmLocationMunicipality || null,
            requestedAreaHa,
            donorParcel.withinAncestralDomain || null,
            donorParcel.ownershipDocumentNo || null,
            donorParcel.agrarianReformBeneficiary || null,
          ],
        );
        const recipientParcelId = Number(recipientParcelResult.rows[0].id);

        await enforceRegisteredOwnerParcelState(
          client,
          recipientParcelId,
          schemaCapabilities,
        );

        await ensureSingleCurrentHistory(client, {
          farmParcelId: recipientParcelId,
          submissionId: recipientFarmer.id,
          farmerName: recipientFarmer.name,
          farmerFfrsCode: recipientFarmer.ffrsCode,
          parcelNumber: recipientParcelNumber,
          farmLocationBarangay: donorParcel.farmLocationBarangay,
          farmLocationMunicipality: donorParcel.farmLocationMunicipality,
          areaHa: requestedAreaHa,
          ownershipDocumentNo: donorParcel.ownershipDocumentNo,
          withinAncestralDomain: donorParcel.withinAncestralDomain,
          agrarianReformBeneficiary: donorParcel.agrarianReformBeneficiary,
          transferDate: normalizedTransferDate,
          changeType: "TRANSFER_PARTIAL_IN",
          changeReason: normalizedReason,
          previousRecordId: previousHistoryId,
          notes: `${historyBaseNote} | recipient receives ${requestedAreaHa} ha`,
        });

        await setCurrentHistoryOwnershipCategory(
          client,
          recipientParcelId,
          "registeredOwner",
          schemaCapabilities,
        );

        partialParcelsTransferred += 1;
        processedItems.push({
          farmParcelId,
          recipientParcelId,
          transferredAreaHa: requestedAreaHa,
          remainingDonorAreaHa: remainingAreaHa,
          mode: "partial",
        });
      }

      totalTransferredAreaHa =
        Math.round((totalTransferredAreaHa + requestedAreaHa) * 100) / 100;
    }

    const donorSummary = await refreshFarmerOwnershipSummary(
      client,
      donorFarmer.id,
      schemaCapabilities,
    );
    const recipientSummary = await refreshFarmerOwnershipSummary(
      client,
      recipientFarmer.id,
      schemaCapabilities,
    );

    const transferRecordResult = await client.query(
      `
                INSERT INTO ownership_transfers (
                    from_farmer_id,
                    to_farmer_id,
                    transfer_date,
                    transfer_type,
                    transfer_reason,
                    documents,
                    notes,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())
                RETURNING id
            `,
      [
        donorFarmer.id,
        recipientFarmer.id,
        normalizedTransferDate,
        transferMode,
        normalizedReason,
        JSON.stringify(safeProofs),
        JSON.stringify({
          mode: transferMode,
          fullParcelsTransferred,
          partialParcelsTransferred,
          totalTransferredAreaHa,
          items: processedItems,
        }),
      ],
    );
    const transferId = Number(transferRecordResult.rows[0].id);

    await client.query("COMMIT");

    return res.json({
      success: true,
      transferId,
      message: "Ownership transfer confirmed.",
      transferMode,
      donor: donorSummary,
      recipient: recipientSummary,
      fullParcelsTransferred,
      partialParcelsTransferred,
      totalTransferredAreaHa,
      processedItems,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Transfer confirm error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to confirm ownership transfer.",
    });
  } finally {
    client.release();
  }
});

// ============================================================================
// TRANSFER OWNERSHIP API ENDPOINT
// ============================================================================

/**
 * POST /api/transfer-ownership
 * Transfers land ownership from one farmer to another (new or existing)
 */
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const schemaCapabilities = await getTransferSchemaCapabilities(client);

    const {
      oldOwnerId,
      selectedParcelIds,
      transferReason,
      transferDate,
      newOwnerOption,
      newOwnerId,
      newFarmerData,
    } = req.body;

    console.log("\n========================================");
    console.log("🔄 TRANSFER OWNERSHIP REQUEST");
    console.log("========================================");
    console.log("Request Body:", JSON.stringify(req.body, null, 2));
    console.log("Old Owner ID:", oldOwnerId);
    console.log("New Owner Option:", newOwnerOption);
    console.log("New Owner ID:", newOwnerId);
    console.log("Selected Parcel IDs:", selectedParcelIds);
    console.log("Transfer Reason:", transferReason);
    console.log("Transfer Date:", transferDate);

    const normalizedTransferDate = normalizeDateValue(transferDate);
    const normalizedOldOwnerId = parsePositiveInt(oldOwnerId);
    const normalizedSelectedParcelIds = Array.isArray(selectedParcelIds)
      ? selectedParcelIds
          .map((value) => parsePositiveInt(value))
          .filter((value) => value !== null)
      : [];

    // Validate required fields
    if (!normalizedOldOwnerId || !transferReason || !transferDate) {
      throw new Error(
        "Missing required fields: oldOwnerId, transferReason, or transferDate",
      );
    }

    if (normalizedSelectedParcelIds.length === 0) {
      throw new Error("At least one parcel must be selected for transfer");
    }

    let finalNewOwnerId = parsePositiveInt(newOwnerId);

    if (newOwnerOption !== "new" && !finalNewOwnerId) {
      throw new Error("A valid existing newOwnerId is required for transfer.");
    }

    // If creating a new farmer, insert into database
    if (newOwnerOption === "new") {
      if (!newFarmerData) {
        throw new Error(
          "New farmer data is required when creating a new owner",
        );
      }

      console.log("\n📝 Creating new farmer...");
      console.log("New Farmer Data:", JSON.stringify(newFarmerData, null, 2));

      // Generate FFRS code for new farmer
      const ffrsQuery = `
                SELECT COALESCE(MAX(CAST(SUBSTRING("FFRS_CODE" FROM 16) AS INTEGER)), 0) + 1 as next_number
                FROM rsbsa_submission
                WHERE "FFRS_CODE" LIKE '06-30-18-%'
            `;
      const ffrsResult = await client.query(ffrsQuery);
      const nextNumber = ffrsResult.rows[0].next_number;
      const barangayCode = "007"; // Default, you can map this based on barangay
      const newFfrsCode = `06-30-18-${barangayCode}-${String(nextNumber).padStart(6, "0")}`;

      console.log("Generated FFRS Code:", newFfrsCode);

      // Insert new farmer
      const insertQuery = `
                INSERT INTO rsbsa_submission (
                    "FIRST NAME",
                    "LAST NAME",
                    "MIDDLE NAME",
                    "EXT NAME",
                    "BARANGAY",
                    "MUNICIPALITY",
                    "BIRTHDATE",
                    "GENDER",
                    "FFRS_CODE",
                    "OWNERSHIP_TYPE_REGISTERED_OWNER",
                    status,
                    submitted_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, 'Active Farmer', CURRENT_TIMESTAMP)
                RETURNING id
            `;

      const insertResult = await client.query(insertQuery, [
        newFarmerData.firstName,
        newFarmerData.lastName,
        newFarmerData.middleName || null,
        newFarmerData.extensionName || null,
        newFarmerData.barangay,
        newFarmerData.municipality,
        newFarmerData.birthdate,
        newFarmerData.gender,
        newFfrsCode,
      ]);

      finalNewOwnerId = parsePositiveInt(insertResult.rows[0].id);
      if (!finalNewOwnerId) {
        throw new Error("Failed to create a valid new owner record.");
      }

      await setSubmissionOwnershipCategory(
        client,
        finalNewOwnerId,
        "registeredOwner",
        schemaCapabilities,
      );

      console.log("✅ New farmer created with ID:", finalNewOwnerId);
    } else {
      console.log("\n👤 Using existing farmer ID:", finalNewOwnerId);
    }

    // Check if all parcels of old owner are being transferred
    const allParcelsQuery = `
            SELECT COUNT(*) as total
            FROM rsbsa_farm_parcels
            WHERE submission_id = $1
        `;
    const allParcelsResult = await client.query(allParcelsQuery, [
      normalizedOldOwnerId,
    ]);
    const totalParcels = parseInt(allParcelsResult.rows[0].total);
    const transferringAllParcels =
      normalizedSelectedParcelIds.length >= totalParcels;

    console.log("\n📊 Parcel Analysis:");
    console.log("Total parcels owned by old owner:", totalParcels);
    console.log(
      "Parcels being transferred:",
      normalizedSelectedParcelIds.length,
    );
    console.log("Transferring all parcels?", transferringAllParcels);

    // Update old owner - mark as transferred only if all parcels are transferred
    if (transferringAllParcels) {
      console.log(
        "\n🔄 Updating old owner status (all parcels transferred)...",
      );
      const updateOldOwnerQuery = `
                UPDATE rsbsa_submission
                SET 
                    "OWNERSHIP_TYPE_REGISTERED_OWNER" = false,
                    status = 'No Parcels'
                WHERE id = $1
                RETURNING id, "FIRST NAME", "LAST NAME", status, "OWNERSHIP_TYPE_REGISTERED_OWNER"
            `;
      const oldOwnerUpdateResult = await client.query(updateOldOwnerQuery, [
        normalizedOldOwnerId,
      ]);
      console.log("✅ Old owner updated:", oldOwnerUpdateResult.rows[0]);

      await setSubmissionOwnershipCategory(
        client,
        normalizedOldOwnerId,
        "unknown",
        schemaCapabilities,
      );

      // Verify the update
      const verifyOldOwner = await client.query(
        `
                SELECT id, "FIRST NAME", "LAST NAME", status, "OWNERSHIP_TYPE_REGISTERED_OWNER"
                FROM rsbsa_submission WHERE id = $1
            `,
        [normalizedOldOwnerId],
      );
      console.log("🔍 Verification - Old owner in DB:", verifyOldOwner.rows[0]);
    } else {
      console.log(
        "\n⚠️ Old owner keeps remaining parcels - status stays Active Farmer",
      );
    }

    // Remove tenant/lessee status from new owner if they were tenant/lessee
    console.log("\n🔄 Updating new owner status...");
    const updateNewOwnerQuery = `
            UPDATE rsbsa_submission
            SET 
                "OWNERSHIP_TYPE_REGISTERED_OWNER" = true,
                "OWNERSHIP_TYPE_TENANT" = false,
                "OWNERSHIP_TYPE_LESSEE" = false,
                status = 'Active Farmer'
            WHERE id = $1
            RETURNING id, "FIRST NAME", "LAST NAME", status, 
                      "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE"
        `;
    const newOwnerUpdateResult = await client.query(updateNewOwnerQuery, [
      finalNewOwnerId,
    ]);
    console.log("✅ New owner updated:", newOwnerUpdateResult.rows[0]);

    await setSubmissionOwnershipCategory(
      client,
      finalNewOwnerId,
      "registeredOwner",
      schemaCapabilities,
    );

    // Get old owner's name for history records
    console.log("\n👤 Fetching owner names...");
    const oldOwnerResult = await client.query(
      `
            SELECT "FIRST NAME", "LAST NAME", "MIDDLE NAME" 
            FROM rsbsa_submission 
            WHERE id = $1
        `,
      [normalizedOldOwnerId],
    );

    const oldOwnerName = oldOwnerResult.rows[0]
      ? `${oldOwnerResult.rows[0]["LAST NAME"]}, ${oldOwnerResult.rows[0]["FIRST NAME"]} ${oldOwnerResult.rows[0]["MIDDLE NAME"] || ""}`.trim()
      : "Unknown";

    console.log("Old owner name:", oldOwnerName);

    // Get new owner's name
    const newOwnerResult = await client.query(
      `
            SELECT "FIRST NAME", "LAST NAME", "MIDDLE NAME" 
            FROM rsbsa_submission 
            WHERE id = $1
        `,
      [finalNewOwnerId],
    );

    const newOwnerName = newOwnerResult.rows[0]
      ? `${newOwnerResult.rows[0]["LAST NAME"]}, ${newOwnerResult.rows[0]["FIRST NAME"]} ${newOwnerResult.rows[0]["MIDDLE NAME"] || ""}`.trim()
      : "Unknown";

    console.log("New owner name:", newOwnerName);

    // Update only selected farm parcels
    console.log("\n🔄 Transferring parcels...");
    console.log(
      "Updating submission_id from",
      normalizedOldOwnerId,
      "to",
      finalNewOwnerId,
    );
    console.log("For parcel IDs:", normalizedSelectedParcelIds);

    const updateParcelsQuery = `
            UPDATE rsbsa_farm_parcels
            SET submission_id = $1
            WHERE id = ANY($2::int[])
            RETURNING id, parcel_number, farm_location_barangay, submission_id
        `;
    const parcelsUpdateResult = await client.query(updateParcelsQuery, [
      finalNewOwnerId,
      normalizedSelectedParcelIds,
    ]);
    await enforceRegisteredOwnerParcelState(
      client,
      normalizedSelectedParcelIds,
      schemaCapabilities,
    );
    for (const parcelId of normalizedSelectedParcelIds) {
      await setCurrentHistoryOwnershipCategory(
        client,
        parcelId,
        "registeredOwner",
        schemaCapabilities,
      );
    }

    const refreshedOldOwnerSummary = await refreshFarmerOwnershipSummary(
      client,
      normalizedOldOwnerId,
      schemaCapabilities,
    );
    const refreshedNewOwnerSummary = await refreshFarmerOwnershipSummary(
      client,
      finalNewOwnerId,
      schemaCapabilities,
    );

    console.log("🔄 Refreshed owner summaries:", {
      oldOwner: refreshedOldOwnerSummary,
      newOwner: refreshedNewOwnerSummary,
    });

    console.log(
      "✅ Parcels updated:",
      parcelsUpdateResult.rowCount,
      "rows affected",
    );
    console.log(
      "Updated parcels:",
      JSON.stringify(parcelsUpdateResult.rows, null, 2),
    );

    // Update tenant/lessee land owner names
    console.log("\n🔄 Updating tenant/lessee land owner names...");
    console.log(
      "Searching for ALL tenants with land_owner_name:",
      oldOwnerName,
    );

    const updateTenantsQuery = `
            UPDATE rsbsa_farm_parcels
            SET tenant_land_owner_name = $1
            WHERE tenant_land_owner_name = $2
              AND ownership_type_tenant = true
            RETURNING id, parcel_number, submission_id, tenant_land_owner_name
        `;
    const tenantsUpdateResult = await client.query(updateTenantsQuery, [
      newOwnerName,
      oldOwnerName,
    ]);
    console.log(
      "✅ Tenant land owner names updated:",
      tenantsUpdateResult.rowCount,
      "rows affected",
    );
    if (tenantsUpdateResult.rowCount > 0) {
      console.log(
        "Updated tenant parcels:",
        JSON.stringify(tenantsUpdateResult.rows, null, 2),
      );
    }

    console.log(
      "Searching for ALL lessees with land_owner_name:",
      oldOwnerName,
    );
    const updateLesseesQuery = `
            UPDATE rsbsa_farm_parcels
            SET lessee_land_owner_name = $1
            WHERE lessee_land_owner_name = $2
              AND ownership_type_lessee = true
            RETURNING id, parcel_number, submission_id, lessee_land_owner_name
        `;
    const lesseesUpdateResult = await client.query(updateLesseesQuery, [
      newOwnerName,
      oldOwnerName,
    ]);
    console.log(
      "✅ Lessee land owner names updated:",
      lesseesUpdateResult.rowCount,
      "rows affected",
    );
    if (lesseesUpdateResult.rowCount > 0) {
      console.log(
        "Updated lessee parcels:",
        JSON.stringify(lesseesUpdateResult.rows, null, 2),
      );
    }

    // Create ownership transfer history record
    console.log("\n📝 Creating ownership transfer history...");
    const createHistoryQuery = `
            INSERT INTO ownership_transfers (
                from_farmer_id,
                to_farmer_id,
                transfer_date,
                transfer_type,
                transfer_reason,
                notes,
                created_at
            ) VALUES ($1, $2, $3, 'ownership_change', $4, $5, NOW())
            RETURNING id
        `;

    try {
      const parcelInfo = `Transferred ${normalizedSelectedParcelIds.length} parcel(s): IDs ${normalizedSelectedParcelIds.join(", ")}`;
      const historyResult = await client.query(createHistoryQuery, [
        normalizedOldOwnerId,
        finalNewOwnerId,
        normalizedTransferDate,
        transferReason,
        parcelInfo,
      ]);
      console.log(
        `✅ History record created with ID: ${historyResult.rows[0].id}`,
      );
      console.log(
        `   Parcels transferred: ${normalizedSelectedParcelIds.join(", ")}`,
      );
    } catch (historyError) {
      console.log("⚠️ Could not create history record:", historyError.message);
      // Don't throw - history is optional, continue with transaction
    }

    await client.query("COMMIT");
    console.log("\n✅ TRANSACTION COMMITTED SUCCESSFULLY");
    console.log("========================================\n");

    res.json({
      success: true,
      message: "Ownership transferred successfully",
      oldOwnerId: normalizedOldOwnerId,
      newOwnerId: finalNewOwnerId,
      newOwnerName,
      parcelsTransferred: normalizedSelectedParcelIds.length,
      allParcelsTransferred: transferringAllParcels,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\n❌ ERROR IN TRANSFER OWNERSHIP:");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("========================================\n");
    res.status(500).json({
      error: "Failed to transfer ownership",
      message: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
