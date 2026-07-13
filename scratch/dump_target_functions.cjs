const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const funcs = [
      'replace_tenant_lessee_holder_with_portions_no_review',
      'update_tenant_lessee_landowner_affiliation_no_review'
    ];

    for (const f of funcs) {
      console.log(`=== Function: ${f} ===`);
      const res = await pool.query(`
        SELECT pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = $1
          AND n.nspname = 'public'
      `, [f]);
      
      if (res.rowCount > 0) {
        res.rows.forEach((row, i) => {
          console.log(`Definition ${i + 1}:`);
          console.log(row.definition);
        });
      } else {
        console.log('Function not found.');
      }
      console.log("\n");
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
