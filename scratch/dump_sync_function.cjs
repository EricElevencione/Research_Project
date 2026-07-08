const { Pool } = require('pg');
const fs = require('fs');

const envConfig = require('dotenv').config({ path: 'backend/.env' }).parsed;
const pool = new Pool({
  connectionString: envConfig.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const defRes = await pool.query(`
    SELECT pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'sync_farmer_no_parcels_status'
      AND n.nspname = 'public';
  `);
  
  if (defRes.rows.length === 0) {
    console.log('Function not found!');
  } else {
    console.log(defRes.rows[0].def);
  }
  await pool.end();
})().catch(console.error);
