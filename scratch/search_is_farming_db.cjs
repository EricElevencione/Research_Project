const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const res = await pool.query(`
      SELECT routine_name, routine_definition 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_definition LIKE '%is_farming%'
    `);
    console.log("=== Routines referencing is_farming ===");
    for (const r of res.rows) {
      console.log(`- Routine: ${r.routine_name}`);
      console.log(r.routine_definition);
      console.log("-----------------------------------------");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
