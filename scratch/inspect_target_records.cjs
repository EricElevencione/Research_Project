const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== rsbsa_submission ===");
    const submissions = await pool.query(`
      SELECT id,
             "FIRST NAME" AS first_name,
             "MIDDLE NAME" AS middle_name,
             "LAST NAME" AS last_name,
             "EXT NAME" AS ext_name,
             status,
             "OWNERSHIP_TYPE_REGISTERED_OWNER" AS is_owner,
             "OWNERSHIP_TYPE_TENANT" AS is_tenant,
             "OWNERSHIP_TYPE_LESSEE" AS is_lessee
      FROM rsbsa_submission
      WHERE id IN (98, 100)
    `);
    console.log(submissions.rows);

    console.log("\n=== rsbsa_farm_parcels (submission_id 98 or 100) ===");
    const parcels = await pool.query(`
      SELECT id, submission_id, parcel_number, total_farm_area_ha,
             ownership_type_registered_owner AS is_owner,
             ownership_type_tenant AS is_tenant,
             ownership_type_lessee AS is_lessee,
             tenant_land_owner_id, tenant_land_owner_name,
             lessee_land_owner_id, lessee_land_owner_name,
             is_current_owner, is_cultivating, cultivator_submission_id,
             farming_status_reason, is_farming
      FROM rsbsa_farm_parcels
      WHERE submission_id IN (98, 100) OR tenant_land_owner_id IN (98, 100) OR lessee_land_owner_id IN (98, 100) OR cultivator_submission_id IN (98, 100)
    `);
    console.log(parcels.rows);

    console.log("\n=== land_history ===");
    const history = await pool.query(`
      SELECT id, land_parcel_id, farm_parcel_id, farmer_id, parcel_number,
             land_owner_id, land_owner_name, farmer_name,
             is_registered_owner, is_tenant, is_lessee, is_current
      FROM land_history
      WHERE farmer_id IN (98, 100) OR land_owner_id IN (98, 100)
    `);
    console.log(history.rows);

    console.log("\n=== farmer_aggregated_unified ===");
    const unified = await pool.query(`
      SELECT farmer_id, farmer_name, ffrs_code, parcels, total_farm_area_ha, last_updated,
             has_registered_owner, has_tenant, has_lessee, archived_at
      FROM farmer_aggregated_unified
      WHERE farmer_id IN (98, 100)
    `);
    console.log(JSON.stringify(unified.rows, null, 2));

  } catch (err) {
    console.error("Error inspecting:", err);
  } finally {
    await pool.end();
  }
}

main();
