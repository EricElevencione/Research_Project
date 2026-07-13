const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const triggerRes = await pool.query(`
      SELECT tgname, pg_get_triggerdef(oid) as def
      FROM pg_trigger
      WHERE tgrelid = 'rsbsa_farm_parcels'::regclass
    `);
    console.log("=== Triggers on rsbsa_farm_parcels ===");
    for (const row of triggerRes.rows) {
      console.log(`- ${row.tgname}: ${row.def}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
