const pg = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const connectionString = envConfig.SUPABASE_DB_URL;

const client = new pg.Client({ connectionString });

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT id, "FIRST NAME", "MIDDLE NAME", "LAST NAME", "BARANGAY", "FFRS_CODE"
    FROM rsbsa_submission
    WHERE "FIRST NAME" ILIKE '%Axel%' OR "LAST NAME" ILIKE '%Axel%' OR "MIDDLE NAME" ILIKE '%Axel%';
  `);
  
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
