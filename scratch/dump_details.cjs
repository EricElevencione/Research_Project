const { Pool } = require('pg');
const fs = require('fs');

const envConfig = require('dotenv').config({ path: 'backend/.env' }).parsed;
const pool = new Pool({
  connectionString: envConfig.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const s87 = await pool.query('SELECT * FROM rsbsa_submission WHERE id = 87');
  const s88 = await pool.query('SELECT * FROM rsbsa_submission WHERE id = 88');
  console.log("SUBMISSION 87:\n", JSON.stringify(s87.rows[0], null, 2));
  console.log("SUBMISSION 88:\n", JSON.stringify(s88.rows[0], null, 2));
  await pool.end();
})().catch(console.error);
