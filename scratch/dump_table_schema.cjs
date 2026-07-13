const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const colRes = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'rsbsa_farm_parcels'
        AND column_name IN ('is_cultivating', 'is_farming')
    `);
    console.log("=== rsbsa_farm_parcels column schemas ===");
    console.log(colRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
