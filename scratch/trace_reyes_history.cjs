const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const res = await pool.query(`
      SELECT id, farm_parcel_id, parcel_number, is_tenant, is_lessee, is_current, period_end_date
      FROM land_history
      WHERE farmer_id = 37
    `);
    console.log("=== Land History for Christian Reyes (37) ===");
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
