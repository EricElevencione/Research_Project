const { createPool } = require("../backend/config/db.cjs");

const rawParcel = process.argv.slice(2).join(" ").trim();
if (!rawParcel) {
  console.error('Usage: node scratch/find_parcel_owners.cjs "Parcel-14-1"');
  process.exit(1);
}

const parcelNumber = rawParcel.trim();
const pool = createPool();

const formatName = (row) => {
  const parts = [row.last_name, row.first_name, row.middle_name, row.ext_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unknown";
};

(async () => {
  try {
    const parcelRows = await pool.query(
      `
      SELECT id, submission_id, parcel_number,
             farm_location_barangay, farm_location_municipality, total_farm_area_ha,
             ownership_type_tenant, ownership_type_lessee,
             tenant_land_owner_id, tenant_land_owner_name,
             lessee_land_owner_id, lessee_land_owner_name
      FROM rsbsa_farm_parcels
      WHERE parcel_number = $1
      ORDER BY id
      `,
      [parcelNumber],
    );

    console.log("\n=== rsbsa_farm_parcels ===");
    console.log("rows:", parcelRows.rowCount);
    if (parcelRows.rowCount > 0) {
      console.log(parcelRows.rows);
    }

    const farmParcelIds = parcelRows.rows
      .map((row) => row.id)
      .filter((id) => Number.isFinite(Number(id)));

    const historyRows = await pool.query(
      `
      SELECT id, farm_parcel_id, parcel_number, farmer_id, farmer_name,
             land_owner_id, land_owner_name, is_registered_owner, is_tenant, is_lessee,
             is_current, period_start_date, period_end_date, change_type, change_reason
      FROM land_history
      WHERE parcel_number = $1
         OR (farm_parcel_id IS NOT NULL AND farm_parcel_id = ANY($2))
      ORDER BY is_current DESC, period_start_date DESC, created_at DESC
      `,
      [parcelNumber, farmParcelIds.length > 0 ? farmParcelIds : [0]],
    );

    console.log("\n=== land_history (parcel matches) ===");
    console.log("rows:", historyRows.rowCount);
    if (historyRows.rowCount > 0) {
      console.log(historyRows.rows);
    }

    const ownerIds = new Set();
    const ownerNames = new Set();
    for (const row of historyRows.rows) {
      if (row.land_owner_id) ownerIds.add(row.land_owner_id);
      if (row.land_owner_name) ownerNames.add(row.land_owner_name);
    }

    if (ownerIds.size > 0) {
      const ownerList = Array.from(ownerIds);
      const owners = await pool.query(
        `
        SELECT id,
               "FIRST NAME" AS first_name,
               "MIDDLE NAME" AS middle_name,
               "LAST NAME" AS last_name,
               "EXT NAME" AS ext_name,
               status
        FROM rsbsa_submission
        WHERE id = ANY($1)
        ORDER BY id
        `,
        [ownerList],
      );

      console.log("\n=== land_history owner IDs resolved ===");
      console.log(
        owners.rows.map((owner) => ({
          id: owner.id,
          name: formatName(owner),
          status: owner.status,
        })),
      );
    }

    if (ownerNames.size > 0) {
      console.log("\n=== land_history owner names ===");
      console.log(Array.from(ownerNames));
    }
  } catch (error) {
    console.error("Lookup failed:", error.message || error);
  } finally {
    await pool.end();
  }
})();
