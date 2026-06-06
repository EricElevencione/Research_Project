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
    console.log('Querying triggers on land_history...');
    const triggersRes = await client.query(`
      SELECT tgname, proname, nspname
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE tgrelid = 'public.land_history'::regclass
        AND n.nspname = 'public';
    `);
    console.log('Triggers on land_history:');
    for (const row of triggersRes.rows) {
      console.log(`Trigger: ${row.tgname}, Function: ${row.proname}`);
      // Print function definition
      const defRes = await client.query(`SELECT pg_get_functiondef($1::regproc) as def`, [`public.${row.proname}`]);
      console.log('--- DEFINITION ---');
      console.log(defRes.rows[0]?.def);
      console.log('------------------\n');
    }

    console.log('Querying triggers on rsbsa_farm_parcels...');
    const parcelsTriggersRes = await client.query(`
      SELECT tgname, proname, nspname
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE tgrelid = 'public.rsbsa_farm_parcels'::regclass
        AND n.nspname = 'public';
    `);
    console.log('Triggers on rsbsa_farm_parcels:');
    for (const row of parcelsTriggersRes.rows) {
      console.log(`Trigger: ${row.tgname}, Function: ${row.proname}`);
      // Print function definition
      const defRes = await client.query(`SELECT pg_get_functiondef($1::regproc) as def`, [`public.${row.proname}`]);
      console.log('--- DEFINITION ---');
      console.log(defRes.rows[0]?.def);
      console.log('------------------\n');
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
