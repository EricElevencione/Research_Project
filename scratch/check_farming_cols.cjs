const { Pool } = require('pg');

const envConfig = require('dotenv').config({ path: 'backend/.env' }).parsed;
const pool = new Pool({
  connectionString: envConfig.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const parcels = await pool.query(
    'SELECT id, submission_id, parcel_number, is_cultivating, is_farming, cultivator_submission_id, cultivation_status_reason, farming_status_reason FROM rsbsa_farm_parcels WHERE submission_id = 87'
  );
  console.log("PARCELS for submission 87:");
  console.log(JSON.stringify(parcels.rows, null, 2));
  await pool.end();
})().catch(console.error);
