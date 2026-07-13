const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const defRes = await pool.query(`
      SELECT pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'update_tenant_lessee_landowner_affiliation_no_review'
        AND n.nspname = 'public';
    `);
    
    if (defRes.rows.length === 0) {
      console.log('Function not found!');
    } else {
      console.log('=== update_tenant_lessee_landowner_affiliation_no_review ===');
      console.log(defRes.rows[0].def);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
