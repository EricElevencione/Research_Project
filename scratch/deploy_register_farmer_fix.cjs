const fs = require("fs");
const path = require("path");
const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== 1. Reading register_farmer_with_parcels.sql ===");
    const sqlPath = path.join(__dirname, "register_farmer_with_parcels.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("=== 2. Deploying register_farmer_with_parcels function to DB ===");
    await pool.query(sql);
    console.log("Successfully deployed register_farmer_with_parcels!");

    console.log("\n=== 3. Repairing Brady's owned parcels is_farming status ===");
    // If a parcel is owned and cultivated by the owner, is_farming should be true.
    const repairResult = await pool.query(`
      UPDATE rsbsa_farm_parcels
      SET is_farming = true
      WHERE id IN (147, 148)
      RETURNING id, parcel_number, is_farming, is_cultivating
    `);
    console.log("Repaired parcels:", repairResult.rows);

  } catch (err) {
    console.error("❌ Deployment/Repair failed:", err);
  } finally {
    await pool.end();
  }
}

main();
