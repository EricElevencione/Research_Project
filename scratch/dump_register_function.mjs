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
    console.log('Querying function definition for register_farmer_with_parcels...');
    const defRes = await client.query(`
      SELECT pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'register_farmer_with_parcels'
        AND n.nspname = 'public';
    `);
    
    if (defRes.rows.length === 0) {
      console.log('Function not found!');
    } else {
      fs.writeFileSync('scratch/register_farmer_with_parcels.sql', defRes.rows[0].def);
      console.log('Saved definition to scratch/register_farmer_with_parcels.sql');
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
