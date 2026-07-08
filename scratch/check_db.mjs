const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const res = await pool.query(`
      SELECT definition 
      FROM pg_views 
      WHERE viewname = 'farmer_aggregated_unified';
    `);
    if (res.rowCount > 0) {
      console.log('Definition of farmer_aggregated_unified:');
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
