const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const res = await pool.query(`
      SELECT id, "FIRST NAME", "LAST NAME", "FFRS_CODE"
      FROM rsbsa_submission
      WHERE "LAST NAME" = 'Satorio'
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
