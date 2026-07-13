const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const namePattern = '%ben%';
    const submissions = await pool.query(`
      SELECT id,
             "FIRST NAME" AS first_name,
             "MIDDLE NAME" AS middle_name,
             "LAST NAME" AS last_name,
             status
      FROM rsbsa_submission
      WHERE lower(concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME")) LIKE $1
         OR lower(concat_ws(' ', "LAST NAME", "FIRST NAME", "MIDDLE NAME")) LIKE $1
    `, [namePattern]);
    console.log("=== Submissions for Ben ===");
    console.log(submissions.rows);

    const benIds = submissions.rows.map(r => Number(r.id));
    if (benIds.length === 0) {
      console.log("No submissions found for Ben.");
      return;
    }

    console.log("\n=== rsbsa_farm_parcels ===");
    const parcels = await pool.query(`
      SELECT id, submission_id, parcel_number, total_farm_area_ha,
             ownership_type_registered_owner AS is_owner,
             ownership_type_tenant AS is_tenant,
             ownership_type_lessee AS is_lessee,
             tenant_land_owner_id, tenant_land_owner_name,
             is_current_owner, is_cultivating, cultivator_submission_id
      FROM rsbsa_farm_parcels
      WHERE submission_id = ANY($1) OR tenant_land_owner_id = ANY($1) OR lessee_land_owner_id = ANY($1)
      ORDER BY id
    `, [benIds]);
    console.log(parcels.rows);

    console.log("\n=== land_history ===");
    const history = await pool.query(`
      SELECT id, land_parcel_id, farm_parcel_id, farmer_id, parcel_number,
             land_owner_id, land_owner_name, farmer_name,
             is_registered_owner, is_tenant, is_lessee, is_current
      FROM land_history
      WHERE farmer_id = ANY($1) OR land_owner_id = ANY($1)
      ORDER BY id
    `, [benIds]);
    console.log(history.rows);

  } catch (err) {
    console.error("Error inspecting:", err);
  } finally {
    await pool.end();
  }
}

main();
