const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const res = await pool.query(`
      SELECT definition 
      FROM pg_views 
      WHERE viewname = 'unified_parcels';
    `);
    if (res.rowCount > 0) {
      console.log('Definition of unified_parcels:');
      console.log(res.rows[0].definition);
    } else {
      console.log('View not found in pg_views');
    }
  } catch (err) {
    console.error('Error querying pg_views:', err);
  } finally {
    await pool.end();
  }
}

main();
