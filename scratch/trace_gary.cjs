const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== 1. Searching for Gary Ches Kasparov in submissions ===");
    const gary = await pool.query(`
      SELECT id, "FIRST NAME" AS first_name, "MIDDLE NAME" AS middle_name, "LAST NAME" AS last_name, status
      FROM rsbsa_submission
      WHERE lower(concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME")) LIKE '%kasparov%'
    `);
    console.log(gary.rows);

    console.log("\n=== 2. Checking parcel 78 ===");
    const parcel = await pool.query(`
      SELECT *
      FROM rsbsa_farm_parcels
      WHERE id = 78
    `);
    console.log(parcel.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
