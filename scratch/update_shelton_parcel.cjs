const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), 'backend/.env') });

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const submissionId = '87';

  const cols = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rsbsa_farm_parcels'
      AND column_name IN ('is_cultivating', 'is_farming', 'cultivation_status_reason')
  `);
  const existingColumns = new Set(cols.rows.map((row) => row.column_name));

  const parcels = await pool.query(
    `SELECT id, parcel_number, is_cultivating, is_farming
     FROM rsbsa_farm_parcels
     WHERE submission_id = $1
     ORDER BY id`,
    [submissionId],
  );

  console.log(JSON.stringify(parcels.rows, null, 2));

  if (parcels.rows.length === 0) {
    console.log('No parcels found for submission 87');
    await pool.end();
    return;
  }

  for (const parcel of parcels.rows) {
    const updates = [];
    const values = [];

    if (existingColumns.has('is_cultivating')) {
      updates.push('is_cultivating = $1');
      values.push(false);
    }

    if (existingColumns.has('is_farming')) {
      updates.push('is_farming = $2');
      values.push(false);
    }

    if (existingColumns.has('cultivation_status_reason')) {
      updates.push('cultivation_status_reason = $3');
      values.push('Updated to land-owner only via admin correction');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(parcel.id);

    const query = `UPDATE rsbsa_farm_parcels SET ${updates.join(', ')} WHERE id = $${values.length}`;
    await pool.query(query, values);
    console.log(`Updated parcel ${parcel.id}`);
  }

  await pool.end();
})();
