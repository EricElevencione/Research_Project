const { Pool } = require('pg');
const fs = require('fs');

const envConfig = require('dotenv').config({ path: 'backend/.env' }).parsed;
const pool = new Pool({
  connectionString: envConfig.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('1. Updating Submission 87 properties...');
    await client.query(`
      UPDATE rsbsa_submission
      SET status = 'Active Farmer',
          "MAIN LIVELIHOOD" = 'farmer',
          is_actively_farming = TRUE,
          archived_at = NULL,
          archive_reason = NULL,
          updated_at = NOW()
      WHERE id = 87
    `);

    console.log('2. Deleting duplicate parcels for Submission 88...');
    await client.query(`
      DELETE FROM rsbsa_farm_parcels
      WHERE submission_id = 88 AND id IN (121, 122)
    `);

    console.log('3. Restoring original parcels for Submission 87...');
    await client.query(`
      UPDATE rsbsa_farm_parcels
      SET is_current_owner = TRUE,
          is_cultivating = TRUE,
          cultivator_submission_id = 87,
          updated_at = NOW()
      WHERE submission_id = 87 AND id IN (119, 120)
    `);

    console.log('4. Deleting duplicate land history records for Submission 88...');
    await client.query(`
      DELETE FROM land_history
      WHERE farmer_id = 88 AND id IN (145, 146)
    `);

    console.log('5. Restoring land history records for Submission 87...');
    await client.query(`
      UPDATE land_history
      SET is_current = TRUE,
          period_end_date = NULL,
          updated_at = NOW()
      WHERE farmer_id = 87 AND id IN (143, 144)
    `);

    console.log('6. Deleting duplicate Submission 88...');
    await client.query(`
      DELETE FROM rsbsa_submission
      WHERE id = 88
    `);

    await client.query('COMMIT');
    console.log('✅ Cleanup successful! Damien Clark Shleton duplicate merged.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Cleanup failed, rolled back changes:', err);
  } finally {
    client.release();
    await pool.end();
  }
})();
