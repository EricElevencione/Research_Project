const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const res = await pool.query(`
      SELECT 
        c.relname as table_name,
        t.tgname as trigger_name,
        p.proname as function_name
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE n.nspname = 'public'
        AND c.relname IN ('rsbsa_submission', 'rsbsa_farm_parcels', 'land_history')
      ORDER BY table_name, trigger_name;
    `);
    console.log(res.rows);

    const funcs = [
      'sync_farmer_no_parcels_status',
      'sync_farmer_status'
    ];
    for (const f of funcs) {
      console.log(`=== Function: ${f} ===`);
      const defRes = await pool.query(`
        SELECT pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        WHERE p.proname = $1
      `, [f]);
      if (defRes.rowCount > 0) {
        console.log(defRes.rows[0].definition);
      } else {
        console.log('Not found');
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
