const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const sub = await pool.query(`
      SELECT *
      FROM rsbsa_submission
      WHERE id = 81
    `);
    console.log("=== Submission for Memphis (81) ===");
    console.log(sub.rows[0]);

    const parcels = await pool.query(`
      SELECT *
      FROM rsbsa_farm_parcels
      WHERE submission_id = 81
    `);
    console.log("\n=== Parcels for Memphis (81) ===");
    console.log(parcels.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
