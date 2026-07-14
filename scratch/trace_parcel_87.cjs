const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== 1. Checking submission 87 ===");
    const sub = await pool.query(`
      SELECT id, "FIRST NAME" AS first_name, "LAST NAME" AS last_name, status, "MAIN LIVELIHOOD"
      FROM rsbsa_submission
      WHERE id = 87
    `);
    console.log(sub.rows);

    console.log("\n=== 2. Checking parcels for submission 87 ===");
    const parcels = await pool.query(`
      SELECT id, submission_id, parcel_number, ownership_type_registered_owner, is_current_owner
      FROM rsbsa_farm_parcels
      WHERE submission_id = 87
    `);
    console.log(parcels.rows);

    console.log("\n=== 3. Checking all parcel rows with number 'Parcel-87-2' ===");
    const allParcels = await pool.query(`
      SELECT id, submission_id, parcel_number, ownership_type_registered_owner, is_current_owner, tenant_land_owner_name, tenant_land_owner_id
      FROM rsbsa_farm_parcels
      WHERE parcel_number = 'Parcel-87-2'
    `);
    console.log(allParcels.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
