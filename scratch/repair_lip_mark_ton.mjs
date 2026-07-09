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
    // Lip Mark Ton = farmer_id 93
    // Old parcel: rsbsa_farm_parcels id=128 (Parcel-56-1 under Marvin, id=56)
    // Old land_history: id=152

    console.log('=== DATA REPAIR: Lip Mark Ton (farmer_id=93) ===\n');

    // Step 1: Verify current state before repair
    console.log('--- BEFORE repair ---');
    const beforeParcels = await client.query(
      `SELECT id, parcel_number, tenant_land_owner_name, tenant_land_owner_id
       FROM rsbsa_farm_parcels WHERE submission_id = 93 ORDER BY id`
    );
    console.log('Parcels:', beforeParcels.rows);

    const beforeHistory = await client.query(
      `SELECT id, parcel_number, land_owner_name, is_current, change_type
       FROM land_history WHERE farmer_id = 93 ORDER BY id`
    );
    console.log('History:', beforeHistory.rows);

    // Step 2: Mark land_history #152 as not current
    console.log('\n--- Marking land_history #152 as not current ---');
    const historyUpdate = await client.query(
      `UPDATE land_history
       SET is_current = false,
           period_end_date = CURRENT_DATE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = 152 AND farmer_id = 93 AND is_current = true
       RETURNING id, parcel_number, is_current`
    );
    console.log('Updated history rows:', historyUpdate.rows);

    // Step 3: Delete old parcel (id=128) from rsbsa_farm_parcels
    console.log('\n--- Deleting rsbsa_farm_parcels id=128 ---');
    const parcelDelete = await client.query(
      `DELETE FROM rsbsa_farm_parcels
       WHERE id = 128 AND submission_id = 93 AND tenant_land_owner_id = 56
       RETURNING id, parcel_number, tenant_land_owner_name`
    );
    console.log('Deleted parcels:', parcelDelete.rows);

    // Step 4: Verify after repair
    console.log('\n--- AFTER repair ---');
    const afterParcels = await client.query(
      `SELECT id, parcel_number, tenant_land_owner_name, tenant_land_owner_id
       FROM rsbsa_farm_parcels WHERE submission_id = 93 ORDER BY id`
    );
    console.log('Parcels:', afterParcels.rows);

    const afterHistory = await client.query(
      `SELECT id, parcel_number, land_owner_name, is_current, change_type
       FROM land_history WHERE farmer_id = 93 ORDER BY id`
    );
    console.log('History:', afterHistory.rows);

    // Step 5: Also verify Marvin still has his owner parcel
    console.log('\n--- Marvin (id=56) parcels ---');
    const marvinParcels = await client.query(
      `SELECT id, parcel_number, ownership_type_registered_owner
       FROM rsbsa_farm_parcels WHERE submission_id = 56 ORDER BY id`
    );
    console.log('Marvin parcels:', marvinParcels.rows);

    // Step 6: Also verify Jada's state
    console.log('\n--- Jada (id=98) parcels ---');
    const jadaParcels = await client.query(
      `SELECT id, parcel_number, ownership_type_registered_owner, ownership_type_tenant, tenant_land_owner_name
       FROM rsbsa_farm_parcels WHERE submission_id = 98 ORDER BY id`
    );
    console.log('Jada parcels:', jadaParcels.rows);

    console.log('\n=== REPAIR COMPLETE ===');
  } catch (err) {
    console.error('REPAIR FAILED:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
