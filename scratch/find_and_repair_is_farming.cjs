const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== Scanning for owned/cultivated parcels that are incorrectly marked is_farming = false ===");
    const res = await pool.query(`
      SELECT id, submission_id, parcel_number, ownership_type_registered_owner, is_cultivating, is_farming
      FROM rsbsa_farm_parcels
      WHERE ownership_type_registered_owner = true
        AND is_cultivating = true
        AND (is_current_owner IS NULL OR is_current_owner = true)
        AND is_farming = false
    `);
    console.log(`Found ${res.rowCount} parcels.`);
    
    if (res.rowCount > 0) {
      console.log("Details:", res.rows);
      console.log("\n=== Repairing these parcels to is_farming = true ===");
      const repairRes = await pool.query(`
        UPDATE rsbsa_farm_parcels
        SET is_farming = true
        WHERE ownership_type_registered_owner = true
          AND is_cultivating = true
          AND (is_current_owner IS NULL OR is_current_owner = true)
          AND is_farming = false
        RETURNING id, submission_id, parcel_number
      `);
      console.log("Repaired parcels:", repairRes.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
