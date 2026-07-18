const pg = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', '.env')));
const connectionString = envConfig.SUPABASE_DB_URL;

const { Pool } = pg;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Altering rsbsa_submission table to add profile_picture column...');
    await client.query(`
      ALTER TABLE public.rsbsa_submission 
      ADD COLUMN IF NOT EXISTS profile_picture TEXT;
    `);
    console.log('✅ Column profile_picture successfully added/verified.');

    console.log('Reading updated SQL file for register_farmer_with_parcels...');
    const sql = fs.readFileSync(path.join(__dirname, 'register_farmer_with_parcels.sql'), 'utf8');

    console.log('Deploying register_farmer_with_parcels function update to Supabase...');
    await client.query(sql);
    console.log('✅ SQL function successfully updated in Supabase!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
