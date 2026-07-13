const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== rsbsa_submission for Jada (98) ===");
    const sub = await pool.query(`
      SELECT id,
             "FIRST NAME", "MIDDLE NAME", "LAST NAME", "EXT NAME",
             status, created_at, submitted_at,
             "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE"
      FROM rsbsa_submission
      WHERE id = 98
    `);
    console.log(sub.rows);

    console.log("\n=== land_history records for farmer_id = 98 (Jada) ===");
    const hist = await pool.query(`
      SELECT id, land_parcel_id, farm_parcel_id, parcel_number, land_owner_name,
             is_registered_owner, is_tenant, is_lessee, change_type, change_reason,
             period_start_date, period_end_date, created_at, updated_at
      FROM land_history
      WHERE farmer_id = 98
      ORDER BY created_at ASC
    `);
    console.log(hist.rows);

    console.log("\n=== audit_logs matching Jada (98) ===");
    const audit = await pool.query(`
      SELECT id, action, module, table_name, record_id, description, created_at
      FROM audit_logs
      WHERE record_id = '98' OR description LIKE '%Jada%' OR description LIKE '%98%'
      ORDER BY created_at ASC
    `);
    console.log(audit.rows);

  } catch (err) {
    console.error("Error tracing Jada:", err);
  } finally {
    await pool.end();
  }
}

main();
