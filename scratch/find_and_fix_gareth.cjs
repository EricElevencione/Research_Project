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
    console.log("Searching for Gareth...");
    const resSub = await client.query(`
      SELECT id, "FIRST NAME", "LAST NAME", "MIDDLE NAME"
      FROM rsbsa_submission
      WHERE "LAST NAME" ILIKE '%Gareth%' OR "FIRST NAME" ILIKE '%Gareth%'
    `);

    if (resSub.rows.length === 0) {
      console.log("No submission found matching Gareth.");
      return;
    }

    const gareth = resSub.rows[0];
    console.log("Found Gareth record:", gareth);

    console.log("Checking farm parcels for submission ID:", gareth.id);
    const resParcels = await client.query(`
      SELECT id, parcel_number, ownership_type_registered_owner, is_cultivating, is_farming
      FROM rsbsa_farm_parcels
      WHERE submission_id = $1
    `, [gareth.id]);

    console.log("Current parcels:", resParcels.rows);

    if (resParcels.rows.length > 0) {
      console.log("Updating parcels to is_cultivating = false and is_farming = false...");
      const updateResult = await client.query(`
        UPDATE rsbsa_farm_parcels
        SET is_cultivating = false, is_farming = false
        WHERE submission_id = $1
      `, [gareth.id]);
      console.log("Update result:", updateResult.rowCount, "parcels updated.");
    } else {
      console.log("No farm parcels found to update.");
    }

    // Double check the result
    const checkParcels = await client.query(`
      SELECT id, parcel_number, ownership_type_registered_owner, is_cultivating, is_farming
      FROM rsbsa_farm_parcels
      WHERE submission_id = $1
    `, [gareth.id]);
    console.log("Updated parcels details:", checkParcels.rows);

  } catch (err) {
    console.error("Database operation failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
