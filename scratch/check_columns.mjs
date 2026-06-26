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
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'rsbsa_farm_parcels' 
      ORDER BY ordinal_position;
    `);
    console.log('Columns of rsbsa_farm_parcels:');
    for (const row of res.rows) {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
