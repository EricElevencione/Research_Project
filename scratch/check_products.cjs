const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres'
});

async function main() {
  const seeds = await pool.query('SELECT id, name FROM shortages_seeds');
  console.log('SEEDS:', seeds.rows);
  
  const ferts = await pool.query('SELECT id, name FROM shortages_fertilizers');
  console.log('FERTS:', ferts.rows);
  
  pool.end();
}
main();
