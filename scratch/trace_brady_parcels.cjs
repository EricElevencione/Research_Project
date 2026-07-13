const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const subRes = await pool.query(`
      SELECT id,
             "OWNERSHIP_TYPE_REGISTERED_OWNER" AS is_owner,
             "OWNERSHIP_TYPE_TENANT" AS is_tenant,
             "OWNERSHIP_TYPE_LESSEE" AS is_lessee,
             is_actively_farming
      FROM rsbsa_submission
      WHERE id = 102
    `);
    console.log("=== Brady Submission Fields ===");
    console.log(subRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
