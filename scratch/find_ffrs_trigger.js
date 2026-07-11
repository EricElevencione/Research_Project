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
    console.log('--- Checking for triggers on rsbsa_submission table ---');
    const resTriggers = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'rsbsa_submission';
    `);
    console.log('Triggers:');
    resTriggers.rows.forEach(r => console.log(JSON.stringify(r, null, 2)));

    console.log('\n--- Checking database functions containing ffrs_code ---');
    const resFuncs = await client.query(`
      SELECT routine_name, routine_definition
      FROM information_schema.routines
      WHERE routine_schema = 'public' 
        AND routine_definition ILIKE '%ffrs_code%' OR routine_definition ILIKE '%ffrs%';
    `);
    console.log(`Found ${resFuncs.rows.length} matching functions:`);
    resFuncs.rows.forEach(r => console.log(r.routine_name));

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
