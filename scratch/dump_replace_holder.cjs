const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const res = await pool.query(`
      SELECT pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'replace_tenant_lessee_holder_with_portions_no_review'
        AND n.nspname = 'public';
    `);
    if (res.rowCount > 0) {
      console.log(res.rows[0].def);
    } else {
      console.log('Function not found!');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
