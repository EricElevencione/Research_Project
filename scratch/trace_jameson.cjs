const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== 1. Searching for Santos, Jameson Hernandez in submissions ===");
    const jameson = await pool.query(`
      SELECT id, "FIRST NAME", "MIDDLE NAME", "LAST NAME", status, "FFRS_CODE"
      FROM rsbsa_submission
      WHERE lower(concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME")) LIKE '%jameson%'
         OR lower(concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME")) LIKE '%santos%'
    `);
    console.log(jameson.rows);

    console.log("\n=== 2. Searching for Miguel Abay Ramos in submissions ===");
    const miguel = await pool.query(`
      SELECT id, "FIRST NAME", "MIDDLE NAME", "LAST NAME", status, "FFRS_CODE"
      FROM rsbsa_submission
      WHERE lower(concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME")) LIKE '%miguel%'
         OR lower(concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME")) LIKE '%ramos%'
    `);
    console.log(miguel.rows);

    if (jameson.rows.length > 0) {
      console.log("\n=== 3. Querying parcels for Jameson ===");
      const jamesonIds = jameson.rows.map(r => r.id);
      const parcels = await pool.query(`
        SELECT id, submission_id, parcel_number, ownership_type_tenant, ownership_type_lessee,
               tenant_land_owner_id, tenant_land_owner_name, is_current_owner
        FROM rsbsa_farm_parcels
        WHERE submission_id = ANY($1)
      `, [jamesonIds]);
      console.log(parcels.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
