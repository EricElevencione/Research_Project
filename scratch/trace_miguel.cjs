const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const sub = await pool.query(`
      SELECT id, "FIRST NAME", "LAST NAME", status, "MAIN LIVELIHOOD",
             "OWNERSHIP_TYPE_REGISTERED_OWNER" AS is_owner
      FROM rsbsa_submission
      WHERE id = 18
    `);
    console.log("=== Miguel Abay Ramos submission ===");
    console.log(sub.rows);

    const parcels = await pool.query(`
      SELECT id, submission_id, parcel_number, ownership_type_registered_owner, is_current_owner
      FROM rsbsa_farm_parcels
      WHERE submission_id = 18
    `);
    console.log("\n=== Miguel Abay Ramos parcels ===");
    console.log(parcels.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
