const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== 1. Scanning for deactivated parcels with active history records ===");
    const res = await pool.query(`
      SELECT lh.id AS history_id, lh.farmer_id, lh.farm_parcel_id, lh.parcel_number,
             fp.is_current_owner
      FROM land_history lh
      JOIN rsbsa_farm_parcels fp ON lh.farm_parcel_id = fp.id
      WHERE fp.is_current_owner = false AND lh.is_current = true
    `);
    console.log(`Found ${res.rowCount} legacy mismatches.`);
    
    if (res.rowCount > 0) {
      console.log("Mismatches:", res.rows);
      
      console.log("\n=== 2. Repairing history records to is_current = false ===");
      const repairRes = await pool.query(`
        UPDATE land_history lh
        SET is_current = false,
            period_end_date = CURRENT_DATE,
            updated_at = NOW()
        FROM rsbsa_farm_parcels fp
        WHERE lh.farm_parcel_id = fp.id
          AND fp.is_current_owner = false
          AND lh.is_current = true
        RETURNING lh.id, lh.farmer_id
      `);
      console.log("Repaired history records:", repairRes.rows);

      console.log("\n=== 3. Re-synchronizing affected farmer statuses ===");
      const affectedFarmerIds = [...new Set(repairRes.rows.map(r => r.farmer_id))];
      for (const farmerId of affectedFarmerIds) {
        await pool.query("SELECT public.sync_farmer_no_parcels_status($1)", [farmerId]);
        console.log(`Synchronized status for farmer ID ${farmerId}`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
