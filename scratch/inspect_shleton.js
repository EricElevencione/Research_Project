const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envConfig = dotenv.parse(fs.readFileSync('backend/.env'));
const pool = new Pool({
  connectionString: envConfig.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const submissions = await pool.query(
    'SELECT id, "LAST NAME", "FIRST NAME", status, "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE" FROM rsbsa_submission WHERE id IN (87, 88)'
  );
  console.log("SUBMISSIONS:\n", JSON.stringify(submissions.rows, null, 2));

  const parcels = await pool.query(
    'SELECT id, submission_id, parcel_number, total_farm_area_ha, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, is_current_owner, is_cultivating, cultivator_submission_id, tenant_land_owner_id, tenant_land_owner_name FROM rsbsa_farm_parcels WHERE submission_id IN (87, 88) OR cultivator_submission_id IN (87, 88)'
  );
  console.log("FARM PARCELS:\n", JSON.stringify(parcels.rows, null, 2));

  const history = await pool.query(
    'SELECT id, land_parcel_id, farm_parcel_id, farmer_id, farmer_name, land_owner_id, land_owner_name, parcel_number, is_registered_owner, is_tenant, is_lessee, is_current, change_type, change_reason FROM land_history WHERE farmer_id IN (87, 88) OR land_owner_id IN (87, 88)'
  );
  console.log("LAND HISTORY:\n", JSON.stringify(history.rows, null, 2));

  await pool.end();
})().catch(console.error);
