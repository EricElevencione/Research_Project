const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const res = await pool.query(`
      SELECT id,
             "FIRST NAME" AS first_name,
             "LAST NAME" AS last_name,
             "FARMER_RICE",
             status,
             "MAIN LIVELIHOOD",
             "OWNERSHIP_TYPE_REGISTERED_OWNER" AS is_owner,
             "OWNERSHIP_TYPE_TENANT" AS is_tenant,
             "OWNERSHIP_TYPE_LESSEE" AS is_lessee
      FROM rsbsa_submission
      WHERE id = 81
    `);
    console.log("Database Row:", res.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
