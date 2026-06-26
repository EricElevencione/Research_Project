import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
    console.log('Reading updated SQL file...');
    const sql = fs.readFileSync('scratch/register_farmer_with_parcels.sql', 'utf8');

    console.log('Deploying register_farmer_with_parcels function update to Supabase...');
    await client.query(sql);
    console.log('✅ SQL function successfully updated in Supabase!');
  } catch (err) {
    console.error('❌ Deployment failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
