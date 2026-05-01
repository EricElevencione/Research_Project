const express = require("express");
const router = express.Router();

// Import database pool
const { createPool } = require("../config/db.cjs");
const pool = createPool();

const computeAgeFromDate = (value) => {
  if (!value) return null;
  const birth = new Date(value);
  if (!Number.isFinite(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
};

const toBooleanFlag = (value) => {
  if (value === true || value === 1 || value === "1") return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "t" || normalized === "yes";
  }
  return false;
};

const normalizeOwnershipCategory = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized) return "unknown";

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

const resolveOwnershipCategory = ({
  preferredCategory,
  registeredOwner,
  tenant,
  lessee,
}) => {
  const explicitCategory = normalizeOwnershipCategory(preferredCategory);
  if (explicitCategory !== "unknown") return explicitCategory;

  if (toBooleanFlag(registeredOwner)) return "registeredOwner";
  if (toBooleanFlag(tenant) || toBooleanFlag(lessee)) return "tenantLessee";
  return "unknown";
};

const buildOwnershipTypePayload = ({
  preferredCategory,
  registeredOwner,
  tenant,
  lessee,
}) => {
  const normalizedRegisteredOwner = toBooleanFlag(registeredOwner);
  const normalizedTenant = toBooleanFlag(tenant);
  const normalizedLessee = toBooleanFlag(lessee);
  const category = resolveOwnershipCategory({
    preferredCategory,
    registeredOwner: normalizedRegisteredOwner,
    tenant: normalizedTenant,
    lessee: normalizedLessee,
  });

  return {
    registeredOwner: normalizedRegisteredOwner,
    tenant: normalizedTenant,
    lessee: normalizedLessee,
    tenantLessee: normalizedTenant || normalizedLessee,
    category,
  };
};

const generateFallbackParcelNumber = (barangayInput) => {
  const barangayToken = String(barangayInput || "PARC")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
  const timeToken = Date.now().toString(36).toUpperCase();
  const randomToken = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${barangayToken || "PARC"}-${timeToken}-${randomToken}`;
};

/*
Purpose: Handles the submission of the final RSBSA form along with multiple farmland parcels. 
Validates data, calculates totals, and stores everything in the database.
Where: Used in backend API route '/api/rsbsa_submission' in server.cjs.
Description: This endpoint handles the submission of the final RSBSA form along with multiple farmland parcels. 
Validates data, calculates totals, and stores everything in the database.
*/

router.post("/", async (req, res) => {
  const { draftId, data } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const dependencyCheck = await client.query(`
      SELECT
        to_regclass('public.land_history') IS NOT NULL AS has_land_history,
        to_regclass('public.land_parcels') IS NOT NULL AS has_land_parcels,
        EXISTS (
          SELECT 1
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE p.proname = 'generate_parcel_number'
            AND n.nspname = 'public'
        ) AS has_generate_parcel_number,
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
            AND column_name = 'is_cultivating'
        ) AS has_is_cultivating_column,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'rsbsa_farm_parcels'
            AND column_name = 'cultivation_status_updated_at'
        ) AS has_cultivation_status_updated_at_column,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'rsbsa_farm_parcels'
            AND column_name = 'cultivation_status_reason'
        ) AS has_cultivation_status_reason_column,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'rsbsa_farm_parcels'
            AND column_name = 'cultivator_submission_id'
        ) AS has_cultivator_submission_id_column,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'land_history'
            AND column_name = 'ownership_category'
        ) AS has_land_history_ownership_category_column
    `);

    const hasLandHistoryTable =
      dependencyCheck.rows[0]?.has_land_history === true;
    const hasLandParcelsTable =
      dependencyCheck.rows[0]?.has_land_parcels === true;
    const hasGenerateParcelNumberFunction =
      dependencyCheck.rows[0]?.has_generate_parcel_number === true;
    const hasCurrentOwnerColumn =
      dependencyCheck.rows[0]?.has_current_owner_column === true;
    const hasSubmissionOwnershipCategoryColumn =
      dependencyCheck.rows[0]?.has_submission_ownership_category_column ===
      true;
    const hasParcelOwnershipCategoryColumn =
      dependencyCheck.rows[0]?.has_parcel_ownership_category_column === true;
    const hasIsCultivatingColumn =
      dependencyCheck.rows[0]?.has_is_cultivating_column === true;
    const hasCultivationStatusUpdatedAtColumn =
      dependencyCheck.rows[0]?.has_cultivation_status_updated_at_column ===
      true;
    const hasCultivationStatusReasonColumn =
      dependencyCheck.rows[0]?.has_cultivation_status_reason_column === true;
    const hasCultivatorSubmissionIdColumn =
      dependencyCheck.rows[0]?.has_cultivator_submission_id_column === true;
    const hasLandHistoryOwnershipCategoryColumn =
      dependencyCheck.rows[0]?.has_land_history_ownership_category_column ===
      true;

    console.log("Received RSBSA submission:", {
      draftId,
      data: {
        ...data,
        farmlandParcels: JSON.stringify(data.farmlandParcels, null, 2),
      },
    });

    const totalFarmArea = data.farmlandParcels
      ? data.farmlandParcels.reduce((total, parcel) => {
          const area = parseFloat(parcel.totalFarmAreaHa) || 0;
          return total + area;
        }, 0)
      : 0;

    // Derive FARM LOCATION from the first parcel, if available
    let farmLocation = "";
    if (data.farmlandParcels && data.farmlandParcels.length > 0) {
      const firstParcel = data.farmlandParcels[0];
      farmLocation =
        `${firstParcel.farmLocationBarangay || ""}, ${firstParcel.farmLocationMunicipality || ""}`.trim();
      if (farmLocation === ",") farmLocation = "";
    }

    // Validate ownership type
    if (data.farmlandParcels && data.farmlandParcels.length > 0) {
      const hasValidOwnershipType = data.farmlandParcels.some(
        (parcel) =>
          parcel.ownershipTypeRegisteredOwner ||
          parcel.ownershipTypeTenant ||
          parcel.ownershipTypeLessee,
      );
      if (!hasValidOwnershipType) {
        throw new Error(
          "At least one parcel must have a valid ownership type (Registered Owner, Tenant, or Lessee)",
        );
      }
    } else {
      throw new Error("At least one farmland parcel is required");
    }

    // Derive ownership types from the first parcel (or adjust logic as needed)
    const firstParcel =
      data.farmlandParcels && data.farmlandParcels.length > 0
        ? data.farmlandParcels[0]
        : {};
    const submissionOwnership = buildOwnershipTypePayload({
      preferredCategory:
        firstParcel.ownershipCategory || data.ownershipCategory || null,
      registeredOwner: firstParcel.ownershipTypeRegisteredOwner,
      tenant: firstParcel.ownershipTypeTenant,
      lessee: firstParcel.ownershipTypeLessee,
    });
    const ownershipTypeRegisteredOwner = submissionOwnership.registeredOwner;
    const ownershipTypeTenant = submissionOwnership.tenant;
    const ownershipTypeLessee = submissionOwnership.lessee;

    // Get all parcel areas and join them with commas
    const parcelAreasArray = data.farmlandParcels
      ? data.farmlandParcels
          .map((parcel) =>
            parcel.totalFarmAreaHa ? parseFloat(parcel.totalFarmAreaHa) : null,
          )
          .filter((area) => area !== null) // Remove null values
      : [];
    const parcelArea =
      parcelAreasArray.length > 0 ? parcelAreasArray.join(", ") : null;

    const genderValue = data.gender || data.sex || "";
    const birthdateValue = data.dateOfBirth || data.birthdate || null;

    const submissionInsertColumns = [
      '"LAST NAME"',
      '"FIRST NAME"',
      '"MIDDLE NAME"',
      '"EXT NAME"',
      '"GENDER"',
      '"BIRTHDATE"',
      '"BARANGAY"',
      '"MUNICIPALITY"',
      '"FARM LOCATION"',
      '"MAIN LIVELIHOOD"',
      '"OWNERSHIP_TYPE_REGISTERED_OWNER"',
      '"OWNERSHIP_TYPE_TENANT"',
      '"OWNERSHIP_TYPE_LESSEE"',
    ];

    const submissionValues = [
      data.surname || "",
      data.firstName || "",
      data.middleName || "",
      data.extensionName || "",
      genderValue,
      birthdateValue ? new Date(birthdateValue) : null,
      data.barangay || "",
      data.municipality || "",
      farmLocation,
      data.mainLivelihood || "",
      ownershipTypeRegisteredOwner,
      ownershipTypeTenant,
      ownershipTypeLessee,
    ];

    if (hasSubmissionOwnershipCategoryColumn) {
      submissionInsertColumns.push("ownership_category");
      submissionValues.push(submissionOwnership.category);
    }

    submissionInsertColumns.push("status");
    submissionValues.push("Active Farmer");

    const submissionInsertPlaceholders = submissionInsertColumns
      .map((_, index) => `$${index + 1}`)
      .join(", ");

    const insertSubmissionQuery = `
            INSERT INTO rsbsa_submission (
                ${submissionInsertColumns.join(", ")}
            ) VALUES (
                ${submissionInsertPlaceholders}
            )
            RETURNING id, submitted_at
        `;

    const submissionResult = await client.query(
      insertSubmissionQuery,
      submissionValues,
    );
    const submissionId = submissionResult.rows[0].id;
    const submittedAt = submissionResult.rows[0].submitted_at;

    if (data.farmlandParcels && data.farmlandParcels.length > 0) {
      const parcelInsertColumns = [
        "submission_id",
        "parcel_number",
        "farm_location_barangay",
        "farm_location_municipality",
        "total_farm_area_ha",
        "within_ancestral_domain",
        "ownership_document_no",
        "agrarian_reform_beneficiary",
        "ownership_type_registered_owner",
        "ownership_type_tenant",
        "ownership_type_lessee",
        "tenant_land_owner_name",
        "lessee_land_owner_name",
        "ownership_others_specify",
        "tenant_land_owner_id",
        "lessee_land_owner_id",
      ];

      if (hasParcelOwnershipCategoryColumn) {
        parcelInsertColumns.push("ownership_category");
      }

      if (hasCurrentOwnerColumn) {
        parcelInsertColumns.push("is_current_owner");
      }

      if (hasIsCultivatingColumn) {
        parcelInsertColumns.push("is_cultivating");
      }

      if (hasCultivationStatusUpdatedAtColumn) {
        parcelInsertColumns.push("cultivation_status_updated_at");
      }

      if (hasCultivationStatusReasonColumn) {
        parcelInsertColumns.push("cultivation_status_reason");
      }

      if (hasCultivatorSubmissionIdColumn) {
        parcelInsertColumns.push("cultivator_submission_id");
      }

      const parcelInsertPlaceholders = parcelInsertColumns
        .map((_, index) => `$${index + 1}`)
        .join(", ");

      const parcelInsertQuery = `
                INSERT INTO rsbsa_farm_parcels (
                    ${parcelInsertColumns.join(", ")}
                ) VALUES (
                    ${parcelInsertPlaceholders}
                )
                RETURNING id
            `;

      const selectedLandOwnerIdRaw = Number(data?.selectedLandOwner?.id);
      const selectedLandOwnerId = Number.isFinite(selectedLandOwnerIdRaw)
        ? selectedLandOwnerIdRaw
        : null;
      const registrantName =
        `${data.firstName || ""} ${data.middleName || ""} ${data.surname || data.lastName || ""}`.trim() ||
        `Submission ${submissionId}`;

      for (let parcel of data.farmlandParcels) {
        try {
          // For ownership transfers, fetch missing data from the existing parcel
          // NOTE: existingParcelId is rsbsa_farm_parcels.id (NOT land_parcels.id)
          if (
            hasLandHistoryTable &&
            parcel.existingParcelId &&
            (!parcel.farmLocationBarangay || !parcel.totalFarmAreaHa)
          ) {
            console.log(
              `📋 Fetching existing parcel data for ownership transfer (farm_parcel_id: ${parcel.existingParcelId})`,
            );
            const existingParcelQuery = `
                            SELECT farm_location_barangay, farm_location_municipality, total_farm_area_ha, parcel_number
                            FROM land_history 
                            WHERE (farm_parcel_id = $1 OR (parcel_number = $2 AND farm_parcel_id IS NULL))
                                  AND is_current = TRUE
                            LIMIT 1
                        `;
            const existingData = await client.query(existingParcelQuery, [
              parcel.existingParcelId,
              parcel.existingParcelNumber || "",
            ]);
            if (existingData.rows.length > 0) {
              const existing = existingData.rows[0];
              parcel.farmLocationBarangay =
                parcel.farmLocationBarangay ||
                existing.farm_location_barangay ||
                "";
              parcel.farmLocationMunicipality =
                parcel.farmLocationMunicipality ||
                existing.farm_location_municipality ||
                "Dumangas";
              parcel.totalFarmAreaHa =
                parcel.totalFarmAreaHa || existing.total_farm_area_ha || 0;
              parcel.existingParcelNumber =
                parcel.existingParcelNumber || existing.parcel_number;
              console.log(
                `✅ Fetched existing data: ${parcel.farmLocationBarangay}, ${parcel.totalFarmAreaHa} ha`,
              );
            }
          }

          if (!parcel.farmLocationBarangay || !parcel.totalFarmAreaHa) {
            console.warn(
              "Skipping parcel due to missing required fields:",
              parcel,
            );
            continue;
          }
          const area = parseFloat(parcel.totalFarmAreaHa);
          if (isNaN(area)) throw new Error("Invalid totalFarmAreaHa");

          const isNewTenant = parcel.ownershipTypeTenant === true;
          const isNewLessee = parcel.ownershipTypeLessee === true;
          const isNewRegisteredOwner =
            parcel.ownershipTypeRegisteredOwner === true ||
            (!isNewTenant && !isNewLessee);
          const parcelOwnership = buildOwnershipTypePayload({
            preferredCategory:
              parcel.ownershipCategory || data.ownershipCategory || null,
            registeredOwner: isNewRegisteredOwner,
            tenant: isNewTenant,
            lessee: isNewLessee,
          });
          const isOwnershipTransfer =
            isNewRegisteredOwner && !isNewTenant && !isNewLessee;
          const isAssociationRole =
            !isNewRegisteredOwner && (isNewTenant || isNewLessee);

          const isCultivating =
            parcel.isCultivating === undefined || parcel.isCultivating === null
              ? true
              : toBooleanFlag(parcel.isCultivating);
          const cultivationStatusUpdatedAt =
            parcel.cultivationStatusUpdatedAt || new Date().toISOString();
          const cultivationStatusReason =
            parcel.cultivationStatusReason || null;
          const parsedCultivatorId = parcel.cultivatorSubmissionId
            ? Number(parcel.cultivatorSubmissionId)
            : null;
          const cultivatorSubmissionId = Number.isFinite(parsedCultivatorId)
            ? parsedCultivatorId
            : isCultivating
              ? submissionId
              : null;
          const effectiveCultivationStatusReason =
            isAssociationRole && !cultivationStatusReason
              ? `${isNewTenant && isNewLessee ? "Cultivated by tenant/lessee" : isNewTenant ? "Cultivated by tenant" : "Cultivated by lessee"}: ${registrantName}`
              : cultivationStatusReason;

          // Try to resolve land owner IDs from names if provided
          let tenantLandOwnerId = parcel.tenantLandOwnerId || null;
          let lesseeLandOwnerId = parcel.lesseeLandOwnerId || null;

          // If tenant land owner name is provided but no ID, try to find the farmer
          if (parcel.tenantLandOwnerName && !tenantLandOwnerId) {
            const findOwnerQuery = `
                            SELECT id FROM rsbsa_submission 
                            WHERE LOWER(TRIM(CONCAT_WS(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME"))) = LOWER(TRIM($1))
                            LIMIT 1
                        `;
            const ownerResult = await client.query(findOwnerQuery, [
              parcel.tenantLandOwnerName,
            ]);
            if (ownerResult.rows.length > 0) {
              tenantLandOwnerId = ownerResult.rows[0].id;
            }
          }

          // If lessee land owner name is provided but no ID, try to find the farmer
          if (parcel.lesseeLandOwnerName && !lesseeLandOwnerId) {
            const findOwnerQuery = `
                            SELECT id FROM rsbsa_submission 
                            WHERE LOWER(TRIM(CONCAT_WS(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME"))) = LOWER(TRIM($1))
                            LIMIT 1
                        `;
            const ownerResult = await client.query(findOwnerQuery, [
              parcel.lesseeLandOwnerName,
            ]);
            if (ownerResult.rows.length > 0) {
              lesseeLandOwnerId = ownerResult.rows[0].id;
            }
          }

          // Use existingParcelNumber for ownership transfers, otherwise generate proper parcel number
          // NOTE: parcel.parcelNo is just a form index ("1", "2", "3") — NOT a real parcel identifier
          let parcelNumber = parcel.existingParcelNumber || null;

          // If no parcel number exists, generate one using the database function
          if (!parcelNumber) {
            const barangayName =
              parcel.farmLocationBarangay || data.barangay || "UNKNOWN";
            if (hasGenerateParcelNumberFunction) {
              const genResult = await client.query(
                "SELECT generate_parcel_number($1) AS parcel_number",
                [barangayName],
              );
              parcelNumber = genResult.rows[0].parcel_number;
            } else {
              parcelNumber = generateFallbackParcelNumber(barangayName);
            }
            console.log(
              `🔢 Generated parcel number: ${parcelNumber} for barangay: ${barangayName}`,
            );
          }

          const parcelInsertValues = [
            submissionId,
            parcelNumber,
            parcel.farmLocationBarangay || "",
            parcel.farmLocationMunicipality || "",
            area,
            parcel.withinAncestralDomain === "Yes" ? "Yes" : "No", // Fixed: Must be 'Yes' or 'No' string
            parcel.ownershipDocumentNo || "",
            parcel.agrarianReformBeneficiary === "Yes" ? "Yes" : "No", // Fixed: Must be 'Yes' or 'No' string
            isNewRegisteredOwner,
            isNewTenant,
            isNewLessee,
            parcel.tenantLandOwnerName || "",
            parcel.lesseeLandOwnerName || "",
            parcel.ownershipOthersSpecify || "",
            tenantLandOwnerId,
            lesseeLandOwnerId,
          ];

          if (hasParcelOwnershipCategoryColumn) {
            parcelInsertValues.push(parcelOwnership.category);
          }

          if (hasCurrentOwnerColumn) {
            parcelInsertValues.push(isNewRegisteredOwner);
          }

          if (hasIsCultivatingColumn) {
            parcelInsertValues.push(isCultivating);
          }

          if (hasCultivationStatusUpdatedAtColumn) {
            parcelInsertValues.push(cultivationStatusUpdatedAt);
          }

          if (hasCultivationStatusReasonColumn) {
            parcelInsertValues.push(effectiveCultivationStatusReason);
          }

          if (hasCultivatorSubmissionIdColumn) {
            parcelInsertValues.push(cultivatorSubmissionId);
          }

          const parcelResult = await client.query(
            parcelInsertQuery,
            parcelInsertValues,
          );

          const newFarmParcelId = parcelResult.rows[0].id;

          if (
            isAssociationRole &&
            selectedLandOwnerId !== null &&
            parcelNumber &&
            (hasIsCultivatingColumn ||
              hasCultivationStatusUpdatedAtColumn ||
              hasCultivationStatusReasonColumn ||
              hasCultivatorSubmissionIdColumn)
          ) {
            const ownerParcelUpdateFields = [];
            const ownerParcelUpdateValues = [];
            let ownerParamIndex = 1;

            if (hasIsCultivatingColumn) {
              ownerParcelUpdateFields.push(
                `is_cultivating = $${ownerParamIndex}`,
              );
              ownerParcelUpdateValues.push(false);
              ownerParamIndex += 1;
            }

            if (hasCultivationStatusUpdatedAtColumn) {
              ownerParcelUpdateFields.push(
                `cultivation_status_updated_at = COALESCE($${ownerParamIndex}::timestamptz, NOW())`,
              );
              ownerParcelUpdateValues.push(cultivationStatusUpdatedAt || null);
              ownerParamIndex += 1;
            }

            if (hasCultivationStatusReasonColumn) {
              ownerParcelUpdateFields.push(
                `cultivation_status_reason = $${ownerParamIndex}`,
              );
              ownerParcelUpdateValues.push(effectiveCultivationStatusReason);
              ownerParamIndex += 1;
            }

            if (hasCultivatorSubmissionIdColumn) {
              ownerParcelUpdateFields.push(
                `cultivator_submission_id = $${ownerParamIndex}`,
              );
              ownerParcelUpdateValues.push(submissionId);
              ownerParamIndex += 1;
            }

            ownerParcelUpdateFields.push("updated_at = NOW()");
            ownerParcelUpdateValues.push(selectedLandOwnerId);
            const ownerSubmissionParam = ownerParamIndex;
            ownerParamIndex += 1;
            ownerParcelUpdateValues.push(parcelNumber);
            const ownerParcelNumberParam = ownerParamIndex;
            const currentOwnerFilter = hasCurrentOwnerColumn
              ? "AND (is_current_owner IS NULL OR is_current_owner = TRUE)"
              : "";

            const ownerParcelUpdateResult = await client.query(
              `
                UPDATE rsbsa_farm_parcels
                SET ${ownerParcelUpdateFields.join(", ")}
                WHERE submission_id = $${ownerSubmissionParam}
                  AND parcel_number = $${ownerParcelNumberParam}
                  AND ownership_type_registered_owner = TRUE
                  ${currentOwnerFilter}
              `,
              ownerParcelUpdateValues,
            );

            if (ownerParcelUpdateResult.rowCount === 0) {
              console.warn(
                `No owner parcel row updated for owner=${selectedLandOwnerId}, parcel=${parcelNumber}`,
              );
            }
          }

          const canWriteLandHistory =
            hasLandHistoryTable && hasLandParcelsTable;
          if (!canWriteLandHistory) {
            console.warn(
              "Skipping land_history/land_parcels writes: required tables are not available in this environment.",
            );
            continue;
          }

          // Handle ownership transfer: create land_history record if existingParcelId is provided
          // NOTE: existingParcelId = rsbsa_farm_parcels.id, NOT land_parcels.id
          if (parcel.existingParcelId) {
            console.log(
              `📝 Processing ownership transfer for farm_parcel_id: ${parcel.existingParcelId}`,
            );

            // Look up the land_history record using farm_parcel_id (rsbsa_farm_parcels.id)
            // Fallback: also try matching by parcel_number for older records where farm_parcel_id may be NULL
            const getLandParcelQuery = `
                            SELECT lh.id as history_id, lh.land_parcel_id, lh.farmer_id, lh.farmer_name,
                                   lh.land_owner_id, lh.land_owner_name
                            FROM land_history lh
                            WHERE (lh.farm_parcel_id = $1 OR (lh.parcel_number = $2 AND lh.farm_parcel_id IS NULL))
                                  AND lh.is_current = TRUE
                            ORDER BY lh.is_registered_owner DESC, lh.farm_parcel_id IS NOT NULL DESC, lh.created_at DESC
                            LIMIT 1
                        `;
            const landParcelResult = await client.query(getLandParcelQuery, [
              parcel.existingParcelId,
              parcelNumber,
            ]);

            if (landParcelResult.rows.length > 0) {
              const {
                history_id,
                land_parcel_id,
                farmer_id: prev_farmer_id,
                farmer_name: prev_farmer_name,
              } = landParcelResult.rows[0];

              // Ownership transfers close previous current holder rows.
              // Association (tenant/lessee) rows should not close legal owner records.
              if (isOwnershipTransfer) {
                await client.query(
                  `
                                    UPDATE land_history 
                                    SET is_current = FALSE, period_end_date = NOW(), updated_at = NOW()
                                    WHERE land_parcel_id = $1 AND is_current = TRUE
                                `,
                  [land_parcel_id],
                );
              }

              // Create new land_history record for the new owner
              const newOwnerName =
                `${data.firstName || ""} ${data.middleName || ""} ${data.surname || ""}`.trim();
              const nextChangeType = isAssociationRole
                ? isNewTenant && isNewLessee
                  ? "ASSOCIATION_CHANGE"
                  : isNewTenant
                    ? "TENANT_CHANGE"
                    : "LESSEE_CHANGE"
                : "TRANSFER";
              const nextChangeReason = isAssociationRole
                ? `${isNewTenant && isNewLessee ? "Tenant/Lessee" : isNewTenant ? "Tenant" : "Lessee"} association under ${prev_farmer_name || "land owner"}`
                : `Ownership transfer from ${prev_farmer_name} to ${newOwnerName}`;
              const historyOwnershipCategoryColumn =
                hasLandHistoryOwnershipCategoryColumn
                  ? ", ownership_category"
                  : "";
              const historyOwnershipCategoryValue =
                hasLandHistoryOwnershipCategoryColumn ? ", $17" : "";
              const historyValues = [
                land_parcel_id,
                newFarmParcelId,
                submissionId,
                newOwnerName,
                parcelNumber,
                parcel.farmLocationBarangay || "",
                parcel.farmLocationMunicipality || "Dumangas",
                area,
                isNewRegisteredOwner,
                isNewTenant,
                isNewLessee,
                isNewRegisteredOwner ? submissionId : prev_farmer_id,
                isNewRegisteredOwner ? newOwnerName : prev_farmer_name,
                nextChangeType,
                nextChangeReason,
                history_id,
              ];

              if (hasLandHistoryOwnershipCategoryColumn) {
                historyValues.push(parcelOwnership.category);
              }

              await client.query(
                `
                                INSERT INTO land_history (
                                    land_parcel_id, farm_parcel_id, farmer_id, farmer_name,
                                    parcel_number, farm_location_barangay, farm_location_municipality,
                                    total_farm_area_ha, is_registered_owner, is_tenant, is_lessee,
                                    land_owner_id, land_owner_name,
                                    is_current, period_start_date, change_type, change_reason,
                                    previous_history_id${historyOwnershipCategoryColumn}, created_at
                                ) VALUES (
                                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                                    TRUE, NOW(), $14, $15, $16${historyOwnershipCategoryValue}, NOW()
                                )
                            `,
                historyValues,
              );

              if (
                isOwnershipTransfer &&
                prev_farmer_id &&
                hasCurrentOwnerColumn
              ) {
                await client.query(
                  `
                                    UPDATE rsbsa_farm_parcels
                                    SET is_current_owner = FALSE,
                                        updated_at = NOW()
                                    WHERE submission_id = $1
                                      AND parcel_number = $2
                                      AND ownership_type_registered_owner = TRUE
                                      AND (is_current_owner IS NULL OR is_current_owner = TRUE)
                                `,
                  [prev_farmer_id, parcelNumber],
                );
              }

              console.log(
                `✅ Land history recorded: ${nextChangeType} (${prev_farmer_name} -> ${newOwnerName})`,
              );
            } else {
              // No existing land_history found — look up land_parcel_id by parcel_number,
              // or create a new land_parcels entry
              const newOwnerName =
                `${data.firstName || ""} ${data.middleName || ""} ${data.surname || ""}`.trim();
              const nextChangeType = isAssociationRole
                ? isNewTenant && isNewLessee
                  ? "ASSOCIATION_CHANGE"
                  : isNewTenant
                    ? "TENANT_CHANGE"
                    : "LESSEE_CHANGE"
                : "TRANSFER";
              const nextChangeReason = isAssociationRole
                ? `${isNewTenant && isNewLessee ? "Tenant/Lessee" : isNewTenant ? "Tenant" : "Lessee"} association registration`
                : "Ownership transfer during parcel registration";
              const fallbackHistoryOwnershipCategoryColumn =
                hasLandHistoryOwnershipCategoryColumn
                  ? ", ownership_category"
                  : "";
              const fallbackHistoryOwnershipCategoryValue =
                hasLandHistoryOwnershipCategoryColumn ? ", $14" : "";

              // Try to find or create the land_parcels entry
              const findOrCreateLandParcel = `
                                INSERT INTO land_parcels (
                                    parcel_number, farm_location_barangay, farm_location_municipality,
                                    total_farm_area_ha, is_active, created_at
                                ) VALUES ($1, $2, $3, $4, TRUE, NOW())
                                ON CONFLICT (parcel_number) DO UPDATE SET updated_at = NOW()
                                RETURNING id
                            `;
              const lpResult = await client.query(findOrCreateLandParcel, [
                parcelNumber,
                parcel.farmLocationBarangay || "",
                parcel.farmLocationMunicipality || "Dumangas",
                area,
              ]);
              const resolvedLandParcelId = lpResult.rows[0].id;

              await client.query(
                `
                                INSERT INTO land_history (
                                    land_parcel_id, farm_parcel_id, farmer_id, farmer_name,
                                    parcel_number, farm_location_barangay, farm_location_municipality,
                                    total_farm_area_ha, is_registered_owner, is_tenant, is_lessee,
                                    is_current, period_start_date, change_type, change_reason${fallbackHistoryOwnershipCategoryColumn}, created_at
                                ) VALUES (
                                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, NOW(), $12, $13${fallbackHistoryOwnershipCategoryValue}, NOW()
                                )
                            `,
                (() => {
                  const values = [
                    resolvedLandParcelId,
                    newFarmParcelId,
                    submissionId,
                    newOwnerName,
                    parcelNumber,
                    parcel.farmLocationBarangay || "",
                    parcel.farmLocationMunicipality || "Dumangas",
                    area,
                    isNewRegisteredOwner,
                    isNewTenant,
                    isNewLessee,
                    nextChangeType,
                    nextChangeReason,
                  ];

                  if (hasLandHistoryOwnershipCategoryColumn) {
                    values.push(parcelOwnership.category);
                  }

                  return values;
                })(),
              );
              console.log(
                `✅ New land_history created for parcel ${parcelNumber} (${nextChangeType})`,
              );
            }
          } else {
            // NEW PARCEL (not a transfer) — create land_parcels + land_history records
            // so this farmer's parcel is searchable and visible in Land Registry
            const newOwnerName =
              `${data.firstName || ""} ${data.middleName || ""} ${data.surname || ""}`.trim();
            const newParcelChangeType = isAssociationRole
              ? isNewTenant && isNewLessee
                ? "ASSOCIATION_CHANGE"
                : isNewTenant
                  ? "TENANT_CHANGE"
                  : "LESSEE_CHANGE"
              : "INITIAL_REGISTRATION";
            const newParcelChangeReason = isAssociationRole
              ? `${isNewTenant && isNewLessee ? "Tenant/Lessee" : isNewTenant ? "Tenant" : "Lessee"} association registration`
              : "Initial RSBSA registration";
            const newParcelHistoryOwnershipCategoryColumn =
              hasLandHistoryOwnershipCategoryColumn
                ? ", ownership_category"
                : "";
            const newParcelHistoryOwnershipCategoryValue =
              hasLandHistoryOwnershipCategoryColumn ? ", $14" : "";

            // Create the land_parcels entry (master registry of physical parcels)
            const createLandParcelQuery = `
                            INSERT INTO land_parcels (
                                parcel_number, farm_location_barangay, farm_location_municipality,
                                total_farm_area_ha, is_active, created_at
                            ) VALUES ($1, $2, $3, $4, TRUE, NOW())
                            ON CONFLICT (parcel_number) DO UPDATE SET updated_at = NOW()
                            RETURNING id
                        `;
            const landParcelRes = await client.query(createLandParcelQuery, [
              parcelNumber,
              parcel.farmLocationBarangay || "",
              parcel.farmLocationMunicipality || "Dumangas",
              area,
            ]);
            const newLandParcelId = landParcelRes.rows[0].id;

            // Create the land_history entry (ownership timeline)
            await client.query(
              `
                            INSERT INTO land_history (
                                land_parcel_id, farm_parcel_id, farmer_id, farmer_name,
                                parcel_number, farm_location_barangay, farm_location_municipality,
                                total_farm_area_ha, is_registered_owner, is_tenant, is_lessee,
                                is_current, change_type, change_reason${newParcelHistoryOwnershipCategoryColumn}, period_start_date, created_at
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12, $13${newParcelHistoryOwnershipCategoryValue}, NOW(), NOW()
                            )
                        `,
              (() => {
                const values = [
                  newLandParcelId,
                  newFarmParcelId,
                  submissionId,
                  newOwnerName,
                  parcelNumber,
                  parcel.farmLocationBarangay || "",
                  parcel.farmLocationMunicipality || "Dumangas",
                  area,
                  isNewRegisteredOwner,
                  isNewTenant,
                  isNewLessee,
                  newParcelChangeType,
                  newParcelChangeReason,
                ];

                if (hasLandHistoryOwnershipCategoryColumn) {
                  values.push(parcelOwnership.category);
                }

                return values;
              })(),
            );
            console.log(
              `✅ New land_parcels + land_history created for parcel ${parcelNumber} (owner: ${newOwnerName})`,
            );
          }
        } catch (err) {
          console.error("Error inserting parcel:", err, "Parcel data:", parcel);
          throw err;
        }
      }
    }

    await client.query("COMMIT");
    // console.log(`RSBSA form submitted successfully with ${data.farmlandParcels.length} parcels for farmer: ${data.firstName} ${data.surname}`);
    res.status(201).json({
      message: "RSBSA form submitted successfully!",
      submissionId: submissionId,
      submittedAt: submittedAt,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error submitting RSBSA form:", error);
    res.status(400).json({
      message: "Error submitting RSBSA form",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

// ============================================================================
// GET /:id/parcels - Get farm parcels for a specific submission
// ============================================================================
/*
Purpose: Fetches farm parcels for a specific RSBSA submission
Where: GET /api/rsbsa_submission/:id/parcels
Description: Returns all farm parcels associated with a submission ID
*/
router.get("/:id/parcels", async (req, res) => {
  try {
    const submissionId = req.params.id;
    // console.log(`Fetching farm parcels for submission ID: ${submissionId}`);

    const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'rsbsa_farm_parcels'
            );
        `);

    if (!tableCheck.rows[0].exists) {
      console.log("rsbsa_farm_parcels table does not exist");
      return res.status(500).json({
        message: "Database error: rsbsa_farm_parcels table not found",
      });
    }

    const parcelOwnershipCategoryColumnCheck = await pool.query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'rsbsa_farm_parcels'
                  AND column_name = 'ownership_category'
            ) AS exists
        `);
    const hasParcelOwnershipCategoryColumn =
      parcelOwnershipCategoryColumnCheck.rows?.[0]?.exists === true;
    const ownershipCategorySelect = hasParcelOwnershipCategoryColumn
      ? "fp.ownership_category,\n                "
      : "";

    const query = `
            SELECT 
                fp.id,
                fp.submission_id,
                fp.parcel_number,
                fp.farm_location_barangay,
                fp.farm_location_municipality,
                fp.total_farm_area_ha,
                fp.within_ancestral_domain,
                fp.ownership_document_no,
                fp.agrarian_reform_beneficiary,
                fp.ownership_type_registered_owner,
                fp.ownership_type_tenant,
                fp.ownership_type_lessee,
                ${ownershipCategorySelect}
                fp.tenant_land_owner_name,
                fp.lessee_land_owner_name,
                fp.ownership_others_specify,
                fp.tenant_land_owner_id,
                fp.lessee_land_owner_id,
                -- Get linked land owner names from foreign key relationship
                CONCAT_WS(' ', tlo."FIRST NAME", tlo."MIDDLE NAME", tlo."LAST NAME") AS tenant_land_owner_linked_name,
                CONCAT_WS(' ', llo."FIRST NAME", llo."MIDDLE NAME", llo."LAST NAME") AS lessee_land_owner_linked_name,
                fp.created_at,
                fp.updated_at
            FROM rsbsa_farm_parcels fp
            LEFT JOIN rsbsa_submission tlo ON fp.tenant_land_owner_id = tlo.id
            LEFT JOIN rsbsa_submission llo ON fp.lessee_land_owner_id = llo.id
            WHERE fp.submission_id = $1
            ORDER BY fp.parcel_number
        `;

    const result = await pool.query(query, [submissionId]);
    console.log(
      `Found ${result.rows.length} farm parcels for submission ${submissionId}`,
    );

    const parcels = result.rows.map((row) => {
      const ownershipType = buildOwnershipTypePayload({
        preferredCategory: row.ownership_category,
        registeredOwner: row.ownership_type_registered_owner,
        tenant: row.ownership_type_tenant,
        lessee: row.ownership_type_lessee,
      });

      return {
        ...row,
        ownership_category: ownershipType.category,
      };
    });

    res.json(parcels);
  } catch (error) {
    console.error("Error fetching farm parcels:", error);
    res
      .status(500)
      .json({ message: "Error fetching farm parcels", error: error.message });
  }
});

// ============================================================================
// GET /farm_parcels - Get all farm parcels with farmer details
// ============================================================================
/*
Purpose: Fetches all farm parcels along with associated farmer details
Where: GET /api/rsbsa_submission/farm_parcels
Description: Returns all parcels with farmer information via JOIN
*/
router.get("/farm_parcels", async (req, res) => {
  try {
    console.log("Fetching all farm parcels...");

    const parcelOwnershipCategoryColumnCheck = await pool.query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'rsbsa_farm_parcels'
                  AND column_name = 'ownership_category'
            ) AS exists
        `);
    const hasParcelOwnershipCategoryColumn =
      parcelOwnershipCategoryColumnCheck.rows?.[0]?.exists === true;
    const ownershipCategorySelect = hasParcelOwnershipCategoryColumn
      ? "fp.ownership_category,\n                "
      : "";

    const query = `
            SELECT 
                fp.id,
                fp.submission_id,
                fp.parcel_number,
                fp.farm_location_barangay,
                fp.farm_location_municipality,
                fp.total_farm_area_ha,
                fp.within_ancestral_domain,
                fp.ownership_document_no,
                fp.agrarian_reform_beneficiary,
                fp.ownership_type_registered_owner,
                fp.ownership_type_tenant,
                fp.ownership_type_lessee,
                ${ownershipCategorySelect}
                fp.ownership_type_others,
                fp.tenant_land_owner_name,
                fp.lessee_land_owner_name,
                fp.tenant_land_owner_id,
                fp.lessee_land_owner_id,
                -- Get linked land owner names from foreign key relationship
                CONCAT_WS(' ', tlo."FIRST NAME", tlo."MIDDLE NAME", tlo."LAST NAME") AS tenant_land_owner_linked_name,
                CONCAT_WS(' ', llo."FIRST NAME", llo."MIDDLE NAME", llo."LAST NAME") AS lessee_land_owner_linked_name,
                fp.ownership_others_specify,
                fp.created_at,
                fp.updated_at,
                rs."LAST NAME",
                rs."FIRST NAME",
                rs."MIDDLE NAME"
            FROM rsbsa_farm_parcels fp
            JOIN rsbsa_submission rs ON fp.submission_id = rs.id
            LEFT JOIN rsbsa_submission tlo ON fp.tenant_land_owner_id = tlo.id
            LEFT JOIN rsbsa_submission llo ON fp.lessee_land_owner_id = llo.id
            ORDER BY fp.submission_id, fp.parcel_number
        `;

    const result = await pool.query(query);
    console.log(`Found ${result.rows.length} farm parcels`);

    const parcels = result.rows.map((row) => {
      const ownershipType = buildOwnershipTypePayload({
        preferredCategory: row.ownership_category,
        registeredOwner: row.ownership_type_registered_owner,
        tenant: row.ownership_type_tenant,
        lessee: row.ownership_type_lessee,
      });

      return {
        ...row,
        ownership_category: ownershipType.category,
      };
    });

    res.json(parcels);
  } catch (error) {
    console.error("Error fetching farm parcels:", error);
    res
      .status(500)
      .json({ message: "Error fetching farm parcels", error: error.message });
  }
});

// ============================================================================
// GET / - Fetch all RSBSA submissions for masterlist
// ============================================================================
router.get("/", async (req, res) => {
  try {
    // Check for optional columns that may not exist in all database versions
    const columnCheckQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'rsbsa_submission' 
            ORDER BY ordinal_position
        `;
    const columnResult = await pool.query(columnCheckQuery);
    const availableColumns = new Set(
      columnResult.rows.map((row) => String(row.column_name || "")),
    );
    const hasOwnershipColumns = columnResult.rows.some(
      (row) =>
        row.column_name === "OWNERSHIP_TYPE_REGISTERED_OWNER" ||
        row.column_name === "ownership_type_registered_owner",
    );
    const hasOwnershipCategoryColumn =
      availableColumns.has("ownership_category");
    const hasFFRSCode = columnResult.rows.some(
      (row) =>
        row.column_name === "FFRS_CODE" || row.column_name === "ffrs_code",
    );
    const farmLocationSelect = availableColumns.has("FARM LOCATION")
      ? 'rs."FARM LOCATION" AS "FARM_LOCATION"'
      : availableColumns.has("FARM_LOCATION")
        ? 'rs."FARM_LOCATION" AS "FARM_LOCATION"'
        : 'NULL::TEXT AS "FARM_LOCATION"';

    const ownershipFields = hasOwnershipColumns
      ? `,
            rs."OWNERSHIP_TYPE_REGISTERED_OWNER",
            rs."OWNERSHIP_TYPE_TENANT",
            rs."OWNERSHIP_TYPE_LESSEE"`
      : "";

    const ffrsField = hasFFRSCode ? ', rs."FFRS_CODE"' : "";
    const ownershipCategoryField = hasOwnershipCategoryColumn
      ? ", rs.ownership_category"
      : "";

    const query = `
            SELECT 
                rs.id,
                rs."LAST NAME",
                rs."FIRST NAME",
                rs."MIDDLE NAME",
                rs."EXT NAME",
                rs."GENDER",
                rs."BIRTHDATE",
                rs."BARANGAY",
                rs."MUNICIPALITY",
                ${farmLocationSelect},
                COALESCE(fp_sum.total_area, 0)::TEXT AS "PARCEL AREA",
                COALESCE(fp_sum.total_area, 0) AS "TOTAL FARM AREA",
                rs."MAIN LIVELIHOOD",
                rs.status,
                rs.submitted_at,
                rs.created_at,
                rs.updated_at,
                COALESCE(fp_count.parcel_count, 0) AS parcel_count
                ${ownershipCategoryField}
                ${ownershipFields}
                ${ffrsField}
            FROM rsbsa_submission rs
            LEFT JOIN (
                SELECT submission_id, SUM(total_farm_area_ha) AS total_area
                FROM rsbsa_farm_parcels
                GROUP BY submission_id
            ) fp_sum ON fp_sum.submission_id = rs.id
            LEFT JOIN (
                SELECT submission_id, COUNT(*) AS parcel_count
                FROM rsbsa_farm_parcels
                GROUP BY submission_id
            ) fp_count ON fp_count.submission_id = rs.id
            WHERE rs."LAST NAME" IS NOT NULL
            ORDER BY rs.submitted_at DESC
        `;
    const result = await pool.query(query);

    // Transform the data to match the frontend's expected format
    const submissions = result.rows.map((row) => {
      const fullName = [
        row["LAST NAME"],
        row["FIRST NAME"],
        row["MIDDLE NAME"],
        row["EXT NAME"],
      ]
        .filter(Boolean)
        .join(", ");

      const parcelInfo = row["FARM_LOCATION"]
        ? `${row["FARM_LOCATION"]}${row["PARCEL AREA"] ? ` (${row["PARCEL AREA"]} ha)` : ""}`
        : "N/A";

      const ownershipType = buildOwnershipTypePayload({
        preferredCategory: row.ownership_category,
        registeredOwner: hasOwnershipColumns
          ? row["OWNERSHIP_TYPE_REGISTERED_OWNER"]
          : false,
        tenant: hasOwnershipColumns ? row["OWNERSHIP_TYPE_TENANT"] : false,
        lessee: hasOwnershipColumns ? row["OWNERSHIP_TYPE_LESSEE"] : false,
      });

      let parcelAreaDisplay = "—";
      if (row["PARCEL AREA"]) {
        const areaStr = String(row["PARCEL AREA"]);
        const areaNum = parseFloat(areaStr);
        if (!isNaN(areaNum) && areaNum > 0) {
          parcelAreaDisplay = `${areaNum.toFixed(2)} ha`;
        } else {
          parcelAreaDisplay = areaStr;
        }
      }

      return {
        id: row.id,
        referenceNumber: row["FFRS_CODE"] || `RSBSA-${row.id}`,
        farmerName: fullName || "—",
        farmerAddress:
          `${row["BARANGAY"] || ""}, ${row["MUNICIPALITY"] || ""}`.replace(
            /^,\s*|,\s*$/g,
            "",
          ) || "—",
        farmLocation: row["FARM_LOCATION"] || "—",
        gender: row["GENDER"] || "—",
        birthdate: row["BIRTHDATE"] || null,
        age: computeAgeFromDate(row["BIRTHDATE"]),
        dateSubmitted: row.submitted_at || row.created_at,
        status: row.status || "Not Active",
        parcelArea: parcelAreaDisplay,
        totalFarmArea: parseFloat(row["TOTAL FARM AREA"]) || 0,
        landParcel: parcelInfo,
        parcelCount: parseInt(row.parcel_count) || 0,
        ownershipCategory: ownershipType.category,
        ownershipType: ownershipType,
      };
    });

    res.json(submissions);
  } catch (error) {
    console.error("Error fetching RSBSA submissions:", error);
    res.status(500).json({
      message: "Error fetching RSBSA submissions",
      error: error.message,
    });
  }
});

// ============================================================================
// GET /:id - Fetch a specific RSBSA submission by ID
// ============================================================================
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  // Skip if this looks like a special route (handled by other endpoints)
  if (id === "farm_parcels") {
    return; // Let the farm_parcels route handle it
  }

  try {
    console.log(`Fetching RSBSA submission ${id}...`);

    const query = `SELECT * FROM rsbsa_submission WHERE id = $1`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "RSBSA submission not found",
        message: `No RSBSA submission found with ID ${id}`,
      });
    }

    const row = result.rows[0];

    const fullName = [
      row["LAST NAME"] || "",
      row["FIRST NAME"] || "",
      row["MIDDLE NAME"] || "",
      row["EXT NAME"] || "",
    ]
      .filter((part) => part)
      .join(", ");

    const barangay = row["BARANGAY"] || "";
    const municipality = row["MUNICIPALITY"] || "";
    const ownershipType = buildOwnershipTypePayload({
      preferredCategory: row.ownership_category,
      registeredOwner: row["OWNERSHIP_TYPE_REGISTERED_OWNER"],
      tenant: row["OWNERSHIP_TYPE_TENANT"],
      lessee: row["OWNERSHIP_TYPE_LESSEE"],
    });

    const submissionData = {
      id: row.id,
      referenceNumber: row["FFRS_CODE"] || `RSBSA-${row.id}`,
      farmerName: fullName,
      firstName: row["FIRST NAME"] || "",
      middleName: row["MIDDLE NAME"] || "",
      lastName: row["LAST NAME"] || "",
      extName: row["EXT NAME"] || "",
      gender: row["GENDER"] || "",
      birthdate: row["BIRTHDATE"] || "",
      mainLivelihood: row["MAIN LIVELIHOOD"] || "",
      farmerAddress: [barangay, municipality].filter(Boolean).join(", ") || "",
      farmLocation:
        row["FARM LOCATION"] || row["FARM_LOCATION"] || barangay || "",
      parcelArea: row["PARCEL AREA"] || row["PARCEL_AREA"] || "",
      status: row.status || "Not Active",
      dateSubmitted: row.submitted_at || row.created_at,
      ownershipCategory: ownershipType.category,
      ownershipType,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    // Also fetch farm parcels for this submission
    const parcelsQuery = `
            SELECT * FROM rsbsa_farm_parcels 
            WHERE submission_id = $1
            ORDER BY parcel_number
        `;
    const parcelsResult = await pool.query(parcelsQuery, [id]);
    submissionData.farmParcels = parcelsResult.rows;

    res.json(submissionData);
  } catch (error) {
    console.error("Error fetching RSBSA submission:", error);
    res.status(500).json({
      message: "Error fetching RSBSA submission",
      error: error.message,
    });
  }
});

// ============================================================================
// PUT /:id - Update a specific RSBSA submission
// ============================================================================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log("Updating RSBSA submission:", { id, updateData });

    let queryValues = [];
    const updateFields = [];
    let paramCounter = 1;

    // Check if only status is provided (e.g., from Masterlist toggle)
    if (Object.keys(updateData).length === 1 && updateData.status) {
      if (!["Active Farmer", "Not Active"].includes(updateData.status)) {
        return res.status(400).json({
          message: "Invalid status value",
          error: 'Status must be either "Active Farmer" or "Not Active"',
        });
      }

      const updateQuery = `
                UPDATE rsbsa_submission 
                SET status = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *;
            `;
      queryValues = [updateData.status, id];

      const result = await pool.query(updateQuery, queryValues);

      if (result.rowCount === 0) {
        return res.status(404).json({
          message: "Record not found",
          error: "No record found with the provided ID",
        });
      }

      return res.json({
        message: "Status updated successfully",
        updatedRecord: result.rows[0],
      });
    }

    // Handle status if provided
    if (updateData.status) {
      if (!["Active Farmer", "Not Active"].includes(updateData.status)) {
        return res.status(400).json({
          message: "Invalid status value",
          error: 'Status must be either "Active Farmer" or "Not Active"',
        });
      }
      updateFields.push(`status = $${paramCounter}`);
      queryValues.push(updateData.status);
      paramCounter++;
    }

    // Handle farmer name components if provided
    if (updateData.farmerName) {
      const nameParts = updateData.farmerName.split(", ");
      const [lName, fName, mName, eName] = nameParts;

      updateFields.push('"LAST NAME" = $' + paramCounter);
      queryValues.push(lName || "");
      paramCounter++;

      updateFields.push('"FIRST NAME" = $' + paramCounter);
      queryValues.push(fName || "");
      paramCounter++;

      updateFields.push('"MIDDLE NAME" = $' + paramCounter);
      queryValues.push(mName || "");
      paramCounter++;

      updateFields.push('"EXT NAME" = $' + paramCounter);
      queryValues.push(eName || "");
      paramCounter++;
    }

    // Handle other fields
    if (updateData.gender) {
      updateFields.push('"GENDER" = $' + paramCounter);
      queryValues.push(updateData.gender);
      paramCounter++;
    }

    if (updateData.birthdate) {
      updateFields.push('"BIRTHDATE" = $' + paramCounter);
      queryValues.push(updateData.birthdate);
      paramCounter++;
    }

    if (updateData.farmLocation) {
      updateFields.push('"FARM LOCATION" = $' + paramCounter);
      queryValues.push(updateData.farmLocation);
      paramCounter++;
    }

    if (updateData.parcelArea) {
      const areaValue = updateData.parcelArea
        .replace(/\s*hectares\s*$/i, "")
        .trim();
      if (!isNaN(parseFloat(areaValue))) {
        updateFields.push('"PARCEL AREA" = $' + paramCounter);
        queryValues.push(parseFloat(areaValue));
        paramCounter++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        message: "No valid fields to update",
        error: "Please provide at least one field to update",
      });
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");

    const finalQuery = `
            UPDATE rsbsa_submission 
            SET ${updateFields.join(", ")}
            WHERE id = $${paramCounter}
            RETURNING *;
        `;
    queryValues.push(id);

    const result = await pool.query(finalQuery, queryValues);

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Record not found",
        error: "No record found with the provided ID",
      });
    }

    res.json({
      message: "Record updated successfully",
      updatedRecord: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating RSBSA submission:", error);
    res.status(500).json({
      message: "Error updating RSBSA submission",
      error: error.message || "Unknown error occurred",
      details: error.detail || "No additional details available",
    });
  }
});

// ============================================================================
// DELETE /:id - Delete RSBSA submission and associated parcels
// ============================================================================
/*
Purpose: Deletes an RSBSA submission and all associated farm parcels
Where: DELETE /api/rsbsa_submission/:id
Description: Cascading delete - removes submission and all linked parcels in a transaction
             Also handles tenant/lessee references - clears land owner references when a land owner is deleted
*/
router.delete("/:id", async (req, res) => {
  const submissionId = req.params.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    console.log(`Deleting RSBSA submission ID: ${submissionId}`);

    // First, get the farmer's full name and reference number (FFRS_CODE)
    const getFarmerQuery = `
            SELECT 
                "FFRS_CODE", 
                "LAST NAME" as surname, 
                "FIRST NAME" as first_name, 
                "MIDDLE NAME" as middle_name,
                "BARANGAY" as barangay
            FROM rsbsa_submission WHERE id = $1
        `;
    const farmerResult = await client.query(getFarmerQuery, [submissionId]);

    let landPlotsDeleted = 0;
    let tenantsAffected = 0;
    let lesseesAffected = 0;
    let affectedTenantDetails = [];
    let affectedLesseeDetails = [];

    if (farmerResult.rows.length > 0) {
      const farmer = farmerResult.rows[0];
      console.log("Farmer data for deletion:", farmer);

      // Build the full name of the farmer being deleted (to match against land owner references)
      const farmerFullName = [
        farmer.first_name,
        farmer.middle_name,
        farmer.surname,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      console.log(
        `Checking for tenants/lessees referencing land owner: ${farmerFullName}`,
      );

      // ============================================================================
      // STEP 1: Find and clear tenant references to this land owner
      // ============================================================================
      if (farmerFullName) {
        // Find tenants who have this farmer as their land owner
        const findTenantsQuery = `
                    SELECT 
                        fp.id as parcel_id,
                        fp.submission_id,
                        fp.tenant_land_owner_name,
                        rs."FIRST NAME" as tenant_first_name,
                        rs."LAST NAME" as tenant_last_name,
                        rs."BARANGAY" as tenant_barangay
                    FROM rsbsa_farm_parcels fp
                    JOIN rsbsa_submission rs ON fp.submission_id = rs.id
                    WHERE fp.ownership_type_tenant = true
                    AND LOWER(TRIM(COALESCE(fp.tenant_land_owner_name, ''))) = LOWER(TRIM($1))
                    AND fp.submission_id != $2
                `;
        const tenantsResult = await client.query(findTenantsQuery, [
          farmerFullName,
          submissionId,
        ]);

        if (tenantsResult.rows.length > 0) {
          affectedTenantDetails = tenantsResult.rows.map((row) => ({
            parcelId: row.parcel_id,
            submissionId: row.submission_id,
            tenantName:
              `${row.tenant_first_name || ""} ${row.tenant_last_name || ""}`.trim(),
            barangay: row.tenant_barangay,
            previousLandOwner: row.tenant_land_owner_name,
          }));

          console.log(
            `Found ${tenantsResult.rows.length} tenant parcels referencing this land owner`,
          );

          // Clear the land owner reference for affected tenants
          const clearTenantRefsQuery = `
                        UPDATE rsbsa_farm_parcels 
                        SET tenant_land_owner_name = NULL,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE ownership_type_tenant = true
                        AND LOWER(TRIM(COALESCE(tenant_land_owner_name, ''))) = LOWER(TRIM($1))
                        AND submission_id != $2
                    `;
          const clearTenantsResult = await client.query(clearTenantRefsQuery, [
            farmerFullName,
            submissionId,
          ]);
          tenantsAffected = clearTenantsResult.rowCount;
          console.log(
            `Cleared land owner reference for ${tenantsAffected} tenant parcels`,
          );
        }

        // ============================================================================
        // STEP 2: Find and clear lessee references to this land owner
        // ============================================================================
        const findLesseesQuery = `
                    SELECT 
                        fp.id as parcel_id,
                        fp.submission_id,
                        fp.lessee_land_owner_name,
                        rs."FIRST NAME" as lessee_first_name,
                        rs."LAST NAME" as lessee_last_name,
                        rs."BARANGAY" as lessee_barangay
                    FROM rsbsa_farm_parcels fp
                    JOIN rsbsa_submission rs ON fp.submission_id = rs.id
                    WHERE fp.ownership_type_lessee = true
                    AND LOWER(TRIM(COALESCE(fp.lessee_land_owner_name, ''))) = LOWER(TRIM($1))
                    AND fp.submission_id != $2
                `;
        const lesseesResult = await client.query(findLesseesQuery, [
          farmerFullName,
          submissionId,
        ]);

        if (lesseesResult.rows.length > 0) {
          affectedLesseeDetails = lesseesResult.rows.map((row) => ({
            parcelId: row.parcel_id,
            submissionId: row.submission_id,
            lesseeName:
              `${row.lessee_first_name || ""} ${row.lessee_last_name || ""}`.trim(),
            barangay: row.lessee_barangay,
            previousLandOwner: row.lessee_land_owner_name,
          }));

          console.log(
            `Found ${lesseesResult.rows.length} lessee parcels referencing this land owner`,
          );

          // Clear the land owner reference for affected lessees
          const clearLesseeRefsQuery = `
                        UPDATE rsbsa_farm_parcels 
                        SET lessee_land_owner_name = NULL,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE ownership_type_lessee = true
                        AND LOWER(TRIM(COALESCE(lessee_land_owner_name, ''))) = LOWER(TRIM($1))
                        AND submission_id != $2
                    `;
          const clearLesseesResult = await client.query(clearLesseeRefsQuery, [
            farmerFullName,
            submissionId,
          ]);
          lesseesAffected = clearLesseesResult.rowCount;
          console.log(
            `Cleared land owner reference for ${lesseesAffected} lessee parcels`,
          );
        }
      }

      // ============================================================================
      // STEP 3: Delete from land_plots by ffrs_id if available
      // ============================================================================
      if (farmer.FFRS_CODE) {
        const deleteLandPlotsByFfrsQuery =
          "DELETE FROM land_plots WHERE ffrs_id = $1";
        const landPlotsResult = await client.query(deleteLandPlotsByFfrsQuery, [
          farmer.FFRS_CODE,
        ]);
        landPlotsDeleted += landPlotsResult.rowCount;
        console.log(
          `Deleted ${landPlotsResult.rowCount} land plots by ffrs_id for submission ${submissionId}`,
        );
      }

      // ============================================================================
      // STEP 4: Also delete by matching name and barangay (using TRIM and LOWER for robust matching)
      // ============================================================================
      if (farmer.surname && farmer.first_name && farmer.barangay) {
        const deleteLandPlotsByNameQuery = `
                    DELETE FROM land_plots 
                    WHERE LOWER(TRIM(COALESCE(surname, ''))) = LOWER(TRIM($1))
                    AND LOWER(TRIM(COALESCE(first_name, ''))) = LOWER(TRIM($2))
                    AND LOWER(TRIM(COALESCE(barangay, ''))) = LOWER(TRIM($3))
                `;
        const landPlotsByNameResult = await client.query(
          deleteLandPlotsByNameQuery,
          [farmer.surname, farmer.first_name, farmer.barangay],
        );
        landPlotsDeleted += landPlotsByNameResult.rowCount;
        console.log(
          `Deleted ${landPlotsByNameResult.rowCount} land plots by name for submission ${submissionId}`,
        );
      }
    }

    // ============================================================================
    // STEP 5: Delete all associated parcels from rsbsa_farm_parcels
    // ============================================================================
    const deleteParcelsQuery =
      "DELETE FROM rsbsa_farm_parcels WHERE submission_id = $1";
    const parcelsResult = await client.query(deleteParcelsQuery, [
      submissionId,
    ]);
    console.log(
      `Deleted ${parcelsResult.rowCount} parcels for submission ${submissionId}`,
    );

    // ============================================================================
    // STEP 6: Delete the submission itself
    // ============================================================================
    const deleteSubmissionQuery =
      "DELETE FROM rsbsa_submission WHERE id = $1 RETURNING id";
    const submissionResult = await client.query(deleteSubmissionQuery, [
      submissionId,
    ]);

    if (submissionResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Submission not found" });
    }

    await client.query("COMMIT");

    // Build response with detailed information about affected records
    const response = {
      message: "RSBSA submission and associated parcels deleted successfully",
      submissionId: submissionResult.rows[0].id,
      parcelsDeleted: parcelsResult.rowCount,
      landPlotsDeleted: landPlotsDeleted,
    };

    // Add tenant/lessee impact information if any were affected
    if (tenantsAffected > 0 || lesseesAffected > 0) {
      response.landOwnerImpact = {
        message:
          "This farmer was referenced as a land owner by tenants/lessees. Their references have been cleared.",
        tenantsAffected: tenantsAffected,
        lesseesAffected: lesseesAffected,
        affectedTenants: affectedTenantDetails,
        affectedLessees: affectedLesseeDetails,
      };
    }

    res.json(response);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting submission:", error);
    res
      .status(500)
      .json({ message: "Error deleting submission", error: error.message });
  } finally {
    client.release();
  }
});

// ============================================================================
// GET /:id/tenant-lessee-references - Check if farmer is referenced as land owner
// ============================================================================
/*
Purpose: Check if a farmer is referenced as a land owner by any tenants or lessees
Where: GET /api/rsbsa_submission/:id/tenant-lessee-references
Description: Returns a list of tenants/lessees who have this farmer as their land owner
             Useful for warning users before deleting a land owner
*/
router.get("/:id/tenant-lessee-references", async (req, res) => {
  const submissionId = req.params.id;

  try {
    // Get the farmer's full name
    const getFarmerQuery = `
            SELECT 
                "FIRST NAME" as first_name, 
                "MIDDLE NAME" as middle_name,
                "LAST NAME" as surname
            FROM rsbsa_submission WHERE id = $1
        `;
    const farmerResult = await pool.query(getFarmerQuery, [submissionId]);

    if (farmerResult.rows.length === 0) {
      return res.status(404).json({ message: "Farmer not found" });
    }

    const farmer = farmerResult.rows[0];
    const farmerFullName = [
      farmer.first_name,
      farmer.middle_name,
      farmer.surname,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!farmerFullName) {
      return res.json({
        farmerName: "",
        hasReferences: false,
        tenants: [],
        lessees: [],
      });
    }

    // Find tenants who have this farmer as their land owner
    const findTenantsQuery = `
            SELECT 
                fp.id as parcel_id,
                fp.submission_id,
                fp.tenant_land_owner_name,
                fp.farm_location_barangay,
                fp.total_farm_area_ha,
                rs."FIRST NAME" as tenant_first_name,
                rs."MIDDLE NAME" as tenant_middle_name,
                rs."LAST NAME" as tenant_last_name,
                rs."BARANGAY" as tenant_barangay
            FROM rsbsa_farm_parcels fp
            JOIN rsbsa_submission rs ON fp.submission_id = rs.id
            WHERE fp.ownership_type_tenant = true
            AND LOWER(TRIM(COALESCE(fp.tenant_land_owner_name, ''))) = LOWER(TRIM($1))
            AND fp.submission_id != $2
        `;
    const tenantsResult = await pool.query(findTenantsQuery, [
      farmerFullName,
      submissionId,
    ]);

    // Find lessees who have this farmer as their land owner
    const findLesseesQuery = `
            SELECT 
                fp.id as parcel_id,
                fp.submission_id,
                fp.lessee_land_owner_name,
                fp.farm_location_barangay,
                fp.total_farm_area_ha,
                rs."FIRST NAME" as lessee_first_name,
                rs."MIDDLE NAME" as lessee_middle_name,
                rs."LAST NAME" as lessee_last_name,
                rs."BARANGAY" as lessee_barangay
            FROM rsbsa_farm_parcels fp
            JOIN rsbsa_submission rs ON fp.submission_id = rs.id
            WHERE fp.ownership_type_lessee = true
            AND LOWER(TRIM(COALESCE(fp.lessee_land_owner_name, ''))) = LOWER(TRIM($1))
            AND fp.submission_id != $2
        `;
    const lesseesResult = await pool.query(findLesseesQuery, [
      farmerFullName,
      submissionId,
    ]);

    const tenants = tenantsResult.rows.map((row) => ({
      parcelId: row.parcel_id,
      submissionId: row.submission_id,
      tenantName: [
        row.tenant_first_name,
        row.tenant_middle_name,
        row.tenant_last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
      tenantBarangay: row.tenant_barangay,
      farmBarangay: row.farm_location_barangay,
      farmArea: row.total_farm_area_ha,
    }));

    const lessees = lesseesResult.rows.map((row) => ({
      parcelId: row.parcel_id,
      submissionId: row.submission_id,
      lesseeName: [
        row.lessee_first_name,
        row.lessee_middle_name,
        row.lessee_last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
      lesseeBarangay: row.lessee_barangay,
      farmBarangay: row.farm_location_barangay,
      farmArea: row.total_farm_area_ha,
    }));

    res.json({
      farmerName: farmerFullName,
      hasReferences: tenants.length > 0 || lessees.length > 0,
      totalReferences: tenants.length + lessees.length,
      tenants: tenants,
      lessees: lessees,
      warning:
        tenants.length > 0 || lessees.length > 0
          ? `This farmer is referenced as a land owner by ${tenants.length} tenant(s) and ${lessees.length} lessee(s). Deleting this farmer will clear these references.`
          : null,
    });
  } catch (error) {
    console.error("Error checking tenant/lessee references:", error);
    res
      .status(500)
      .json({ message: "Error checking references", error: error.message });
  }
});

module.exports = router;
