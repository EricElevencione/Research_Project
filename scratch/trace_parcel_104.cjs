const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const res = await pool.query(`
      SELECT id, submission_id, parcel_number, tenant_land_owner_name, tenant_land_owner_id
      FROM rsbsa_farm_parcels
      WHERE ownership_type_tenant = true 
        AND tenant_land_owner_id IS NULL 
        AND tenant_land_owner_name IS NOT NULL 
        AND tenant_land_owner_name != ''
    `);
    console.log("=== Matching parcels ===");
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
