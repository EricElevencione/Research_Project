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
    console.log('Fetching all public tables in Supabase...');
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    console.log('Tables:', tablesRes.rows.map(r => r.table_name));

    console.log('\nSearching for any text matching "Eric" or "Elevencione" in ALL tables...');
    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      // Get text columns for this table
      const colsRes = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1;
      `, [tableName]);
      
      const textCols = colsRes.rows
        .filter(c => ['character varying', 'text', 'json', 'jsonb'].includes(c.data_type))
        .map(c => c.column_name);
        
      if (textCols.length === 0) continue;
      
      const orClauses = textCols.map(col => `CAST("${col}" AS TEXT) ILIKE '%Eric%' OR CAST("${col}" AS TEXT) ILIKE '%Elevencione%'`).join(' OR ');
      try {
        const searchRes = await client.query(`
          SELECT * FROM "${tableName}" WHERE ${orClauses} LIMIT 5;
        `);
        if (searchRes.rows.length > 0) {
          console.log(`\nTable "${tableName}" matches:`);
          searchRes.rows.forEach(r => {
            console.log(JSON.stringify(r));
          });
        }
      } catch (err) {
        // Skip tables that fail (e.g. partition templates or postgis tables if any)
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
