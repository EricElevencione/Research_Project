const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const res = await pool.query(`
      SELECT id, submission_id, parcel_number, lessee_land_owner_id, lessee_land_owner_name
      FROM rsbsa_farm_parcels
      WHERE id = 78;
    `);
    console.log(res.rows[0]);
  } catch (err) {
    console.error("Error:", err.message || err);
  } finally {
    await pool.end();
  }
}

main();
