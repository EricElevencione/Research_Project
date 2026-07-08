const { Pool } = require('pg');

const envConfig = require('dotenv').config({ path: 'backend/.env' }).parsed;
const pool = new Pool({
  connectionString: envConfig.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT tgname, proname, nspname
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE tgrelid = 'public.rsbsa_submission'::regclass
        AND n.nspname = 'public';
    `);
    console.log('Triggers on rsbsa_submission:');
    for (const row of res.rows) {
      console.log(`Trigger: ${row.tgname}, Function: ${row.proname}`);
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
})().catch(console.error);
