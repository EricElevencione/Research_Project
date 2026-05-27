const { createPool } = require("../backend/config/db.cjs");

const [rawParcel, rawOwnerId] = process.argv.slice(2);
if (!rawParcel || !rawOwnerId) {
  console.error(
    'Usage: node scratch/update_tenant_landowner.cjs "Parcel-14-1" 57',
  );
  process.exit(1);
}

const parcelNumber = String(rawParcel || "").trim();
const ownerId = Number(rawOwnerId);
if (!parcelNumber || !Number.isFinite(ownerId)) {
  console.error("Invalid parcel number or owner id.");
  process.exit(1);
}

const pool = createPool();

const formatName = (row) => {
  const parts = [row.last_name, row.first_name, row.middle_name, row.ext_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unknown";
};

(async () => {
  try {
    const ownerResult = await pool.query(
      `
      SELECT id,
             "FIRST NAME" AS first_name,
             "MIDDLE NAME" AS middle_name,
             "LAST NAME" AS last_name,
             "EXT NAME" AS ext_name,
             status
      FROM rsbsa_submission
      WHERE id = $1
      `,
      [ownerId],
    );

    if (ownerResult.rowCount === 0) {
      console.error("No rsbsa_submission row found for owner id:", ownerId);
      process.exit(1);
    }

    const ownerRow = ownerResult.rows[0];
    const ownerName = formatName(ownerRow);

    const updateResult = await pool.query(
      `
      UPDATE rsbsa_farm_parcels
      SET tenant_land_owner_id = $1,
          tenant_land_owner_name = $2
      WHERE parcel_number = $3
        AND ownership_type_tenant = TRUE
      `,
      [ownerId, ownerName, parcelNumber],
    );

    console.log("Updated rows:", updateResult.rowCount);
    console.log("Owner:", {
      id: ownerId,
      name: ownerName,
      status: ownerRow.status,
    });
    console.log("Parcel:", parcelNumber);
  } catch (error) {
    console.error("Update failed:", error.message || error);
  } finally {
    await pool.end();
  }
})();
