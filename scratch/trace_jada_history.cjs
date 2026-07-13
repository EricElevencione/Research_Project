const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== 1. Jada Stele Nash (98) Submission Record ===");
    const subRes = await pool.query(`
      SELECT 
        id,
        "FIRST NAME" AS first_name,
        "MIDDLE NAME" AS middle_name,
        "LAST NAME" AS last_name,
        created_at,
        submitted_at,
        status,
        "OWNERSHIP_TYPE_REGISTERED_OWNER" AS is_owner_sub,
        "OWNERSHIP_TYPE_TENANT" AS is_tenant_sub,
        "OWNERSHIP_TYPE_LESSEE" AS is_lessee_sub
      FROM rsbsa_submission
      WHERE id = 98
    `);
    console.log(subRes.rows[0]);

    console.log("\n=== 2. All Land History Rows for Jada Stele Nash (farmer_id = 98) ===");
    const histRes = await pool.query(`
      SELECT 
        id,
        farm_parcel_id,
        parcel_number,
        land_owner_id,
        land_owner_name,
        farmer_id,
        farmer_name,
        is_registered_owner,
        is_tenant,
        is_lessee,
        change_type,
        change_reason,
        is_current,
        period_start_date,
        period_end_date,
        created_at
      FROM land_history
      WHERE farmer_id = 98 OR rsbsa_submission_id = 98
      ORDER BY created_at ASC
    `);
    console.log(histRes.rows);

    console.log("\n=== 3. Original Parcels Registered with Submission 98 ===");
    // Let's check rsbsa_farm_parcels rows that mention Jada Steele Nash or submission_id = 98 in the past
    const parcelRes = await pool.query(`
      SELECT 
        id,
        submission_id,
        parcel_number,
        ownership_type_registered_owner,
        ownership_type_tenant,
        ownership_type_lessee,
        tenant_land_owner_id,
        tenant_land_owner_name,
        is_current_owner,
        created_at
      FROM rsbsa_farm_parcels
      WHERE submission_id = 98 OR parcel_number LIKE 'Parcel-98-%'
      ORDER BY created_at ASC
    `);
    console.log(parcelRes.rows);

  } catch (err) {
    console.error("Error tracing history:", err);
  } finally {
    await pool.end();
  }
}

main();
