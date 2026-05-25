const { createPool } = require("../backend/config/db.cjs");

const rawName = process.argv.slice(2).join(" ").trim();
if (!rawName) {
  console.error('Usage: node scratch/trace_tenant_landowner.cjs "Full Name"');
  process.exit(1);
}

const normalized = rawName.toLowerCase().replace(/\s+/g, " ").trim();
const pattern = `%${normalized}%`;

const pool = createPool();

const formatName = (row) => {
  const parts = [row.last_name, row.first_name, row.middle_name, row.ext_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unknown";
};

const toBool = (value) => value === true;

(async () => {
  try {
    const candidates = await pool.query(
      `
      SELECT id,
             "FIRST NAME" AS first_name,
             "MIDDLE NAME" AS middle_name,
             "LAST NAME" AS last_name,
             "EXT NAME" AS ext_name,
             status,
             "OWNERSHIP_TYPE_TENANT" AS is_tenant,
             "OWNERSHIP_TYPE_LESSEE" AS is_lessee
      FROM rsbsa_submission
      WHERE lower(concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME", "EXT NAME")) LIKE $1
         OR lower(concat_ws(' ', "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME")) LIKE $1
      ORDER BY id
      `,
      [pattern],
    );

    if (candidates.rowCount === 0) {
      console.log("No matching rsbsa_submission rows for:", rawName);
      return;
    }

    for (const row of candidates.rows) {
      const farmerId = Number(row.id);
      console.log("\n=== Farmer ===");
      console.log({
        id: farmerId,
        name: formatName(row),
        status: row.status,
        is_tenant: toBool(row.is_tenant),
        is_lessee: toBool(row.is_lessee),
      });

      const history = await pool.query(
        `
        SELECT id, parcel_number, land_owner_id, land_owner_name, is_tenant, is_lessee, is_current
        FROM land_history
        WHERE farmer_id = $1
          AND is_current = TRUE
          AND (is_tenant = TRUE OR is_lessee = TRUE)
        ORDER BY id
        `,
        [farmerId],
      );

      console.log("Current land_history tenant/lessee rows:", history.rowCount);
      if (history.rowCount > 0) {
        console.log(history.rows);
      }

      const parcels = await pool.query(
        `
        SELECT id, parcel_number, ownership_type_tenant, ownership_type_lessee,
               tenant_land_owner_id, tenant_land_owner_name,
               lessee_land_owner_id, lessee_land_owner_name
        FROM rsbsa_farm_parcels
        WHERE submission_id = $1
          AND (ownership_type_tenant = TRUE OR ownership_type_lessee = TRUE)
        ORDER BY id
        `,
        [farmerId],
      );

      console.log("Tenant/lessee parcel rows:", parcels.rowCount);
      if (parcels.rowCount > 0) {
        console.log(parcels.rows);
      }

      const ownerIds = new Set();
      parcels.rows.forEach((parcel) => {
        if (parcel.tenant_land_owner_id)
          ownerIds.add(parcel.tenant_land_owner_id);
        if (parcel.lessee_land_owner_id)
          ownerIds.add(parcel.lessee_land_owner_id);
      });

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

        console.log("Linked owner IDs:", ownerList);
        console.log(
          owners.rows.map((owner) => ({
            id: owner.id,
            name: formatName(owner),
            status: owner.status,
          })),
        );
      } else {
        console.log("No tenant/lessee landowner IDs set on parcels.");
      }
    }
  } catch (error) {
    console.error("Trace failed:", error.message || error);
  } finally {
    await pool.end();
  }
})();
