const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== Submissions for Brady ===");
    const submissions = await pool.query(`
      SELECT id,
             "FIRST NAME" AS first_name,
             "MIDDLE NAME" AS middle_name,
             "LAST NAME" AS last_name,
             status,
             created_at
      FROM rsbsa_submission
      WHERE id = 102
    `);
    console.log(submissions.rows);

    console.log("\n=== rsbsa_farm_parcels for Brady ===");
    const parcels = await pool.query(`
      SELECT id, submission_id, parcel_number, total_farm_area_ha,
             ownership_type_registered_owner AS is_owner,
             ownership_type_tenant AS is_tenant,
             ownership_type_lessee AS is_lessee,
             tenant_land_owner_id, tenant_land_owner_name,
             is_current_owner, is_cultivating, cultivator_submission_id,
             created_at
      FROM rsbsa_farm_parcels
      WHERE submission_id = 102 OR tenant_land_owner_id = 102
      ORDER BY id
    `);
    console.log(parcels.rows);

    console.log("\n=== land_history for Brady (102) ===");
    const history = await pool.query(`
      SELECT id, farm_parcel_id, farmer_id, parcel_number,
             land_owner_id, land_owner_name, farmer_name,
             is_registered_owner, is_tenant, is_lessee, is_current, change_type, change_reason,
             created_at
      FROM land_history
      WHERE farmer_id = 102 OR land_owner_id = 102
      ORDER BY id
    `);
    console.log(history.rows);

  } catch (err) {
    console.error("Error inspecting:", err);
  } finally {
    await pool.end();
  }
}

main();
