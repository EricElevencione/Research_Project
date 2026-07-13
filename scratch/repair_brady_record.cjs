const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== 1. Repairing rsbsa_farm_parcels for Brady (ID: 102) ===");
    const parcelResult = await pool.query(`
      UPDATE rsbsa_farm_parcels
      SET tenant_land_owner_id = 97
      WHERE id = 149
      RETURNING id, tenant_land_owner_id, tenant_land_owner_name
    `);
    console.log("Updated parcel:", parcelResult.rows);

    console.log("\n=== 2. Repairing land_history for Brady (ID: 102) ===");
    const historyResult = await pool.query(`
      UPDATE land_history
      SET land_owner_id = 97
      WHERE id = 180
      RETURNING id, land_owner_id, land_owner_name
    `);
    console.log("Updated history:", historyResult.rows);

    console.log("\n=== 3. Running sync status function ===");
    await pool.query("SELECT public.sync_farmer_no_parcels_status(97)");
    await pool.query("SELECT public.sync_farmer_no_parcels_status(102)");
    console.log("Sync status completed!");

  } catch (err) {
    console.error("❌ Repair failed:", err);
  } finally {
    await pool.end();
  }
}

main();
